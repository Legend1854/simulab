export function newId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replaceAll('-', '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${random}`;
}

/** Turns a display name into an identifier that satisfies ID_PATTERN, avoiding ids already taken. */
export function slugId(name: string, taken: ReadonlyArray<string>, fallback: string): string {
  let base = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 28);
  if (!/^[a-z]/.test(base)) base = `${fallback}${base ? `_${base}` : ''}`.slice(0, 28);
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let counter = 2;
  while (used.has(`${base}_${counter}`)) counter += 1;
  return `${base}_${counter}`;
}

export const nowIso = (): string => new Date().toISOString();
