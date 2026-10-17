export const CREDENTIALS_NOTE =
  'Credentials are omitted unless include_credentials=true; never log them.';

/** The session API accepts only the query literals "true" and "false". */
export function sessionCredentialsPath(path: string, includeCredentials: boolean): string {
  return `${path}?include_credentials=${includeCredentials ? 'true' : 'false'}`;
}

export function getSessionApiPath(sessionId: string, includeCredentials: boolean): string {
  return sessionCredentialsPath(`/sessions/${encodeURIComponent(sessionId)}`, includeCredentials);
}

export function rotateSessionApiPath(sessionId: string, includeCredentials: boolean): string {
  return sessionCredentialsPath(
    `/sessions/${encodeURIComponent(sessionId)}/rotate`,
    includeCredentials,
  );
}
