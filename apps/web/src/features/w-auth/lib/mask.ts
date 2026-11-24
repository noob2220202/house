/** "김서진" → "김*진", "김진" → "김*", "Alexander" → "A*******r". Never shows the full name. */
export function maskName(name: string | null | undefined): string {
  const chars = Array.from((name ?? '').trim());
  if (chars.length === 0) return '';
  if (chars.length === 1) return '*';
  if (chars.length === 2) return `${chars[0]}*`;
  return `${chars[0]}${'*'.repeat(chars.length - 2)}${chars[chars.length - 1]}`;
}

/** "kimseojin@kakao.com" → "ki***@kakao.com". Returns '' for anything that is not an e-mail. */
export function maskEmail(email: string | null | undefined): string {
  const value = (email ?? '').trim();
  const at = value.lastIndexOf('@');
  if (at <= 0 || at === value.length - 1) return '';
  const local = value.slice(0, at);
  const visible = local.slice(0, Math.min(2, Math.max(1, local.length - 1)));
  return `${visible}***${value.slice(at)}`;
}
