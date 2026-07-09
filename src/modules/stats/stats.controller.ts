import { FastifyRequest, FastifyReply } from 'fastify';
import * as statsService from './stats.service';
import {
  sendSuccess,
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

export async function handleGetOverview(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const ctx = getCtx(request);
  const result = await statsService.getOverview(
    ctx.agentId
  );
  sendSuccess(reply, result, 200, request.startTime);
}
