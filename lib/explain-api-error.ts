// ── Shared API error explanation helper ──────────────────────────────────────
// Returns a human-readable cause + actionable suggestion for common HTTP error codes.

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
