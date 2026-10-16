import {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../app';
import { ERROR_CODES } from '../config/constants';
import { AppError } from '../utils/response';
import { hashIdempotentRequest, parseResponsePayload } from '../utils/idempotency';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export async function idempotencyGuard(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply | void> {
  const key = request.headers['idempotency-key'];
  if (!key) return;

  if (Array.isArray(key) || key.length > 64) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      'Idempotency-Key must be a string with at most 64 characters'
    );
  }

  const agentId = request.agentContext?.agentId;
  if (!agentId) return;

  const requestPath = buildRequestPath(request);
  const requestHash = hashIdempotentRequest(request);
  const existing =
    await prisma.agentIdempotencyKey.findUnique({
      where: {
        uq_agent_idempotency: {
          agentId,
          idempotencyKey: key,
        },
      },
    });

  if (existing) {
    if (
      existing.requestPath !== requestPath ||
      (existing.requestHash !== null && existing.requestHash !== requestHash)
    ) {
      throw new AppError(
        ERROR_CODES.IDEMPOTENCY_CONFLICT,
        'Idempotency-Key was already used for a different request',
        {
          idempotency_key: key,
          original_request_path: existing.requestPath,
          current_request_path: requestPath,
        }
      );
    }

    if (
      existing.responseStatus &&
      existing.responseBody !== null
    ) {
      reply
        .header('X-Idempotent-Replay', 'true')
        .status(existing.responseStatus)
        .send(existing.responseBody);
      return reply;
    }

    throw new AppError(
      ERROR_CODES.IDEMPOTENCY_CONFLICT,
      'Request with this Idempotency-Key is still in progress',
      { idempotency_key: key }
    );
  }

  try {
    const record =
      await prisma.agentIdempotencyKey.create({
        data: {
          agentId,
          idempotencyKey: key,
          requestPath,
          requestHash,
          expiresAt: new Date(
            Date.now() + IDEMPOTENCY_TTL_MS
          ),
        },
      });
    request.idempotencyRecordId = record.id;
  } catch {
    throw new AppError(
      ERROR_CODES.IDEMPOTENCY_CONFLICT,
      'Idempotency-Key is already being processed',
      { idempotency_key: key }
    );
  }
}

export function registerIdempotencyPersistence(
  app: FastifyInstance
): void {
  app.addHook(
    'onSend',
    async (request, reply, payload) => {
      if (!request.idempotencyRecordId) return payload;

      const body = parseResponsePayload(payload);
      await prisma.agentIdempotencyKey
        .update({
          where: { id: request.idempotencyRecordId },
          data: {
            responseStatus: reply.statusCode,
            responseBody:
              body as Prisma.InputJsonValue,
          },
        })
        .catch((err) => {
          request.log.error(
            { err },
            'Failed to persist idempotent response'
          );
        });

      return payload;
    }
  );
}

function buildRequestPath(
  request: FastifyRequest
): string {
  return `${request.method.toUpperCase()} ${request.url}`;
}
