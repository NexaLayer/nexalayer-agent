import { env } from '../../config/env';
import { redactDeep } from '../support/redact';

export type OpsAlertSeverity = 'info' | 'warning' | 'critical';

export const OPS_ALERT_EVENTS = {
  TRIAL_CLAIM_SURGE: 'TRIAL_CLAIM_SURGE',
  SUPPORT_TICKET_URGENT: 'SUPPORT_TICKET_URGENT',
  COMPONENT_STATUS_CHANGED: 'COMPONENT_STATUS_CHANGED',
  UPSTREAM_TERMINATE_FAILED: 'UPSTREAM_TERMINATE_FAILED',
  UPSTREAM_CLEANUP_GAVE_UP: 'UPSTREAM_CLEANUP_GAVE_UP',
  DEBIT_PROVISION_MISMATCH: 'DEBIT_PROVISION_MISMATCH',
} as const;
export type OpsAlertEvent = (typeof OPS_ALERT_EVENTS)[keyof typeof OPS_ALERT_EVENTS];

type AlertLogger = {
  warn: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
};

export type SendOpsAlertOptions = {
  /** Distinguishes instances of one event (e.g. a ticket id or component id). */
  dedupeKey?: string;
  /** Dedupe window; defaults to OPS_ALERT_DEDUPE_MINUTES. */
  windowMinutes?: number;
  logger?: AlertLogger;
  now?: Date;
};

export type SendOpsAlertResult = {
  deduped: boolean;
  channels: Array<'telegram' | 'webhook'>;
  failures: string[];
};

const lastSent = new Map<string, number>();

const consoleLogger: AlertLogger = {
  warn: (obj, msg) => console.warn(msg ?? '', JSON.stringify(obj)),
  error: (obj, msg) => console.error(msg ?? '', JSON.stringify(obj)),
};

export function resetOpsAlertDedupeForTests(): void {
  lastSent.clear();
}

/** Which channel config is active, preferring OPS_ALERT_* over TRIAL_ALERT_*. */
export function resolveAlertChannels() {
  const token = env.OPS_ALERT_TELEGRAM_BOT_TOKEN ?? env.TRIAL_ALERT_TELEGRAM_BOT_TOKEN;
  const chatId = env.OPS_ALERT_TELEGRAM_CHAT_ID ?? env.TRIAL_ALERT_TELEGRAM_CHAT_ID;
  const webhookUrl = env.OPS_ALERT_WEBHOOK_URL ?? env.TRIAL_ALERT_WEBHOOK_URL;
  return {
    telegram: token && chatId ? { token, chatId } : null,
    webhookUrl: webhookUrl ?? null,
  };
}

/**
 * Send one owner/ops alert. At most one alert is sent per
 * (event, dedupeKey) within the dedupe window. Payloads are deep-redacted
 * so proxy credentials, full_url, keys, and tokens never leave the server.
 * Never throws.
 */
export async function sendOpsAlert(
  event: OpsAlertEvent | string,
  severity: OpsAlertSeverity,
  payload: Record<string, unknown>,
  options: SendOpsAlertOptions = {}
): Promise<SendOpsAlertResult> {
  const logger = options.logger ?? consoleLogger;
  const now = options.now ?? new Date();
  const windowMs = (options.windowMinutes ?? env.OPS_ALERT_DEDUPE_MINUTES ?? 30) * 60_000;
  const key = `${event}:${options.dedupeKey ?? ''}`;
  const previous = lastSent.get(key);
  if (previous !== undefined && now.getTime() - previous < windowMs) {
    return { deduped: true, channels: [], failures: [] };
  }
  lastSent.set(key, now.getTime());

  const { value: safePayload } = redactDeep(payload);
  // Reserved fields go last so a payload can never overwrite them.
  const body = {
    ...safePayload,
    event,
    severity,
    observed_at: now.toISOString(),
  };
  logger.warn(body, `Ops alert: ${event}`);

  const { telegram, webhookUrl } = resolveAlertChannels();
  const result: SendOpsAlertResult = { deduped: false, channels: [], failures: [] };
  if (!telegram && !webhookUrl) {
    logger.error(body, 'No ops alert notification channel is configured');
    return result;
  }

  if (telegram) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${telegram.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegram.chatId,
          text: formatTelegramText(body),
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`Telegram API HTTP ${response.status}`);
      result.channels.push('telegram');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.failures.push(`telegram: ${message}`);
      logger.error({ event, error: message }, 'Failed to send Telegram ops alert');
    }
  }

  if (webhookUrl) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      result.channels.push('webhook');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.failures.push(`webhook: ${message}`);
      logger.error({ event, error: message }, 'Failed to send webhook ops alert');
    }
  }
  return result;
}

export function formatTelegramText(body: Record<string, unknown>): string {
  const { event, severity, observed_at, ...rest } = body;
  const lines = [
    `NexaLayer alert: ${String(event)}`,
    `Severity: ${String(severity)}`,
    ...Object.entries(rest).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`),
    `Observed: ${String(observed_at)}`,
  ];
  return lines.join('\n').slice(0, 3_500);
}
