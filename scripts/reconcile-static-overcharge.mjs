#!/usr/bin/env node
import readline from 'node:readline/promises';
import process from 'node:process';

const orders = process.argv.filter((arg) => arg.startsWith('STA'));
const targetOrders = orders.length ? orders : [
  'STA202610162022110edup6',
  'STA2026101620235981fayg',
];
const apply = process.argv.includes('--apply');
const baseUrl = process.env.BACKEND_BASE_URL;
const user = process.env.BACKEND_USER_USERNAME;
const password = process.env.BACKEND_USER_PASSWORD;
const adminUser = process.env.BACKEND_ADMIN_USERNAME;
const adminPassword = process.env.BACKEND_ADMIN_PASSWORD;
const expectedCny = Number(process.env.EXPECTED_STATIC_PRICE_CNY ?? 5);

if (!baseUrl || !user || !password) {
  throw new Error('Set BACKEND_BASE_URL, BACKEND_USER_USERNAME and BACKEND_USER_PASSWORD');
}

async function api(path, token, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const body = await response.json();
  if (!response.ok || (typeof body.code === 'number' && ![0, 200].includes(body.code))) {
    throw new Error(String(body.message ?? body.msg ?? `HTTP ${response.status}`));
  }
  return body.data;
}

async function login(username, loginPassword) {
  const data = await api('/api/auth/login', undefined, {
    method: 'POST',
    body: JSON.stringify({ username, password: loginPassword }),
  });
  return data.token;
}

const userToken = await login(user, password);
const report = [];
for (const orderNo of targetOrders) {
  const data = await api(`/api/open/app/user/transactions?${new URLSearchParams({ order_no: orderNo, page: '1', page_size: '50' })}`, userToken);
  const items = data.items ?? data.list ?? [];
  const debit = items.find((item) => String(item.order_no ?? item.orderNo) === orderNo && Number(item.amount) < 0);
  const duplicateRefund = items.find((item) => Number(item.amount) > 0 && String(item.remark ?? '').includes(`NexaLayer price correction ${orderNo}`));
  const actualCny = debit ? Math.abs(Number(debit.amount)) : null;
  report.push({
    order_no: orderNo,
    user_id: debit?.user_id ?? debit?.userId ?? null,
    actual_debit_cny: actualCny,
    expected_cny: expectedCny,
    proposed_refund_cny: actualCny === null ? null : Math.max(0, Math.round((actualCny - expectedCny) * 100) / 100),
    already_refunded: Boolean(duplicateRefund),
  });
}
console.table(report);

if (!apply) {
  console.log('Read-only reconciliation complete. Re-run with --apply for interactive, per-order confirmation.');
  process.exit(0);
}
if (!process.stdin.isTTY || !adminUser || !adminPassword) {
  throw new Error('--apply requires an interactive terminal plus BACKEND_ADMIN_USERNAME and BACKEND_ADMIN_PASSWORD');
}
const adminToken = await login(adminUser, adminPassword);
const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
for (const item of report) {
  if (!item.user_id || !item.proposed_refund_cny || item.already_refunded) continue;
  const phrase = `REFUND ${item.order_no} ${item.proposed_refund_cny}`;
  const answer = await prompt.question(`Type exactly "${phrase}" to refund CNY ${item.proposed_refund_cny}: `);
  if (answer !== phrase) continue;
  await api(`/api/open/app/agent/sub-users/${item.user_id}/balance`, adminToken, {
    method: 'POST',
    body: JSON.stringify({ amount: item.proposed_refund_cny, remark: `NexaLayer price correction ${item.order_no}` }),
  });
  console.log(`Refunded ${item.order_no}`);
}
prompt.close();
