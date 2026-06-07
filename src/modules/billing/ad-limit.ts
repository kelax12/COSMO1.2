// Detects the "daily ad-credit limit reached" error raised by the
// `credit_premium_token_from_ad()` RPC (migration 039) when a user has already
// earned the maximum number of ad-reward tokens in the current 24 h window.
//
// The RPC raises with ERRCODE `check_violation` (23514) and a message
// containing "Daily ad-credit limit". We NEVER display the raw Postgres message
// in the UI (security rule V7) — callers map this boolean to their own
// localized copy.
export function isDailyAdLimitError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string };
  if (typeof e.message === 'string' && e.message.includes('Daily ad-credit limit')) {
    return true;
  }
  return e.code === '23514';
}
