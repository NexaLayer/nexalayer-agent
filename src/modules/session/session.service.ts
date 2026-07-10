import { prisma } from '../../app';
import { AppError } from '../../utils/response';
import {
  ERROR_CODES,
  SESSION_STATUS,
  SESSION_TYPE,
} from '../../config/constants';
import { generateSessionId } from '../../utils/id-generator';
import { encrypt, decrypt } from '../../utils/crypto';
import * as backend from '../../gateway/backend-client';
import {
  CreateSessionRequest,
  ListSessionsQuery,
} from './session.schema';

const STATIC_ORDER_READY_TIMEOUT_MS = 120_000;
const STATIC_ORDER_POLL_MS = 3_000;

export async function createSession(
  agentId: number,
  input: CreateSessionRequest
) {
  const agent = await prisma.agentApp.findUnique({
    where: { id: agentId },
  });
  if (!agent) {
    throw new AppError(
      ERROR_CODES.AUTH_INVALID_KEY,
      'Agent not found'
    );
  }

  if (
    !agent.backendUserId ||
    !agent.backendUsername ||
    !agent.backendPasswordEnc
  ) {
    throw new AppError(
      ERROR_CODES.BACKEND_ERROR,
      'Backend account is not ready. Complete backend sync before creating sessions.',
      { backend_ready: false }
    );
  }

  const activeSessions = await prisma.agentSession.count({
    where: {
      agentId,
      status: {
        in: [SESSION_STATUS.ACTIVE, SESSION_STATUS.CREATING],
      },
    },
  });

  if (activeSessions >= agent.maxActiveSessions) {
    throw new AppError(
      ERROR_CODES.SESSION_LIMIT_REACHED,
      `Active session limit reached (${agent.maxActiveSessions})`
    );
  }

  const sessionId = generateSessionId();

  const session = await prisma.agentSession.create({
    data: {
      sessionId,
      agentId,
      sessionType: input.session_type,
      status: SESSION_STATUS.CREATING,
      proxyProtocol: input.protocol,
      countryCode: input.country_code,
      cityCode: input.city_code,
      ispType: input.isp_type,
      rotationMode: input.rotation_mode,
      rotationIntervalSec: input.rotation_interval_sec,
      identityId: input.identity_id,
      identityPool: input.identity_pool,
      backendProductNo: input.product_no,
    },
  });

  provisionSessionAsync(
    session.id,
    {
      id: agent.id,
      backendUserId: agent.backendUserId,
      backendUsername: agent.backendUsername,
      backendPasswordEnc: agent.backendPasswordEnc,
    },
    input
  ).catch((err) => {
    console.error(
      `Async provision failed for ${sessionId}:`,
      err
    );
  });

  return {
    session_id: sessionId,
    session_type: input.session_type,
    status: SESSION_STATUS.CREATING,
    message:
      'Session is being created. Poll GET /v1/sessions/:id for status.',
    created_at: session.createdAt.toISOString(),
  };
}

async function lookupProductInfo(
  userToken: string,
  productNo: string,
  sessionType: string
) {
  if (sessionType === SESSION_TYPE.DYNAMIC) {
    const products =
      await backend.getDynamicProducts(userToken);
    const match = products.find(
      (p) => p.type === productNo
    );
    if (!match) {
      throw new Error(
        `Dynamic product not found: ${productNo}`
      );
    }

    let price = match.price;
    if (!price || price <= 0) {
      const prices =
        await backend.getDynamicPrices();
      const priceEntry = prices.find(
        (p) =>
          p.id === match.id ||
          p.type === match.type
      );
      if (priceEntry && priceEntry.price > 0) {
        price = priceEntry.price;
      }
    }
    if (!price || price <= 0) {
      throw new Error(
        `No valid price for product ` +
          `${productNo} (id=${match.id}). ` +
          `Configure pricing first.`
      );
    }

    return {
      price,
      proxyType: match.proxyType,
      flow: match.flow,
      duration: match.duration || 1,
      unit: match.unit || 1,
    };
  }

  const products =
    await backend.getStaticProducts(userToken);
  const match = products.find(
    (p) => p.productId === productNo
  );
  if (!match) {
    throw new Error(
      `Static product not found: ${productNo}`
    );
  }
  return {
    price: match.price,
    proxyType: match.proxyType,
    flow: match.flow ?? 0,
    duration: match.duration ?? 30,
    unit: match.unit ?? 1,
    projectId: chooseStaticProjectId(match),
  };
}

