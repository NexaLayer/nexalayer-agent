import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../app';
import { AppError } from '../../utils/response';
import {
  ERROR_CODES,
  RISK_LEVEL,
  HEALTH_RECOMMENDATION,
} from '../../config/constants';
import { ReportEventRequest } from './telemetry.schema';

const RISK_EVENTS = new Set([
  'http_error',
  'captcha',
  'block',
  'rate_limit',
]);

export async function reportEvent(
  agentId: number,
  sessionId: string,
  input: ReportEventRequest
) {
  const session = await prisma.agentSession.findFirst({
    where: { sessionId, agentId },
  });

  if (!session) {
    throw new AppError(
      ERROR_CODES.SESSION_NOT_FOUND,
      'Session not found'
    );
  }

  const riskLevel = computeRiskLevel(input);
  const blockProbability = computeBlockProbability(
    input
  );

  await prisma.agentTelemetry.create({
    data: {
      agentId,
      sessionId,
      eventType: input.event_type,
      statusCode: input.status_code,
      targetHost: input.target_host,
      latencyMs: input.latency_ms,
      errorMessage: input.error_message,
      riskLevel,
      blockProbability,
      metadata: (input.metadata ?? {}) as Record<
        string,
        string | number | boolean
      >,
    },
  });

  await updateSessionHealth(
    session.id,
    input.event_type,
    riskLevel
  );

  return {
    recorded: true,
    risk_level: riskLevel,
    block_probability: blockProbability,
  };
}

export async function batchReport(
  agentId: number,
  events: (ReportEventRequest & {
    session_id: string;
  })[]
) {
  const results = [];
  for (const event of events) {
    const { session_id, ...rest } = event;
    const result = await reportEvent(
      agentId,
      session_id,
      rest
    );
    results.push({ session_id, ...result });
  }
  return { processed: results.length, results };
}

export async function getSessionHealth(
  agentId: number,
  sessionId: string
) {
  const session = await prisma.agentSession.findFirst({
    where: { sessionId, agentId },
    select: {
      riskLevel: true,
      healthScore: true,
      successRate: true,
      consecutiveFailures: true,
      lastErrorType: true,
      totalEvents: true,
    },
  });

  if (!session) {
    throw new AppError(
      ERROR_CODES.SESSION_NOT_FOUND,
      'Session not found'
    );
  }

  const recentEvents = await prisma.agentTelemetry.findMany({
    where: { sessionId, agentId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      eventType: true,
      statusCode: true,
      latencyMs: true,
      riskLevel: true,
      createdAt: true,
    },
  });

  const recommendation = getRecommendation(
    session.healthScore,
    session.consecutiveFailures
  );

  return {
    session_id: sessionId,
    risk_level: session.riskLevel,
    health_score: session.healthScore,
    success_rate: Number(session.successRate),
    consecutive_failures: session.consecutiveFailures,
    last_error_type: session.lastErrorType,
    total_events: session.totalEvents,
    recommendation,
    recent_events: recentEvents.map((e) => ({
      event_type: e.eventType,
      status_code: e.statusCode,
      latency_ms: e.latencyMs,
      risk_level: e.riskLevel,
      timestamp: e.createdAt.toISOString(),
    })),
  };
}

function computeRiskLevel(
  input: ReportEventRequest
): string {
  if (
    input.event_type === 'block' ||
    input.event_type === 'captcha'
  ) {
    return RISK_LEVEL.HIGH;
  }
  if (
    input.event_type === 'rate_limit' ||
    input.event_type === 'http_error'
  ) {
    return RISK_LEVEL.MEDIUM;
  }
  return RISK_LEVEL.LOW;
}

function computeBlockProbability(
  input: ReportEventRequest
): number {
  const riskScores: Record<string, number> = {
    success: 0,
    http_error: 0.2,
    timeout: 0.1,
    rate_limit: 0.4,
    captcha: 0.6,
    block: 0.9,
    custom: 0.05,
  };
  return riskScores[input.event_type] ?? 0;
}

async function updateSessionHealth(
  sessionDbId: number,
  eventType: string,
  riskLevel: string
): Promise<void> {
  const session = await prisma.agentSession.findUnique({
    where: { id: sessionDbId },
    select: {
      healthScore: true,
      totalEvents: true,
      successRate: true,
      consecutiveFailures: true,
    },
  });

  if (!session) return;

  const isFailure = RISK_EVENTS.has(eventType);
  const newTotalEvents = session.totalEvents + 1;

  const currentSuccessCount = Math.round(
    Number(session.successRate) * session.totalEvents
  );
  const newSuccessCount = isFailure
    ? currentSuccessCount
    : currentSuccessCount + 1;
  const newSuccessRate =
    newTotalEvents > 0
      ? newSuccessCount / newTotalEvents
      : 1;

  const healthDelta = isFailure ? -10 : 2;
  const newHealthScore = Math.max(
    0,
    Math.min(100, session.healthScore + healthDelta)
  );

  const newConsecFailures = isFailure
    ? session.consecutiveFailures + 1
    : 0;

  await prisma.agentSession.update({
    where: { id: sessionDbId },
    data: {
      totalEvents: newTotalEvents,
      successRate: new Decimal(
        newSuccessRate.toFixed(4)
      ),
      healthScore: newHealthScore,
      consecutiveFailures: newConsecFailures,
      riskLevel: riskLevel,
      lastErrorType: isFailure ? eventType : null,
    },
  });
}

function getRecommendation(
  healthScore: number,
  consecutiveFailures: number
): string {
  if (
    consecutiveFailures >= 5 ||
    healthScore < 20
  ) {
    return HEALTH_RECOMMENDATION.PAUSE;
  }
  if (
    consecutiveFailures >= 3 ||
    healthScore < 50
  ) {
    return HEALTH_RECOMMENDATION.ROTATE_NOW;
  }
  if (healthScore < 70) {
    return HEALTH_RECOMMENDATION.CONSIDER_ROTATE;
  }
  return HEALTH_RECOMMENDATION.OK;
}
