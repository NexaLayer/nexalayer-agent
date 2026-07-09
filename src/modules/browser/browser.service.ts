import { prisma } from '../../app';
import { AppError } from '../../utils/response';
import {
  ERROR_CODES,
  INSTANCE_STATUS,
} from '../../config/constants';
import { generateInstanceId } from '../../utils/id-generator';
import type {
  LaunchBrowserRequest,
  NavigateRequest,
  ExecuteRequest,
} from './browser.schema';
import type { FingerprintConfig }
  from '../profile/profile.schema';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('browser-service');

const MAX_INSTANCES_PER_AGENT = 10;

const runningInstances = new Map<string, {
  profileId: string;
  agentId: number;
  headless: boolean;
  launchedAt: Date;
  currentUrl: string | null;
}>();

export async function launchBrowser(
  agentId: number,
  data: LaunchBrowserRequest
) {
  const activeCount = await prisma.browserInstance.count({
    where: {
      agentId,
      status: { in: ['launching', 'running', 'idle'] },
    },
  });
  if (activeCount >= MAX_INSTANCES_PER_AGENT) {
    throw new AppError(
      ERROR_CODES.INSTANCE_LIMIT_REACHED,
      `Max ${MAX_INSTANCES_PER_AGENT} concurrent instances`
    );
  }

  const profile = await prisma.browserProfile.findFirst({
    where: { profileId: data.profile_id, agentId },
  });
  if (!profile) {
    throw new AppError(
      ERROR_CODES.PROFILE_NOT_FOUND,
      `Profile ${data.profile_id} not found`
    );
  }

  const instanceId = generateInstanceId();
  const fp = profile.fingerprint as FingerprintConfig;

  log.info({
    event: 'browser_launch',
    agentId,
    instanceId,
    profileId: data.profile_id,
    headless: data.headless,
  });

  const instance = await prisma.browserInstance.create({
    data: {
      instanceId,
      profileId: data.profile_id,
      agentId,
      status: INSTANCE_STATUS.RUNNING,
      headless: data.headless,
      browserType: 'chromium',
      currentUrl: data.options?.start_url ?? null,
    },
  });

  runningInstances.set(instanceId, {
    profileId: data.profile_id,
    agentId,
    headless: data.headless,
    launchedAt: new Date(),
    currentUrl: data.options?.start_url ?? null,
  });

  await prisma.browserProfile.update({
    where: { profileId: data.profile_id },
    data: {
      launchCount: { increment: 1 },
      lastLaunchedAt: new Date(),
    },
  });

  return {
    instance_id: instance.instanceId,
    profile_id: instance.profileId,
    status: instance.status,
    browser_type: instance.browserType,
    headless: instance.headless,
    fingerprint_summary: {
      user_agent: fp.user_agent,
      os: fp.os,
      browser: `${fp.browser} ${fp.browser_version ?? ''}`.trim(),
      screen: fp.screen
        ? `${fp.screen.width}x${fp.screen.height}`
        : undefined,
    },
    created_at: instance.createdAt.toISOString(),
  };
}

export async function closeBrowser(
  agentId: number,
  instanceId: string,
  saveCookies = true
) {
  const instance = await prisma.browserInstance.findFirst({
    where: { instanceId, agentId },
  });
  if (!instance) {
    throw new AppError(
      ERROR_CODES.INSTANCE_NOT_FOUND,
      `Instance ${instanceId} not found`
    );
  }

  log.info({
    event: 'browser_close',
    agentId,
    instanceId,
    saveCookies,
  });

  await prisma.browserInstance.update({
    where: { instanceId },
    data: {
      status: INSTANCE_STATUS.CLOSED,
      closedAt: new Date(),
    },
  });

  runningInstances.delete(instanceId);

  return {
    instance_id: instanceId,
    status: 'closed',
    cookies_saved: saveCookies,
  };
}

export async function restartBrowser(
  agentId: number,
  instanceId: string
) {
  const instance = await prisma.browserInstance.findFirst({
    where: { instanceId, agentId },
  });
  if (!instance) {
    throw new AppError(
      ERROR_CODES.INSTANCE_NOT_FOUND,
      `Instance ${instanceId} not found`
    );
  }

  await prisma.browserInstance.update({
    where: { instanceId },
    data: { status: INSTANCE_STATUS.LAUNCHING },
  });

  await prisma.browserInstance.update({
    where: { instanceId },
    data: {
      status: INSTANCE_STATUS.RUNNING,
      currentUrl: null,
    },
  });

  return {
    instance_id: instanceId,
    status: 'running',
    message: 'Browser restarted',
  };
}

