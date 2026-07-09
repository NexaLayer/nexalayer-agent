import { FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import {
  ApiResponse,
  ApiError,
  PaginatedData,
} from '../types/api.types';
import { HTTP_STATUS_FOR_ERROR } from '../config/constants';

export function sendSuccess<T>(
  reply: FastifyReply,
  data: T,
  statusCode = 200,
  startTime?: number
): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
    error: null,
    meta: buildMeta(startTime),
  };
  reply.status(statusCode).send(response);
}

export function sendError(
  reply: FastifyReply,
  code: string,
  message: string,
  details?: Record<string, unknown>,
  startTime?: number
): void {
  const httpStatus = HTTP_STATUS_FOR_ERROR[code] ?? 500;
  const response: ApiResponse<null> = {
    success: false,
    data: null,
    error: { code, message, details },
    meta: buildMeta(startTime),
  };
  reply.status(httpStatus).send(response);
}

export function sendPaginated<T>(
  reply: FastifyReply,
  items: T[],
  total: number,
  page: number,
  pageSize: number,
  startTime?: number
): void {
  const data: PaginatedData<T> = {
    items,
    pagination: {
      page,
      page_size: pageSize,
      total,
      total_pages: Math.ceil(total / pageSize),
    },
  };
  sendSuccess(reply, data, 200, startTime);
}

function buildMeta(startTime?: number) {
  return {
    request_id: `req_${uuidv4().replace(/-/g, '').slice(0, 16)}`,
    timestamp: new Date().toISOString(),
    latency_ms: startTime
      ? Date.now() - startTime
      : undefined,
  };
}

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}
