import { HttpErrorResponse } from '@angular/common/http';

interface ApiErrorBody {
  error?: {
    message?: string;
    details?: { path: string; message: string }[];
  };
}

/**
 * The API answers every failure with { error: { message, details? } }. This turns
 * any failure — including the network-level one you hit when the backend is not
 * running — into a single string a template can show.
 */
export function apiErrorMessage(err: unknown): string {
  if (!(err instanceof HttpErrorResponse)) {
    return 'Something went wrong.';
  }

  // status 0 means the request never got a response: wrong port, server down, or CORS.
  if (err.status === 0) {
    return 'Cannot reach the API. Is the backend running on http://localhost:3000?';
  }

  const body = err.error as ApiErrorBody | string | null;
  if (typeof body === 'string' && body.trim() !== '') {
    return body;
  }

  const apiError = typeof body === 'object' && body !== null ? body.error : undefined;
  const message = apiError?.message ?? `Request failed with status ${err.status}.`;
  const details = apiError?.details;

  if (details && details.length > 0) {
    const parts = details.map((d) => (d.path ? `${d.path}: ${d.message}` : d.message));
    return `${message} (${parts.join('; ')})`;
  }

  return message;
}
