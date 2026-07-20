import { Prisma } from '@prisma/client';
import { prisma } from '../../app';
import { decrypt } from '../../utils/crypto';
import { AppError } from '../../utils/response';
import { ERROR_CODES } from '../../config/constants';
import * as backend from '../../gateway/backend-client';
import { BackendUsdtOrderResponse } from '../../gateway/types';

const CURRENCY = 'CNY';
const DEFAULT_MIN_RECHARGE_CNY = 10;

export type PricingSnapshot = {
  currency: 'CNY';
  source: 'backend';
  message: string;
};

async function getAgentBackendToken(
  agentId: number
): Promise<string> {
  const agent = await prisma.agentApp.findUnique({
    where: { id: agentId },
  });

  if (
    !agent?.backendUsername ||
    !agent.backendPasswordEnc
  ) {
    throw new AppError(
      ERROR_CODES.BACKEND_ERROR,
      'Backend credentials not configured'
    );
  }

  const password = decrypt(agent.backendPasswordEnc);
  return backend.getUserToken(
    agent.backendUsername,
    password
  );
}

function toNumber(value: unknown): number {
  if (value instanceof Prisma.Decimal) {
    return Number(value.toString());
  }
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return 0;
}

function roundUsd(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export async function getPricing(): Promise<PricingSnapshot> {
  return {
    currency: 'CNY',
    source: 'backend',
    message:
      'Prices are account-specific. Read GET /products for current product prices.',
  };
}

export async function getBalance(agentId: number) {
  const userToken = await getAgentBackendToken(agentId);
  const balance = await backend.getBalance(userToken);

  return {
    cash_balance: balance,
    available_balance: balance,
    currency: 'CNY',
    balance,
    source: 'backend',
    updated_at: new Date().toISOString(),
  };
}

export async function createRecharge(
  agentId: number,
  amountCny: number
) {
  if (amountCny < DEFAULT_MIN_RECHARGE_CNY) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      `Minimum recharge is ${DEFAULT_MIN_RECHARGE_CNY} CNY`,
      {
        minimum_recharge_cny: DEFAULT_MIN_RECHARGE_CNY,
        currency: CURRENCY,
      }
    );
  }

  const userToken =
    await getAgentBackendToken(agentId);
  const order = await backend.createUsdtRechargeOrder(
    userToken,
    amountCny
  );

  await prisma.agentUsageRecord.create({
    data: {
      agentId,
      action: 'recharge_created',
      resourceType: 'billing',
      details: {
        order_id: order.order_id,
        amount_cny: amountCny,
        currency: 'USDT',
      },
    },
  });

  return {
    order_id: order.order_id,
    amount_cny: amountCny,
    amount: amountCny,
    currency: CURRENCY,
    payment_currency: 'USDT',
    status: order.status,
    pay_url: order.pay_url,
    wallet_address: order.wallet_address,
    created_at: new Date().toISOString(),
  };
}

function rechargeAmountCny(
  order: BackendUsdtOrderResponse
) {
  const raw =
    order.confirmed_amount ??
    order.amount_usdt ??
    order.amount_usd ??
    order.amount;
  return roundUsd(Number(raw ?? 0));
}

export async function checkRechargeStatus(
  agentId: number,
  orderId: string
) {
  const userToken =
    await getAgentBackendToken(agentId);
  const order = await backend.checkUsdtOrderStatus(
    userToken,
    orderId
  );

  const amountCny = rechargeAmountCny(order);
  return {
    order_id: order.order_id,
    amount_cny: amountCny,
    amount: amountCny,
    currency: CURRENCY,
    payment_currency: 'USDT',
    status: order.status,
    tx_hash: order.transaction_id,
  };
}

export async function getTransactions(
  agentId: number,
  page: number,
  pageSize: number
) {
  const userToken = await getAgentBackendToken(agentId);
  const result = await backend.getTransactions(userToken, {
    page,
    page_size: pageSize,
  });

  return {
    items: result.items.map((item) => ({
      ...item,
      currency: 'CNY',
      source: 'backend',
    })),
    total: result.total,
    page,
    page_size: pageSize,
  };
}
