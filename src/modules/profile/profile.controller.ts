import { FastifyRequest, FastifyReply } from 'fastify';
import {
  createProfileSchema,
  updateProfileSchema,
  listProfilesSchema,
  duplicateProfileSchema,
  batchCreateSchema,
  bindProxySchema,
  generateFingerprintSchema,
  validateFingerprintSchema,
  importProfilesSchema,
  exportProfilesSchema,
} from './profile.schema';
import * as profileService from './profile.service';
import { generateFingerprint, validateFingerprint }
  from './fingerprint.service';
import * as proxyManager from './proxy-manager.service';
import {
  sendSuccess,
  sendPaginated,
  AppError,
} from '../../utils/response';
import { ERROR_CODES } from '../../config/constants';

function getCtx(request: FastifyRequest) {
  const ctx = request.agentContext;
  if (!ctx) {
    throw new AppError(
      ERROR_CODES.AUTH_INVALID_KEY,
      'Not authenticated'
    );
  }
  return ctx;
}

export async function handleCreate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const ctx = getCtx(request);
  const body = createProfileSchema.parse(request.body);
  const result = await profileService.createProfile(
    ctx.agentId, body
  );
  sendSuccess(reply, result, 201, request.startTime);
}

export async function handleGet(
  request: FastifyRequest<{
    Params: { profile_id: string };
  }>,
  reply: FastifyReply
) {
  const ctx = getCtx(request);
  const result = await profileService.getProfile(
    ctx.agentId, request.params.profile_id
  );
  sendSuccess(reply, result, 200, request.startTime);
}

export async function handleUpdate(
  request: FastifyRequest<{
    Params: { profile_id: string };
  }>,
  reply: FastifyReply
) {
  const ctx = getCtx(request);
  const body = updateProfileSchema.parse(request.body);
  const result = await profileService.updateProfile(
    ctx.agentId, request.params.profile_id, body
  );
  sendSuccess(reply, result, 200, request.startTime);
}

export async function handleDelete(
  request: FastifyRequest<{
    Params: { profile_id: string };
  }>,
  reply: FastifyReply
) {
  const ctx = getCtx(request);
  const result = await profileService.deleteProfile(
    ctx.agentId, request.params.profile_id
  );
  sendSuccess(reply, result, 200, request.startTime);
}

export async function handleList(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const ctx = getCtx(request);
  const query = listProfilesSchema.parse(request.query);
  const result = await profileService.listProfiles(
    ctx.agentId, query
  );
  sendPaginated(
    reply,
    result.items,
    result.total,
    result.page,
    result.page_size,
    request.startTime
  );
}

export async function handleDuplicate(
  request: FastifyRequest<{
    Params: { profile_id: string };
  }>,
  reply: FastifyReply
) {
  const ctx = getCtx(request);
  const body = duplicateProfileSchema.parse(
    request.body ?? {}
  );
  const result = await profileService.duplicateProfile(
    ctx.agentId,
    request.params.profile_id,
    body.new_name,
    body.regenerate_fingerprint
  );
  sendSuccess(reply, result, 201, request.startTime);
}

export async function handleBatchCreate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const ctx = getCtx(request);
  const body = batchCreateSchema.parse(request.body);
  const result = await profileService.batchCreateProfiles(
    ctx.agentId,
    body.count,
    body.name_prefix,
    body.template
  );
  sendSuccess(reply, result, 201, request.startTime);
}

export async function handleBindProxy(
  request: FastifyRequest<{
    Params: { profile_id: string };
  }>,
  reply: FastifyReply
) {
  const ctx = getCtx(request);
  const body = bindProxySchema.parse(request.body);
  const result = await profileService.bindProxy(
    ctx.agentId, request.params.profile_id, body
  );
  sendSuccess(reply, result, 200, request.startTime);
}

export async function handleGenerateFingerprint(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const body = generateFingerprintSchema.parse(
    request.body
  );
  const fp = generateFingerprint({
    os: body.os,
    browser: body.browser,
    country: body.country,
  });
  sendSuccess(reply, fp, 200, request.startTime);
}

export async function handleValidateFingerprint(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const body = validateFingerprintSchema.parse(
    request.body
  );
  const result = validateFingerprint(
    body.fingerprint,
    body.proxy_country
  );
  sendSuccess(reply, result, 200, request.startTime);
}

export async function handleImport(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const ctx = getCtx(request);
  const body = importProfilesSchema.parse(request.body);
  const results = [];
  for (const p of body.profiles) {
    const created = await profileService.createProfile(
      ctx.agentId,
      {
        name: p.name,
        fingerprint: p.fingerprint,
        auto_generate_fingerprint:
          body.auto_generate_fingerprint,
      }
    );
    results.push(created);
  }
  sendSuccess(
    reply,
    { imported_count: results.length, profiles: results },
    201,
    request.startTime
  );
}

export async function handleExport(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const ctx = getCtx(request);
  const query = exportProfilesSchema.parse(request.query);
  const listQuery = {
    page: 1,
    page_size: 100,
    status: 'active' as const,
    group_id: query.group,
  };
  const result = await profileService.listProfiles(
    ctx.agentId, listQuery
  );

  let profiles = result.items;
  if (query.profile_ids) {
    const ids = query.profile_ids.split(',');
    profiles = profiles.filter(
      (p: { profile_id: string }) =>
        ids.includes(p.profile_id)
    );
  }

  sendSuccess(
    reply,
    { exported_count: profiles.length, profiles },
    200,
    request.startTime
  );
}

export async function handleAddProxy(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const ctx = getCtx(request);
  const result = await proxyManager.addProxy(
    ctx.agentId, request.body as Record<string, unknown>
  );
  sendSuccess(reply, result, 201, request.startTime);
}

export async function handleListProxies(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const ctx = getCtx(request);
  const result = await proxyManager.listProxies(
    ctx.agentId,
    request.query as Record<string, string>
  );
  sendSuccess(reply, result, 200, request.startTime);
}

export async function handleVerifyProxy(
  request: FastifyRequest<{
    Params: { proxy_id: string };
  }>,
  reply: FastifyReply
) {
  const ctx = getCtx(request);
  const result = await proxyManager.verifyProxy(
    ctx.agentId, request.params.proxy_id
  );
  sendSuccess(reply, result, 200, request.startTime);
}

export async function handleDeleteProxy(
  request: FastifyRequest<{
    Params: { proxy_id: string };
  }>,
  reply: FastifyReply
) {
  const ctx = getCtx(request);
  await proxyManager.deleteProxy(
    ctx.agentId, request.params.proxy_id
  );
  sendSuccess(
    reply,
    { proxy_id: request.params.proxy_id, deleted: true },
    200,
    request.startTime
  );
}
