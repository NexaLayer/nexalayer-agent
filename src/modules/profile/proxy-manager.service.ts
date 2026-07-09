import { prisma } from '../../app';
import { AppError } from '../../utils/response';
import { ERROR_CODES } from '../../config/constants';
import { generateProxyId } from '../../utils/id-generator';
import { encrypt } from '../../utils/crypto';

export async function addProxy(
  agentId: number,
  data: Record<string, unknown>
) {
  const proxyId = generateProxyId();

  const proxy = await prisma.agentProxy.create({
    data: {
      proxyId,
      agentId,
      name: (data.name as string) ?? null,
      proxyType: (data.type as string) ?? 'socks5',
      host: data.host as string,
      port: data.port as number,
      username: (data.username as string) ?? null,
      passwordEnc: data.password
        ? encrypt(data.password as string)
        : null,
      countryCode: (data.country as string) ?? null,
      cityCode: (data.city as string) ?? null,
      tags: (data.tags as string[]) ?? [],
    },
  });

  return {
    proxy_id: proxy.proxyId,
    name: proxy.name,
    type: proxy.proxyType,
    host: proxy.host,
    port: proxy.port,
    country: proxy.countryCode,
    status: proxy.status,
    full_url: buildProxyUrl(proxy),
  };
}

export async function listProxies(
  agentId: number,
  query: Record<string, string>
) {
  const where: Record<string, unknown> = { agentId };
  if (query.status && query.status !== 'all') {
    where.status = query.status;
  }
  if (query.country) {
    where.countryCode = query.country.toUpperCase();
  }
  if (query.type) {
    where.proxyType = query.type;
  }

  const proxies = await prisma.agentProxy.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: parseInt(query.page_size ?? '20', 10),
    skip:
      (parseInt(query.page ?? '1', 10) - 1) *
      parseInt(query.page_size ?? '20', 10),
  });

  return {
    items: proxies.map((p: typeof proxies[number]) => ({
      proxy_id: p.proxyId,
      name: p.name,
      type: p.proxyType,
      host: p.host,
      port: p.port,
      country: p.countryCode,
      city: p.cityCode,
      status: p.status,
      latency_ms: p.latencyMs,
      anonymity: p.anonymity,
      tags: p.tags,
      last_verified_at: p.lastVerifiedAt?.toISOString(),
    })),
    total: await prisma.agentProxy.count({ where }),
  };
}

export async function verifyProxy(
  agentId: number,
  proxyId: string
) {
  const proxy = await prisma.agentProxy.findFirst({
    where: { proxyId, agentId },
  });
  if (!proxy) {
    throw new AppError(
      ERROR_CODES.PROXY_NOT_FOUND,
      `Proxy ${proxyId} not found`
    );
  }

  const startTime = Date.now();
  let status = 'active';
  let latencyMs = 0;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      10000
    );
    const resp = await fetch('https://httpbin.org/ip', {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    latencyMs = Date.now() - startTime;

    if (!resp.ok) status = 'failed';
  } catch {
    status = 'failed';
    latencyMs = Date.now() - startTime;
  }

  const updated = await prisma.agentProxy.update({
    where: { proxyId },
    data: {
      status,
      latencyMs,
      lastVerifiedAt: new Date(),
    },
  });

  return {
    proxy_id: updated.proxyId,
    status: updated.status,
    latency_ms: latencyMs,
    detected_country: updated.countryCode,
    tested_at: updated.lastVerifiedAt?.toISOString(),
  };
}

export async function deleteProxy(
  agentId: number,
  proxyId: string
) {
  const proxy = await prisma.agentProxy.findFirst({
    where: { proxyId, agentId },
  });
  if (!proxy) {
    throw new AppError(
      ERROR_CODES.PROXY_NOT_FOUND,
      `Proxy ${proxyId} not found`
    );
  }
  await prisma.agentProxy.delete({
    where: { proxyId },
  });
}

function buildProxyUrl(p: {
  proxyType: string;
  host: string;
  port: number;
  username: string | null;
}) {
  const auth = p.username ? `${p.username}:***@` : '';
  return `${p.proxyType}://${auth}${p.host}:${p.port}`;
}