function chooseStaticProjectId(product: {
  productType?: number | string;
  projectList?: Record<string, unknown>[];
}): string | undefined {
  const projects = product.projectList ?? [];
  if (!projects.length) return undefined;

  const available =
    projects.find((project) => {
      const stock = Number(
        project.inventory ??
          project.stock ??
          project.count ??
          0
      );
      return !Number.isFinite(stock) || stock > 0;
    }) ?? projects[0];

  const projectId =
    available.code ??
    available.projectId ??
    available.project_id ??
    available.id ??
    available.value;
  return projectId === undefined
    ? undefined
    : String(projectId);
}

async function provisionSessionAsync(
  sessionDbId: number,
  agent: {
    id: number;
    backendUserId: number | null;
    backendUsername: string | null;
    backendPasswordEnc: string | null;
  },
  input: CreateSessionRequest
): Promise<void> {
  try {
    if (
      !agent.backendUsername ||
      !agent.backendPasswordEnc
    ) {
      throw new Error(
        'Backend credentials not configured'
      );
    }
    if (!agent.backendUserId) {
      throw new Error(
        'Backend user ID not configured'
      );
    }

    const backendPassword = decrypt(
      agent.backendPasswordEnc
    );
    const userToken = await backend.getUserToken(
      agent.backendUsername,
      backendPassword
    );

    const product = await lookupProductInfo(
      userToken,
      input.product_no,
      input.session_type
    );

    const qty = input.quantity ?? 1;
    const dur = input.duration ?? product.duration;
    const totalAmount = product.price * qty;

    let backendOrderNo: string | undefined;
    let expiresAt: Date | undefined;

    if (
      input.session_type === SESSION_TYPE.DYNAMIC
    ) {
      const dynOpen = await backend.openDynamicProxy(
        userToken,
        {
          productNo: input.product_no,
          proxyType: product.proxyType,
          flow: qty,
          maxFlowLimit: qty,
          username: agent.backendUsername,
          userId: agent.backendUserId,
          unitPrice: product.price,
          totalAmount,
          remark:
            `Agent session (agentId=${agent.id})`,
        }
      );
      backendOrderNo = dynOpen.order_no;
      let proxy = extractProxyInfo(dynOpen.payload);
      if (!proxy) {
        const dynExtract =
          await backend.extractDynamicProxy(
            userToken,
            {
              productNo: input.product_no,
              proxyType: product.proxyType,
              username: undefined,
              protocol: input.protocol,
              quantity: 1,
              validTime:
                dynamicValidTimeMinutes(input),
              countryCode: input.country_code,
              cityCode: input.city_code,
            }
          );
        proxy = extractProxyInfo(dynExtract);
      }
      if (!proxy) {
        throw new Error(
          'Dynamic proxy extraction returned no proxy endpoint'
        );
      }
      await prisma.agentSession.update({
        where: { id: sessionDbId },
        data: proxy
          ? {
              proxyHost: proxy.host,
              proxyPort: proxy.port,
              proxyUsername: proxy.username,
              proxyPasswordEnc: proxy.password
                ? encrypt(proxy.password)
                : undefined,
              proxyProtocol: proxy.protocol,
            }
          : {},
      });
    } else {
      const staticResult =
        await backend.createStaticOrderV2(
          userToken,
          {
            orderType: 'static_proxy',
            poolId: input.product_no,
            userId: agent.backendUserId,
            unitPrice: product.price,
            totalAmount,
            ipCount: qty,
            duration: dur,
            unit: product.unit,
            cycleTimes: 1,
            countryCode: input.country_code,
            cityCode: input.city_code,
            projectId:
              input.project_id ?? product.projectId,
            remark: `Agent session ` +
              `(agentId=${agent.id})`,
          }
      );
      backendOrderNo = staticResult.order_no;
      const proxy = await waitForStaticProxy(
        userToken,
        staticResult.order_no,
        staticResult.payload
      );
      if (!proxy) {
        throw new Error(
          'Static order creation returned no proxy endpoint'
        );
      }
      await prisma.agentSession.update({
        where: { id: sessionDbId },
        data: {
          proxyHost: proxy.host,
          proxyPort: proxy.port,
          proxyUsername: proxy.username,
          proxyPasswordEnc: proxy.password
            ? encrypt(proxy.password)
            : undefined,
          proxyProtocol: proxy.protocol,
        },
      });
      expiresAt = new Date(
        Date.now() + dur * 24 * 60 * 60 * 1000
      );
    }

    await prisma.agentSession.update({
      where: { id: sessionDbId },
      data: {
        status: SESSION_STATUS.ACTIVE,
        backendOrderNo,
        expiresAt,
      },
    });
  } catch (err) {
    console.error(
      `[provision] session #${sessionDbId} failed:`,
      (err as Error).message
    );
    await prisma.agentSession.update({
      where: { id: sessionDbId },
      data: {
        status: SESSION_STATUS.ERROR,
        lastErrorType: (err as Error).message.slice(
          0,
          50
        ),
      },
    });
  }
}

