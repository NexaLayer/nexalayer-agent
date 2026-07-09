import { env } from '../../config/env';

export type Lang = 'zh' | 'en';

export const DEFAULT_PAGE_SIZE = 20;

export interface ExecResult {
  message: string;
  data?: Record<string, unknown>;
  suggestions?: string[];
}

export function t(
  lang: Lang,
  zh: string,
  en: string
): string {
  return lang === 'zh' ? zh : en;
}

export async function backendGet(
  path: string,
  token: string
): Promise<unknown> {
  const res = await fetch(
    `${env.BACKEND_BASE_URL}${path}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return res.json();
}

export async function backendPost(
  path: string,
  body: unknown,
  token: string
): Promise<unknown> {
  const res = await fetch(
    `${env.BACKEND_BASE_URL}${path}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );
  return res.json();
}

let cachedAdminToken: string | null = null;
let adminTokenExpiry = 0;

export async function getAdminToken(): Promise<string> {
  if (
    cachedAdminToken &&
    Date.now() < adminTokenExpiry
  ) {
    return cachedAdminToken;
  }
  const res = await fetch(
    `${env.BACKEND_BASE_URL}/api/auth/login`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: env.BACKEND_ADMIN_USERNAME,
        password: env.BACKEND_ADMIN_PASSWORD,
      }),
    }
  );
  const json = (await res.json()) as {
    code: number;
    data?: { token?: string };
  };
  if (json.code !== 0 || !json.data?.token) {
    throw new Error('Admin login failed');
  }
  cachedAdminToken = json.data.token;
  adminTokenExpiry = Date.now() + 30 * 60 * 1000;
  return cachedAdminToken;
}

export interface FoundUser {
  id: number;
  username: string;
  email?: string;
  is_agent?: boolean;
  is_admin?: boolean;
  balance?: number;
  agent_id?: number | null;
}

type UserListRes = {
  code: number;
  data?: { list?: FoundUser[] };
};

function matchExact(
  list: FoundUser[],
  keyword: string
): FoundUser | undefined {
  const kw = keyword.toLowerCase();
  return (
    list.find(
      (u) => u.username?.toLowerCase() === kw
    ) ??
    list.find(
      (u) => u.email?.toLowerCase() === kw
    )
  );
}

export async function findUserAcrossRoles(
  keyword: string,
  token: string
): Promise<FoundUser | null> {
  const q = encodeURIComponent(keyword);
  const roles = [undefined, 'agent', 'admin'];
  let fallback: FoundUser | null = null;

  for (const role of roles) {
    const roleParam = role
      ? `&role=${role}`
      : '';
    const res = (await backendGet(
      `/api/open/app/users/list?search=${q}&pageSize=5${roleParam}`,
      token
    )) as UserListRes;

    const list = res.data?.list ?? [];
    if (list.length === 0) continue;

    const exact = matchExact(list, keyword);
    if (exact) return exact;

    if (!fallback) fallback = list[0];
  }

  return fallback;
}

export function randomString(len: number): string {
  const chars =
    'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out +=
      chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function randomPassword(): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '#$!@%&';
  const pick = (s: string) =>
    s[Math.floor(Math.random() * s.length)];
  let pwd =
    pick(upper) +
    pick(lower) +
    pick(digits) +
    pick(special);
  const all = upper + lower + digits + special;
  for (let i = pwd.length; i < 12; i++) {
    pwd += pick(all);
  }
  return pwd
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

export function fmtNum(n: unknown): string {
  if (typeof n === 'number') {
    return n.toLocaleString('en-US', {
      maximumFractionDigits: 2,
    });
  }
  return String(n ?? 0);
}

export function paginationFooter(
  page: number,
  pageSize: number,
  total: number,
  lang: Lang
): string {
  if (total <= 0) return '';
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  if (lang === 'zh') {
    let footer =
      `\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `当前显示第 ${page} 页` +
      `（第 ${start}-${end} 条），` +
      `共 ${total} 条记录，` +
      `${totalPages} 页。\n`;
    if (totalPages > 1) {
      footer += '可输入：\n';
      if (page < totalPages)
        footer += '- "下一页" / "继续"\n';
      if (page > 1)
        footer += '- "上一页"\n';
      footer += '- "第N页"（如 "第3页"）\n';
      footer += '- "每页20条"\n';
      footer += '- "查看第5条详情"';
    }
    return footer;
  }
  let footer =
    `\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Showing page ${page}` +
    ` (${start}-${end}),` +
    ` ${total} total,` +
    ` ${totalPages} pages.\n`;
  if (totalPages > 1) {
    footer += 'Commands:\n';
    if (page < totalPages)
      footer += '- "next page"\n';
    if (page > 1)
      footer += '- "previous page"\n';
    footer += '- "page N" (e.g. "page 3")\n';
    footer += '- "20 per page"\n';
    footer += '- "view detail 5"';
  }
  return footer;
}
