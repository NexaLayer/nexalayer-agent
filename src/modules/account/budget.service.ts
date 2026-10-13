import { Prisma } from '@prisma/client';
import { prisma } from '../../app';
import { AppError } from '../../utils/response';
import { ERROR_CODES } from '../../config/constants';
import type { UpdateBudgetRequest } from './account.schema';

function number(value: Prisma.Decimal | number | null | undefined): number {
  return value == null ? 0 : Number(value);
}

function startOfUtcDay(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function spend(agentId: number, tx: Prisma.TransactionClient = prisma) {
  const [lifetime, daily] = await Promise.all([
    tx.agentSession.aggregate({
      where: { agentId, status: { notIn: ['error', 'failed', 'cancelled'] } },
      _sum: { estimatedChargeUsd: true },
    }),
    tx.agentSession.aggregate({
      where: {
        agentId,
        createdAt: { gte: startOfUtcDay() },
        status: { notIn: ['error', 'failed', 'cancelled'] },
      },
      _sum: { estimatedChargeUsd: true },
    }),
  ]);
  return {
    key_spend_usd: number(lifetime._sum.estimatedChargeUsd),
    daily_spend_usd: number(daily._sum.estimatedChargeUsd),
  };
}

export async function getBudget(agentId: number) {
  const [policy, usage] = await Promise.all([
    prisma.agentBudgetPolicy.findUnique({ where: { agentId } }),
    spend(agentId),
  ]);
  return {
    key_limit_usd: policy?.keyLimitUsd == null ? null : number(policy.keyLimitUsd),
    daily_limit_usd: policy?.dailyLimitUsd == null ? null : number(policy.dailyLimitUsd),
    pause_on_exceed: policy?.pauseOnExceed ?? true,
    paused: Boolean(policy?.pausedAt),
    paused_at: policy?.pausedAt?.toISOString() ?? null,
    pause_reason: policy?.pauseReason ?? null,
    alert_thresholds: policy?.alertThresholds ?? [50, 80, 100],
    ...usage,
    resets_at: new Date(startOfUtcDay().getTime() + 86_400_000).toISOString(),
  };
}

export async function updateBudget(agentId: number, input: UpdateBudgetRequest) {
  await prisma.agentBudgetPolicy.upsert({
    where: { agentId },
    create: {
      agentId,
      keyLimitUsd: input.key_limit_usd,
      dailyLimitUsd: input.daily_limit_usd,
      pauseOnExceed: input.pause_on_exceed,
      alertThresholds: input.alert_thresholds,
      pausedAt: input.paused === true ? new Date() : null,
      pauseReason: input.paused === true ? 'manual' : null,
    },
    update: {
      keyLimitUsd: input.key_limit_usd,
      dailyLimitUsd: input.daily_limit_usd,
      pauseOnExceed: input.pause_on_exceed,
      alertThresholds: input.alert_thresholds,
      ...(input.paused === undefined ? {} : {
        pausedAt: input.paused ? new Date() : null,
        pauseReason: input.paused ? 'manual' : null,
      }),
    },
  });
  return getBudget(agentId);
}

export async function assertBudgetAllowsSpend(agentId: number, amountUsd: number) {
  const policy = await prisma.agentBudgetPolicy.findUnique({ where: { agentId } });
  if (!policy) return;
  if (policy.pausedAt) {
    throw new AppError(ERROR_CODES.INVALID_REQUEST, 'API key spending is paused', {
      reason: policy.pauseReason,
    });
  }
  const usage = await spend(agentId);
  const projectedKey = usage.key_spend_usd + amountUsd;
  const projectedDaily = usage.daily_spend_usd + amountUsd;
  const keyLimit = policy.keyLimitUsd == null ? null : number(policy.keyLimitUsd);
  const dailyLimit = policy.dailyLimitUsd == null ? null : number(policy.dailyLimitUsd);
  const reason = keyLimit !== null && projectedKey > keyLimit
    ? 'key_limit_exceeded'
    : dailyLimit !== null && projectedDaily > dailyLimit
      ? 'daily_limit_exceeded'
      : null;
  if (!reason) return;
  if (policy.pauseOnExceed) {
    await prisma.agentBudgetPolicy.update({
      where: { agentId },
      data: { pausedAt: new Date(), pauseReason: reason },
    });
  }
  throw new AppError(ERROR_CODES.INVALID_REQUEST, 'Spend limit would be exceeded', {
    reason,
    requested_usd: amountUsd,
    projected_key_spend_usd: projectedKey,
    projected_daily_spend_usd: projectedDaily,
    key_limit_usd: keyLimit,
    daily_limit_usd: dailyLimit,
    paused: policy.pauseOnExceed,
  });
}

export async function createBudgetedSession(
  agentId: number,
  amountUsd: number,
  data: Prisma.AgentSessionUncheckedCreateInput
) {
  let blockedDetails: Record<string, unknown> | null = null;
  const session = await prisma.$transaction(async (tx) => {
    // Serialize spend reservations for one API Key so simultaneous agents
    // cannot each pass the same remaining-budget check.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${agentId})`;
    const policy = await tx.agentBudgetPolicy.findUnique({ where: { agentId } });
    if (policy?.pausedAt) {
      throw new AppError(ERROR_CODES.INVALID_REQUEST, 'API key spending is paused', {
        reason: policy.pauseReason,
      });
    }
    if (policy) {
      const usage = await spend(agentId, tx);
      const projectedKey = usage.key_spend_usd + amountUsd;
      const projectedDaily = usage.daily_spend_usd + amountUsd;
      const keyLimit = policy.keyLimitUsd == null ? null : number(policy.keyLimitUsd);
      const dailyLimit = policy.dailyLimitUsd == null ? null : number(policy.dailyLimitUsd);
      const reason = keyLimit !== null && projectedKey > keyLimit
        ? 'key_limit_exceeded'
        : dailyLimit !== null && projectedDaily > dailyLimit
          ? 'daily_limit_exceeded'
          : null;
      if (reason) {
        if (policy.pauseOnExceed) {
          await tx.agentBudgetPolicy.update({
            where: { agentId },
            data: { pausedAt: new Date(), pauseReason: reason },
          });
        }
        blockedDetails = {
          reason,
          requested_usd: amountUsd,
          projected_key_spend_usd: projectedKey,
          projected_daily_spend_usd: projectedDaily,
          key_limit_usd: keyLimit,
          daily_limit_usd: dailyLimit,
          paused: policy.pauseOnExceed,
        };
        return null;
      }
    }
    return tx.agentSession.create({ data });
  });
  if (!session) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      'Spend limit would be exceeded',
      blockedDetails ?? undefined
    );
  }
  return session;
}

export async function getUsageAlerts(agentId: number) {
  const budget = await getBudget(agentId);
  const thresholds = Array.isArray(budget.alert_thresholds)
    ? budget.alert_thresholds.map(Number).filter(Number.isFinite)
    : [50, 80, 100];
  const alerts: Record<string, unknown>[] = [];
  for (const [scope, spent, limit] of [
    ['key', budget.key_spend_usd, budget.key_limit_usd],
    ['daily', budget.daily_spend_usd, budget.daily_limit_usd],
  ] as const) {
    if (typeof limit !== 'number' || limit <= 0) continue;
    const percent = Math.round((spent / limit) * 10000) / 100;
    for (const threshold of thresholds) {
      if (percent >= threshold) alerts.push({ scope, threshold_percent: threshold, percent_used: percent, spend_usd: spent, limit_usd: limit });
    }
  }
  return { alerts, paused: budget.paused, generated_at: new Date().toISOString() };
}