async function waitForStaticProxy(
  userToken: string,
  orderNo: string,
  initialPayload: Record<string, unknown>
): Promise<{
  host: string;
  port: number;
  username: string | null;
  password: string | null;
  protocol: string;
} | null> {
  const initial = extractProxyInfo(initialPayload);
  if (initial) return initial;

  const deadline =
    Date.now() + STATIC_ORDER_READY_TIMEOUT_MS;
  let lastStatus = String(
    initialPayload.status ?? 'unknown'
  );

  while (Date.now() < deadline) {
    const orders = await backend.getStaticOrders(
      userToken,
      {
        page: 1,
        page_size: 10,
        search: orderNo,
      }
    );
    const matching =
      orders.items.find(
        (item) => {
          const record =
            item as unknown as Record<string, unknown>;
          return (
            item.order_no === orderNo ||
            record.orderNo === orderNo
          );
        }
      ) ?? orders.items[0];
    if (matching) {
      const record =
        matching as unknown as Record<string, unknown>;
      lastStatus = String(
        matching.status ??
          record.effective_status ??
          lastStatus
      );
      const proxy = extractProxyInfo(matching);
      if (proxy) return proxy;
      if (
        ['failed', 'cancelled', 'released'].includes(
          lastStatus
        )
      ) {
        throw new Error(
          `Static order ${orderNo} entered ${lastStatus} status`
        );
      }
    }
    await sleep(STATIC_ORDER_POLL_MS);
  }

  throw new Error(
    `Static order ${orderNo} did not return proxy info before timeout; last_status=${lastStatus}`
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function dynamicValidTimeMinutes(input: {
  rotation_interval_sec: number;
}): number {
  if (input.rotation_interval_sec > 0) {
    return Math.min(
      89,
      Math.max(
        1,
        Math.ceil(input.rotation_interval_sec / 60)
      )
    );
  }
  return 5;
}

export async function getSession(
  agentId: number,
  sessionId: string
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

  return formatSession(session);
}

export async function listSessions(
  agentId: number,
  query: ListSessionsQuery
) {
  const where: Record<string, unknown> = { agentId };
  if (query.status) where.status = query.status;
  if (query.session_type) {
    where.sessionType = query.session_type;
  }

  const [sessions, total] = await Promise.all([
    prisma.agentSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.page_size,
      take: query.page_size,
    }),
    prisma.agentSession.count({ where }),
  ]);

  return {
    items: sessions.map(formatSession),
    total,
    page: query.page,
    page_size: query.page_size,
  };
}

