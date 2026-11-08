import { AppError, decodeBase64Url, parseFragment, sha256 } from '../../protocol/src/index';
import { gunzip } from '../../protocol/src/compression';

export async function decodeApplication(fragment: string): Promise<string> {
  const envelope = parseFragment(fragment);
  const bytes = await gunzip(decodeBase64Url(envelope.payload), envelope.size);
  if (bytes.byteLength !== envelope.size) throw new AppError('SIZE_MISMATCH', '应用字节长度不匹配，链接可能不完整。');
  if (await sha256(bytes) !== envelope.sha256) throw new AppError('HASH_MISMATCH', '完整性校验失败，应用内容已改变。');
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { throw new AppError('INVALID_UTF8', '应用必须是有效的 UTF-8 HTML 文件。'); }
}
