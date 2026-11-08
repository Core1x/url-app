import { createHash, randomBytes } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { expect, it } from 'vitest';
import { packHtml } from '../../packages/packager/src/index';
import { decodeApplication } from '../../packages/runtime/src/decode';

it('packs exact UTF-8 HTML into a standard gzip stream and preserves the hosting subpath', async () => {
  const html = '<!doctype html><h1>你好 🌏</h1><pre>  keep  whitespace\n</pre>';
  const result = await packHtml(html, 'https://example.com/url-app/?theme=dark#old');
  const url = new URL(result.url);
  expect(url.pathname).toBe('/url-app/');
  expect(url.search).toBe('?theme=dark');
  const p = new URLSearchParams(url.hash.slice(1));
  expect(p.get('uapp')).toBe('1'); expect(p.get('codec')).toBe('gzip');
  expect(gunzipSync(Buffer.from(p.get('payload')!, 'base64url')).toString()).toBe(html);
  expect(result.originalSize).toBe(Buffer.byteLength(html));
  expect(result.sha256).toBe(createHash('sha256').update(html).digest('hex'));
  expect(result.urlLength).toBe(result.url.length);
  await expect(decodeApplication(url.hash)).resolves.toBe(html);
});

it('warns above 8 KiB but rejects URLs above the configured or absolute limit', async () => {
  const html = '<pre>' + randomBytes(10_000).toString('hex') + '</pre>';
  const result = await packHtml(html, 'https://example.com/');
  expect(result.urlLength).toBeGreaterThan(8192); expect(result.warnings.length).toBeGreaterThan(0);
  await expect(packHtml(html, 'https://example.com/', { maxUrlLength: 8192 })).rejects.toMatchObject({ code: 'URL_LIMIT' });
  await expect(packHtml('small', 'https://example.com/', { maxUrlLength: 262145 })).rejects.toMatchObject({ code: 'INVALID_OPTIONS' });
  await expect(packHtml('<pre>' + randomBytes(250_000).toString('hex') + '</pre>', 'https://example.com/')).rejects.toMatchObject({ code: 'URL_LIMIT' });
});

it.each(['', '   ', '\n\t'])('rejects empty applications %j', async html => {
  await expect(packHtml(html, 'https://example.com/')).rejects.toMatchObject({ code: 'EMPTY_HTML' });
});

it('caps raw UTF-8 bytes before compression', async () => {
  await expect(packHtml('中'.repeat(350_000), 'https://example.com/')).rejects.toMatchObject({ code: 'SIZE_LIMIT' });
});

it('handles many sibling elements within the byte budget without overflowing the call stack', async () => {
  const html = '<br>'.repeat(150_000);
  const result = await packHtml(html, 'https://example.com/');
  await expect(decodeApplication(new URL(result.url).hash)).resolves.toBe(html);
});

it.each(['javascript:alert(1)', 'file:///index.html', 'https://u:p@example.com/', 'http://example.com/', 'not-a-url'])('rejects unusable runtime URLs %s', async base => {
  await expect(packHtml('<p>hello</p>', base)).rejects.toMatchObject({ code: 'INVALID_RUNTIME_URL' });
});

it('allows loopback HTTP for development', async () => {
  expect((await packHtml('<p>local</p>', 'http://127.0.0.1:5173/')).url).toContain('http://127.0.0.1:5173/#uapp=1');
});

it.each([
  '<script src="./app.js"></script>', '<link rel="stylesheet" href="style.css">',
  '<img src="https://example.com/pic.png">', '<iframe srcdoc="hello"></iframe>',
  '<base href="https://example.com/">', '<meta http-equiv="refresh" content="0;url=https://example.com/">',
])('explains non-self-contained or unsupported HTML: %s', async html => {
  await expect(packHtml(html, 'https://example.com/')).rejects.toMatchObject({ code: 'EXTERNAL_RESOURCE' });
});

it('keeps inline CSS, scripts and data images intact', async () => {
  const html = '<style>body{color:red}</style><img src="data:image/png;base64,aA=="><script>document.body.dataset.ready="yes"</script>';
  await expect(decodeApplication(new URL((await packHtml(html, 'https://example.com/')).url).hash)).resolves.toBe(html);
});