export async function rotateSession(
  agentId: number,
  sessionId: string,
  reason: string
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

  if (session.status !== SESSION_STATUS.ACTIVE) {
    throw new AppError(
      ERROR_CODES.SESSION_EXPIRED,
      `Cannot rotate session in ${session.status} status`
    );
  }

  if (
    session.sessionType !== SESSION_TYPE.DYNAMIC
  ) {
    throw new AppError(
      ERROR_CODES.BACKEND_ERROR,
      'Only dynamic sessions support rotate. Renew or recreate static sessions instead.'
    );
  }

  if (!session.backendProductNo) {
    throw new AppError(
      ERROR_CODES.BACKEND_ERROR,
      'No backend product associated'
    );
  }

  await prisma.agentSession.update({
    where: { id: session.id },
    data: {
      status: SESSION_STATUS.ROTATING,
      lastRotateReason: reason,
    },
  });

  try {
    const agent = await prisma.agentApp.findUnique({
      where: { id: agentId },
    });
    if (
      !agent?.backendUsername ||
      !agent.backendPasswordEnc
    ) {
      throw new AppError(
        ERROR_CODES.BACKEND_ERROR,
        'Backend credentials missing'
      );
    }

    const backendPassword = decrypt(
      agent.backendPasswordEnc
    );
    const userToken = await backend.getUserToken(
      agent.backendUsername,
      backendPassword
    );
    const product = await lookupProductInfo(
      userToken,
      session.backendProductNo,
      session.sessionType
    );
    const result = await backend.extractDynamicProxy(
      userToken,
      {
        productNo: session.backendProductNo,
        proxyType: product.proxyType,
        username: undefined,
        protocol: session.proxyProtocol,
        quantity: 1,
        validTime: dynamicValidTimeMinutes({
          rotation_interval_sec:
            session.rotationIntervalSec,
        }),
        countryCode: session.countryCode ?? undefined,
        cityCode: session.cityCode ?? undefined,
      }
    );

    const proxyInfo = extractProxyInfo(result);
    if (!proxyInfo) {
      throw new Error(
        'Dynamic proxy rotation returned no proxy endpoint'
      );
    }

    await prisma.agentSession.update({
      where: { id: session.id },
      data: {
        status: SESSION_STATUS.ACTIVE,
        proxyHost: proxyInfo.host,
        proxyPort: proxyInfo.port,
        proxyUsername:
          proxyInfo.username ??
          session.proxyUsername,
        proxyPasswordEnc: proxyInfo.password
          ? encrypt(proxyInfo.password)
          : session.proxyPasswordEnc,
        proxyProtocol: proxyInfo.protocol,
        lastRotatedAt: new Date(),
        lastRotateReason: reason,
      },
    });

    const updated = await prisma.agentSession.findUnique({
      where: { id: session.id },
    });

    return formatSession(updated!);
  } catch (err) {
    await prisma.agentSession.update({
      where: { id: session.id },
      data: {
        status: SESSION_STATUS.ACTIVE,
        lastErrorType: (err as Error).message.slice(
          0,
          50
        ),
      },
    });
    throw err;
  }
}

export async function terminateSession(
  agentId: number,
  sessionId: string
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

  if (
    session.sessionType === SESSION_TYPE.STATIC &&
    session.backendOrderNo &&
    session.status !== SESSION_STATUS.TERMINATED
  ) {
    await backend.releaseZtProxyStaticOrder(
      session.backendOrderNo
    );
  }

  await prisma.agentSession.update({
    where: { id: session.id },
    data: { status: SESSION_STATUS.TERMINATED },
  });

  return {
    session_id: session.sessionId,
    status: SESSION_STATUS.TERMINATED,
    terminated_at: new Date().toISOString(),
  };
}

export async function renewSession(
  agentId: number,
  sessionId: string,
  duration: number
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

  if (
    session.status !== SESSION_STATUS.ACTIVE &&
    session.status !== SESSION_STATUS.EXPIRED
  ) {
    throw new AppError(
      ERROR_CODES.SESSION_EXPIRED,
      `Cannot renew session in ${session.status} status`
    );
  }

  if (!session.backendOrderNo) {
    throw new AppError(
      ERROR_CODES.BACKEND_ERROR,
      'No backend order associated'
    );
  }

  const agent = await prisma.agentApp.findUnique({
    where: { id: agentId },
  });
  if (!agent?.backendUserId) {
    throw new AppError(
      ERROR_CODES.BACKEND_ERROR,
      'Backend user ID missing'
    );
  }

  await backend.renewStaticOrder({
    userId: agent.backendUserId,
    orderNo: session.backendOrderNo,
    productNo: session.backendProductNo ?? '',
    duration,
    country: session.countryCode ?? '',
    city: session.cityCode ?? '',
  });

  const durationMs =
    duration * 30 * 24 * 60 * 60 * 1000;
  const newExpiry = session.expiresAt
    ? new Date(
        session.expiresAt.getTime() + durationMs
      )
    : new Date(Date.now() + durationMs);

  const updated = await prisma.agentSession.update({
    where: { id: session.id },
    data: {
      status: SESSION_STATUS.ACTIVE,
      expiresAt: newExpiry,
    },
  });

  return formatSession(updated);
}

