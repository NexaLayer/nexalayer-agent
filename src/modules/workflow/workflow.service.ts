import { prisma } from '../../app';
import { createModuleLogger } from '../../utils/logger';
import { generateId } from '../../utils/id-generator';

const log = createModuleLogger('workflow-service');

export async function createWorkflow(
  agentId: number,
  data: {
    name: string;
    description?: string;
    steps?: Array<{
      action_type: string;
      config: Record<string, unknown>;
      on_error?: string;
      timeout_ms?: number;
    }>;
  }
) {
  const workflowId = generateId('wf');
  log.info({
    event: 'workflow_create',
    agentId,
    workflowId,
    name: data.name,
    stepCount: data.steps?.length ?? 0,
  });

  const workflow = await prisma.workflow.create({
    data: {
      workflowId,
      agentId,
      name: data.name,
      description: data.description,
      status: 'draft',
    },
  });

  if (data.steps?.length) {
    await prisma.workflowStep.createMany({
      data: data.steps.map((s, i) => ({
        workflowId,
        stepOrder: i + 1,
        actionType: s.action_type,
        config: s.config as object,
        onError: s.on_error ?? 'abort',
        timeoutMs: s.timeout_ms ?? 30000,
      })),
    });
  }

  return {
    workflow_id: workflowId,
    name: data.name,
    status: 'draft',
    steps: data.steps?.length ?? 0,
  };
}

export async function listWorkflows(
  agentId: number
) {
  const workflows = await prisma.workflow.findMany({
    where: { agentId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { steps: true } } },
  });
  return workflows.map((w) => ({
    workflow_id: w.workflowId,
    name: w.name,
    status: w.status,
    trigger_type: w.triggerType,
    step_count: w._count.steps,
    run_count: w.runCount,
    last_run_at: w.lastRunAt,
    last_run_status: w.lastRunStatus,
    created_at: w.createdAt,
  }));
}

export async function runWorkflow(
  agentId: number,
  workflowId: string
) {
  const wf = await prisma.workflow.findFirst({
    where: { workflowId, agentId },
    include: { steps: { orderBy: { stepOrder: 'asc' } } },
  });
  if (!wf) throw new Error('WORKFLOW_NOT_FOUND');

  log.info({
    event: 'workflow_run',
    agentId,
    workflowId,
    stepCount: wf.steps.length,
  });

  await prisma.workflow.update({
    where: { id: wf.id },
    data: {
      status: 'active',
      lastRunAt: new Date(),
      lastRunStatus: 'running',
      runCount: { increment: 1 },
    },
  });

  return {
    workflow_id: workflowId,
    name: wf.name,
    status: 'running',
    steps: wf.steps.length,
    message: 'Workflow execution started',
  };
}

export async function deleteWorkflow(
  agentId: number,
  workflowId: string
) {
  const wf = await prisma.workflow.findFirst({
    where: { workflowId, agentId },
  });
  if (!wf) throw new Error('WORKFLOW_NOT_FOUND');

  log.info({
    event: 'workflow_delete',
    agentId,
    workflowId,
  });

  await prisma.workflow.delete({ where: { id: wf.id } });
  return { deleted: true };
}
