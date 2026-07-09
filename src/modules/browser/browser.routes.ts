import { FastifyInstance } from 'fastify';
import {
  handleLaunch,
  handleClose,
  handleRestart,
  handleList,
  handleGetInstance,
  handleNavigate,
  handleExecute,
  handleEvaluate,
  handleScreenshot,
  handleBatchLaunch,
  handleBatchClose,
} from './browser.controller';
import { authGuard } from '../../middleware/auth.middleware';

export async function browserRoutes(
  app: FastifyInstance
): Promise<void> {
  app.addHook('preHandler', authGuard);

  app.post('/launch', handleLaunch);
  app.get('/instances', handleList);
  app.post('/batch-launch', handleBatchLaunch);
  app.post('/batch-close', handleBatchClose);
  app.get('/instances/:instance_id', handleGetInstance);
  app.post('/instances/:instance_id/close', handleClose);
  app.post(
    '/instances/:instance_id/restart',
    handleRestart
  );
  app.post(
    '/instances/:instance_id/navigate',
    handleNavigate
  );
  app.post(
    '/instances/:instance_id/execute',
    handleExecute
  );
  app.post(
    '/instances/:instance_id/evaluate',
    handleEvaluate
  );
  app.post(
    '/instances/:instance_id/screenshot',
    handleScreenshot
  );
}
