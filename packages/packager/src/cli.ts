import { readFile, stat, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { packHtml } from './index';
import { AppError, MAX_HTML_BYTES, errorMessage } from '../../protocol/src/index';

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      runtime: { type: 'string' }, out: { type: 'string' }, json: { type: 'boolean' },
      'max-url-length': { type: 'string' }, help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log('URL App v0.1\n用法: npm run pack:html -- <input.html> --runtime <https://host/path/> [--out link.txt] [--json] [--max-url-length 262144]\n仅支持 UTF-8 单文件 HTML，CSS/JS/图片需预先内联。输出文件必须不存在。');
    return;
  }
  if (positionals.length !== 1 || !values.runtime) throw new AppError('USAGE', '请指定一个 HTML 文件和 --runtime 地址。使用 --help 查看示例。');
  const path = positionals[0]!;
  const info = await stat(path);
  if (!info.isFile()) throw new AppError('INVALID_FILE', '输入必须是 HTML 文件。');
  if (info.size > MAX_HTML_BYTES) throw new AppError('SIZE_LIMIT', 'HTML 文件不可超过 1 MiB。');
  const bytes = await readFile(path);
  let html: string;
  try { html = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { throw new AppError('INVALID_UTF8', '输入文件不是有效的 UTF-8。'); }
  const result = await packHtml(html, values.runtime, { maxUrlLength: values['max-url-length'] === undefined ? undefined : Number(values['max-url-length']) });
  if (values.out) await writeFile(values.out, result.url + '\n', { encoding: 'utf8', flag: 'wx' });
  for (const warning of result.warnings) console.error(`提示: ${warning}`);
  console.error(`HTML ${result.originalSize} B → Gzip ${result.compressedSize} B → URL ${result.urlLength} 字符`);
  console.log(values.json ? JSON.stringify(result, null, 2) : result.url);
}

main().catch((error: unknown) => {
  console.error(`URL App: ${error instanceof AppError ? '[' + error.code + '] ' : ''}${errorMessage(error)}`);
  process.exitCode = 1;
});
