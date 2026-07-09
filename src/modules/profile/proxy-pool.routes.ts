import { FastifyInstance } from 'fastify';
import {
  handleCreate,
  handleList,
  handleDelete,
} from './proxy-pool.controller';
import { authGuard } from '../../middleware/auth.middleware';

export async function proxyPoolRoutes(
  app: FastifyInstance
): Promise<void> {
  app.addHook('preHandler', authGuard);

  app.post('/', handleCreate);
  app.get('/', handleList);
  app.delete('/:pool_id', handleDelete);
}
