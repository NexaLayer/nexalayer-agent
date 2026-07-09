import { prisma } from '../../app';
import { createModuleLogger } from '../../utils/logger';
import os from 'os';

const log = createModuleLogger('system-service');

export async function getSystemStatus(agentId: number) {
  log.info({ event: 'system_status', agentId });

  const [profileCount, instanceCount, taskCount] =
    await Promise.all([
      prisma.browserProfile.count({
        where: { agentId },
      }),
      prisma.browserInstance.count({
        where: { agentId, status: 'running' },
      }),
      prisma.browserTask.count({
        where: { agentId, status: 'queued' },
      }),
    ]);

  return {
    status: 'healthy',
    profiles: profileCount,
    running_browsers: instanceCount,
    queued_tasks: taskCount,
    uptime_seconds: Math.floor(process.uptime()),
    node_version: process.version,
  };
}

export async function getResourceUsage() {
  const mem = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  return {
    memory: {
      heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
      rss_mb: Math.round(mem.rss / 1024 / 1024),
      system_total_mb: Math.round(totalMem / 1024 / 1024),
      system_free_mb: Math.round(freeMem / 1024 / 1024),
    },
    cpu: {
      cores: os.cpus().length,
      model: os.cpus()[0]?.model ?? 'unknown',
      load_avg: os.loadavg(),
    },
    platform: os.platform(),
    arch: os.arch(),
  };
}

export async function getRecentLogs(
  agentId: number,
  limit = 20
) {
  const logs = await prisma.agentApiLog.findMany({
    where: { agentId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      method: true,
      path: true,
      statusCode: true,
      latencyMs: true,
      createdAt: true,
    },
  });
  return logs.map((l) => ({
    method: l.method,
    path: l.path,
    status: l.statusCode,
    latency_ms: l.latencyMs,
    time: l.createdAt,
  }));
}
