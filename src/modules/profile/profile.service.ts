import { prisma } from '../../app';
import { AppError } from '../../utils/response';
import { ERROR_CODES } from '../../config/constants';
import {
  generateProfileId,
  generateGroupId,
} from '../../utils/id-generator';
import {
  generateFingerprint,
  validateFingerprint,
} from './fingerprint.service';
import type {
  CreateProfileRequest,
  UpdateProfileRequest,
  ListProfilesQuery,
  FingerprintConfig,
} from './profile.schema';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('profile-service');

const MAX_PROFILES_PER_AGENT = 500;

export async function createProfile(
  agentId: number,
  data: CreateProfileRequest
) {
  const count = await prisma.browserProfile.count({
    where: { agentId, status: 'active' },
  });
  if (count >= MAX_PROFILES_PER_AGENT) {
    throw new AppError(
      ERROR_CODES.PROFILE_LIMIT_REACHED,
      `Max ${MAX_PROFILES_PER_AGENT} active profiles`
    );
  }

  let fp = data.fingerprint ?? {};
  if (data.auto_generate_fingerprint) {
    fp = generateFingerprint({
      os: fp.os,
      browser: fp.browser,
    });
  }

  const profileId = generateProfileId();
  log.info({
    event: 'profile_create',
    agentId,
    profileId,
    name: data.name,
    auto_fp: !!data.auto_generate_fingerprint,
  });
  const profile = await prisma.browserProfile.create({
    data: {
      profileId,
      agentId,
      name: data.name,
      fingerprint: fp as object,
      tags: data.tags ?? [],
      groupId: data.group_id
        ? await resolveGroupId(agentId, data.group_id)
        : undefined,
      notes: data.notes,
    },
  });

  return formatProfile(profile);
}

export async function getProfile(
  agentId: number,
  profileId: string
) {
  const profile = await prisma.browserProfile.findFirst({
    where: { profileId, agentId },
  });
  if (!profile) {
    throw new AppError(
      ERROR_CODES.PROFILE_NOT_FOUND,
      `Profile ${profileId} not found`
    );
  }
  return formatProfile(profile);
}

export async function updateProfile(
  agentId: number,
  profileId: string,
  data: UpdateProfileRequest
) {
  const existing = await prisma.browserProfile.findFirst({
    where: { profileId, agentId },
  });
  if (!existing) {
    throw new AppError(
      ERROR_CODES.PROFILE_NOT_FOUND,
      `Profile ${profileId} not found`
    );
  }

  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.tags !== undefined) updateData.tags = data.tags;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.status !== undefined) updateData.status = data.status;

  if (data.fingerprint) {
    const current = existing.fingerprint as object;
    updateData.fingerprint = deepMerge(
      current,
      data.fingerprint as object
    );
  }

  if (data.group_id !== undefined) {
    updateData.groupId = data.group_id
      ? await resolveGroupId(agentId, data.group_id)
      : null;
  }

  const updated = await prisma.browserProfile.update({
    where: { profileId },
    data: updateData,
  });

  return formatProfile(updated);
}

export async function deleteProfile(
  agentId: number,
  profileId: string
) {
  const existing = await prisma.browserProfile.findFirst({
    where: { profileId, agentId },
  });
  if (!existing) {
    throw new AppError(
      ERROR_CODES.PROFILE_NOT_FOUND,
      `Profile ${profileId} not found`
    );
  }

  await prisma.browserProfile.update({
    where: { profileId },
    data: { status: 'archived' },
  });

  return { profile_id: profileId, status: 'archived' };
}

export async function listProfiles(
  agentId: number,
  query: ListProfilesQuery
) {
  const where: Record<string, unknown> = { agentId };
  if (query.status && query.status !== 'all') {
    where.status = query.status;
  }
  if (query.group_id) {
    const grp = await prisma.profileGroup.findFirst({
      where: { groupId: query.group_id, agentId },
    });
    if (grp) where.groupId = grp.id;
  }

  const [items, total] = await Promise.all([
    prisma.browserProfile.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.page_size,
      take: query.page_size,
    }),
    prisma.browserProfile.count({ where }),
  ]);

  return {
    items: items.map(formatProfile),
    total,
    page: query.page,
    page_size: query.page_size,
  };
}

export async function duplicateProfile(
  agentId: number,
  profileId: string,
  newName?: string,
  regenerate = false
) {
  const source = await prisma.browserProfile.findFirst({
    where: { profileId, agentId },
  });
  if (!source) {
    throw new AppError(
      ERROR_CODES.PROFILE_NOT_FOUND,
      `Profile ${profileId} not found`
    );
  }

  let fp = source.fingerprint as FingerprintConfig;
  if (regenerate) {
    fp = generateFingerprint({ os: fp.os, browser: fp.browser });
  }

  const newId = generateProfileId();
  const cloned = await prisma.browserProfile.create({
    data: {
      profileId: newId,
      agentId,
      name: newName ?? `${source.name} (copy)`,
      fingerprint: fp as object,
      tags: source.tags as string[],
      groupId: source.groupId,
      notes: source.notes,
    },
  });

  return formatProfile(cloned);
}

