import { ERROR_CODES } from '../config/constants';
import { AppError } from '../utils/response';

const BACKEND_ERROR_MAP: Record<number, string> = {
  401: ERROR_CODES.AUTH_INVALID_KEY,
  403: ERROR_CODES.AUTH_INSUFFICIENT_PERMISSION,
  404: ERROR_CODES.PRODUCT_NOT_FOUND,
  429: ERROR_CODES.RATE_LIMIT_EXCEEDED,
};

export function mapBackendError(
  statusCode: number,
  message: string
): AppError {
  if (statusCode === 0 || statusCode >= 500) {
    return new AppError(
      ERROR_CODES.BACKEND_ERROR,
      `Backend service error: ${message}`
    );
  }

  const code =
    BACKEND_ERROR_MAP[statusCode] ??
    ERROR_CODES.BACKEND_ERROR;

  return new AppError(code, message);
}

export function mapBackendTimeout(): AppError {
  return new AppError(
    ERROR_CODES.BACKEND_TIMEOUT,
    'Backend service timed out'
  );
}
