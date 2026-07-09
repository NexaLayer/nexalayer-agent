import { FastifyRequest, FastifyReply } from 'fastify';
import {
  rechargeSchema,
  listTransactionsSchema,
} from './billing.schema';
import * as billingService from './billing.service';
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

export async function handleGetBalance(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const ctx = getCtx(request);
  const result = await billingService.getBalance(
    ctx.agentId
  );
  sendSuccess(reply, result, 200, request.startTime);
}

export async function handleRecharge(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const ctx = getCtx(request);
  const body = rechargeSchema.parse(request.body);
  const result = await billingService.createRecharge(
    ctx.agentId,
    body.amount
  );
  sendSuccess(reply, result, 201, request.startTime);
}

export async function handleRechargeStatus(
  request: FastifyRequest<{
    Params: { order_id: string };
  }>,
  reply: FastifyReply
): Promise<void> {
  const ctx = getCtx(request);
  const result =
    await billingService.checkRechargeStatus(
      ctx.agentId,
      request.params.order_id
    );
  sendSuccess(reply, result, 200, request.startTime);
}

export async function handleGetTransactions(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const ctx = getCtx(request);
  const query = listTransactionsSchema.parse(
    request.query
  );
  const result = await billingService.getTransactions(
    ctx.agentId,
    query.page,
    query.page_size
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
