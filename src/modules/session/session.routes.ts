import { FastifyInstance } from 'fastify';
import {
  handleCreate,
  handleGet,
  handleList,
  handleRotate,
  handleTerminate,
  handleRenew,
  handleWhitelist,
  handleUsage,
} from './session.controller';
import {
  handleReportEvent,
  handleGetHealth,
} from '../telemetry/telemetry.controller';
import { authGuard, rejectDemoMutation } from '../../middleware/auth.middleware';
import {
  idempotencyGuard,
} from '../../middleware/idempotency';

export async function sessionRoutes(
  app: FastifyInstance
): Promise<void> {
  app.addHook('preHandler', authGuard);

  app.post('/', { preHandler: [rejectDemoMutation, idempotencyGuard] }, handleCreate);
  app.get('/', handleList);
  app.get('/:session_id', handleGet);
  app.get('/:session_id/usage', handleUsage);
  app.post<{
    Params: { session_id: string };
    Querystring: { include_credentials?: string };
  }>(
    '/:session_id/rotate',
    { preHandler: [rejectDemoMutation, idempotencyGuard] },
    handleRotate
  );
  app.delete<{ Params: { session_id: string } }>(
    '/:session_id',
    { preHandler: [rejectDemoMutation] },
    handleTerminate
  );
  app.post<{ Params: { session_id: string } }>(
    '/:session_id/renew',
    { preHandler: [rejectDemoMutation, idempotencyGuard] },
    handleRenew
  );
  app.post<{ Params: { session_id: string } }>(
    '/:session_id/whitelist',
    { preHandler: [rejectDemoMutation] },
    handleWhitelist
  );

  app.post(
    '/:session_id/report-event',
    handleReportEvent
  );
  app.get('/:session_id/health', handleGetHealth);
}
