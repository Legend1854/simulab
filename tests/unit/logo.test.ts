// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOGO_SVG_SOURCE } from '../../src/components/Logo';

describe('logo mark', () => {
  it('uses the same drawing for the favicon in index.html', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const href = /<link rel="icon" href="data:image\/svg\+xml,([^"]+)"/.exec(html)?.[1];
    expect(href).toBeDefined();
    expect(decodeURIComponent(href ?? '')).toBe(LOGO_SVG_SOURCE);
  });
});