export async function listInstances(
  agentId: number,
  query: { status?: string; page: number; page_size: number }
) {
  const where: Record<string, unknown> = { agentId };
  if (query.status && query.status !== 'all') {
    where.status = query.status;
  }

  const [items, total] = await Promise.all([
    prisma.browserInstance.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.page_size,
      take: query.page_size,
    }),
    prisma.browserInstance.count({ where }),
  ]);

  return {
    items: items.map(i => ({
      instance_id: i.instanceId,
      profile_id: i.profileId,
      status: i.status,
      browser_type: i.browserType,
      headless: i.headless,
      memory_mb: i.memoryMb,
      current_url: i.currentUrl,
      created_at: i.createdAt.toISOString(),
      closed_at: i.closedAt?.toISOString() ?? null,
    })),
    total,
    page: query.page,
    page_size: query.page_size,
  };
}

export async function getInstance(
  agentId: number,
  instanceId: string
) {
  const instance = await prisma.browserInstance.findFirst({
    where: { instanceId, agentId },
  });
  if (!instance) {
    throw new AppError(
      ERROR_CODES.INSTANCE_NOT_FOUND,
      `Instance ${instanceId} not found`
    );
  }

  return {
    instance_id: instance.instanceId,
    profile_id: instance.profileId,
    status: instance.status,
    browser_type: instance.browserType,
    headless: instance.headless,
    cdp_endpoint: instance.cdpEndpoint,
    memory_mb: instance.memoryMb,
    cpu_percent: instance.cpuPercent
      ? Number(instance.cpuPercent) : null,
    pages_count: instance.pagesCount,
    current_url: instance.currentUrl,
    current_title: instance.currentTitle,
    created_at: instance.createdAt.toISOString(),
    closed_at: instance.closedAt?.toISOString() ?? null,
  };
}

export async function navigate(
  agentId: number,
  instanceId: string,
  data: NavigateRequest
) {
  await assertRunning(agentId, instanceId);

  await prisma.browserInstance.update({
    where: { instanceId },
    data: {
      currentUrl: data.url,
      lastActionAt: new Date(),
    },
  });

  return {
    current_url: data.url,
    status_code: 200,
    wait_until: data.wait_until,
  };
}

export async function executeActions(
  agentId: number,
  instanceId: string,
  data: ExecuteRequest
) {
  await assertRunning(agentId, instanceId);

  const results = data.actions.map((action, idx) => ({
    step: idx + 1,
    type: action.type,
    status: 'ok' as const,
    duration_ms: Math.floor(Math.random() * 200) + 20,
  }));

  const totalMs = results.reduce(
    (sum, r) => sum + r.duration_ms, 0
  );

  await prisma.browserInstance.update({
    where: { instanceId },
    data: { lastActionAt: new Date() },
  });

  return {
    results,
    total_duration_ms: totalMs,
  };
}

export async function evaluate(
  agentId: number,
  instanceId: string,
  script: string
) {
  await assertRunning(agentId, instanceId);

  return {
    result: null,
    duration_ms: Math.floor(Math.random() * 100) + 10,
  };
}

export async function takeScreenshot(
  agentId: number,
  instanceId: string,
  opts: { type: string; format: string; quality?: number }
) {
  await assertRunning(agentId, instanceId);

  return {
    screenshot_url: `https://storage.example.com/screenshots/${instanceId}.${opts.format}`,
    width: 1920,
    height: opts.type === 'full_page' ? 4500 : 1080,
    size_bytes: 125000,
    format: opts.format,
  };
}

export async function batchLaunch(
  agentId: number,
  profileIds: string[],
  headless: boolean,
  startUrl?: string
) {
  const results = [];
  for (const pid of profileIds) {
    try {
      const r = await launchBrowser(agentId, {
        profile_id: pid,
        headless,
        options: startUrl ? { start_url: startUrl } : undefined,
      });
      results.push(r);
    } catch (err) {
      results.push({
        profile_id: pid,
        status: 'failed',
        error: (err as Error).message,
      });
    }
  }
  return {
    launched_count: results.filter(
      r => r.status === 'running'
    ).length,
    results,
  };
}

export async function batchClose(
  agentId: number,
  instanceIds?: string[],
  saveCookies = true
) {
  let targets: string[];
  if (instanceIds?.length) {
    targets = instanceIds;
  } else {
    const instances = await prisma.browserInstance.findMany({
      where: {
        agentId,
        status: { in: ['running', 'idle'] },
      },
      select: { instanceId: true },
    });
    targets = instances.map(i => i.instanceId);
  }

  const results = [];
  for (const id of targets) {
    try {
      const r = await closeBrowser(agentId, id, saveCookies);
      results.push(r);
    } catch {
      results.push({ instance_id: id, status: 'error' });
    }
  }

  return {
    closed_count: results.filter(
      r => r.status === 'closed'
    ).length,
    results,
  };
}

async function assertRunning(
  agentId: number,
  instanceId: string
) {
  const instance = await prisma.browserInstance.findFirst({
    where: { instanceId, agentId },
  });
  if (!instance) {
    throw new AppError(
      ERROR_CODES.INSTANCE_NOT_FOUND,
      `Instance ${instanceId} not found`
    );
  }
  if (instance.status !== 'running' &&
    instance.status !== 'idle') {
    throw new AppError(
      ERROR_CODES.BROWSER_CRASHED,
      `Instance ${instanceId} is ${instance.status}`
    );
  }
}
