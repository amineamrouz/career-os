import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { apiErrorMessage } from './api-error';

describe('apiErrorMessage', () => {
  it('uses the API error envelope message', () => {
    const err = new HttpErrorResponse({
      status: 404,
      error: { error: { message: 'Goal 9 not found' } },
    });

    expect(apiErrorMessage(err)).toBe('Goal 9 not found');
  });

  it('appends validation details', () => {
    const err = new HttpErrorResponse({
      status: 400,
      error: {
        error: {
          message: 'Validation failed',
          details: [{ path: 'title', message: 'Too small: expected string to have >=1 characters' }],
        },
      },
    });

    expect(apiErrorMessage(err)).toContain('Validation failed');
    expect(apiErrorMessage(err)).toContain('title:');
  });

  it('explains a request that never reached the API', () => {
    const err = new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') });

    expect(apiErrorMessage(err)).toContain('Cannot reach the API');
  });

  it('falls back to the status when there is no envelope', () => {
    const err = new HttpErrorResponse({ status: 500, error: null });

    expect(apiErrorMessage(err)).toBe('Request failed with status 500.');
  });
});
