import { prisma } from '../../app';
import { decrypt } from '../../utils/crypto';
import { AppError } from '../../utils/response';
import { ERROR_CODES } from '../../config/constants';
import * as backend from '../../gateway/backend-client';

export async function getOverview(agentId: number) {
  const [
    totalSessions,
    activeSessions,
    agent,
    totalTelemetry,
  ] = await Promise.all([
    prisma.agentSession.count({
      where: { agentId },
    }),
    prisma.agentSession.count({
      where: {
        agentId,
        status: { in: ['active', 'creating'] },
      },
    }),
    prisma.agentApp.findUnique({
      where: { id: agentId },
      select: {
        balanceCache: true,
        maxActiveSessions: true,
      },
    }),
    prisma.agentTelemetry.count({
      where: { agentId },
    }),
  ]);

  let backendStats: Record<string, unknown> = {};
  try {
    const agentFull = await prisma.agentApp.findUnique({
      where: { id: agentId },
    });
    if (
      agentFull?.backendUsername &&
      agentFull.backendPasswordEnc
    ) {
      const password = decrypt(
        agentFull.backendPasswordEnc
      );
      const token = await backend.getUserToken(
        agentFull.backendUsername,
        password
      );
      backendStats =
        await backend.getDashboardInfo(token);
    }
  } catch {
    // Non-critical: backend stats may be unavailable
  }

  return {
    total_sessions: totalSessions,
    active_sessions: activeSessions,
    max_sessions: agent?.maxActiveSessions ?? 100,
    balance: agent
      ? Number(agent.balanceCache)
      : 0,
    total_telemetry_events: totalTelemetry,
    backend_stats: backendStats,
    updated_at: new Date().toISOString(),
  };
}
