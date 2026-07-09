import {
  FastifyInstance,
  FastifyRequest,
  FastifyReply,
} from 'fastify';
import { prisma } from '../app';
import { AppError } from '../utils/response';
import { ERROR_CODES } from '../config/constants';

export async function authGuard(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const apiKey = request.headers['x-api-key'] as
    | string
    | undefined;

  if (!apiKey) {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return jwtAuth(request, reply, authHeader.slice(7));
    }
    throw new AppError(
      ERROR_CODES.AUTH_INVALID_KEY,
      'Missing authentication: provide X-API-Key header'
    );
  }

  return apiKeyAuth(request, apiKey);
}

async function apiKeyAuth(
  request: FastifyRequest,
  apiKey: string
): Promise<void> {
  const agent = await prisma.agentApp.findUnique({
    where: { apiKey },
    select: {
      id: true,
      apiKey: true,
      status: true,
      permissions: true,
    },
  });

  if (!agent) {
    throw new AppError(
      ERROR_CODES.AUTH_INVALID_KEY,
      'Invalid API key'
    );
  }

  if (agent.status !== 'active') {
    throw new AppError(
      ERROR_CODES.ACCOUNT_DISABLED,
      'Agent account is disabled'
    );
  }

  request.agentContext = {
    agentId: agent.id,
    apiKey: agent.apiKey,
    permissions: agent.permissions as string[],
  };

  prisma.agentApp
    .update({
      where: { id: agent.id },
      data: { lastActiveAt: new Date() },
    })
    .catch(() => {});
}

async function jwtAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  token: string
): Promise<void> {
  try {
    const app = request.server as FastifyInstance;
    const payload = app.jwt.verify<{
      agentId: number;
      apiKey: string;
      permissions: string[];
    }>(token);

    const agent = await prisma.agentApp.findUnique({
      where: { id: payload.agentId },
      select: { id: true, apiKey: true, status: true },
    });

    if (!agent || agent.status !== 'active') {
      throw new AppError(
        ERROR_CODES.AUTH_EXPIRED_TOKEN,
        'Token invalid or account disabled'
      );
    }

    request.agentContext = {
      agentId: payload.agentId,
      apiKey: payload.apiKey,
      permissions: payload.permissions,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      ERROR_CODES.AUTH_EXPIRED_TOKEN,
      'Invalid or expired token'
    );
  }
}

export function requirePermission(permission: string) {
  return async (
    request: FastifyRequest,
    _reply: FastifyReply
  ) => {
    const ctx = request.agentContext;
    if (!ctx) {
      throw new AppError(
        ERROR_CODES.AUTH_INVALID_KEY,
        'Not authenticated'
      );
    }
    if (!ctx.permissions.includes(permission)) {
      throw new AppError(
        ERROR_CODES.AUTH_INSUFFICIENT_PERMISSION,
        `Missing permission: ${permission}`
      );
    }
  };
}
