export function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const response = (error as {
      response?: { data?: { detail?: unknown } };
    }).response;
    if (typeof response?.data?.detail === 'string') {
      return response.data.detail;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
