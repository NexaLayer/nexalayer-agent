import { FastifyRequest, FastifyReply } from 'fastify';
import { listProductsSchema } from './product.schema';
import * as productService from './product.service';
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

export async function handleListProducts(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const ctx = getCtx(request);
  const query = listProductsSchema.parse(
    request.query
  );
  const result = await productService.listProducts(
    query
  );
  reply.header('Cache-Control', 'private, max-age=60');
  sendSuccess(reply, result, 200, request.startTime);
}

export async function handleListRegions(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const ctx = getCtx(request);
  const result = await productService.listRegions(
    ctx.agentId
  );
  sendSuccess(reply, result, 200, request.startTime);
}

export async function handlePublicPricing(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const query = listProductsSchema.parse(request.query);
  reply.header('Cache-Control', 'public, max-age=60, s-maxage=60');
  sendSuccess(reply, await productService.listProducts(query), 200, request.startTime);
}
