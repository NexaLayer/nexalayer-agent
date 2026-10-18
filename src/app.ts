import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { PrismaClient } from '@prisma/client';
import { env } from './config/env';
import { API_PREFIX, ERROR_CODES } from './config/constants';
import { registerErrorHandler } from './middleware/error-handler';
import { registerRateLimit } from './middleware/rate-limit';
import { registerLogger } from './middleware/logger';
import { registerTolerantJsonParser } from './middleware/json-parser';
import {
  registerIdempotencyPersistence,
} from './middleware/idempotency';
import { authRoutes } from './modules/auth/auth.routes';
import { accountRoutes } from './modules/account/account.routes';
import { sessionRoutes } from './modules/session/session.routes';
import { billingRoutes } from './modules/billing/billing.routes';
import { productRoutes } from './modules/product/product.routes';
import { handlePublicPricing } from './modules/product/product.controller';
import { telemetryRoutes } from './modules/telemetry/telemetry.routes';
import { statsRoutes } from './modules/stats/stats.routes';
import { nlRoutes } from './modules/nl-agent/nl.routes';
import {
  profileRoutes,
  fingerprintRoutes,
  proxyRoutes,
} from './modules/profile/profile.routes';
import { browserRoutes } from './modules/browser/browser.routes';
import { taskRoutes } from './modules/task/task.routes';
import { workspaceRoutes } from './modules/workspace/workspace.routes';
import { workflowRoutes } from './modules/workflow/workflow.routes';
import { systemRoutes } from './modules/system/system.routes';
import { proxyPoolRoutes } from './modules/profile/proxy-pool.routes';
import { newRequestId, sendError, sendSuccess } from './utils/response';
import {
  publicSupportRoutes,
  supportAdminRoutes,
  supportTicketRoutes,
} from './modules/support/support.routes';
import { checkBackendReachable } from './modules/support/status.service';

export const prisma = new PrismaClient();

export async function buildApp() {
  const app = Fastify({
    // req_<16 hex>, mirrored in meta.request_id, error.request_id and X-Request-Id.
    genReqId: () => newRequestId(),
    trustProxy: (_address, hop) =>
      hop < env.TRUST_PROXY_HOPS,
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty' }
          : undefined,
    },
  });

  registerTolerantJsonParser(app);

  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Request-Id', request.id);
  });

  await app.register(cors, { origin: true });

  await app.register(jwt, {
    secret: env.JWT_SECRET,
  });

  await registerRateLimit(app);
  registerErrorHandler(app);
  registerLogger(app);
  registerIdempotencyPersistence(app);

  app.get(
    `${API_PREFIX}/public/products`,
    {
      config: {
        rateLimit: {
          max: 120,
          timeWindow: '1 minute',
        },
      },
    },
    handlePublicPricing
  );

  app.get(
    `${API_PREFIX}/health`,
    async (_req, reply) => {
      const probe = await checkBackendReachable();
      const backendReachable = probe.reachable;
      if (!probe.reachable) {
        app.log.warn(
          `Health: backend unreachable: ${probe.error}`
        );
      }

      sendSuccess(reply, {
        status: 'ok',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        backend_reachable: backendReachable,
      });
    }
  );

  await app.register(publicSupportRoutes, {
    prefix: `${API_PREFIX}/public`,
  });
  await app.register(supportTicketRoutes, {
    prefix: `${API_PREFIX}/support`,
  });
  await app.register(supportAdminRoutes, {
    prefix: `${API_PREFIX}/admin`,
  });
  await app.register(authRoutes, {
    prefix: `${API_PREFIX}/auth`,
  });
  await app.register(accountRoutes, {
    prefix: `${API_PREFIX}/account`,
  });
  await app.register(sessionRoutes, {
    prefix: `${API_PREFIX}/sessions`,
  });
  await app.register(billingRoutes, {
    prefix: `${API_PREFIX}/billing`,
  });
  await app.register(productRoutes, {
    prefix: `${API_PREFIX}/products`,
  });
  await app.register(telemetryRoutes, {
    prefix: `${API_PREFIX}/telemetry`,
  });
  await app.register(statsRoutes, {
    prefix: `${API_PREFIX}/stats`,
  });
  await app.register(nlRoutes, {
    prefix: `${API_PREFIX}/nl`,
  });
  await app.register(profileRoutes, {
    prefix: `${API_PREFIX}/profiles`,
  });
  await app.register(fingerprintRoutes, {
    prefix: `${API_PREFIX}/fingerprints`,
  });
  await app.register(proxyRoutes, {
    prefix: `${API_PREFIX}/proxies`,
  });
  await app.register(browserRoutes, {
    prefix: `${API_PREFIX}/browser`,
  });
  await app.register(taskRoutes, {
    prefix: `${API_PREFIX}/tasks`,
  });
  await app.register(workspaceRoutes, {
    prefix: `${API_PREFIX}/workspaces`,
  });
  await app.register(workflowRoutes, {
    prefix: `${API_PREFIX}/workflows`,
  });
  await app.register(systemRoutes, {
    prefix: `${API_PREFIX}/system`,
  });
  await app.register(proxyPoolRoutes, {
    prefix: `${API_PREFIX}/proxy-pools`,
  });

  app.setNotFoundHandler((request, reply) =>
    sendError(
      reply,
      ERROR_CODES.ROUTE_NOT_FOUND,
      'Route not found',
      { method: request.method, path: request.url.split('?')[0] },
      request.startTime
    )
  );

  return app;
}
