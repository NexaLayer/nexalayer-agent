import { prisma } from '../../app';
import { AppError } from '../../utils/response';
import {
  ERROR_CODES,
  TASK_STATUS,
} from '../../config/constants';
import { generateTaskId } from '../../utils/id-generator';
import type {
  SubmitTaskRequest,
  ListTasksQuery,
} from './task.schema';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('task-service');

const MAX_QUEUED_TASKS = 100;

export async function submitTask(
  agentId: number,
  data: SubmitTaskRequest
) {
  const queuedCount = await prisma.browserTask.count({
    where: {
      agentId,
      status: { in: ['queued', 'running'] },
    },
  });
  if (queuedCount >= MAX_QUEUED_TASKS) {
    throw new AppError(
      ERROR_CODES.TASK_QUEUE_FULL,
      `Max ${MAX_QUEUED_TASKS} queued/running tasks`
    );
  }

  const profile = await prisma.browserProfile.findFirst({
    where: { profileId: data.profile_id, agentId },
  });
  if (!profile) {
    throw new AppError(
      ERROR_CODES.PROFILE_NOT_FOUND,
      `Profile ${data.profile_id} not found`
    );
  }

  const taskId = generateTaskId();
  log.info({
    event: 'task_submit',
    agentId,
    taskId,
    profileId: data.profile_id,
    taskType: data.task_type,
    priority: data.priority,
  });

  const task = await prisma.browserTask.create({
    data: {
      taskId,
      agentId,
      profileId: data.profile_id,
      taskType: data.task_type,
      priority: data.priority,
      targetUrl: data.target_url,
      steps: (data.steps as object[]) ?? [],
      script: data.script,
      timeoutMs: data.timeout_ms,
      maxRetries: data.max_retries,
      idempotencyKey: data.idempotency_key,
    },
  });

  return {
    task_id: task.taskId,
    status: task.status,
    profile_id: task.profileId,
    task_type: task.taskType,
    priority: task.priority,
    created_at: task.createdAt.toISOString(),
  };
}

export async function getTask(
  agentId: number,
  taskId: string
) {
  const task = await prisma.browserTask.findFirst({
    where: { taskId, agentId },
  });
  if (!task) {
    throw new AppError(
      ERROR_CODES.TASK_NOT_FOUND,
      `Task ${taskId} not found`
    );
  }

  return {
    task_id: task.taskId,
    status: task.status,
    profile_id: task.profileId,
    instance_id: task.instanceId,
    task_type: task.taskType,
    priority: task.priority,
    target_url: task.targetUrl,
    steps: task.steps,
    result: {
      status_code: task.resultStatus,
      data: task.resultData,
      screenshots: task.screenshots,
      error_message: task.errorMessage,
      duration_ms: task.durationMs,
    },
    retry_count: task.retryCount,
    max_retries: task.maxRetries,
    created_at: task.createdAt.toISOString(),
    started_at: task.startedAt?.toISOString() ?? null,
    completed_at: task.completedAt?.toISOString() ?? null,
  };
}

export async function listTasks(
  agentId: number,
  query: ListTasksQuery
) {
  const where: Record<string, unknown> = { agentId };
  if (query.status && query.status !== 'all') {
    where.status = query.status;
  }
  if (query.profile_id) {
    where.profileId = query.profile_id;
  }

  const [items, total] = await Promise.all([
    prisma.browserTask.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.page_size,
      take: query.page_size,
    }),
    prisma.browserTask.count({ where }),
  ]);

  return {
    items: items.map(t => ({
      task_id: t.taskId,
      status: t.status,
      profile_id: t.profileId,
      task_type: t.taskType,
      priority: t.priority,
      target_url: t.targetUrl,
      duration_ms: t.durationMs,
      created_at: t.createdAt.toISOString(),
    })),
    total,
    page: query.page,
    page_size: query.page_size,
  };
}

export async function cancelTask(
  agentId: number,
  taskId: string
) {
  const task = await prisma.browserTask.findFirst({
    where: { taskId, agentId },
  });
  if (!task) {
    throw new AppError(
      ERROR_CODES.TASK_NOT_FOUND,
      `Task ${taskId} not found`
    );
  }
  if (task.status === 'completed' || task.status === 'failed') {
    throw new AppError(
      ERROR_CODES.TASK_ALREADY_COMPLETED,
      `Task ${taskId} already ${task.status}`
    );
  }

  await prisma.browserTask.update({
    where: { taskId },
    data: {
      status: TASK_STATUS.CANCELLED,
      completedAt: new Date(),
    },
  });

  return { task_id: taskId, status: 'cancelled' };
}

export async function retryTask(
  agentId: number,
  taskId: string
) {
  const task = await prisma.browserTask.findFirst({
    where: { taskId, agentId },
  });
  if (!task) {
    throw new AppError(
      ERROR_CODES.TASK_NOT_FOUND,
      `Task ${taskId} not found`
    );
  }

  await prisma.browserTask.update({
    where: { taskId },
    data: {
      status: TASK_STATUS.QUEUED,
      retryCount: { increment: 1 },
      startedAt: null,
      completedAt: null,
      errorMessage: null,
      resultData: {},
      resultStatus: null,
    },
  });

  return { task_id: taskId, status: 'queued' };
}

export async function batchSubmit(
  agentId: number,
  tasks: SubmitTaskRequest[]
) {
  const results = [];
  for (const t of tasks) {
    const result = await submitTask(agentId, t);
    results.push(result);
  }
  return {
    submitted_count: results.length,
    task_ids: results.map(r => r.task_id),
  };
}

export async function scheduleTask(
  agentId: number,
  data: SubmitTaskRequest & {
    schedule: {
      type: string;
      delay_seconds?: number;
    };
  }
) {
  const scheduledAt =
    data.schedule.type === 'delay' && data.schedule.delay_seconds
      ? new Date(
          Date.now() + data.schedule.delay_seconds * 1000
        )
      : new Date();

  const taskId = generateTaskId();
  const task = await prisma.browserTask.create({
    data: {
      taskId,
      agentId,
      profileId: data.profile_id,
      taskType: data.task_type,
      priority: data.priority,
      targetUrl: data.target_url,
      steps: (data.steps as object[]) ?? [],
      script: data.script,
      timeoutMs: data.timeout_ms,
      maxRetries: data.max_retries,
      scheduledAt,
    },
  });

  return {
    task_id: task.taskId,
    status: task.status,
    scheduled_at: scheduledAt.toISOString(),
    created_at: task.createdAt.toISOString(),
  };
}
