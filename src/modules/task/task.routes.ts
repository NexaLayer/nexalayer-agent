import { FastifyInstance } from 'fastify';
import {
  handleSubmit,
  handleGet,
  handleList,
  handleCancel,
  handleRetry,
  handleBatch,
  handleSchedule,
} from './task.controller';
import { authGuard } from '../../middleware/auth.middleware';

export async function taskRoutes(
  app: FastifyInstance
): Promise<void> {
  app.addHook('preHandler', authGuard);

  app.post('/', handleSubmit);
  app.get('/', handleList);
  app.post('/batch', handleBatch);
  app.post('/schedule', handleSchedule);
  app.get('/:task_id', handleGet);
  app.delete('/:task_id', handleCancel);
  app.post('/:task_id/retry', handleRetry);
}
