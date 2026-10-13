import { FastifyInstance } from 'fastify';
import {
  handleRegister,
  handleGetInfo,
  handleRequestApiKey,
  handleRequestEmailLoginCode,
  handleVerifyEmailLoginCode,
  handleRegenerateApiKey,
  handleEmailPasswordLogin,
  handleSetEmailPassword,
  handleGetBudget,
  handleUpdateBudget,
  handleGetUsageAlerts,
} from './account.controller';
import { authGuard } from '../../middleware/auth.middleware';
import { idempotencyGuard } from '../../middleware/idempotency';

export async function accountRoutes(
  app: FastifyInstance
): Promise<void> {
  app.post('/request-api-key', handleRequestApiKey);
  app.post('/register', handleRegister);
  app.post('/login/email/request-code', handleRequestEmailLoginCode);
  app.post('/login/email/verify', handleVerifyEmailLoginCode);
  app.post('/login/password', handleEmailPasswordLogin);

  app.get(
    '/info',
    { preHandler: [authGuard] },
    handleGetInfo
  );
  app.post('/api-key/regenerate', { preHandler: [authGuard] }, handleRegenerateApiKey);
  app.post('/password', { preHandler: [authGuard] }, handleSetEmailPassword);
  app.get('/budget', { preHandler: [authGuard] }, handleGetBudget);
  app.put('/budget', { preHandler: [authGuard, idempotencyGuard] }, handleUpdateBudget);
  app.get('/usage-alerts', { preHandler: [authGuard] }, handleGetUsageAlerts);
}
