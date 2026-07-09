import { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { env } from '../config/env';
import { ERROR_CODES } from '../config/constants';

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
    errorResponseBuilder: (_request, context) => ({
      success: false,
      data: null,
      error: {
        code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
        message: `Rate limit exceeded. Retry after ${Math.ceil(context.ttl / 1000)}s`,
        details: {
          limit: context.max,
          remaining: 0,
          retry_after: Math.ceil(context.ttl / 1000),
        },
      },
      meta: {
        request_id: `req_ratelimit`,
        timestamp: new Date().toISOString(),
      },
    }),
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