export async function batchCreateProfiles(
  agentId: number,
  count: number,
  namePrefix?: string,
  template?: FingerprintConfig
) {
  const profiles = [];
  for (let i = 0; i < count; i++) {
    const fp = generateFingerprint({
      os: template?.os,
      browser: template?.browser,
    });
    const profileId = generateProfileId();
    const name = namePrefix
      ? `${namePrefix}-${String(i + 1).padStart(3, '0')}`
      : `Profile-${profileId.slice(5)}`;

    profiles.push({
      profileId,
      agentId,
      name,
      fingerprint: fp as object,
      tags: [],
    });
  }

  await prisma.browserProfile.createMany({ data: profiles });

  return {
    created_count: count,
    profile_ids: profiles.map(p => p.profileId),
  };
}

export async function bindProxy(
  agentId: number,
  profileId: string,
  data: {
    session_id?: string;
    proxy_id?: string;
    country?: string;
    auto_match?: boolean;
  }
) {
  const profile = await prisma.browserProfile.findFirst({
    where: { profileId, agentId },
  });
  if (!profile) {
    throw new AppError(
      ERROR_CODES.PROFILE_NOT_FOUND,
      `Profile ${profileId} not found`
    );
  }

  const binding: Record<string, unknown> = {};

  if (data.session_id) {
    const session = await prisma.agentSession.findFirst({
      where: { sessionId: data.session_id, agentId },
    });
    if (!session) {
      throw new AppError(
        ERROR_CODES.SESSION_NOT_FOUND,
        `Session ${data.session_id} not found`
      );
    }
    binding.session_id = session.sessionId;
    binding.proxy_url =
      `${session.proxyProtocol}://` +
      `${session.proxyUsername}:***@` +
      `${session.proxyHost}:${session.proxyPort}`;
    binding.country = session.countryCode;
  }

  if (data.proxy_id) {
    const proxy = await prisma.agentProxy.findFirst({
      where: { proxyId: data.proxy_id, agentId },
    });
    if (!proxy) {
      throw new AppError(
        ERROR_CODES.PROXY_NOT_FOUND,
        `Proxy ${data.proxy_id} not found`
      );
    }
    binding.proxy_id = proxy.proxyId;
    binding.proxy_url =
      `${proxy.proxyType}://${proxy.host}:${proxy.port}`;
    binding.country = proxy.countryCode;
  }

  const fp = profile.fingerprint as FingerprintConfig;
  const country = (binding.country as string) ?? data.country;
  const validation = validateFingerprint(fp, country);

  const updated = await prisma.browserProfile.update({
    where: { profileId },
    data: {
      proxyBinding: binding as Record<string, string>,
    },
  });

  return {
    ...formatProfile(updated),
    validation,
  };
}

export async function validateFingerprintCheck(
  fp: FingerprintConfig,
  proxyCountry?: string
) {
  return validateFingerprint(fp, proxyCountry);
}

async function resolveGroupId(
  agentId: number,
  groupIdOrName: string
): Promise<number | undefined> {
  let group = await prisma.profileGroup.findFirst({
    where: {
      agentId,
      OR: [
        { groupId: groupIdOrName },
        { name: groupIdOrName },
      ],
    },
  });

  if (!group) {
    group = await prisma.profileGroup.create({
      data: {
        groupId: generateGroupId(),
        agentId,
        name: groupIdOrName,
      },
    });
  }

  return group.id;
}

function formatProfile(p: {
  profileId: string;
  name: string;
  status: string;
  fingerprint: unknown;
  proxyBinding: unknown;
  tags: unknown;
  notes: string | null;
  launchCount: number;
  lastLaunchedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    profile_id: p.profileId,
    name: p.name,
    status: p.status,
    fingerprint: p.fingerprint,
    proxy_binding: p.proxyBinding,
    tags: p.tags,
    notes: p.notes,
    launch_count: p.launchCount,
    last_launched_at: p.lastLaunchedAt?.toISOString() ?? null,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
  };
}

function deepMerge(target: object, source: object): object {
  const result = { ...target } as Record<string, unknown>;
  for (const [key, val] of Object.entries(source)) {
    if (
      val && typeof val === 'object' && !Array.isArray(val) &&
      result[key] && typeof result[key] === 'object'
    ) {
      result[key] = deepMerge(
        result[key] as object,
        val as object
      );
    } else {
      result[key] = val;
    }
  }
  return result;
}
