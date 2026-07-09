import { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../app';

export function registerLogger(
  app: FastifyInstance
): void {
  app.addHook('onRequest', async (request) => {
    request.startTime = Date.now();
  });

  app.addHook(
    'onResponse',
    async (request, reply) => {
      if (shouldSkipLog(request)) return;

      const latencyMs = request.startTime
        ? Date.now() - request.startTime
        : 0;

      prisma.agentApiLog
        .create({
          data: {
            agentId: request.agentContext?.agentId,
            method: request.method,
            path: request.url,
            statusCode: reply.statusCode,
            latencyMs,
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
            idempotencyKey: request.headers[
              'idempotency-key'
            ] as string | undefined,
          },
        })
        .catch((err) => {
          request.log.error(
            { err },
            'Failed to save API log'
          );
        });
    }
  );
}

function shouldSkipLog(request: FastifyRequest): boolean {
  const skipPaths = ['/v1/health', '/favicon.ico'];
  return skipPaths.some((p) =>
    request.url.startsWith(p)
  );
}
