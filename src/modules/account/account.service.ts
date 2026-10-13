import { createHash, randomInt } from 'crypto';
import { compare, hash } from 'bcryptjs';
import { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
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
import {
  RegisterRequest,
  RequestApiKeyRequest,
} from './account.schema';
import {
  decodeReferralCode,
} from '../../utils/referral';
import { getBalance } from '../billing/billing.service';
import { sendApiKeyEmail } from './email.service';
import { sendLoginCodeEmail } from './email.service';
import { env } from '../../config/env';

const OPEN_AGENT_ID = 1474;
const API_KEY_EMAIL_RESEND_COOLDOWN_MS = 10 * 60 * 1000;
const LOGIN_CODE_TTL_MINUTES = 10;
const LOGIN_CODE_RESEND_COOLDOWN_MS = 60 * 1000;
const LOGIN_CODE_MAX_ATTEMPTS = 5;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashEmail(email: string): string {
  return createHash('sha256')
    .update(email)
    .digest('hex');
}

function agentNameFromEmail(email: string): string {
  const local = email.split('@')[0] || 'developer';
  const cleaned = local
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return cleaned || 'developer';
}

function resolveBackendAgentId(referralCode?: string) {
  if (!referralCode) return OPEN_AGENT_ID;

  const decoded = decodeReferralCode(referralCode);
  if (!decoded) {
    throw new AppError(
      ERROR_CODES.INVALID_REFERRAL_CODE,
      `Invalid referral code: ${referralCode}`
    );
  }
  return decoded;
}

async function syncBackendUserForAgent(input: {
  agentId: number;
  agentName: string;
  email?: string | null;
  backendAgentId: number;
  trialBalanceUsd?: number;
}) {
  const backendPassword = generateBackendPassword();
  const backendUsername = generateBackendUsername(
    input.agentName,
    input.agentId
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
      input.email ?? undefined,
      input.backendAgentId,
      input.trialBalanceUsd ?? 0
    );

    referralInfo = {
      agent_id: backendUser.agent_id,
      agent_name: backendUser.agent_name,
    };

    await prisma.agentApp.update({
      where: { id: input.agentId },
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
      where: { id: input.agentId },
      data: {
        metadata: {
          backend_sync_pending: true,
          error: backendSyncError,
        },
      },
    });
  }

  return {
    backendReady,
    backendSyncError,
    referralInfo,
  };
}

export async function registerAgent(
  input: RegisterRequest
) {
  const backendAgentId = resolveBackendAgentId(
    input.referral_code
  );

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

  const {
    backendReady,
    backendSyncError,
    referralInfo,
  } = await syncBackendUserForAgent({
    agentId: agent.id,
    agentName: input.name,
    email: input.contact_email,
    backendAgentId,
    trialBalanceUsd: 0,
  });

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
    created_at: agent.createdAt.toISOString(),
  };
}

async function sendApiKeyForAgent(input: {
  agentId: number;
  email: string;
  apiKey: string;
  status: string;
  backendReady: boolean;
}) {
  if (input.status !== 'active') {
    throw new AppError(
      ERROR_CODES.ACCOUNT_DISABLED,
      'Agent account is disabled'
    );
  }

  await sendApiKeyEmail({
    to: input.email,
    apiKey: input.apiKey,
    backendReady: input.backendReady,
  });

  await prisma.agentEmailIdentity.updateMany({
    where: { agentId: input.agentId },
    data: { lastSentAt: new Date() },
  });

  await prisma.agentUsageRecord.create({
    data: {
      agentId: input.agentId,
      action: 'api_key_email_sent',
      resourceType: 'account',
      details: {
        email_hash: hashEmail(input.email),
        delivery: 'api_key',
      },
    },
  });
}

