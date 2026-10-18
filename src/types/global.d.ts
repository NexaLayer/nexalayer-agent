import { AgentContext } from './api.types';

declare module 'fastify' {
  interface FastifyRequest {
    agentContext?: AgentContext;
    startTime?: number;
    idempotencyRecordId?: bigint;
    /** Error code sent on this request, recorded in agent_api_logs. */
    errorCode?: string;
  }
}
