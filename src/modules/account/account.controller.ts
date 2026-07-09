import { FastifyRequest, FastifyReply } from 'fastify';
import { registerSchema } from './account.schema';
import {
  registerAgent,
  getAgentInfo,
} from './account.service';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../utils/response';
import { ERROR_CODES } from '../../config/constants';

export async function handleRegister(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const body = registerSchema.parse(request.body);
  const result = await registerAgent(body);
  sendSuccess(reply, result, 201, request.startTime);
}

export async function handleGetInfo(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const ctx = request.agentContext;
  if (!ctx) {
    throw new AppError(
      ERROR_CODES.AUTH_INVALID_KEY,
      'Not authenticated'
    );
  }
  const result = await getAgentInfo(ctx.agentId);
  sendSuccess(reply, result, 200, request.startTime);
}
