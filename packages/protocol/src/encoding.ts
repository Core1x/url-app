import { AppError } from './errors';

export function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeBase64Url(text: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(text) || text.length % 4 === 1) {
    throw new AppError('INVALID_BASE64', '链接中的 Base64URL 数据无效或已被截断。');
  }
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  if (encodeBase64Url(bytes) !== text) {
    throw new AppError('INVALID_BASE64', '链接包含非规范的 Base64URL 编码。');
  }
  return bytes;
}

export async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new AppError('UNSUPPORTED_BROWSER', '完整性校验需要 Web Crypto，请使用 HTTPS 或本机 localhost 打开。');
  }
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('');
}
