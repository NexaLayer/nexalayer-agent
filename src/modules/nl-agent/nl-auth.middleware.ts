import { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../../utils/response';
import { ERROR_CODES } from '../../config/constants';
import { env } from '../../config/env';

export interface NLUserContext {
  userId: number;
  username: string;
  isAdmin: boolean;
  isAgent: boolean;
  backendToken: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    nlUser?: NLUserContext;
  }
}

export async function nlAuthGuard(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError(
      ERROR_CODES.AUTH_INVALID_KEY,
      'Missing Bearer token'
    );
  }
  const token = authHeader.slice(7);

  const res = await fetch(
    `${env.BACKEND_BASE_URL}/api/auth/current-user`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!res.ok) {
    throw new AppError(
      ERROR_CODES.AUTH_EXPIRED_TOKEN,
      'Invalid or expired token'
    );
  }

  const json = (await res.json()) as {
    code: number;
    data?: {
      id: number;
      username: string;
      is_admin: boolean;
      is_agent: boolean;
    };
  };

  if (json.code !== 0 || !json.data) {
    throw new AppError(
      ERROR_CODES.AUTH_EXPIRED_TOKEN,
      'Token validation failed'
    );
  }

  const u = json.data;
  request.nlUser = {
    userId: u.id,
    username: u.username,
    isAdmin: u.is_admin ?? false,
    isAgent: u.is_agent ?? false,
    backendToken: token,
  };
}