async function resendExistingApiKey(input: {
  agent: {
    id: number;
    apiKey: string;
    status: string;
    backendUserId: number | null;
    backendUsername: string | null;
    backendPasswordEnc: string | null;
  };
  email: string;
}) {
  await sendApiKeyForAgent({
    agentId: input.agent.id,
    email: input.email,
    apiKey: input.agent.apiKey,
    status: input.agent.status,
    backendReady: Boolean(
      input.agent.backendUserId &&
        input.agent.backendUsername &&
        input.agent.backendPasswordEnc
    ),
  });

  return {
    status: 'email_sent',
    backend_ready: Boolean(
      input.agent.backendUserId &&
        input.agent.backendUsername &&
        input.agent.backendPasswordEnc
    ),
    message:
      'If the email address is valid, the API key has been sent.',
  };
}

export async function requestApiKeyByEmail(
  input: RequestApiKeyRequest
) {
  const normalizedEmail = normalizeEmail(input.email);
  const emailHash = hashEmail(normalizedEmail);

  const existingIdentity =
    await prisma.agentEmailIdentity.findUnique({
      where: { emailHash },
      include: { agent: true },
    });

  if (existingIdentity) {
    const lastSentAt =
      existingIdentity.lastSentAt?.getTime() ?? 0;
    const now = Date.now();
    if (
      lastSentAt &&
      now - lastSentAt < API_KEY_EMAIL_RESEND_COOLDOWN_MS
    ) {
      return {
        status: 'email_recently_sent',
        backend_ready: Boolean(
          existingIdentity.agent.backendUserId &&
            existingIdentity.agent.backendUsername &&
            existingIdentity.agent.backendPasswordEnc
        ),
        message:
          'The API key was sent recently. Please check the mailbox or try again later.',
      };
    }

    return resendExistingApiKey({
      agent: existingIdentity.agent,
      email: normalizedEmail,
    });
  }

  const legacyClaim =
    await prisma.agentTrialClaim.findUnique({
      where: { emailHash },
      include: { agent: true },
    });

  if (legacyClaim) {
    await prisma.agentEmailIdentity.upsert({
      where: { emailHash },
      update: {
        agentId: legacyClaim.agentId,
      },
      create: {
        agentId: legacyClaim.agentId,
        normalizedEmail,
        emailHash,
      },
    });
    return resendExistingApiKey({
      agent: legacyClaim.agent,
      email: normalizedEmail,
    });
  }

  const backendAgentId = resolveBackendAgentId(
    input.referral_code
  );
  const name = agentNameFromEmail(normalizedEmail);
  const apiKey = generateApiKey();
  const apiSecret = generateApiSecret();
  const apiSecretHash = await hashSecret(apiSecret);
  const trialBalanceUsd = env.TRIAL_BALANCE;
  const trialExpiresAt = new Date(
    Date.now() + env.TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000
  );

  let agent;
  try {
    agent = await prisma.$transaction(
      async (tx) => {
        const created = await tx.agentApp.create({
          data: {
            name,
            description:
              'Created from email API key request',
            apiKey,
            apiSecretHash,
            contactEmail: normalizedEmail,
            trialBalance: trialBalanceUsd,
            isTrial: trialBalanceUsd > 0,
            metadata: {
              signup_source: 'email_api_key',
              acquisition_source:
                input.acquisition_source ?? 'direct',
            },
          },
        });

        await tx.agentEmailIdentity.create({
          data: {
            agentId: created.id,
            normalizedEmail,
            emailHash,
          },
        });

        if (trialBalanceUsd > 0) {
          await tx.agentWallet.create({
            data: {
              agentId: created.id,
              trialBalanceUsd,
              trialExpiresAt,
            },
          });
          await tx.agentTrialClaim.create({
            data: {
              agentId: created.id,
              normalizedEmail,
              emailHash,
              claimedAmountUsd: trialBalanceUsd,
            },
          });
        }

        return created;
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
      }
    );
  } catch (err) {
    const identity =
      await prisma.agentEmailIdentity.findUnique({
        where: { emailHash },
        include: { agent: true },
      });
    if (identity) {
      return resendExistingApiKey({
        agent: identity.agent,
        email: normalizedEmail,
      });
    }
    throw err;
  }

  const { backendReady, backendSyncError } =
    await syncBackendUserForAgent({
      agentId: agent.id,
      agentName: name,
      email: normalizedEmail,
      backendAgentId,
      trialBalanceUsd,
    });

  await sendApiKeyForAgent({
    agentId: agent.id,
    email: normalizedEmail,
    apiKey,
    status: agent.status,
    backendReady,
  });

  return {
    status: 'email_sent',
    backend_ready: backendReady,
    backend_sync_error: backendSyncError,
    trial: {
      granted: trialBalanceUsd > 0 && backendReady,
      amount_usd: trialBalanceUsd,
      expires_at: trialExpiresAt.toISOString(),
    },
    message:
      'If the email address is valid, the API key has been sent.',
  };
}

