import { FastifyInstance } from 'fastify';
import {
  handleCreate,
  handleList,
  handleDelete,
  handleMove,
} from './workspace.controller';
import { authGuard } from '../../middleware/auth.middleware';

export async function workspaceRoutes(
  app: FastifyInstance
): Promise<void> {
  app.addHook('preHandler', authGuard);

  app.post('/', handleCreate);
  app.get('/', handleList);
  app.delete('/:workspace_id', handleDelete);
  app.post('/move', handleMove);
}
