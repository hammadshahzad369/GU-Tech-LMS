export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message = code,
  ) {
    super(message);
  }
}
export function checked<
  T extends { data?: unknown; error: { message: string; code?: string } | null },
>(result: T): NonNullable<T['data']> {
  if (result.error) {
    const m = result.error.message;
    const status = /FORBIDDEN|row-level security|permission denied/i.test(m)
      ? 403
      : /NOT_FOUND/.test(m)
        ? 404
        : /23505|ATTEMPT_EXISTS|DEADLINE|QUIZ_CLOSED|QUIZ_EXPIRED|INVALID_TRANSITION/.test(
              (result.error.code || '') + m,
            )
          ? 409
          : 422;
    throw new ApiError(
      status,
      status === 403 ? 'FORBIDDEN' : status === 409 ? 'CONFLICT' : 'VALIDATION_ERROR',
      status === 403 ? 'You do not have access to this action.' : m,
    );
  }
  return result.data as NonNullable<T['data']>;
}
