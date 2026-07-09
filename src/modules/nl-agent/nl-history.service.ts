import { prisma } from '../../app';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('nl-history');

interface SaveParams {
  userId: number;
  username: string;
  conversationId: string;
  userMessage: string;
  assistantMessage: string;
  intent?: string;
  confidence?: number;
  slots?: Record<string, unknown>;
  isAdmin?: boolean;
  isAgent?: boolean;
}

export async function saveNlChatLog(
  params: SaveParams
): Promise<void> {
  try {
    await prisma.nlChatLog.create({
      data: {
        userId: params.userId,
        username: params.username,
        conversationId: params.conversationId,
        userMessage: params.userMessage,
        assistantMessage: params.assistantMessage,
        intent: params.intent ?? null,
        confidence: params.confidence ?? null,
        slots: (params.slots ?? {}) as object,
        isAdmin: params.isAdmin ?? false,
        isAgent: params.isAgent ?? false,
      },
    });
  } catch (err) {
    log.error({
      event: 'save_chat_log_failed',
      userId: params.userId,
      error: err instanceof Error
        ? err.message : 'Unknown',
    });
  }
}

interface QueryParams {
  userId?: number;
  username?: string;
  search?: string;
  intent?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}

interface ChatLogItem {
  id: bigint;
  userId: number;
  username: string;
  conversationId: string;
  userMessage: string;
  assistantMessage: string;
  intent: string | null;
  createdAt: Date;
}

interface QueryResult {
  list: ChatLogItem[];
  total: number;
}

export async function queryNlChatLogs(
  params: QueryParams
): Promise<QueryResult> {
  const where: Record<string, unknown> = {};

  if (params.userId) {
    where.userId = params.userId;
  }
  if (params.username) {
    where.username = {
      contains: params.username,
      mode: 'insensitive',
    };
  }
  if (params.intent) {
    where.intent = params.intent;
  }
  if (params.search) {
    where.OR = [
      {
        userMessage: {
          contains: params.search,
          mode: 'insensitive',
        },
      },
      {
        assistantMessage: {
          contains: params.search,
          mode: 'insensitive',
        },
      },
    ];
  }
  if (params.startDate || params.endDate) {
    const dateFilter: Record<string, Date> = {};
    if (params.startDate)
      dateFilter.gte = new Date(params.startDate);
    if (params.endDate)
      dateFilter.lte = new Date(params.endDate);
    where.createdAt = dateFilter;
  }

  const [list, total] = await Promise.all([
    prisma.nlChatLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      select: {
        id: true,
        userId: true,
        username: true,
        conversationId: true,
        userMessage: true,
        assistantMessage: true,
        intent: true,
        createdAt: true,
      },
    }),
    prisma.nlChatLog.count({ where }),
  ]);

  return { list, total };
}
