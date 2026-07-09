import { FastifyInstance } from 'fastify';
import {
  handleRegister,
  handleGetInfo,
} from './account.controller';
import { authGuard } from '../../middleware/auth.middleware';

export async function accountRoutes(
  app: FastifyInstance
): Promise<void> {
  app.post('/register', handleRegister);

  app.get(
    '/info',
    { preHandler: [authGuard] },
    handleGetInfo
  );
}
