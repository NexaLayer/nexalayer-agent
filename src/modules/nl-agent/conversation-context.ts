import { v4 as uuid } from 'uuid';
import type { PlanStep } from './llm-parser';
import { DEFAULT_PAGE_SIZE } from './executor-utils';

export interface PendingConfirmation {
  id: string;
  intent: string;
  slots: Record<string, unknown>;
  lang: 'zh' | 'en';
  createdAt: number;
}

export interface PendingPlan {
  id: string;
  steps: PlanStep[];
  currentStep: number;
  completedResults: Array<{
    step: number;
    intent: string;
    success: boolean;
    message: string;
    data?: Record<string, unknown>;
  }>;
  lang: 'zh' | 'en';
  createdAt: number;
}

export interface SearchContext {
  lastFilters: {
    country?: string;
    city?: string;
    proxyType?: string;
    quality?: string;
    priceMax?: number;
    qualityMin?: number;
    sort?: string;
    excludePrefix?: string[];
    quantity?: number;
  };
  lastResultSet: Array<Record<string, unknown>>;
  shownIds: string[];
  rejectedIds: string[];
  qualityResults: Array<Record<string, unknown>>;
  currentPage: number;
  mode:
    | 'idle'
    | 'searching'
    | 'evaluating'
    | 'refining'
    | 'confirming_purchase';
}

export function createSearchContext(): SearchContext {
  return {
    lastFilters: {},
    lastResultSet: [],
    shownIds: [],
    rejectedIds: [],
    qualityResults: [],
    currentPage: 0,
    mode: 'idle',
  };
}

export interface PaginationContext {
  lastListIntent: string;
  lastListSlots: Record<string, unknown>;
  lastListLang: 'zh' | 'en';
  currentPage: number;
  pageSize: number;
  totalCount: number;
}

export function createPaginationContext():
  PaginationContext {
  return {
    lastListIntent: '',
    lastListSlots: {},
    lastListLang: 'zh',
    currentPage: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    totalCount: 0,
  };
}

export const PAGINATED_INTENTS = new Set([
  'query_static_orders',
  'query_dynamic_orders',
  'query_transactions',
  'query_expiring_ips',
  'query_dynamic_resource',
  'query_users',
  'query_nl_history',
  'query_ip_inventory',
]);

export interface LastResult {
  intent: string;
  data: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
  lang: 'zh' | 'en';
  timestamp: number;
}

export interface Conversation {
  id: string;
  userId: number;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  slotsMemory: Record<string, unknown>;
  lastIntent?: string;
  lastResult?: LastResult;
  searchContext: SearchContext;
  paginationCtx: PaginationContext;
  pendingConfirmation?: PendingConfirmation;
  pendingPlan?: PendingPlan;
  createdAt: number;
  expiresAt: number;
}

const TTL_MS = 30 * 60 * 1000;
const store = new Map<string, Conversation>();

export function getOrCreate(
  conversationId: string | undefined,
  userId: number
): Conversation {
  if (conversationId) {
    const c = store.get(conversationId);
    if (c && c.userId === userId && Date.now() < c.expiresAt) {
      c.expiresAt = Date.now() + TTL_MS;
      return c;
    }
  }
  const conv: Conversation = {
    id: uuid(),
    userId,
    messages: [],
    slotsMemory: {},
    searchContext: createSearchContext(),
    paginationCtx: createPaginationContext(),
    createdAt: Date.now(),
    expiresAt: Date.now() + TTL_MS,
  };
  store.set(conv.id, conv);
  return conv;
}

export function setPending(
  conv: Conversation,
  intent: string,
  slots: Record<string, unknown>,
  lang: 'zh' | 'en'
): string {
  const id = uuid();
  conv.pendingConfirmation = {
    id,
    intent,
    slots,
    lang,
    createdAt: Date.now(),
  };
  return id;
}

export function getPending(
  conv: Conversation,
  confirmationId: string
): PendingConfirmation | null {
  const p = conv.pendingConfirmation;
  if (!p || p.id !== confirmationId) return null;
  return p;
}

export function clearPending(conv: Conversation): void {
  conv.pendingConfirmation = undefined;
}

export function setPlan(
  conv: Conversation,
  steps: PlanStep[],
  lang: 'zh' | 'en'
): string {
  const id = uuid();
  conv.pendingPlan = {
    id,
    steps,
    currentStep: 0,
    completedResults: [],
    lang,
    createdAt: Date.now(),
  };
  return id;
}

export function getPlan(
  conv: Conversation
): PendingPlan | null {
  return conv.pendingPlan ?? null;
}

export function advancePlan(
  conv: Conversation,
  result: {
    step: number;
    intent: string;
    success: boolean;
    message: string;
    data?: Record<string, unknown>;
  }
): void {
  if (!conv.pendingPlan) return;
  conv.pendingPlan.completedResults.push(result);
  conv.pendingPlan.currentStep += 1;
}

export function clearPlan(
  conv: Conversation
): void {
  conv.pendingPlan = undefined;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) {
    if (now > v.expiresAt) store.delete(k);
  }
}, 5 * 60 * 1000);
