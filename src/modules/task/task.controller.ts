import { FastifyRequest, FastifyReply } from 'fastify';
import {
  submitTaskSchema,
  batchTaskSchema,
  scheduleTaskSchema,
  listTasksSchema,
} from './task.schema';
import * as taskService from './task.service';
import {
  sendSuccess,
  sendPaginated,
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

export async function handleSubmit(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const ctx = getCtx(request);
  const body = submitTaskSchema.parse(request.body);
  const result = await taskService.submitTask(
    ctx.agentId, body
  );
  sendSuccess(reply, result, 202, request.startTime);
}

export async function handleGet(
  request: FastifyRequest<{
    Params: { task_id: string };
  }>,
  reply: FastifyReply
) {
  const ctx = getCtx(request);
  const result = await taskService.getTask(
    ctx.agentId, request.params.task_id
  );
  sendSuccess(reply, result, 200, request.startTime);
}

export async function handleList(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const ctx = getCtx(request);
  const query = listTasksSchema.parse(request.query);
  const result = await taskService.listTasks(
    ctx.agentId, query
  );
  sendPaginated(
    reply,
    result.items,
    result.total,
    result.page,
    result.page_size,
    request.startTime
  );
}

export async function handleCancel(
  request: FastifyRequest<{
    Params: { task_id: string };
  }>,
  reply: FastifyReply
) {
  const ctx = getCtx(request);
  const result = await taskService.cancelTask(
    ctx.agentId, request.params.task_id
  );
  sendSuccess(reply, result, 200, request.startTime);
}

export async function handleRetry(
  request: FastifyRequest<{
    Params: { task_id: string };
  }>,
  reply: FastifyReply
) {
  const ctx = getCtx(request);
  const result = await taskService.retryTask(
    ctx.agentId, request.params.task_id
  );
  sendSuccess(reply, result, 200, request.startTime);
}

export async function handleBatch(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const ctx = getCtx(request);
  const body = batchTaskSchema.parse(request.body);
  const result = await taskService.batchSubmit(
    ctx.agentId, body.tasks
  );
  sendSuccess(reply, result, 202, request.startTime);
}

export async function handleSchedule(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const ctx = getCtx(request);
  const body = scheduleTaskSchema.parse(request.body);
  const result = await taskService.scheduleTask(
    ctx.agentId, body
  );
  sendSuccess(reply, result, 202, request.startTime);
}
