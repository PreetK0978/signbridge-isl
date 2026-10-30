/** Collision-resistant id for local records (not a security token). */
export function createId(prefix = ''): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.floor(Math.random() * 1e16).toString(16);
  return `${prefix}${Date.now().toString(36)}${rand}`;
}
