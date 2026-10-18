import { FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import {
  ApiResponse,
  ApiError,
  PaginatedData,
} from '../types/api.types';
import { HTTP_STATUS_FOR_ERROR } from '../config/constants';
import { buildErrorEnvelope } from '../modules/support/error-envelope';

export function sendSuccess<T>(
  reply: FastifyReply,
  data: T,
  statusCode = 200,
  startTime?: number
): FastifyReply {
  const response: ApiResponse<T> = {
    success: true,
    data,
    error: null,
    meta: buildMeta(startTime, reply),
  };
  return reply.status(statusCode).send(response);
}

export function sendError(
  reply: FastifyReply,
  code: string,
  message: string,
  details?: Record<string, unknown>,
  startTime?: number
): FastifyReply {
  const httpStatus = HTTP_STATUS_FOR_ERROR[code] ?? 500;
  const meta = buildMeta(startTime, reply);
  // Additive, backward-compatible envelope: code/message/details keep their
  // meaning; the extra fields are machine-readable support hints.
  const error: ApiError = buildErrorEnvelope({
    code,
    message,
    details,
    status: httpStatus,
    requestId: meta.request_id,
    endpoint: endpointFor(reply),
  });
  const response: ApiResponse<null> = {
    success: false,
    data: null,
    error,
    meta,
  };
  const request = reply.request as { errorCode?: string } | undefined;
  if (request) request.errorCode = code;
  if (
    error.retry_after !== null &&
    error.retry_after !== undefined &&
    [429, 502, 503, 504].includes(httpStatus) &&
    typeof reply.getHeader === 'function' &&
    !reply.getHeader('retry-after')
  ) {
    reply.header('Retry-After', String(error.retry_after));
  }
  return reply.status(httpStatus).send(response);
}

export function sendPaginated<T>(
  reply: FastifyReply,
  items: T[],
  total: number,
  page: number,
  pageSize: number,
  startTime?: number
): FastifyReply {
  const data: PaginatedData<T> = {
    items,
    pagination: {
      page,
      page_size: pageSize,
      total,
      total_pages: Math.ceil(total / pageSize),
    },
  };
  return sendSuccess(reply, data, 200, startTime);
}

export function newRequestId(): string {
  return `req_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
}

/** The per-request id assigned by Fastify's genReqId, or a fresh one. */
export function requestIdFor(reply?: FastifyReply): string {
  const id = (reply as { request?: { id?: unknown } } | undefined)?.request?.id;
  return typeof id === 'string' && id.startsWith('req_') ? id : newRequestId();
}

function endpointFor(reply: FastifyReply): string | undefined {
  const request = (reply as { request?: { method?: string; routeOptions?: { url?: string } } }).request;
  const route = request?.routeOptions?.url;
  return request?.method && route ? `${request.method} ${route}` : undefined;
}

function buildMeta(startTime?: number, reply?: FastifyReply) {
  return {
    request_id: requestIdFor(reply),
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
