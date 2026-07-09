import { FastifyInstance } from 'fastify';
import {
  handleStatus,
  handleResources,
  handleLogs,
} from './system.controller';
import { authGuard } from '../../middleware/auth.middleware';

export async function systemRoutes(
  app: FastifyInstance
): Promise<void> {
  app.addHook('preHandler', authGuard);

  app.get('/status', handleStatus);
  app.get('/resources', handleResources);
  app.get('/logs', handleLogs);
}
