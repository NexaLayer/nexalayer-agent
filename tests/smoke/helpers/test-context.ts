import { AgentClient } from './agent-client';
import {
  BackendVerifyClient,
} from './backend-verify-client';

export interface PerfMetric {
  p50: number;
  p95: number;
  max: number;
}

export interface TestContext {
  agentClient: AgentClient;
  backendClient: BackendVerifyClient;
  agentName: string;
  agentId: number;
  apiKey: string;
  apiSecret: string;
  bearerToken: string;
  backendUsername: string;
  backendUserId: number;
  createdSessionIds: string[];
  dynamicProductNo: string;
  staticProductNo: string;
  dynamicOrderNo: string;
  staticOrderNo: string;
  staticSessionId: string;
  initialBalance: number;
  balanceBefore: number;
  balanceAfter: number;
  terminatedCount: number;
  residualCount: number;
  commitHash: string;
  startedAt: Date;
  perfMetrics: Record<string, PerfMetric>;
}

declare global {
  // eslint-disable-next-line no-var
  var __smokeTestContext: TestContext | undefined;
}

export function getContext(): TestContext {
  if (!globalThis.__smokeTestContext) {
    throw new Error(
      'TestContext not initialized. ' +
        'Call initContext() first.'
    );
  }
  return globalThis.__smokeTestContext;
}

export function initContext(): TestContext {
  if (globalThis.__smokeTestContext) {
    return globalThis.__smokeTestContext;
  }
  const suffix = Date.now()
    .toString(36)
    .slice(-6);
  const ctx: TestContext = {
    agentClient: new AgentClient(),
    backendClient: new BackendVerifyClient(),
    agentName: `smoke_agent_${suffix}`,
    agentId: 0,
    apiKey: '',
    apiSecret: '',
    bearerToken: '',
    backendUsername: '',
    backendUserId: 0,
    createdSessionIds: [],
    dynamicProductNo: '',
    staticProductNo: '',
    dynamicOrderNo: '',
    staticOrderNo: '',
    staticSessionId: '',
    initialBalance: 0,
    balanceBefore: 0,
    balanceAfter: 0,
    terminatedCount: 0,
    residualCount: 0,
    commitHash: process.env.GIT_COMMIT ?? 'unknown',
    startedAt: new Date(),
    perfMetrics: {},
  };
  globalThis.__smokeTestContext = ctx;
  return ctx;
}

export function resetContext(): void {
  globalThis.__smokeTestContext = undefined;
}
