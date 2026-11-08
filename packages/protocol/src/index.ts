import { AppError } from './errors';
import { decodeBase64Url } from './encoding';

export { AppError, errorMessage } from './errors';
export { decodeBase64Url, encodeBase64Url, sha256 } from './encoding';

export const MAX_HTML_BYTES = 1024 * 1024;
export const MAX_URL_LENGTH = 256 * 1024;
export const WARN_URL_LENGTH = 8 * 1024;
export interface Envelope { version: 1; codec: 'gzip'; size: number; sha256: string; payload: string }

export function parseFragment(fragment: string): Envelope {
  if (fragment.length > MAX_URL_LENGTH) {
    throw new AppError('URL_LIMIT', '链接数据超过 256 KiB 硬限制。');
  }
  const params = new URLSearchParams(fragment.startsWith('#') ? fragment.slice(1) : fragment);
  const fields = ['uapp', 'codec', 'size', 'sha256', 'payload'];
  if ([...params.keys()].some(key => !fields.includes(key)) || fields.some(key => params.getAll(key).length !== 1 || !params.get(key))) {
    throw new AppError('INVALID_ENVELOPE', '链接字段缺失、重复或无法识别，请重新复制完整链接。');
  }
  if (params.get('uapp') !== '1') throw new AppError('UNSUPPORTED_VERSION', '此 Runtime 仅支持 URL App 协议 v1。');
  if (params.get('codec') !== 'gzip') throw new AppError('UNSUPPORTED_CODEC', '此 Runtime 仅支持 Gzip 压缩。');
  const sizeText = params.get('size')!;
  if (!/^[1-9]\d*$/.test(sizeText) || !Number.isSafeInteger(Number(sizeText))) {
    throw new AppError('INVALID_SIZE', '应用声明的字节长度无效。');
  }
  const size = Number(sizeText);
  if (size > MAX_HTML_BYTES) throw new AppError('SIZE_LIMIT', '应用解压后不可超过 1 MiB。');
  const hash = params.get('sha256')!;
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new AppError('INVALID_HASH', 'SHA-256 校验字段无效。');
  const payload = params.get('payload')!;
  decodeBase64Url(payload);
  return { version: 1, codec: 'gzip', size, sha256: hash, payload };
}
