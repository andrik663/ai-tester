/**
 * lib/explain-api-error.ts — Human-readable API error explanations.
 *
 * Converts raw HTTP status codes (and optional error-body text) into a
 * `{ cause, suggestion }` pair that can be shown directly in the UI without
 * exposing implementation details to the user.
 *
 * Used by: manual-key-tester, batch-test panel, and gateway routes.
 */

/**
 * Map an HTTP status code (and optional response body) to a user-facing
 * cause description and an actionable suggestion.
 *
 * Inspects `errorText` for provider-specific keywords (e.g. "expired",
 * "quota", "billing") to produce a more precise diagnosis before falling
 * back to a generic status-level explanation.
 *
 * @param status    - HTTP status code returned by the provider (use `0` for
 *   network-level errors where no HTTP response was received).
 * @param errorText - Optional raw response body or error message string.
 *   Matched case-insensitively against common provider keywords.
 * @returns A `{ cause, suggestion }` object, or `null` if the status code is
 *   unrecognised (e.g. 2xx that still ended up here by mistake).
 *
 * @example
 * const info = explainApiError(429, '{"error":"daily quota exceeded"}')
 * // → { cause: "Daily quota or token limit reached.", suggestion: "Wait until..." }
 */
export function explainApiError(
  status: number,
  errorText?: string,
): { cause: string; suggestion: string } | null {
  const body = (errorText ?? "").toLowerCase()

  if (status === 401 || (status === 0 && body.includes("unauthorized"))) {
    if (body.includes("expired"))
      return { cause: "API key has expired.", suggestion: "Generate a new key in your provider console." }
    if (body.includes("invalid"))
      return { cause: "API key is invalid.", suggestion: "Double-check the key was copied in full with no extra spaces or characters." }
    return {
      cause: "Authentication failed — key rejected by the provider.",
      suggestion: "Verify the key is correct and belongs to this provider.",
    }
  }

  if (status === 403) {
    if (body.includes("quota") || body.includes("billing") || body.includes("limit"))
      return { cause: "Quota or billing limit exceeded.", suggestion: "Top up your account balance or upgrade your plan." }
    return {
      cause: "Permission denied.",
      suggestion: "Check that your key has the required scopes and your account is in good standing.",
    }
  }

  if (status === 404) {
    return {
      cause: "Endpoint not found.",
      suggestion: "The model or endpoint URL may be wrong for this provider. Check the API docs link.",
    }
  }

  if (status === 422 || status === 400) {
    if (body.includes("model"))
      return { cause: "Model name not recognised.", suggestion: "Select a valid model from the catalog in the Pricing tab." }
    return {
      cause: "Request payload rejected by the provider.",
      suggestion: "The request body or parameters may be malformed for this endpoint.",
    }
  }

  if (status === 429) {
    if (body.includes("quota") || body.includes("daily"))
      return { cause: "Daily quota or token limit reached.", suggestion: "Wait until your quota resets or upgrade to a higher tier." }
    return {
      cause: "Rate limit exceeded — too many requests.",
      suggestion: "Slow down or wait a moment, then retry. Check your rate-limit tier.",
    }
  }

  if (status >= 500) {
    return {
      cause: `Provider server error (HTTP ${status}).`,
      suggestion: "This is on the provider's side — wait a few minutes and retry.",
    }
  }

  if (status === 0) {
    return {
      cause: "Network error — could not reach the provider.",
      suggestion: "Check your internet connection or whether the provider URL is accessible.",
    }
  }

  return null
}
