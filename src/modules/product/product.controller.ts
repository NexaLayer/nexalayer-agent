import { FastifyRequest, FastifyReply } from 'fastify';
import { listProductsSchema } from './product.schema';
import * as productService from './product.service';
import {
  sendSuccess,
  AppError,
} from '../../utils/response';
import { ERROR_CODES } from '../../config/constants';
import { getPublicPricing } from './public-pricing';

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
    ctx.agentId,
    query.type,
    query.country_code
  );
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
  reply.header('Cache-Control', 'public, max-age=300, s-maxage=3600');
  sendSuccess(reply, getPublicPricing(), 200, request.startTime);
}
