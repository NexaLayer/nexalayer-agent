import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../app';
import { decrypt } from '../../utils/crypto';
import { AppError } from '../../utils/response';
import { ERROR_CODES, SESSION_TYPE } from '../../config/constants';
import * as backend from '../../gateway/backend-client';
import { BackendUsdtOrderResponse } from '../../gateway/types';

const CURRENCY = 'USD';
const DEFAULT_MIN_RECHARGE_USD = 10;
const DEFAULT_DYNAMIC_USD_PER_GB = 4;
const DEFAULT_STATIC_MIN_USD_PER_MONTH = 10;
const DEFAULT_SESSION_MANAGEMENT_FEE_USD = 0;

type PrismaExecutor = typeof prisma | Prisma.TransactionClient;

type WalletSnapshot = {
  cash_balance: number;
  trial_balance: number;
  available_balance: number;
  currency: string;
};

export type PricingSnapshot = {
  currency: 'USD';
  min_recharge_usd: number;
  dynamic_usd_per_gb: number;
  static_min_usd_per_month: number;
  session_management_fee_usd: number;
};

export type SessionChargeEstimate = {
  amount_usd: number;
  cash_amount_usd?: number;
  trial_amount_usd?: number;
  currency: 'USD';
  session_type: 'dynamic' | 'static';
  billing_unit: 'GB' | 'month';
  quantity: number;
  unit_price_usd: number;
  minimum_charge_usd?: number;
  session_management_fee_usd: number;
  months?: number;
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

function usd(value: number | string | Prisma.Decimal) {
  return new Prisma.Decimal(value).toDecimalPlaces(4);
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

function walletSnapshot(wallet: {
  cashBalanceUsd: Prisma.Decimal;
  trialBalanceUsd: Prisma.Decimal;
  currency: string;
}): WalletSnapshot {
  const cash = toNumber(wallet.cashBalanceUsd);
  const trial = toNumber(wallet.trialBalanceUsd);
  return {
    cash_balance: cash,
    trial_balance: trial,
    available_balance: roundUsd(cash + trial),
    currency: wallet.currency,
  };
}

async function ensureDefaultPriceRules(
  db: PrismaExecutor = prisma
): Promise<void> {
  const rules = [
    {
      code: 'min_recharge_usd',
      sessionType: null,
      billingUnit: 'recharge',
      unitPriceUsd: DEFAULT_MIN_RECHARGE_USD,
      minimumChargeUsd: DEFAULT_MIN_RECHARGE_USD,
      metadata: {
        public: true,
        description:
          'Minimum USDT self-service top-up',
      },
    },
    {
      code: 'dynamic_usd_per_gb',
      sessionType: SESSION_TYPE.DYNAMIC,
      billingUnit: 'GB',
      unitPriceUsd: DEFAULT_DYNAMIC_USD_PER_GB,
      minimumChargeUsd: null,
      metadata: {
        public: true,
        description:
          'Dynamic network resource price per GB',
      },
    },
    {
      code: 'static_min_usd_per_month',
      sessionType: SESSION_TYPE.STATIC,
      billingUnit: 'month',
      unitPriceUsd: DEFAULT_STATIC_MIN_USD_PER_MONTH,
      minimumChargeUsd:
        DEFAULT_STATIC_MIN_USD_PER_MONTH,
      metadata: {
        public: true,
        description:
          'Minimum static network resource monthly price',
      },
    },
    {
      code: 'session_management_fee_usd',
      sessionType: null,
      billingUnit: 'session',
      unitPriceUsd:
        DEFAULT_SESSION_MANAGEMENT_FEE_USD,
      minimumChargeUsd:
        DEFAULT_SESSION_MANAGEMENT_FEE_USD,
      metadata: {
        public: true,
        description:
          'Session management is free for now',
      },
    },
  ];

  for (const rule of rules) {
    await db.billingPriceRule.upsert({
      where: { code: rule.code },
      update: {
        sessionType: rule.sessionType,
        billingUnit: rule.billingUnit,
        unitPriceUsd: usd(rule.unitPriceUsd),
        minimumChargeUsd:
          rule.minimumChargeUsd === null
            ? null
            : usd(rule.minimumChargeUsd),
        isActive: true,
        metadata:
          rule.metadata as Prisma.InputJsonValue,
      },
      create: {
        code: rule.code,
        sessionType: rule.sessionType,
        billingUnit: rule.billingUnit,
        unitPriceUsd: usd(rule.unitPriceUsd),
        minimumChargeUsd:
          rule.minimumChargeUsd === null
            ? null
            : usd(rule.minimumChargeUsd),
        metadata:
          rule.metadata as Prisma.InputJsonValue,
      },
    });
  }
}

async function getWalletOrCreate(
  db: PrismaExecutor,
  agentId: number
) {
  const existing = await db.agentWallet.findUnique({
    where: { agentId },
  });
  if (existing) return existing;

  return db.agentWallet.create({
    data: {
      agentId,
      trialBalanceUsd: usd(0),
      currency: CURRENCY,
    },
  });
}

async function addLedgerEntry(
  db: PrismaExecutor,
  input: {
    agentId: number;
    type: string;
    amountUsd: number;
    cashDeltaUsd?: number;
    trialDeltaUsd?: number;
    cashBalanceAfterUsd: number;
    trialBalanceAfterUsd: number;
    sessionId?: string;
    backendOrderNo?: string;
    reservationId?: string;
    externalRef?: string;
    idempotencyKey?: string;
    status?: string;
    priceSnapshot?: Prisma.InputJsonValue;
    metadata?: Prisma.InputJsonValue;
  }
) {
  return db.billingLedgerEntry.create({
    data: {
      agentId: input.agentId,
      type: input.type,
      amountUsd: usd(input.amountUsd),
      cashDeltaUsd: usd(input.cashDeltaUsd ?? 0),
      trialDeltaUsd: usd(input.trialDeltaUsd ?? 0),
      cashBalanceAfterUsd: usd(
        input.cashBalanceAfterUsd
      ),
      trialBalanceAfterUsd: usd(
        input.trialBalanceAfterUsd
      ),
      sessionId: input.sessionId,
      backendOrderNo: input.backendOrderNo,
      reservationId: input.reservationId,
      externalRef: input.externalRef,
      idempotencyKey: input.idempotencyKey,
      status: input.status ?? 'success',
      priceSnapshot:
        input.priceSnapshot ??
        ({} as Prisma.InputJsonValue),
      metadata:
        input.metadata ??
        ({} as Prisma.InputJsonValue),
    },
  });
}

export async function initializeWallet(agentId: number) {
  await ensureDefaultPriceRules();
  const wallet = await prisma.$transaction(async (tx) => {
    const created = await getWalletOrCreate(tx, agentId);
    await tx.agentApp.update({
      where: { id: agentId },
      data: { trialBalance: usd(0), isTrial: false },
    });
    return created;
  });
  return walletSnapshot(wallet);
}

export async function getPricing(): Promise<PricingSnapshot> {
  await ensureDefaultPriceRules();
  const rows = await prisma.billingPriceRule.findMany({
    where: { isActive: true },
  });
  const price = new Map(
    rows.map((row) => [
      row.code,
      {
        unit: toNumber(row.unitPriceUsd),
        minimum:
          row.minimumChargeUsd === null
            ? undefined
            : toNumber(row.minimumChargeUsd),
      },
    ])
  );

  return {
    currency: 'USD',
    min_recharge_usd:
      price.get('min_recharge_usd')?.minimum ??
      DEFAULT_MIN_RECHARGE_USD,
    dynamic_usd_per_gb:
      price.get('dynamic_usd_per_gb')?.unit ??
      DEFAULT_DYNAMIC_USD_PER_GB,
    static_min_usd_per_month:
      price.get('static_min_usd_per_month')
        ?.minimum ??
      DEFAULT_STATIC_MIN_USD_PER_MONTH,
    session_management_fee_usd:
      price.get('session_management_fee_usd')
        ?.unit ??
      DEFAULT_SESSION_MANAGEMENT_FEE_USD,
  };
}

export async function getBalance(agentId: number) {
  const wallet = await prisma.$transaction((tx) =>
    getWalletOrCreate(tx, agentId)
  );
  const snapshot = walletSnapshot(wallet);

  return {
    cash_balance: snapshot.cash_balance,
    available_balance: snapshot.available_balance,
    currency: snapshot.currency,
    balance: snapshot.available_balance,
    updated_at: new Date().toISOString(),
  };
}

export async function createRecharge(
  agentId: number,
  amountUsd: number
) {
  const pricing = await getPricing();
  if (amountUsd < pricing.min_recharge_usd) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      `Minimum recharge is ${pricing.min_recharge_usd} USD`,
      {
        minimum_recharge_usd:
          pricing.min_recharge_usd,
        currency: CURRENCY,
      }
    );
  }

  const userToken =
    await getAgentBackendToken(agentId);
  const order = await backend.createUsdtRechargeOrder(
    userToken,
    amountUsd
  );

  await prisma.agentUsageRecord.create({
    data: {
      agentId,
      action: 'recharge_created',
      resourceType: 'billing',
      details: {
        order_id: order.order_id,
        amount_usd: amountUsd,
        currency: 'USDT',
      },
    },
  });

  return {
    order_id: order.order_id,
    amount_usd: amountUsd,
    amount: amountUsd,
    currency: CURRENCY,
    payment_currency: 'USDT',
    status: order.status,
    pay_url: order.pay_url,
    wallet_address: order.wallet_address,
    created_at: new Date().toISOString(),
  };
}