export async function addWhitelist(
  agentId: number,
  sessionId: string,
  ips: string[]
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

  if (!session.backendOrderNo) {
    throw new AppError(
      ERROR_CODES.BACKEND_ERROR,
      'No backend order associated'
    );
  }

  const agent = await prisma.agentApp.findUnique({
    where: { id: agentId },
  });
  if (
    !agent?.backendUsername ||
    !agent.backendPasswordEnc
  ) {
    throw new AppError(
      ERROR_CODES.BACKEND_ERROR,
      'Backend credentials missing'
    );
  }

  const backendPassword = decrypt(
    agent.backendPasswordEnc
  );
  const userToken = await backend.getUserToken(
    agent.backendUsername,
    backendPassword
  );

  await backend.addIpWhitelist(
    userToken,
    session.backendOrderNo,
    ips
  );

  return { session_id: sessionId, whitelisted_ips: ips };
}

function formatSession(
  session: {
    sessionId: string;
    sessionType: string;
    status: string;
    proxyHost: string | null;
    proxyPort: number | null;
    proxyUsername: string | null;
    proxyPasswordEnc: string | null;
    proxyProtocol: string;
    countryCode: string | null;
    cityCode: string | null;
    ispType: string | null;
    identityId: string | null;
    identityPool: string | null;
    rotationMode: string;
    rotationIntervalSec: number;
    lastRotatedAt: Date | null;
    lastRotateReason: string | null;
    backendOrderNo: string | null;
    riskLevel: string;
    healthScore: number;
    successRate: unknown;
    consecutiveFailures: number;
    lastErrorType: string | null;
    totalEvents: number;
    bytesUsed: bigint;
    requestsCount: number;
    expiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }
) {
  return {
    session_id: session.sessionId,
    session_type: session.sessionType,
    status: session.status,
    proxy:
      session.status === SESSION_STATUS.ACTIVE
        ? {
            host: session.proxyHost,
            port: session.proxyPort,
            username: session.proxyUsername,
            password: session.proxyPasswordEnc
              ? decrypt(session.proxyPasswordEnc)
              : null,
            protocol: session.proxyProtocol,
            full_url: buildProxyUrl(session),
          }
        : undefined,
    location: {
      country_code: session.countryCode,
      city_code: session.cityCode,
      isp_type: session.ispType,
    },
    identity: {
      identity_id: session.identityId,
      identity_pool: session.identityPool,
    },
    rotation: {
      mode: session.rotationMode,
      interval_sec: session.rotationIntervalSec,
      last_rotated_at:
        session.lastRotatedAt?.toISOString(),
      last_reason: session.lastRotateReason,
    },
    health: {
      risk_level: session.riskLevel,
      health_score: session.healthScore,
      success_rate: Number(session.successRate),
      consecutive_failures:
        session.consecutiveFailures,
      last_error_type: session.lastErrorType,
      total_events: session.totalEvents,
    },
    usage: {
      bytes_used: Number(session.bytesUsed),
      requests_count: session.requestsCount,
    },
    backend_order_no: session.backendOrderNo,
    expires_at: session.expiresAt?.toISOString(),
    created_at: session.createdAt.toISOString(),
    updated_at: session.updatedAt.toISOString(),
  };
}

