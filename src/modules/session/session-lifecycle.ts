export function shouldReleaseStaticResource(session: {
  sessionType: string;
  provisioningMode: string;
  backendOrderNo: string | null;
  status: string;
}): boolean {
  return Boolean(
    session.sessionType === 'static' &&
      session.provisioningMode === 'purchase' &&
      session.backendOrderNo &&
      session.status !== 'terminated'
  );
}