function rechargeSucceeded(status: string) {
  return [
    'success',
    'succeeded',
    'paid',
    'confirmed',
    'completed',
  ].includes(status.toLowerCase());
}

function rechargeAmountUsd(
  order: BackendUsdtOrderResponse
) {
  const raw =
    order.confirmed_amount ??
    order.amount_usdt ??
    order.amount_usd ??
    order.amount;
  return roundUsd(Number(raw ?? 0));
}

async function creditRechargeIfConfirmed(
  agentId: number,
  order: BackendUsdtOrderResponse
) {
  if (!rechargeSucceeded(order.status)) return;
  const amountUsd = rechargeAmountUsd(order);
  if (amountUsd <= 0) return;

  const externalRef = `recharge:${order.order_id}`;
  await prisma.$transaction(
    async (tx) => {
      const existing =
        await tx.billingLedgerEntry.findUnique({
          where: { externalRef },
        });
      if (existing) return;

      await getWalletOrCreate(tx, agentId);
      const updated = await tx.agentWallet.update({
        where: { agentId },
        data: {
          cashBalanceUsd: {
            increment: amountUsd,
          },
        },
      });

      await addLedgerEntry(tx, {
        agentId,
        type: 'recharge',
        amountUsd,
        cashDeltaUsd: amountUsd,
        cashBalanceAfterUsd: toNumber(
          updated.cashBalanceUsd
        ),
        trialBalanceAfterUsd: toNumber(
          updated.trialBalanceUsd
        ),
        externalRef,
        metadata: {
          order_id: order.order_id,
          payment_currency: 'USDT',
          amount_usdt:
            order.confirmed_amount ??
            order.amount_usdt ??
            order.amount,
          tx_hash: order.transaction_id,
        } as Prisma.InputJsonValue,
      });
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel.Serializable,
    }
  );
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

  await creditRechargeIfConfirmed(agentId, order);

  const amountUsd = rechargeAmountUsd(order);
  return {
    order_id: order.order_id,
    amount_usd: amountUsd,
    amount: amountUsd,
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
  const [items, total] = await Promise.all([
    prisma.billingLedgerEntry.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.billingLedgerEntry.count({
      where: { agentId },
    }),
  ]);

  return {
    items: items.map((item) => ({
      id: String(item.id),
      type: item.type,
      amount_usd: toNumber(item.amountUsd),
      cash_delta_usd: toNumber(item.cashDeltaUsd),
      trial_delta_usd: toNumber(
        item.trialDeltaUsd
      ),
      cash_balance_after_usd: toNumber(
        item.cashBalanceAfterUsd
      ),
      trial_balance_after_usd: toNumber(
        item.trialBalanceAfterUsd
      ),
      currency: CURRENCY,
      status: item.status,
      session_id: item.sessionId,
      backend_order_no: item.backendOrderNo,
      reservation_id: item.reservationId,
      external_ref: item.externalRef,
      metadata: item.metadata,
      created_at: item.createdAt.toISOString(),
    })),
    total,
    page,
    page_size: pageSize,
  };
}

export async function estimateSessionCharge(input: {
  session_type: 'dynamic' | 'static';
  quantity?: number;
  duration?: number;
}): Promise<SessionChargeEstimate> {
  const pricing = await getPricing();
  const qty = input.quantity ?? 1;
  const managementFee =
    pricing.session_management_fee_usd;

  if (input.session_type === SESSION_TYPE.DYNAMIC) {
    const resourceAmount =
      qty * pricing.dynamic_usd_per_gb;
    return {
      amount_usd: roundUsd(
        resourceAmount + managementFee
      ),
      currency: 'USD',
      session_type: 'dynamic',
      billing_unit: 'GB',
      quantity: qty,
      unit_price_usd: pricing.dynamic_usd_per_gb,
      session_management_fee_usd: managementFee,
    };
  }

  const duration = input.duration ?? 30;
  const months = Math.max(
    1,
    Math.ceil(duration / 30)
  );
  const unitPrice =
    pricing.static_min_usd_per_month;
  const resourceAmount = qty * months * unitPrice;
  return {
    amount_usd: roundUsd(
      resourceAmount + managementFee
    ),
    currency: 'USD',
    session_type: 'static',
    billing_unit: 'month',
    quantity: qty,
    months,
    unit_price_usd: unitPrice,
    minimum_charge_usd:
      pricing.static_min_usd_per_month,
    session_management_fee_usd: managementFee,
  };
}

export async function reserveSessionCharge(input: {
  agentId: number;
  sessionId: string;
  estimate: SessionChargeEstimate;
  idempotencyKey?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  const reservationId = `br_${randomUUID()
    .replace(/-/g, '')
    .slice(0, 24)}`;

  return prisma.$transaction(
    async (tx) => {
      const wallet = await getWalletOrCreate(
        tx,
        input.agentId
      );
      const cash = toNumber(wallet.cashBalanceUsd);
      const trial = toNumber(wallet.trialBalanceUsd);
      const available = cash + trial;
      const amount = input.estimate.amount_usd;

      if (available + 0.0001 < amount) {
        throw new AppError(
          ERROR_CODES.INSUFFICIENT_BALANCE,
          'Insufficient USD balance for this session',
          {
            required_usd: amount,
            available_usd: roundUsd(available),
            cash_balance_usd: cash,
            trial_balance_usd: trial,
          }
        );
      }

      const trialDebit = Math.min(trial, amount);
      const cashDebit = roundUsd(amount - trialDebit);
      const updated = await tx.agentWallet.update({
        where: { agentId: input.agentId },
        data: {
          trialBalanceUsd: {
            decrement: trialDebit,
          },
          cashBalanceUsd: {
            decrement: cashDebit,
          },
        },
      });

      await tx.billingReservation.create({
        data: {
          reservationId,
          agentId: input.agentId,
          sessionId: input.sessionId,
          amountUsd: usd(amount),
          cashAmountUsd: usd(cashDebit),
          trialAmountUsd: usd(trialDebit),
          status: 'reserved',
          idempotencyKey: input.idempotencyKey,
          priceSnapshot:
            input.estimate as unknown as Prisma.InputJsonValue,
          metadata:
            input.metadata ??
            ({} as Prisma.InputJsonValue),
        },
      });

      await addLedgerEntry(tx, {
        agentId: input.agentId,
        type: 'session_charge',
        amountUsd: -amount,
        cashDeltaUsd: -cashDebit,
        trialDeltaUsd: -trialDebit,
        cashBalanceAfterUsd: toNumber(
          updated.cashBalanceUsd
        ),
        trialBalanceAfterUsd: toNumber(
          updated.trialBalanceUsd
        ),
        sessionId: input.sessionId,
        reservationId,
        idempotencyKey: input.idempotencyKey,
        priceSnapshot:
          input.estimate as unknown as Prisma.InputJsonValue,
        metadata:
          input.metadata ??
          ({} as Prisma.InputJsonValue),
      });

      return {
        reservation_id: reservationId,
        ...input.estimate,
        cash_amount_usd: cashDebit,
        trial_amount_usd: trialDebit,
      };
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel.Serializable,
    }
  );
}

export async function captureSessionReservation(
  reservationId: string,
  backendOrderNo?: string
) {
  await prisma.billingReservation.updateMany({
    where: {
      reservationId,
      status: 'reserved',
    },
    data: {
      status: 'captured',
      metadata: backendOrderNo
        ? {
            backend_order_no: backendOrderNo,
          }
        : undefined,
    },
  });

  if (backendOrderNo) {
    await prisma.billingLedgerEntry.updateMany({
      where: { reservationId },
      data: { backendOrderNo },
    });
  }
}

export async function releaseSessionReservation(
  reservationId: string,
  reason: string
) {
  await prisma.$transaction(
    async (tx) => {
      const reservation =
        await tx.billingReservation.findUnique({
          where: { reservationId },
        });
      if (
        !reservation ||
        reservation.status !== 'reserved'
      ) {
        return;
      }

      const updated = await tx.agentWallet.update({
        where: { agentId: reservation.agentId },
        data: {
          cashBalanceUsd: {
            increment: reservation.cashAmountUsd,
          },
          trialBalanceUsd: {
            increment: reservation.trialAmountUsd,
          },
        },
      });

      await tx.billingReservation.update({
        where: { reservationId },
        data: {
          status: 'released',
          metadata: {
            reason,
          },
        },
      });

      await addLedgerEntry(tx, {
        agentId: reservation.agentId,
        type: 'session_charge_refund',
        amountUsd: toNumber(reservation.amountUsd),
        cashDeltaUsd: toNumber(
          reservation.cashAmountUsd
        ),
        trialDeltaUsd: toNumber(
          reservation.trialAmountUsd
        ),
        cashBalanceAfterUsd: toNumber(
          updated.cashBalanceUsd
        ),
        trialBalanceAfterUsd: toNumber(
          updated.trialBalanceUsd
        ),
        sessionId: reservation.sessionId,
        reservationId,
        priceSnapshot:
          reservation.priceSnapshot as Prisma.InputJsonValue,
        metadata: {
          reason,
        } as Prisma.InputJsonValue,
      });
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel.Serializable,
    }
  );
}