export async function getAgentInfo(agentId: number) {
  const agent = await prisma.agentApp.findUnique({
    where: { id: agentId },
    include: {
      wallet: true,
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
    api_key: agent.apiKey,
    name: agent.name,
    status: agent.status,
    balance: balance.balance,
    cash_balance: balance.cash_balance,
    available_balance: balance.available_balance,
    currency: balance.currency,
    exchange_rate: balance.exchange_rate,
    exchange_rate_pair: balance.exchange_rate_pair,
    total_sessions: agent._count.sessions,
    active_sessions: activeSessions,
    max_active_sessions: agent.maxActiveSessions,
    permissions: agent.permissions,
    rate_limit: {
      per_minute: agent.rateLimitPerMin,
      per_day: agent.rateLimitPerDay,
    },
    auth_mode: agent.authMode,
    trial: agent.wallet
      ? {
          is_trial:
            Number(agent.wallet.trialBalanceUsd) > 0 &&
            (!agent.wallet.trialExpiresAt || agent.wallet.trialExpiresAt > new Date()),
          trial_balance: Number(agent.wallet.trialBalanceUsd),
          trial_expires_at: agent.wallet.trialExpiresAt?.toISOString() ?? null,
        }
      : {
          is_trial: false,
          trial_balance: 0,
          trial_expires_at: null,
        },
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

export async function requestEmailLoginCode(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const identity = await prisma.agentEmailIdentity.findUnique({
    where: { emailHash: hashEmail(normalizedEmail) },
    include: { agent: true },
  });

  // Always return the same shape so this endpoint cannot enumerate accounts.
  if (!identity || identity.agent.status !== 'active') {
    return {
      status: 'code_sent',
      message: 'If the email is registered, a login code has been sent.',
    };
  }

  const latest = await prisma.agentEmailLoginCode.findFirst({
    where: { agentId: identity.agentId },
    orderBy: { createdAt: 'desc' },
  });
  if (
    latest &&
    Date.now() - latest.createdAt.getTime() < LOGIN_CODE_RESEND_COOLDOWN_MS
  ) {
    return {
      status: 'code_recently_sent',
      message: 'A login code was sent recently. Please check your mailbox.',
    };
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  const codeHash = await hash(code, 10);
  await prisma.$transaction([
    prisma.agentEmailLoginCode.updateMany({
      where: { agentId: identity.agentId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.agentEmailLoginCode.create({
      data: {
        agentId: identity.agentId,
        codeHash,
        expiresAt: new Date(Date.now() + LOGIN_CODE_TTL_MINUTES * 60_000),
      },
    }),
  ]);

  try {
    await sendLoginCodeEmail({
      to: normalizedEmail,
      code,
      expiresInMinutes: LOGIN_CODE_TTL_MINUTES,
    });
  } catch (error) {
    await prisma.agentEmailLoginCode.updateMany({
      where: { agentId: identity.agentId, codeHash, usedAt: null },
      data: { usedAt: new Date() },
    });
    throw error;
  }

  return {
    status: 'code_sent',
    message: 'If the email is registered, a login code has been sent.',
  };
}

export async function verifyEmailLoginCode(
  app: FastifyInstance,
  email: string,
  code: string
) {
  const normalizedEmail = normalizeEmail(email);
  const identity = await prisma.agentEmailIdentity.findUnique({
    where: { emailHash: hashEmail(normalizedEmail) },
    include: { agent: true },
  });
  if (!identity || identity.agent.status !== 'active') {
    throw new AppError(ERROR_CODES.AUTH_INVALID_KEY, 'Invalid or expired login code');
  }

  const loginCode = await prisma.agentEmailLoginCode.findFirst({
    where: { agentId: identity.agentId, usedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (
    !loginCode ||
    loginCode.expiresAt.getTime() <= Date.now() ||
    loginCode.attempts >= LOGIN_CODE_MAX_ATTEMPTS
  ) {
    throw new AppError(ERROR_CODES.AUTH_INVALID_KEY, 'Invalid or expired login code');
  }

  const valid = await compare(code, loginCode.codeHash);
  if (!valid) {
    await prisma.agentEmailLoginCode.update({
      where: { id: loginCode.id },
      data: { attempts: { increment: 1 } },
    });
    throw new AppError(ERROR_CODES.AUTH_INVALID_KEY, 'Invalid or expired login code');
  }

  await prisma.agentEmailLoginCode.update({
    where: { id: loginCode.id },
    data: { usedAt: new Date() },
  });
  const permissions = identity.agent.permissions as string[];
  const accessToken = app.jwt.sign(
    { agentId: identity.agent.id, apiKey: identity.agent.apiKey, permissions },
    { expiresIn: env.JWT_EXPIRES_IN }
  );
  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: env.JWT_EXPIRES_IN,
    account: {
      agent_id: identity.agent.id,
      name: identity.agent.name,
      email: normalizedEmail,
    },
  };
}

export async function regenerateApiKey(agentId: number) {
  const apiKey = generateApiKey();
  const agent = await prisma.agentApp.update({
    where: { id: agentId },
    data: { apiKey },
    select: { apiKey: true },
  });
  return { api_key: agent.apiKey, regenerated_at: new Date().toISOString() };
}

function issueEmailAccessToken(app: FastifyInstance, agent: {
  id: number;
  apiKey: string;
  permissions: unknown;
  name: string;
}, email: string) {
  const permissions = agent.permissions as string[];
  return {
    access_token: app.jwt.sign(
      { agentId: agent.id, apiKey: agent.apiKey, permissions },
      { expiresIn: env.JWT_EXPIRES_IN }
    ),
    token_type: 'Bearer',
    expires_in: env.JWT_EXPIRES_IN,
    account: { agent_id: agent.id, name: agent.name, email },
  };
}

export async function loginWithEmailPassword(
  app: FastifyInstance,
  email: string,
  password: string
) {
  const normalizedEmail = normalizeEmail(email);
  const identity = await prisma.agentEmailIdentity.findUnique({
    where: { emailHash: hashEmail(normalizedEmail) },
    include: { agent: true },
  });
  if (
    !identity?.passwordHash ||
    identity.agent.status !== 'active' ||
    !(await compare(password, identity.passwordHash))
  ) {
    throw new AppError(ERROR_CODES.AUTH_INVALID_KEY, 'Invalid email or password');
  }
  return issueEmailAccessToken(app, identity.agent, normalizedEmail);
}

export async function setEmailPassword(agentId: number, password: string) {
  const passwordHash = await hash(password, 12);
  const result = await prisma.agentEmailIdentity.updateMany({
    where: { agentId },
    data: { passwordHash },
  });
  if (!result.count) {
    throw new AppError(ERROR_CODES.INVALID_REQUEST, 'Email identity not found');
  }
  return { status: 'password_set', updated_at: new Date().toISOString() };
}
