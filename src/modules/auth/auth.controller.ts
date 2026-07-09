import { FastifyRequest, FastifyReply } from 'fastify';
import { tokenRequestSchema } from './auth.schema';
import { issueToken, refreshToken } from './auth.service';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../utils/response';
import { ERROR_CODES } from '../../config/constants';

export async function handleGetToken(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const body = tokenRequestSchema.parse(request.body);

  const result = await issueToken(
    request.server,
    body.api_key,
    body.api_secret
  );

  sendSuccess(
    reply,
    {
      access_token: result.accessToken,
      token_type: 'Bearer',
      expires_in: result.expiresIn,
      agent: result.agent,
    },
    200,
    request.startTime
  );
}

export async function handleRefreshToken(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError(
      ERROR_CODES.AUTH_EXPIRED_TOKEN,
      'Bearer token required for refresh'
    );
  }

  const token = authHeader.slice(7);
  const result = await refreshToken(
    request.server,
    token
  );

  sendSuccess(
    reply,
    {
      access_token: result.accessToken,
      token_type: 'Bearer',
      expires_in: result.expiresIn,
    },
    200,
    request.startTime
  );
}
