import { FastifyInstance } from 'fastify';
import {
  handleCreate,
  handleGet,
  handleList,
  handleRotate,
  handleTerminate,
  handleRenew,
  handleWhitelist,
} from './session.controller';
import {
  handleReportEvent,
  handleGetHealth,
} from '../telemetry/telemetry.controller';
import { authGuard } from '../../middleware/auth.middleware';

export async function sessionRoutes(
  app: FastifyInstance
): Promise<void> {
  app.addHook('preHandler', authGuard);

  app.post('/', handleCreate);
  app.get('/', handleList);
  app.get('/:session_id', handleGet);
  app.post('/:session_id/rotate', handleRotate);
  app.delete('/:session_id', handleTerminate);
  app.post('/:session_id/renew', handleRenew);
  app.post('/:session_id/whitelist', handleWhitelist);

  app.post(
    '/:session_id/report-event',
    handleReportEvent
  );
  app.get('/:session_id/health', handleGetHealth);
}
