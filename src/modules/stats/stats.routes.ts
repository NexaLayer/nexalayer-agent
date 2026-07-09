import { FastifyInstance } from 'fastify';
import { handleGetOverview } from './stats.controller';
import { authGuard } from '../../middleware/auth.middleware';

export async function statsRoutes(
  app: FastifyInstance
): Promise<void> {
  app.addHook('preHandler', authGuard);

  app.get('/overview', handleGetOverview);
}
