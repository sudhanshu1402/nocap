/** Soft format check only — never a hard gate. Enterprise/proxy keys can differ. */
export function looksLikeApiKey(key: string): boolean {
  return /^sk-ant-[A-Za-z0-9_-]{10,}$/.test(key.trim());
}
