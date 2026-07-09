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
import {
  idempotencyGuard,
} from '../../middleware/idempotency';

export async function sessionRoutes(
  app: FastifyInstance
): Promise<void> {
  app.addHook('preHandler', authGuard);

  app.post('/', { preHandler: idempotencyGuard }, handleCreate);
  app.get('/', handleList);
  app.get('/:session_id', handleGet);
  app.post<{ Params: { session_id: string } }>(
    '/:session_id/rotate',
    { preHandler: idempotencyGuard },
    handleRotate
  );
  app.delete('/:session_id', handleTerminate);
  app.post<{ Params: { session_id: string } }>(
    '/:session_id/renew',
    { preHandler: idempotencyGuard },
    handleRenew
  );
  app.post('/:session_id/whitelist', handleWhitelist);

  app.post(
    '/:session_id/report-event',
    handleReportEvent
  );
  app.get('/:session_id/health', handleGetHealth);
}
