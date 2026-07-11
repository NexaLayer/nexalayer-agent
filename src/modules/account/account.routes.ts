import { FastifyInstance } from 'fastify';
import {
  handleRegister,
  handleGetInfo,
  handleRequestApiKey,
} from './account.controller';
import { authGuard } from '../../middleware/auth.middleware';

export async function accountRoutes(
  app: FastifyInstance
): Promise<void> {
  app.post('/request-api-key', handleRequestApiKey);
  app.post('/register', handleRegister);

  app.get(
    '/info',
    { preHandler: [authGuard] },
    handleGetInfo
  );
}
