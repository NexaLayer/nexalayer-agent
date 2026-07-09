import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { PrismaClient } from '@prisma/client';
import { env } from './config/env';
import { API_PREFIX } from './config/constants';
import { registerErrorHandler } from './middleware/error-handler';
import { registerRateLimit } from './middleware/rate-limit';
import { registerLogger } from './middleware/logger';
import { authRoutes } from './modules/auth/auth.routes';
import { accountRoutes } from './modules/account/account.routes';
import { sessionRoutes } from './modules/session/session.routes';
import { billingRoutes } from './modules/billing/billing.routes';
import { productRoutes } from './modules/product/product.routes';
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
import { sendSuccess } from './utils/response';

export const prisma = new PrismaClient();

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty' }
          : undefined,
    },
  });

  await app.register(cors, { origin: true });

  await app.register(jwt, {
    secret: env.JWT_SECRET,
  });

  await registerRateLimit(app);
  registerErrorHandler(app);
  registerLogger(app);

  app.get(
    `${API_PREFIX}/health`,
    async (_req, reply) => {
      let backendReachable = false;
      let backendError = '';
      let dnsResolved = false;
      try {
        const url = new URL(env.BACKEND_BASE_URL);
        const dns = await import('dns');
        const { promisify } = await import('util');
        const lookup = promisify(dns.lookup);
        try {
          const addr = await lookup(
            url.hostname
          );
          dnsResolved = true;
          backendError =
            `dns=${addr.address}:${url.port}`;
        } catch (dnsErr) {
          backendError =
            `dns_fail: ${(dnsErr as Error).message}`;
        }
      } catch {
        /* ignore parse errors */
      }

      try {
        const ctrl = new AbortController();
        const t = setTimeout(
          () => ctrl.abort(),
          5000
        );
        const r = await fetch(
          `${env.BACKEND_BASE_URL}/api/auth/login`,
          {
            method: 'POST',
            signal: ctrl.signal,
            headers: {
              'Content-Type': 'application/json',
            },
            body: '{}',
          }
        );
        clearTimeout(t);
        backendReachable = r.status < 500;
        backendError = '';
      } catch (err) {
        backendReachable = false;
        const cause = (err as Error).cause
          ? String((err as Error).cause)
          : '';
        backendError =
          `${(err as Error).message}` +
          (cause ? ` [${cause}]` : '');
        app.log.warn(
          `Health: backend unreachable: ` +
            `${backendError}`
        );
      }

      sendSuccess(reply, {
        status: 'ok',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        backend_url: env.BACKEND_BASE_URL,
        backend_reachable: backendReachable,
        dns_resolved: dnsResolved,
        backend_error: backendError || undefined,
      });
    }
  );

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

  return app;
}
