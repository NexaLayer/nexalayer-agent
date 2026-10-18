import {
  FastifyInstance,
  FastifyError,
} from 'fastify';
import { ZodError } from 'zod';
import { AppError, sendError } from '../utils/response';
import { ERROR_CODES } from '../config/constants';

export function registerErrorHandler(
  app: FastifyInstance
): void {
  app.setErrorHandler(
    (error: FastifyError | Error, request, reply) => {
      request.log.error(
        { err: error, path: request.url },
        'Unhandled error'
      );

      if (error instanceof AppError) {
        return sendError(
          reply,
          error.code,
          error.message,
          error.details,
          request.startTime
        );
      }

      if (error instanceof ZodError) {
        return sendError(
          reply,
          ERROR_CODES.INVALID_REQUEST,
          'Validation error',
          { issues: error.issues },
          request.startTime
        );
      }

      const fastifyErr = error as FastifyError;
      // @fastify/rate-limit throws the errorResponseBuilder object; keep its
      // code instead of collapsing it into INVALID_REQUEST.
      const rateLimited = error as unknown as {
        statusCode?: number;
        error?: { code?: string; message?: string; details?: Record<string, unknown> };
      };
      if (
        rateLimited.statusCode === 429 &&
        rateLimited.error?.code === ERROR_CODES.RATE_LIMIT_EXCEEDED
      ) {
        return sendError(
          reply,
          ERROR_CODES.RATE_LIMIT_EXCEEDED,
          rateLimited.error.message ?? 'Rate limit exceeded',
          rateLimited.error.details,
          request.startTime
        );
      }
      if (fastifyErr.validation) {
        return sendError(
          reply,
          ERROR_CODES.INVALID_REQUEST,
          'Validation error',
          { issues: fastifyErr.validation },
          request.startTime
        );
      }

      if (
        fastifyErr.statusCode &&
        fastifyErr.statusCode >= 400 &&
        fastifyErr.statusCode < 500
      ) {
        return sendError(
          reply,
          ERROR_CODES.INVALID_REQUEST,
          fastifyErr.message || 'Invalid request',
          { fastify_code: fastifyErr.code },
          request.startTime
        );
      }

      return sendError(
        reply,
        ERROR_CODES.INTERNAL_ERROR,
        'Internal server error',
        undefined,
        request.startTime
      );
    }
  );
}
