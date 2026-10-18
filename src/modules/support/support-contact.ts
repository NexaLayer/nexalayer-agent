// Deliberately reads process.env directly (with defaults) instead of the
// validated `env` module so that the error envelope can be built from any
// module — including unit tests — without requiring a full runtime config.

export const ERROR_SCHEMA_VERSION = '1';

export function publicApiBase(): string {
  return (process.env.PUBLIC_API_BASE_URL?.trim() || 'https://api.nexalayer.net').replace(/\/$/, '');
}

export function supportContact() {
  return {
    email: process.env.SUPPORT_EMAIL?.trim() || 'support@nexalayer.net',
    telegram: process.env.SUPPORT_TELEGRAM?.trim() || '@LEWISMIN',
    ticket_api: `${publicApiBase()}/v1/support/tickets`,
    status_api: `${publicApiBase()}/v1/public/status`,
    note: 'Agents: file a ticket via the API (or MCP nexalayer_report_issue). Humans: email first, Telegram second. Never send API keys, proxy passwords, or full_url.',
  };
}

/** Short human-readable contact line for error messages. */
export function supportContactLine(): string {
  const c = supportContact();
  return `contact ${c.email} (Telegram ${c.telegram})`;
}
