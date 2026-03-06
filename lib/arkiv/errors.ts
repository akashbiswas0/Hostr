const ERROR_MAP: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /user rejected|user denied/i, message: "Transaction was cancelled." },
  { pattern: /insufficient funds/i, message: "Insufficient funds to complete this action." },
  { pattern: /nonce too low/i, message: "Transaction conflict — please try again." },
  { pattern: /already known/i, message: "This action was already submitted. Please wait." },
  { pattern: /timeout|timed? ?out/i, message: "The network took too long to respond. Please try again." },
  { pattern: /rate limit/i, message: "Too many requests — please wait a moment and retry." },
  { pattern: /entity not found|not found/i, message: "The requested item could not be found." },
  { pattern: /unauthorized|not authorised|not authorized/i, message: "You don't have permission to do that." },
  { pattern: /network error|fetch failed|failed to fetch/i, message: "Network error — check your connection and try again." },
  { pattern: /execution reverted/i, message: "The transaction could not be completed. Please try again." },
  { pattern: /chain mismatch|wrong chain|wrong network/i, message: "Please switch to the correct network." },
  { pattern: /connector not connected/i, message: "Wallet is not connected. Please sign in first." },
  { pattern: /0x[a-f0-9]+/i, message: "Something went wrong. Please try again." },
]

export function friendlyError(raw: unknown): string {
  const message =
    raw instanceof Error ? raw.message : typeof raw === "string" ? raw : String(raw ?? "")

  for (const { pattern, message: friendly } of ERROR_MAP) {
    if (pattern.test(message)) return friendly
  }

  if (message.length > 120) return "Something went wrong. Please try again."
  return message || "An unexpected error occurred."
}
