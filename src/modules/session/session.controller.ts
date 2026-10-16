import { FastifyRequest, FastifyReply } from 'fastify';
import {
  createSessionSchema,
  rotateSessionSchema,
  renewSessionSchema,
  listSessionsSchema,
  whitelistSchema,
} from './session.schema';
import * as sessionService from './session.service';
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
): Promise<FastifyReply> {
  const ctx = getCtx(request);
  const body = createSessionSchema.parse(request.body);
  const result = await sessionService.createSession(
    ctx.agentId,
    body,
    typeof request.headers['idempotency-key'] ===
      'string'
      ? request.headers['idempotency-key']
      : undefined
  );
  return sendSuccess(reply, result, 202, request.startTime);
}

export async function handleGet(
  request: FastifyRequest<{
    Params: { session_id: string };
  }>,
  reply: FastifyReply
): Promise<void> {
  const ctx = getCtx(request);
  const result = await sessionService.getSession(
    ctx.agentId,
    request.params.session_id
  );
  sendSuccess(reply, result, 200, request.startTime);
}

export async function handleList(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const ctx = getCtx(request);
  const query = listSessionsSchema.parse(
    request.query
  );
  const result = await sessionService.listSessions(
    ctx.agentId,
    query
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

export async function handleUsage(
  request: FastifyRequest<{
    Params: { session_id: string };
  }>,
  reply: FastifyReply
): Promise<void> {
  const ctx = getCtx(request);
  const result = await sessionService.getSessionUsage(
    ctx.agentId,
    request.params.session_id
  );
  sendSuccess(reply, result, 200, request.startTime);
}

export async function handleRotate(
  request: FastifyRequest<{
    Params: { session_id: string };
  }>,
  reply: FastifyReply
): Promise<FastifyReply> {
  const ctx = getCtx(request);
  const body = rotateSessionSchema.parse(
    request.body ?? {}
  );
  const result = await sessionService.rotateSession(
    ctx.agentId,
    request.params.session_id,
    body.reason ?? 'manual'
  );
  return sendSuccess(reply, result, 200, request.startTime);
}

export async function handleTerminate(
  request: FastifyRequest<{
    Params: { session_id: string };
  }>,
  reply: FastifyReply
): Promise<void> {
  const ctx = getCtx(request);
  const result = await sessionService.terminateSession(
    ctx.agentId,
    request.params.session_id
  );
  sendSuccess(reply, result, 200, request.startTime);
}

export async function handleRenew(
  request: FastifyRequest<{
    Params: { session_id: string };
  }>,
  reply: FastifyReply
): Promise<FastifyReply> {
  const ctx = getCtx(request);
  const body = renewSessionSchema.parse(request.body);
  const result = await sessionService.renewSession(
    ctx.agentId,
    request.params.session_id,
    body.duration,
    typeof request.headers['idempotency-key'] ===
      'string'
      ? request.headers['idempotency-key']
      : undefined
  );
  return sendSuccess(reply, result, 200, request.startTime);
}

export async function handleWhitelist(
  request: FastifyRequest<{
    Params: { session_id: string };
  }>,
  reply: FastifyReply
): Promise<void> {
  const ctx = getCtx(request);
  const body = whitelistSchema.parse(request.body);
  const result = await sessionService.addWhitelist(
    ctx.agentId,
    request.params.session_id,
    body.ips
  );
  sendSuccess(reply, result, 200, request.startTime);
}
