import { FastifyRequest, FastifyReply } from 'fastify';
import * as workspaceSvc from './workspace.service';
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
    color?: string;
    icon?: string;
  };
  const ws = await workspaceSvc.createWorkspace(agentId, body);
  sendSuccess(reply, ws, 201);
}

export async function handleList(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { agentId } = getCtx(request);
  const list = await workspaceSvc.listWorkspaces(agentId);
  sendSuccess(reply, list);
}

export async function handleDelete(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { agentId } = getCtx(request);
  const { workspace_id } = request.params as {
    workspace_id: string;
  };
  await workspaceSvc.deleteWorkspace(agentId, workspace_id);
  sendSuccess(reply, { deleted: true });
}

export async function handleMove(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { agentId } = getCtx(request);
  const body = request.body as {
    profile_id: string;
    workspace_name: string;
  };
  const result = await workspaceSvc.moveProfileToWorkspace(
    agentId, body.profile_id, body.workspace_name
  );
  sendSuccess(reply, result);
}
