import { env } from '../../config/env';
import { ERROR_CODES } from '../../config/constants';
import { AppError } from '../../utils/response';

type ApiKeyEmailInput = {
  to: string;
  apiKey: string;
  backendReady: boolean;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildText(input: ApiKeyEmailInput): string {
  const readyLine = input.backendReady
    ? 'Your API key is ready to use.'
    : 'Your API key has been created, but backend resource provisioning is still pending. Please retry shortly or contact support if it does not become ready.';

  return [
    'Your NexaLayer API Key is ready.',
    '你的 NexaLayer API Key 已就绪。',
    '',
    `API Key: ${input.apiKey}`,
    '',
    'New accounts receive a small one-time trial credit automatically; no support request is required.',
    '新账号会自动获得一次性小额试用金，无需联系人工。',
    readyLine,
    '',
    'Use this key in the X-API-Key header. Keep it private.',
    '请在 X-API-Key 请求头中使用该密钥，并妥善保管。',
    '',
    `Quick start: ${env.NEXALAYER_DOCS_URL}`,
    `Runnable examples: ${env.NEXALAYER_EXAMPLES_URL}`,
  ].join('\n');
}

function buildHtml(input: ApiKeyEmailInput): string {
  const readyLine = input.backendReady
    ? 'Your API key is ready to use.'
    : 'Your API key has been created, but backend resource provisioning is still pending. Please retry shortly or contact support if it does not become ready.';

  return `
    <div style="font-family:Inter,Arial,sans-serif;color:#0f172a;line-height:1.6">
      <h2 style="margin:0 0 16px">Your NexaLayer API Key is ready</h2>
      <p style="margin:0 0 16px">你的 NexaLayer API Key 已就绪。</p>
      <p>${readyLine}</p>
      <p style="margin:16px 0 8px">API Key</p>
      <pre style="padding:14px;border-radius:8px;background:#0f172a;color:#e2e8f0;white-space:pre-wrap">${escapeHtml(input.apiKey)}</pre>
      <p>New accounts receive a small one-time trial credit automatically; no support request is required.</p>
      <p>新账号会自动获得一次性小额试用金，无需联系人工。</p>
      <p>Use this key in the <code>X-API-Key</code> header. Keep it private.</p>
      <p>请在 <code>X-API-Key</code> 请求头中使用该密钥，并妥善保管。</p>
      <p>
        <a href="${escapeHtml(env.NEXALAYER_DOCS_URL)}">Quick start</a>
        ·
        <a href="${escapeHtml(env.NEXALAYER_EXAMPLES_URL)}">Runnable examples</a>
      </p>
    </div>
  `;
}

export async function sendApiKeyEmail(
  input: ApiKeyEmailInput
): Promise<void> {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    throw new AppError(
      ERROR_CODES.BACKEND_ERROR,
      'Email service is not configured'
    );
  }

  const response = await fetch(
    'https://api.resend.com/emails',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `NexaLayer <${env.RESEND_FROM_EMAIL}>`,
        to: input.to,
        subject:
          'Your NexaLayer API Key is ready / NexaLayer API Key 已就绪',
        text: buildText(input),
        html: buildHtml(input),
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new AppError(
      ERROR_CODES.BACKEND_ERROR,
      'Failed to send API key email',
      {
        provider: 'resend',
        status: response.status,
        detail: text.slice(0, 300),
      }
    );
  }
}

export async function sendLoginCodeEmail(input: {
  to: string;
  code: string;
  expiresInMinutes: number;
}): Promise<void> {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    throw new AppError(
      ERROR_CODES.BACKEND_ERROR,
      'Email service is not configured'
    );
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `NexaLayer <${env.RESEND_FROM_EMAIL}>`,
      to: input.to,
      subject: 'NexaLayer 登录验证码 / Sign-in code',
      text: [
        `你的 NexaLayer 登录验证码是：${input.code}`,
        `验证码 ${input.expiresInMinutes} 分钟内有效，请勿转发。`,
        '',
        `Your NexaLayer sign-in code is: ${input.code}`,
        `It expires in ${input.expiresInMinutes} minutes. Do not share it.`,
      ].join('\n'),
      html: `<div style="font-family:Inter,Arial,sans-serif;color:#0f172a;line-height:1.6"><h2>NexaLayer 登录验证码</h2><p>使用以下验证码登录控制台：</p><p style="font-size:30px;font-weight:700;letter-spacing:8px;margin:24px 0">${escapeHtml(input.code)}</p><p>${input.expiresInMinutes} 分钟内有效，请勿转发。</p><hr style="border:0;border-top:1px solid #e2e8f0"><p>Your NexaLayer sign-in code expires in ${input.expiresInMinutes} minutes.</p></div>`,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new AppError(ERROR_CODES.BACKEND_ERROR, 'Failed to send login code', {
      provider: 'resend',
      status: response.status,
      detail: text.slice(0, 300),
    });
  }
}
