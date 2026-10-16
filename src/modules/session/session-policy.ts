import { AppError } from '../../utils/response';
import { ERROR_CODES, SESSION_TYPE } from '../../config/constants';

export function staticMonths(durationDays: number): number {
  return Math.max(1, Math.ceil(durationDays / 30));
}

export function assertPriceMatches(displayed: number, upstream: number): void {
  if (!Number.isFinite(displayed) || !Number.isFinite(upstream) || Math.abs(displayed - upstream) > 0.0001) {
    throw new AppError(
      ERROR_CODES.PRICE_MISMATCH,
      'The supplier price changed. No order was placed.',
      { displayed_price_cny: displayed, upstream_price_cny: upstream }
    );
  }
}

export function assertProtocolSupported(sessionType: string, protocol: string): void {
  const supported = sessionType === SESSION_TYPE.STATIC
    ? ['socks5']
    : ['socks5', 'http', 'https'];
  if (!supported.includes(protocol)) {
    throw new AppError(ERROR_CODES.INVALID_REQUEST, `Protocol ${protocol} is not supported for ${sessionType} sessions`, {
      protocol,
      supported_protocols: supported,
    });
  }
}

export function projectIds(projects?: Record<string, unknown>[]): string[] {
  return (projects ?? []).flatMap((project) => {
    const value = project.code ?? project.projectId ?? project.project_id ?? project.id ?? project.value;
    return value === undefined ? [] : [String(value)];
  });
}

export function assertProjectSelection(required: boolean, validIds: string[], selected?: string): void {
  if (required && !selected) {
    throw new AppError(ERROR_CODES.INVALID_REQUEST, 'project_id is required for this product');
  }
  if (selected && !validIds.includes(selected)) {
    throw new AppError(ERROR_CODES.INVALID_REQUEST, 'project_id is not valid for this product', {
      project_id: selected,
    });
  }
}

export function transactionDebitCny(items: Record<string, unknown>[], orderNo: string): number | null {
  const item = items.find((entry) => {
    if (String(entry.order_no ?? entry.orderNo ?? '') !== orderNo) return false;
    const amount = Number(entry.amount);
    const type = String(entry.type ?? '').toLowerCase();
    return amount < 0 || ['debit', 'expense', 'consume', 'consumption', 'purchase'].includes(type);
  });
  if (!item) return null;
  const amount = Number(item.amount);
  if (!Number.isFinite(amount) || amount === 0) return null;
  return Math.abs(amount);
}

export function canonicalStaticCity(productNo: string, fallback?: string): string | undefined {
  const match = productNo.match(/^ZT_[A-Z]{2}_(.+)_\d+$/);
  return match ? match[1].replace(/_/g, ' ').trim().toUpperCase() : fallback;
}
