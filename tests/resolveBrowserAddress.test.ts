import { describe, expect, it } from 'vitest';
import { resolveBrowserAddress } from '../src/components/CallUi/BrowserActivity/resolveBrowserAddress';

describe('resolveBrowserAddress', () => {
  it('opens hostnames and URLs directly and sends other text to search', () => {
    expect(resolveBrowserAddress('example.com')).toBe('https://example.com');
    expect(resolveBrowserAddress('http://localhost:3000')).toBe('http://localhost:3000');
    expect(resolveBrowserAddress('cats and dogs')).toBe('https://www.google.com/search?q=cats%20and%20dogs');
    expect(resolveBrowserAddress('')).toBe('about:blank');
  });
});
