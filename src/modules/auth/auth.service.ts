import { FastifyInstance } from 'fastify';
import { prisma } from '../../app';
import { verifySecret } from '../../utils/crypto';
import { AppError } from '../../utils/response';
import { ERROR_CODES } from '../../config/constants';
import { env } from '../../config/env';

interface TokenPayload {
  agentId: number;
  apiKey: string;
  permissions: string[];
}

export async function issueToken(
  app: FastifyInstance,
  apiKey: string,
  apiSecret: string
): Promise<{
  accessToken: string;
  expiresIn: number;
  agent: {
    id: number;
    name: string;
    permissions: string[];
  };
}> {
  const agent = await prisma.agentApp.findUnique({
    where: { apiKey },
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

  const valid = await verifySecret(
    apiSecret,
    agent.apiSecretHash
  );
  if (!valid) {
    throw new AppError(
      ERROR_CODES.AUTH_INVALID_KEY,
      'Invalid API secret'
    );
  }

  const permissions = agent.permissions as string[];
  const payload: TokenPayload = {
    agentId: agent.id,
    apiKey: agent.apiKey,
    permissions,
  };

  const accessToken = app.jwt.sign(payload, {
    expiresIn: env.JWT_EXPIRES_IN,
  });

  await prisma.agentApp.update({
    where: { id: agent.id },
    data: { lastActiveAt: new Date() },
  });

  return {
    accessToken,
    expiresIn: env.JWT_EXPIRES_IN,
    agent: {
      id: agent.id,
      name: agent.name,
      permissions,
    },
  };
}

export async function refreshToken(
  app: FastifyInstance,
  currentToken: string
): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  let payload: TokenPayload;
  try {
    payload = app.jwt.verify<TokenPayload>(currentToken);
  } catch {
    throw new AppError(
      ERROR_CODES.AUTH_EXPIRED_TOKEN,
      'Invalid or expired token'
    );
  }

  const agent = await prisma.agentApp.findUnique({
    where: { id: payload.agentId },
    select: {
      id: true,
      apiKey: true,
      status: true,
      permissions: true,
    },
  });

  if (!agent || agent.status !== 'active') {
    throw new AppError(
      ERROR_CODES.ACCOUNT_DISABLED,
      'Agent account is disabled or not found'
    );
  }

  const newPayload: TokenPayload = {
    agentId: agent.id,
    apiKey: agent.apiKey,
    permissions: agent.permissions as string[],
  };

  const accessToken = app.jwt.sign(newPayload, {
    expiresIn: env.JWT_EXPIRES_IN,
  });

  return {
    accessToken,
    expiresIn: env.JWT_EXPIRES_IN,
  };
}
