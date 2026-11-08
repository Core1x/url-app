export class AppError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '发生未知错误，请重试。';
}
