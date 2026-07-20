import { FastifyRequest, FastifyReply } from 'fastify';
import {
  registerSchema,
  requestApiKeySchema,
  requestEmailLoginCodeSchema,
  verifyEmailLoginCodeSchema,
} from './account.schema';
import {
  registerAgent,
  getAgentInfo,
  requestApiKeyByEmail,
  requestEmailLoginCode,
  verifyEmailLoginCode,
  regenerateApiKey,
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

export async function handleRequestEmailLoginCode(request: FastifyRequest, reply: FastifyReply) {
  const body = requestEmailLoginCodeSchema.parse(request.body);
  const result = await requestEmailLoginCode(body.email);
  sendSuccess(reply, result, 200, request.startTime);
}

export async function handleVerifyEmailLoginCode(request: FastifyRequest, reply: FastifyReply) {
  const body = verifyEmailLoginCodeSchema.parse(request.body);
  const result = await verifyEmailLoginCode(request.server, body.email, body.code);
  sendSuccess(reply, result, 200, request.startTime);
}

export async function handleRegenerateApiKey(request: FastifyRequest, reply: FastifyReply) {
  const ctx = request.agentContext;
  if (!ctx) throw new AppError(ERROR_CODES.AUTH_INVALID_KEY, 'Not authenticated');
  const result = await regenerateApiKey(ctx.agentId);
  sendSuccess(reply, result, 200, request.startTime);
}

export async function handleRequestApiKey(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const body = requestApiKeySchema.parse(request.body);
  const result = await requestApiKeyByEmail(body);
  sendSuccess(reply, result, 200, request.startTime);
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
