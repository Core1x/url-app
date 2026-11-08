import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { parseFragment } from '../../packages/protocol/src/index';
import { decodeApplication } from '../../packages/runtime/src/decode';

function envelope(bytes = Buffer.from('<h1>你好 🌏</h1>')): URLSearchParams {
  return new URLSearchParams({ uapp: '1', codec: 'gzip', size: String(bytes.length), sha256: createHash('sha256').update(bytes).digest('hex'), payload: gzipSync(bytes).toString('base64url') });
}

describe('protocol boundary', () => {
  it('parses a v1 envelope without confusing Unicode bytes with characters', () => {
    const value = parseFragment('#' + envelope().toString());
    expect(value).toMatchObject({ version: 1, codec: 'gzip', size: 20 });
  });
  it.each([
    ['uapp', '2', 'UNSUPPORTED_VERSION'], ['codec', 'br', 'UNSUPPORTED_CODEC'],
    ['size', '-1', 'INVALID_SIZE'], ['size', '1.5', 'INVALID_SIZE'],
    ['size', '1e3', 'INVALID_SIZE'], ['size', '0', 'INVALID_SIZE'],
    ['size', '1048577', 'SIZE_LIMIT'], ['sha256', 'invalid', 'INVALID_HASH'],
    ['payload', 'abc+', 'INVALID_BASE64'], ['payload', 'a', 'INVALID_BASE64'],
    ['payload', 'AB', 'INVALID_BASE64'], ['payload', 'AA==', 'INVALID_BASE64'],
  ])('rejects invalid %s=%s', (key, value, code) => {
    const p = envelope(); p.set(key, value);
    expect(() => parseFragment(p.toString())).toThrow(expect.objectContaining({ code }));
  });
  it('rejects missing and duplicate fields', () => {
    const p = envelope(); p.delete('payload');
    expect(() => parseFragment(p.toString())).toThrow(expect.objectContaining({ code: 'INVALID_ENVELOPE' }));
    const duplicate = envelope(); duplicate.append('size', '20');
    expect(() => parseFragment(duplicate.toString())).toThrow(expect.objectContaining({ code: 'INVALID_ENVELOPE' }));
  });
  it('rejects unknown parameters and overlong input before processing', () => {
    expect(() => parseFragment(envelope() + '&extra=1')).toThrow(expect.objectContaining({ code: 'INVALID_ENVELOPE' }));
    expect(() => parseFragment('x'.repeat(262145))).toThrow(expect.objectContaining({ code: 'URL_LIMIT' }));
  });
});

describe('bounded application decoding', () => {
  it('restores exact HTML from independently created Node gzip bytes', async () => {
    await expect(decodeApplication('#' + envelope())).resolves.toBe('<h1>你好 🌏</h1>');
  });
  it('checks SHA-256 before returning executable HTML', async () => {
    const p = envelope(); p.set('sha256', '0'.repeat(64));
    await expect(decodeApplication(p.toString())).rejects.toMatchObject({ code: 'HASH_MISMATCH' });
  });
  it('checks the declared uncompressed size', async () => {
    const p = envelope(); p.set('size', '21');
    await expect(decodeApplication(p.toString())).rejects.toMatchObject({ code: 'SIZE_MISMATCH' });
  });
  it('stops an expanding stream at its declared limit', async () => {
    const p = envelope(Buffer.alloc(2 * 1024 * 1024, 65)); p.set('size', '100');
    await expect(decodeApplication(p.toString())).rejects.toMatchObject({ code: 'SIZE_LIMIT' });
  });
  it('rejects corrupt gzip', async () => {
    const p = envelope(); p.set('payload', Buffer.from('not gzip').toString('base64url'));
    await expect(decodeApplication(p.toString())).rejects.toMatchObject({ code: 'DECOMPRESSION_FAILED' });
  });
  it('rejects valid gzip and hash containing invalid UTF-8', async () => {
    await expect(decodeApplication(envelope(Buffer.from([0xff, 0xfe])).toString())).rejects.toMatchObject({ code: 'INVALID_UTF8' });
  });
  it('explains missing browser decompression support', async () => {
    vi.stubGlobal('DecompressionStream', undefined);
    try { await expect(decodeApplication(envelope().toString())).rejects.toMatchObject({ code: 'UNSUPPORTED_BROWSER' }); }
    finally { vi.unstubAllGlobals(); }
  });
});
