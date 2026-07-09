import { prisma } from '../../app';
import { AppError } from '../../utils/response';
import { ERROR_CODES } from '../../config/constants';
import { generateId } from '../../utils/id-generator';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('proxy-pool-service');

export async function createProxyPool(
  agentId: number,
  data: {
    name: string;
    country_code?: string;
    proxy_type?: string;
    rotation_strategy?: string;
  }
) {
  const poolId = generateId('pool');
  log.info({
    event: 'proxy_pool_create',
    agentId,
    poolId,
    name: data.name,
  });

  const pool = await prisma.proxyPool.create({
    data: {
      poolId,
      agentId,
      name: data.name,
      countryCode: data.country_code ?? null,
      proxyType: data.proxy_type ?? 'socks5',
      rotationStrategy: data.rotation_strategy ?? 'round_robin',
    },
  });

  return {
    pool_id: pool.poolId,
    name: pool.name,
    country_code: pool.countryCode,
    proxy_type: pool.proxyType,
    rotation_strategy: pool.rotationStrategy,
    created_at: pool.createdAt,
  };
}

export async function listProxyPools(agentId: number) {
  const pools = await prisma.proxyPool.findMany({
    where: { agentId },
    orderBy: { createdAt: 'desc' },
  });

  return pools.map((p) => ({
    pool_id: p.poolId,
    name: p.name,
    country_code: p.countryCode,
    proxy_type: p.proxyType,
    proxy_count: Array.isArray(p.proxyIds)
      ? (p.proxyIds as string[]).length
      : 0,
    rotation_strategy: p.rotationStrategy,
    created_at: p.createdAt,
  }));
}

export async function deleteProxyPool(
  agentId: number,
  poolId: string
) {
  const pool = await prisma.proxyPool.findFirst({
    where: { poolId, agentId },
  });
  if (!pool) {
    throw new AppError(
      ERROR_CODES.PROXY_POOL_NOT_FOUND ?? 'PROXY_POOL_NOT_FOUND',
      `Proxy pool ${poolId} not found`
    );
  }

  log.info({
    event: 'proxy_pool_delete',
    agentId,
    poolId,
  });

  await prisma.proxyPool.delete({ where: { id: pool.id } });
  return { deleted: true };
}

export async function autoSelectProxy(
  agentId: number,
  _profileId: string
) {
  const proxies = await prisma.agentProxy.findMany({
    where: {
      agentId,
      status: 'active',
    },
    orderBy: { latencyMs: 'asc' },
    take: 1,
  });

  if (!proxies.length) {
    return { proxy_id: null, message: 'No active proxies' };
  }

  const best = proxies[0];
  return {
    proxy_id: best.proxyId,
    name: best.name,
    type: best.proxyType,
    host: best.host,
    port: best.port,
    latency_ms: best.latencyMs,
    country: best.countryCode,
  };
}
