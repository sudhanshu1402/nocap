// Scrubs secret-shaped substrings from any text before it's ever rendered,
// logged, or written to a crash report. Defense in depth — the API key
// itself never comes from model/tool output, but errors and echoed strings
// might contain one (e.g. a misconfigured env var leaking into a message).
const SECRET_PATTERNS: RegExp[] = [
  /sk-ant-[a-zA-Z0-9_-]{8,}/g, // Anthropic API keys
  /sk-[a-zA-Z0-9_-]{20,}/g, // generic OpenAI-style secret keys
  /Bearer\s+[a-zA-Z0-9._-]{10,}/gi, // Bearer tokens
  /ghp_[a-zA-Z0-9]{30,}/g, // GitHub tokens
  /xox[baprs]-[a-zA-Z0-9-]{10,}/g, // Slack tokens
];

export function redact(text: string): string {
  return SECRET_PATTERNS.reduce((acc, pattern) => acc.replace(pattern, '[redacted]'), text);
}
