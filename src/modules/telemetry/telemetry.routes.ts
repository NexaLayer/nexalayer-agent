import { FastifyInstance } from 'fastify';
import {
  handleReportEvent,
  handleBatchReport,
  handleGetHealth,
} from './telemetry.controller';
import { authGuard } from '../../middleware/auth.middleware';

export async function telemetryRoutes(
  app: FastifyInstance
): Promise<void> {
  app.addHook('preHandler', authGuard);

  app.post('/batch', handleBatchReport);
}

export async function sessionTelemetryRoutes(
  app: FastifyInstance
): Promise<void> {
  app.post(
    '/:session_id/report-event',
    handleReportEvent
  );
  app.get('/:session_id/health', handleGetHealth);
}
