import { FastifyRequest, FastifyReply } from 'fastify';
import {
  executeSchema,
  confirmSchema,
} from './nl.schema';
import { NLService } from './nl.service';
import { queryNlChatLogs } from './nl-history.service';
import { AppError } from '../../utils/response';
import { ERROR_CODES } from '../../config/constants';
import {
  DEFAULT_SUGGESTIONS,
  getSuggestionsByRole,
} from './suggestions';
import { llmChat } from './llm-parser';
import { randomUUID } from 'node:crypto';

const nlService = new NLService();

export async function handlePublicExecute(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const parsed = executeSchema.safeParse(request.body);
  if (!parsed.success) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      'Invalid request body'
    );
  }

  const message = await llmChat(parsed.data.message);
  const isZh = /[\u3400-\u9fff]/.test(parsed.data.message);
  const fallback = isZh
    ? '我可以介绍 NexaLayer、代理 Session、价格和使用方式。涉及购买、余额或账户操作时，请先登录。'
    : 'I can explain NexaLayer, proxy sessions, pricing, and usage. Sign in before purchases, billing, or account actions.';

  reply.status(200).send({
    success: true,
    data: {
      conversation_id:
        parsed.data.conversation_id || `public_${randomUUID()}`,
      intent: 'public_chat',
      message: message || fallback,
      suggestions: isZh
        ? ['NexaLayer 能做什么？', '代理 Session 是什么？', '价格是多少？']
        : ['What can NexaLayer do?', 'What is a proxy Session?', 'How much does it cost?'],
      requires_confirmation: false,
    },
  });
}

export async function handleExecute(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const parsed = executeSchema.safeParse(request.body);
  if (!parsed.success) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      'Invalid request body'
    );
  }

  const user = request.nlUser;
  if (!user) {
    throw new AppError(
      ERROR_CODES.AUTH_INVALID_KEY,
      'Not authenticated'
    );
  }

  const result = await nlService.execute(
    parsed.data.message,
    user,
    parsed.data.conversation_id
  );

  reply.status(200).send({
    success: true,
    data: result,
  });
}

export async function handleConfirm(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const parsed = confirmSchema.safeParse(request.body);
  if (!parsed.success) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      'Invalid request body'
    );
  }

  const user = request.nlUser;
  if (!user) {
    throw new AppError(
      ERROR_CODES.AUTH_INVALID_KEY,
      'Not authenticated'
    );
  }

  const result = await nlService.confirm(
    parsed.data.conversation_id,
    parsed.data.confirmation_id,
    parsed.data.confirmed,
    user
  );

  reply.status(200).send({
    success: true,
    data: result,
  });
}

export async function handleSuggestions(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const user = request.nlUser;
  const categories = user
    ? getSuggestionsByRole(user.isAgent || user.isAdmin)
    : DEFAULT_SUGGESTIONS;
  reply.status(200).send({
    success: true,
    data: { categories },
  });
}

export async function handleHistory(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const user = request.nlUser;
  if (!user) {
    throw new AppError(
      ERROR_CODES.AUTH_INVALID_KEY,
      'Not authenticated'
    );
  }

  const q = request.query as Record<string, string>;
  const page = parseInt(q.page || '1', 10);
  const pageSize = Math.min(
    parseInt(q.page_size || '20', 10), 100
  );

  const params: {
    userId?: number;
    username?: string;
    search?: string;
    intent?: string;
    startDate?: string;
    endDate?: string;
    page: number;
    pageSize: number;
  } = { page, pageSize };

  if (user.isAdmin) {
    if (q.user_id)
      params.userId = parseInt(q.user_id, 10);
    if (q.username)
      params.username = q.username;
  } else {
    params.userId = user.userId;
  }

  if (q.search) params.search = q.search;
  if (q.intent) params.intent = q.intent;
  if (q.start_date) params.startDate = q.start_date;
  if (q.end_date) params.endDate = q.end_date;

  const result = await queryNlChatLogs(params);

  const serialized = result.list.map((item) => ({
    ...item,
    id: item.id.toString(),
    createdAt: item.createdAt.toISOString(),
  }));

  reply.status(200).send({
    success: true,
    data: {
      list: serialized,
      total: result.total,
      page,
      pageSize,
    },
  });
}
