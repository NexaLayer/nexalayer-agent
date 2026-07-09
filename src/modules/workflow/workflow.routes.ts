import { FastifyInstance } from 'fastify';
import {
  handleCreate,
  handleList,
  handleRun,
  handleDelete,
} from './workflow.controller';
import { authGuard } from '../../middleware/auth.middleware';

export async function workflowRoutes(
  app: FastifyInstance
): Promise<void> {
  app.addHook('preHandler', authGuard);

  app.post('/', handleCreate);
  app.get('/', handleList);
  app.post('/:workflow_id/run', handleRun);
  app.delete('/:workflow_id', handleDelete);
}
