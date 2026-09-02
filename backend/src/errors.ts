/** An error carrying the HTTP status the client should receive. */
export class AppError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AppError';
    this.status = status;
  }
}

export const notFound = (message: string): AppError => new AppError(message, 404);

export const badRequest = (message: string): AppError => new AppError(message, 400);
