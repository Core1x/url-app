import { AppError } from './errors';

// Count as data arrives: never materialize an unbounded decompressed Response.
async function readBounded(stream: ReadableStream<Uint8Array>, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void reader.cancel().catch(() => undefined);
  }, 10_000);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (timedOut) throw new AppError('TIMEOUT', '数据处理超时，请缩小应用后重试。');
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        void reader.cancel().catch(() => undefined);
        throw new AppError('SIZE_LIMIT', '实际数据超过声明长度或安全大小限制。');
      }
      chunks.push(value);
    }
    const output = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
    return output;
  } finally { clearTimeout(timer); reader.releaseLock(); }
}

export async function gzip(bytes: Uint8Array<ArrayBuffer>, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  let codec: CompressionStream;
  try { codec = new CompressionStream('gzip'); }
  catch { throw new AppError('UNSUPPORTED_BROWSER', '当前环境不支持 Gzip 压缩，请升级浏览器或使用 Node.js CLI。'); }
  return readBounded(new Blob([bytes]).stream().pipeThrough(codec), limit);
}

export async function gunzip(bytes: Uint8Array<ArrayBuffer>, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  let codec: DecompressionStream;
  try { codec = new DecompressionStream('gzip'); }
  catch { throw new AppError('UNSUPPORTED_BROWSER', '当前浏览器不支持 Gzip 解压，请使用新版 Chrome、Firefox 或 Safari。'); }
  try {
    return await readBounded(new Blob([bytes]).stream().pipeThrough(codec), limit);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('DECOMPRESSION_FAILED', 'Gzip 解压失败，链接可能已损坏或被截断。');
  }
}
