export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
    public readonly details: Record<string, unknown> = {},
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function invariant(
  condition: unknown,
  code: string,
  message: string,
  statusCode = 409,
  details: Record<string, unknown> = {},
): asserts condition {
  if (!condition) throw new AppError(code, statusCode, message, details);
}

export function assertVersion(current: number, expected: number, name = 'version'): void {
  invariant(current === expected, 'VERSION_CONFLICT', '内容已更新，请重新读取后比较修改。', 409, {
    current_versions: { [name]: current },
  });
}

export function notFound(): never {
  throw new AppError('RESOURCE_NOT_FOUND', 404, '该内容不存在或当前账号无法访问。');
}

export function safeErrorCode(error: unknown): string {
  return error instanceof AppError ? error.code : 'INTERNAL_ERROR';
}
