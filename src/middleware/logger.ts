import { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../app';
import { recordRequestOutcome } from '../modules/support/status.service';

export function registerLogger(
  app: FastifyInstance
): void {
  app.addHook('onRequest', async (request) => {
    request.startTime = Date.now();
  });

  app.addHook(
    'onResponse',
    async (request, reply) => {
      recordRequestOutcome(request.url, reply.statusCode);
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
            requestId: request.id,
            errorCode: request.errorCode,
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
