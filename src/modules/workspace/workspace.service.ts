import { prisma } from '../../app';
import { createModuleLogger } from '../../utils/logger';
import { generateId } from '../../utils/id-generator';

const log = createModuleLogger('workspace-service');

export async function createWorkspace(
  agentId: number,
  data: { name: string; description?: string; color?: string; icon?: string }
) {
  const workspaceId = generateId('ws');
  log.info({
    event: 'workspace_create',
    agentId,
    workspaceId,
    name: data.name,
  });
  return prisma.workspace.create({
    data: {
      workspaceId,
      agentId,
      name: data.name,
      description: data.description,
      color: data.color,
      icon: data.icon,
    },
  });
}

export async function listWorkspaces(
  agentId: number
) {
  const workspaces = await prisma.workspace.findMany({
    where: { agentId },
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { profiles: true } } },
  });
  return workspaces.map((w) => ({
    workspace_id: w.workspaceId,
    name: w.name,
    description: w.description,
    color: w.color,
    icon: w.icon,
    profile_count: w._count.profiles,
    created_at: w.createdAt,
  }));
}

export async function deleteWorkspace(
  agentId: number,
  workspaceId: string
) {
  log.info({
    event: 'workspace_delete',
    agentId,
    workspaceId,
  });
  const ws = await prisma.workspace.findFirst({
    where: { workspaceId, agentId },
  });
  if (!ws) throw new Error('WORKSPACE_NOT_FOUND');

  await prisma.browserProfile.updateMany({
    where: { workspaceId: ws.id },
    data: { workspaceId: null },
  });
  await prisma.workspace.delete({ where: { id: ws.id } });
  return { deleted: true };
}

export async function moveProfileToWorkspace(
  agentId: number,
  profileId: string,
  workspaceName: string
) {
  const ws = await prisma.workspace.findFirst({
    where: { agentId, name: workspaceName },
  });
  if (!ws) throw new Error('WORKSPACE_NOT_FOUND');

  const profile = await prisma.browserProfile.findFirst({
    where: { profileId, agentId },
  });
  if (!profile) throw new Error('PROFILE_NOT_FOUND');

  log.info({
    event: 'profile_move_workspace',
    agentId,
    profileId,
    workspaceId: ws.workspaceId,
  });

  await prisma.browserProfile.update({
    where: { id: profile.id },
    data: { workspaceId: ws.id },
  });
  return {
    profile_id: profileId,
    workspace: ws.name,
  };
}
