import { FastifyRequest, FastifyReply } from 'fastify';
import * as poolSvc from './proxy-pool.service';
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

export async function handleCreate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { agentId } = getCtx(request);
  const body = request.body as {
    name: string;
    country_code?: string;
    proxy_type?: string;
    rotation_strategy?: string;
  };
  const pool = await poolSvc.createProxyPool(agentId, body);
  sendSuccess(reply, pool, 201);
}

export async function handleList(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { agentId } = getCtx(request);
  const list = await poolSvc.listProxyPools(agentId);
  sendSuccess(reply, list);
}

export async function handleDelete(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { agentId } = getCtx(request);
  const { pool_id } = request.params as { pool_id: string };
  await poolSvc.deleteProxyPool(agentId, pool_id);
  sendSuccess(reply, { deleted: true });
}
