// Shared request handling; safe retries are idempotent on the server.
export async function submitInterest(endpoint, data, signal = AbortSignal.timeout(15000)) {
  const response = await fetch(endpoint, {
    method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data), signal,
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.ok !== true) {
    const error = new Error('The signup was not confirmed.');
    error.status = response.status;
    throw error;
  }
  return result;
}
