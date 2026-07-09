import { FastifyRequest, FastifyReply } from 'fastify';
import {
  reportEventSchema,
  batchReportSchema,
} from './telemetry.schema';
import * as telemetryService from './telemetry.service';
import {
  sendSuccess,
  AppError,
} from '../../utils/response';
import { ERROR_CODES } from '../../config/constants';

function getCtx(request: FastifyRequest) {
  const ctx = request.agentContext;
  if (!ctx) {
    throw new AppError(
      ERROR_CODES.AUTH_INVALID_KEY,
      'Not authenticated'
    );
  }
  return ctx;
}

export async function handleReportEvent(
  request: FastifyRequest<{
    Params: { session_id: string };
  }>,
  reply: FastifyReply
): Promise<void> {
  const ctx = getCtx(request);
  const body = reportEventSchema.parse(request.body);
  const result = await telemetryService.reportEvent(
    ctx.agentId,
    request.params.session_id,
    body
  );
  sendSuccess(reply, result, 201, request.startTime);
}

export async function handleBatchReport(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const ctx = getCtx(request);
  const body = batchReportSchema.parse(request.body);
  const result = await telemetryService.batchReport(
    ctx.agentId,
    body.events
  );
  sendSuccess(reply, result, 201, request.startTime);
}

export async function handleGetHealth(
  request: FastifyRequest<{
    Params: { session_id: string };
  }>,
  reply: FastifyReply
): Promise<void> {
  const ctx = getCtx(request);
  const result =
    await telemetryService.getSessionHealth(
      ctx.agentId,
      request.params.session_id
    );
  sendSuccess(reply, result, 200, request.startTime);
}
