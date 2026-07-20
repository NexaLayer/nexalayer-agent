import { Prisma } from '@prisma/client';
import { prisma } from '../../app';
import { decrypt } from '../../utils/crypto';
import { AppError } from '../../utils/response';
import { ERROR_CODES } from '../../config/constants';
import * as backend from '../../gateway/backend-client';
import { BackendUsdtOrderResponse } from '../../gateway/types';

const CURRENCY = 'USD';
const DEFAULT_MIN_RECHARGE_USD = 10;

export type PricingSnapshot = {
  currency: 'USD';
  source: 'backend';
  exchange_rate: number;
  exchange_rate_pair: 'USD/CNY';
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
  return Math.round(value * 100) / 100;
}

function roundCny(value: number): number {
  return Math.round(value * 100) / 100;
}

function effectiveRate(rate: {
  rate: number;
  effective_rate?: number;
}): number {
  const value = Number(rate.effective_rate ?? rate.rate);
  if (!Number.isFinite(value) || value <= 0) {
    throw new AppError(
      ERROR_CODES.BACKEND_ERROR,
      'Backend exchange rate is unavailable'
    );
  }
  return value;
}

export async function getPricing(
  agentId: number
): Promise<PricingSnapshot> {
  const userToken = await getAgentBackendToken(agentId);
  const exchangeRate = effectiveRate(
    await backend.getUsdtRate(userToken)
  );
  return {
    currency: 'USD',
    source: 'backend',
    exchange_rate: exchangeRate,
    exchange_rate_pair: 'USD/CNY',
    message:
      'Prices are account-specific USD conversions of backend CNY prices. Read GET /products for current prices.',
  };
}

export async function getBalance(agentId: number) {
  const userToken = await getAgentBackendToken(agentId);
  const [balanceCny, rate] = await Promise.all([
    backend.getBalance(userToken),
    backend.getUsdtRate(userToken),
  ]);
  const exchangeRate = effectiveRate(rate);
  const balanceUsd = roundUsd(balanceCny / exchangeRate);

  return {
    cash_balance: balanceUsd,
    available_balance: balanceUsd,
    currency: 'USD',
    balance: balanceUsd,
    source: 'backend',
    source_balance_cny: balanceCny,
    exchange_rate: exchangeRate,
    exchange_rate_pair: 'USD/CNY',
    updated_at: new Date().toISOString(),
  };
}

export async function createRecharge(
  agentId: number,
  amountUsd: number
) {
  if (amountUsd < DEFAULT_MIN_RECHARGE_USD) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      `Minimum recharge is ${DEFAULT_MIN_RECHARGE_USD} USD`,
      {
        minimum_recharge_usd: DEFAULT_MIN_RECHARGE_USD,
        currency: CURRENCY,
      }
    );
  }

  const userToken =
    await getAgentBackendToken(agentId);
  const exchangeRate = effectiveRate(
    await backend.getUsdtRate(userToken)
  );
  const amountCny = roundCny(amountUsd * exchangeRate);
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
        amount_usd: amountUsd,
        amount_cny: amountCny,
        currency: 'USDT',
      },
    },
  });

  return {
    order_id: order.order_id,
    amount_usd: amountUsd,
    amount_cny: order.amount_cny ?? amountCny,
    amount_usdt: order.amount_usdt,
    amount: amountUsd,
    currency: CURRENCY,
    payment_currency: 'USDT',
    exchange_rate: order.usdt_rate ?? exchangeRate,
    exchange_rate_pair: 'USD/CNY',
    network: order.network,
    status: order.status ?? 'pending',
    pay_url: order.pay_url,
    wallet_address: order.wallet_address,
    wallet_explorer_url: order.wallet_explorer_url,
    min_amount_usdt: order.min_amount_usdt,
    created_at:
      order.created_at ?? new Date().toISOString(),
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

  const amountCny = Number(
    order.amount_cny ?? rechargeAmountCny(order)
  );
  const exchangeRate = Number(order.usdt_rate ?? 0);
  return {
    order_id: order.order_id,
    amount_cny: amountCny,
    amount_usd:
      exchangeRate > 0
        ? roundUsd(amountCny / exchangeRate)
        : undefined,
    amount_usdt: order.amount_usdt,
    currency: CURRENCY,
    payment_currency: 'USDT',
    exchange_rate: order.usdt_rate,
    exchange_rate_pair: 'USD/CNY',
    network: order.network,
    wallet_address: order.wallet_address,
    wallet_explorer_url: order.wallet_explorer_url,
    status: order.status ?? 'pending',
    tx_hash: order.transaction_id,
  };
}

export async function getTransactions(
  agentId: number,
  page: number,
  pageSize: number
) {
  const userToken = await getAgentBackendToken(agentId);
  const [result, rate] = await Promise.all([
    backend.getTransactions(userToken, {
      page,
      page_size: pageSize,
    }),
    backend.getUsdtRate(userToken),
  ]);
  const exchangeRate = effectiveRate(rate);

  return {
    items: result.items.map((item) => {
      const {
        amount,
        balance,
        supplier_balance: _supplierBalance,
        ...rest
      } = item;
      const amountUsd = roundUsd(
        toNumber(amount) / exchangeRate
      );
      return {
        ...rest,
        amount: amountUsd,
        amount_usd: amountUsd,
        balance: roundUsd(
          toNumber(balance) / exchangeRate
        ),
        currency: 'USD',
        source: 'backend',
        exchange_rate: exchangeRate,
        exchange_rate_pair: 'USD/CNY',
      };
    }),
    total: result.total,
    page,
    page_size: pageSize,
  };
}
