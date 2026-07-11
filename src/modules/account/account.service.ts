import { prisma } from '../../app';
import {
  generateApiKey,
  generateApiSecret,
  hashSecret,
  encrypt,
} from '../../utils/crypto';
import {
  generateBackendUsername,
  generateBackendPassword,
} from '../../utils/id-generator';
import { createBackendUser } from '../../gateway/backend-client';
import { AppError } from '../../utils/response';
import { ERROR_CODES } from '../../config/constants';
import { RegisterRequest } from './account.schema';
import {
  decodeReferralCode,
} from '../../utils/referral';
import {
  getBalance,
  initializeWalletAndTrial,
} from '../billing/billing.service';

const OPEN_AGENT_ID = 1474;

export async function registerAgent(
  input: RegisterRequest
) {
  let backendAgentId = OPEN_AGENT_ID;

  if (input.referral_code) {
    const decoded = decodeReferralCode(
      input.referral_code
    );
    if (!decoded) {
      throw new AppError(
        ERROR_CODES.INVALID_REFERRAL_CODE,
        `Invalid referral code: ${input.referral_code}`
      );
    }
    backendAgentId = decoded;
  }

  const apiKey = generateApiKey();
  const apiSecret = generateApiSecret();
  const apiSecretHash = await hashSecret(apiSecret);

  const agent = await prisma.agentApp.create({
    data: {
      name: input.name,
      description: input.description,
      apiKey,
      apiSecretHash,
      contactEmail: input.contact_email,
      webhookUrl: input.webhook_url,
      trialBalance: 0,
      isTrial: false,
    },
  });

  const trial = await initializeWalletAndTrial(
    agent.id,
    input.contact_email
  );

  const backendPassword = generateBackendPassword();
  const backendUsername = generateBackendUsername(
    input.name,
    agent.id
  );

  let referralInfo: {
    agent_id?: number;
    agent_name?: string;
  } = {};
  let backendReady = false;
  let backendSyncError: string | undefined;

  try {
    const backendUser = await createBackendUser(
      backendUsername,
      backendPassword,
      input.contact_email,
      backendAgentId
    );

    referralInfo = {
      agent_id: backendUser.agent_id,
      agent_name: backendUser.agent_name,
    };

    await prisma.agentApp.update({
      where: { id: agent.id },
      data: {
        backendUserId: backendUser.id,
        backendUsername,
        backendPasswordEnc: encrypt(backendPassword),
      },
    });
    backendReady = true;
  } catch (err) {
    backendSyncError = (err as Error).message;
    console.error(
      '[REGISTER] createBackendUser failed:',
      backendSyncError
    );
    await prisma.agentApp.update({
      where: { id: agent.id },
      data: {
        metadata: {
          backend_sync_pending: true,
          error: backendSyncError,
        },
      },
    });
  }

  return {
    agent_id: agent.id,
    name: agent.name,
    api_key: apiKey,
    api_secret: apiSecret,
    status: agent.status,
    backend_ready: backendReady,
    backend_sync_error: backendSyncError,
    referral: referralInfo.agent_name
      ? {
          agent_id: referralInfo.agent_id,
          agent_name: referralInfo.agent_name,
        }
      : undefined,
    trial,
    created_at: agent.createdAt.toISOString(),
  };
}

export async function getAgentInfo(agentId: number) {
  const agent = await prisma.agentApp.findUnique({
    where: { id: agentId },
    include: {
      _count: {
        select: {
          sessions: true,
        },
      },
    },
  });

  if (!agent) {
    throw new AppError(
      ERROR_CODES.AUTH_INVALID_KEY,
      'Agent not found'
    );
  }

  const activeSessions = await prisma.agentSession.count({
    where: {
      agentId: agent.id,
      status: { in: ['active', 'creating'] },
    },
  });

  const balance = await getBalance(agent.id);

  return {
    agent_id: agent.id,
    name: agent.name,
    status: agent.status,
    balance: balance.balance,
    cash_balance: balance.cash_balance,
    trial_balance: balance.trial_balance,
    available_balance: balance.available_balance,
    currency: balance.currency,
    trial:
      balance.trial_balance > 0
        ? {
            is_trial: true,
            trial_balance: balance.trial_balance,
          }
        : undefined,
    total_sessions: agent._count.sessions,
    active_sessions: activeSessions,
    max_active_sessions: agent.maxActiveSessions,
    permissions: agent.permissions,
    rate_limit: {
      per_minute: agent.rateLimitPerMin,
      per_day: agent.rateLimitPerDay,
    },
    auth_mode: agent.authMode,
    backend_ready: Boolean(
      agent.backendUserId &&
        agent.backendUsername &&
        agent.backendPasswordEnc
    ),
    contact_email: agent.contactEmail,
    webhook_url: agent.webhookUrl,
    last_active_at: agent.lastActiveAt?.toISOString(),
    created_at: agent.createdAt.toISOString(),
  };
}