function extractProxyInfo(
  rawValue: unknown
):
  | {
      host: string;
      port: number;
      username: string | null;
      password: string | null;
      protocol: string;
    }
  | null {
  if (Array.isArray(rawValue)) {
    for (const item of rawValue) {
      const proxy = extractProxyInfo(item);
      if (proxy) return proxy;
    }
    return null;
  }

  const value = rawValue as Record<string, unknown>;
  if (!value || typeof value !== 'object') {
    return null;
  }

  const directHost =
    (value.host as string | undefined) ??
    (value.ip as string | undefined) ??
    (value.proxy_ip as string | undefined) ??
    (value.proxyIp as string | undefined);
  const directPort =
    value.port ??
    value.proxy_port ??
    value.proxyPort;
  const directUsername =
    (value.username as string | undefined) ??
    (value.user as string | undefined) ??
    (value.proxy_username as string | undefined) ??
    (value.proxyUsername as string | undefined);
  const directPassword =
    (value.password as string | undefined) ??
    (value.pass as string | undefined) ??
    (value.proxy_password as string | undefined) ??
    (value.proxyPassword as string | undefined);
  const directProtocol =
    (value.protocol as string | undefined) ?? 'socks5';

  if (directHost && directPort) {
    return {
      host: directHost,
      port:
        typeof directPort === 'number'
          ? directPort
          : Number(directPort),
      username: directUsername ?? null,
      password: directPassword ?? null,
      protocol: directProtocol,
    };
  }

  const nestedProxy =
    value.proxy as Record<string, unknown> | undefined;
  const nestedCandidates = [
    nestedProxy,
    value.proxy_info,
    value.proxyInfo,
    value.orderInfo,
    value.data,
    value.instances,
    (value.orderInfo as Record<string, unknown> | undefined)
      ?.instances,
  ];
  for (const candidate of nestedCandidates) {
    if (!candidate) continue;
    const proxy = extractProxyInfo(candidate);
    if (proxy) return proxy;
  }

  const proxyList =
    (nestedProxy?.list as unknown[] | undefined) ??
    (value.list as unknown[] | undefined);
  if (
    Array.isArray(proxyList) &&
    typeof proxyList[0] !== 'string'
  ) {
    const proxy = extractProxyInfo(proxyList);
    if (proxy) return proxy;
  }
  const proxyUrl =
    (nestedProxy?.url as string | undefined) ??
    (nestedProxy?.proxyUrl as string | undefined) ??
    (typeof proxyList?.[0] === 'string'
      ? (proxyList[0] as string)
      : undefined) ??
    (value.full_url as string | undefined) ??
    (value.proxy_url as string | undefined);

  if (!proxyUrl) return null;

  const lineProxy = parseProxyLine(proxyUrl);
  if (lineProxy) return lineProxy;

  try {
    const parsed = new URL(proxyUrl);
    return {
      host: parsed.hostname,
      port: Number(parsed.port),
      username: parsed.username
        ? decodeURIComponent(parsed.username)
        : null,
      password: parsed.password
        ? decodeURIComponent(parsed.password)
        : null,
      protocol: parsed.protocol.replace(':', '') || 'socks5',
    };
  } catch {
    return null;
  }
}

function parseProxyLine(line: string):
  | {
      host: string;
      port: number;
      username: string | null;
      password: string | null;
      protocol: string;
    }
  | null {
  const raw = line.trim();
  if (!raw) return null;
  if (raw.includes('://')) return null;

  const atIdx = raw.lastIndexOf('@');
  if (atIdx > 0) {
    const userPass = raw.slice(0, atIdx);
    const hostPort = raw.slice(atIdx + 1);
    const [username, ...passwordParts] =
      userPass.split(':');
    const [host, portText] = hostPort.split(':');
    const port = Number(portText);
    if (host && Number.isFinite(port)) {
      return {
        host,
        port,
        username: username || null,
        password: passwordParts.join(':') || null,
        protocol: 'socks5',
      };
    }
  }

  const parts = raw.split(':');
  if (parts.length >= 4) {
    const [host, portText, username, ...passwordParts] =
      parts;
    const port = Number(portText);
    if (host && Number.isFinite(port)) {
      return {
        host,
        port,
        username: username || null,
        password: passwordParts.join(':') || null,
        protocol: 'socks5',
      };
    }
  }

  return null;
}

function buildProxyUrl(session: {
  proxyHost: string | null;
  proxyPort: number | null;
  proxyUsername: string | null;
  proxyPasswordEnc: string | null;
  proxyProtocol: string;
}): string | null {
  if (!session.proxyHost || !session.proxyPort) {
    return null;
  }

  const protocol = session.proxyProtocol || 'socks5';
  const password = session.proxyPasswordEnc
    ? decrypt(session.proxyPasswordEnc)
    : null;
  const auth =
    session.proxyUsername && password
      ? `${encodeURIComponent(session.proxyUsername)}:` +
        `${encodeURIComponent(password)}@`
      : '';

  return (
    `${protocol}://` +
    `${auth}${session.proxyHost}:${session.proxyPort}`
  );
}
