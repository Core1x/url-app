import { AppError, MAX_HTML_BYTES, MAX_URL_LENGTH, WARN_URL_LENGTH, encodeBase64Url, sha256 } from '../../protocol/src/index';
import { gzip } from '../../protocol/src/compression';
import { validateSingleFileHtml } from './html';

export interface PackagerOptions { compression?: 'gzip'; maxUrlLength?: number }
export interface PackagerResult { url: string; originalSize: number; compressedSize: number; urlLength: number; sha256: string; warnings: string[] }

export async function packHtml(html: string, runtimeUrl: string, options: PackagerOptions = {}): Promise<PackagerResult> {
  const maxUrlLength = options.maxUrlLength ?? MAX_URL_LENGTH;
  if (!Number.isSafeInteger(maxUrlLength) || maxUrlLength <= 0 || maxUrlLength > MAX_URL_LENGTH || (options.compression && options.compression !== 'gzip')) {
    throw new AppError('INVALID_OPTIONS', 'URL 长度限制必须是 1 至 262144 的整数，压缩格式仅支持 gzip。');
  }
  let base: URL;
  try { base = new URL(runtimeUrl); }
  catch { throw new AppError('INVALID_RUNTIME_URL', '请输入完整的 HTTPS Runtime 地址（本机开发可使用 HTTP）。'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  if (base.username || base.password || !(base.protocol === 'https:' || (base.protocol === 'http:' && loopback))) {
    throw new AppError('INVALID_RUNTIME_URL', 'Runtime 必须使用 HTTPS 或本机 HTTP，且不能包含账号密码。');
  }
  if (!html.trim()) throw new AppError('EMPTY_HTML', '请先上传或粘贴一个 HTML 应用。');
  // Guard character length before allocating UTF-8; bytes are checked next.
  if (html.length > MAX_HTML_BYTES) throw new AppError('SIZE_LIMIT', 'HTML 文件不可超过 1 MiB。');
  const bytes = new TextEncoder().encode(html);
  if (bytes.byteLength > MAX_HTML_BYTES) throw new AppError('SIZE_LIMIT', 'HTML 文件的 UTF-8 字节数不可超过 1 MiB。');
  validateSingleFileHtml(html);
  const hash = await sha256(bytes);
  const compressed = await gzip(bytes, MAX_HTML_BYTES + 1024);
  base.hash = new URLSearchParams({ uapp: '1', codec: 'gzip', size: String(bytes.byteLength), sha256: hash, payload: encodeBase64Url(compressed) }).toString();
  const url = base.href;
  if (url.length > maxUrlLength) throw new AppError('URL_LIMIT', `生成链接长 ${url.length} 字符，超过 ${maxUrlLength} 字符上限，请缩小应用。`);
  const warnings = url.length > WARN_URL_LENGTH ? ['链接超过 8 KiB 分享预警值，聊天软件可能截断，请验证接收端的完整链接。'] : [];
  if (loopback) warnings.push('这是本机 Runtime 地址，其他设备无法通过它访问。公开分享前请改为已部署的 HTTPS 地址。');
  return { url, originalSize: bytes.byteLength, compressedSize: compressed.byteLength, urlLength: url.length, sha256: hash, warnings };
}
