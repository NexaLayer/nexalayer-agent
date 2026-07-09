import { FastifyRequest, FastifyReply } from 'fastify';
import * as systemSvc from './system.service';
import { sendSuccess, AppError } from '../../utils/response';
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

export async function handleStatus(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { agentId } = getCtx(request);
  const status = await systemSvc.getSystemStatus(agentId);
  sendSuccess(reply, status);
}

export async function handleResources(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  const usage = await systemSvc.getResourceUsage();
  sendSuccess(reply, usage);
}

export async function handleLogs(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { agentId } = getCtx(request);
  const query = request.query as { limit?: string };
  const limit = parseInt(query.limit ?? '20', 10);
  const logs = await systemSvc.getRecentLogs(agentId, limit);
  sendSuccess(reply, logs);
}
