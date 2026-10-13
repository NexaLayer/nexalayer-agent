import { FastifyRequest, FastifyReply } from 'fastify';
import {
  registerSchema,
  requestApiKeySchema,
  requestEmailLoginCodeSchema,
  verifyEmailLoginCodeSchema,
  emailPasswordLoginSchema,
  setEmailPasswordSchema,
  updateBudgetSchema,
} from './account.schema';
import {
  registerAgent,
  getAgentInfo,
  requestApiKeyByEmail,
  requestEmailLoginCode,
  verifyEmailLoginCode,
  regenerateApiKey,
  loginWithEmailPassword,
  setEmailPassword,
} from './account.service';
import { getBudget, getUsageAlerts, updateBudget } from './budget.service';
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

export async function handleEmailPasswordLogin(request: FastifyRequest, reply: FastifyReply) {
  const body = emailPasswordLoginSchema.parse(request.body);
  const result = await loginWithEmailPassword(request.server, body.email, body.password);
  sendSuccess(reply, result, 200, request.startTime);
}

export async function handleSetEmailPassword(request: FastifyRequest, reply: FastifyReply) {
  const body = setEmailPasswordSchema.parse(request.body);
  const ctx = request.agentContext;
  if (!ctx) throw new AppError(ERROR_CODES.AUTH_INVALID_KEY, 'Not authenticated');
  const result = await setEmailPassword(ctx.agentId, body.password);
  sendSuccess(reply, result, 200, request.startTime);
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
  const installationId = request.headers['x-client-installation-id'];
  const result = await requestApiKeyByEmail(body, {
    ip: request.ip,
    installationId:
      typeof installationId === 'string' ? installationId : undefined,
  });
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

export async function handleGetBudget(request: FastifyRequest, reply: FastifyReply) {
  const ctx = request.agentContext;
  if (!ctx) throw new AppError(ERROR_CODES.AUTH_INVALID_KEY, 'Not authenticated');
  sendSuccess(reply, await getBudget(ctx.agentId), 200, request.startTime);
}

export async function handleUpdateBudget(request: FastifyRequest, reply: FastifyReply) {
  const ctx = request.agentContext;
  if (!ctx) throw new AppError(ERROR_CODES.AUTH_INVALID_KEY, 'Not authenticated');
  const body = updateBudgetSchema.parse(request.body);
  sendSuccess(reply, await updateBudget(ctx.agentId, body), 200, request.startTime);
}

export async function handleGetUsageAlerts(request: FastifyRequest, reply: FastifyReply) {
  const ctx = request.agentContext;
  if (!ctx) throw new AppError(ERROR_CODES.AUTH_INVALID_KEY, 'Not authenticated');
  sendSuccess(reply, await getUsageAlerts(ctx.agentId), 200, request.startTime);
}
