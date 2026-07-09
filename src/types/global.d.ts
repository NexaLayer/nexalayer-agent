import { AgentContext } from './api.types';

declare module 'fastify' {
  interface FastifyRequest {
    agentContext?: AgentContext;
    startTime?: number;
    idempotencyRecordId?: bigint;
  }
}
