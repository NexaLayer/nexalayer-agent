import { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { env } from '../config/env';
import { ERROR_CODES } from '../config/constants';
import { buildErrorEnvelope } from '../modules/support/error-envelope';

export async function registerRateLimit(
  app: FastifyInstance
): Promise<void> {
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_PER_MIN,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      const apiKey = request.headers['x-api-key'] as
        | string
        | undefined;
      return apiKey ?? request.ip;
    },
    errorResponseBuilder: (request, context) => {
      const retryAfter = Math.ceil(context.ttl / 1000);
      request.errorCode = ERROR_CODES.RATE_LIMIT_EXCEEDED;
      return {
        statusCode: 429,
        success: false,
        data: null,
        error: buildErrorEnvelope({
          code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
          message: `Rate limit exceeded. Retry after ${retryAfter}s`,
          details: {
            limit: context.max,
            remaining: 0,
            retry_after: retryAfter,
          },
          status: 429,
          requestId: request.id,
        }),
        meta: {
          request_id: request.id,
          timestamp: new Date().toISOString(),
        },
      };
    },
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
  });
}
