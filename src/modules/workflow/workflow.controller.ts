import { FastifyRequest, FastifyReply } from 'fastify';
import * as workflowSvc from './workflow.service';
import { sendSuccess, AppError } from '../../utils/response';
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

export async function handleCreate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { agentId } = getCtx(request);
  const body = request.body as {
    name: string;
    description?: string;
    steps?: Array<{
      action_type: string;
      config: Record<string, unknown>;
      on_error?: string;
      timeout_ms?: number;
    }>;
  };
  const wf = await workflowSvc.createWorkflow(agentId, body);
  sendSuccess(reply, wf, 201);
}

export async function handleList(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { agentId } = getCtx(request);
  const list = await workflowSvc.listWorkflows(agentId);
  sendSuccess(reply, list);
}

export async function handleRun(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { agentId } = getCtx(request);
  const { workflow_id } = request.params as {
    workflow_id: string;
  };
  const result = await workflowSvc.runWorkflow(
    agentId, workflow_id
  );
  sendSuccess(reply, result);
}

export async function handleDelete(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { agentId } = getCtx(request);
  const { workflow_id } = request.params as {
    workflow_id: string;
  };
  await workflowSvc.deleteWorkflow(agentId, workflow_id);
  sendSuccess(reply, { deleted: true });
}
