import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { decodeApplication } from '../../packages/runtime/src/decode';

const run = promisify(execFile);
const cli = resolve('packages/packager/src/cli.ts');
let directory: string;
beforeAll(async () => { directory = await mkdtemp(join(tmpdir(), 'url-app-test-')); });
afterAll(async () => { await rm(directory, { recursive: true, force: true }); });
const invoke = (...args: string[]) => run(process.execPath, ['--import', 'tsx', cli, ...args]);

it('reads a real Unicode filename and writes a runnable link with parseable JSON statistics', async () => {
  const input = join(directory, '示例 页面.html');
  const output = join(directory, 'link.txt');
  await writeFile(input, '<h1>你好</h1>');
  const { stdout } = await invoke(input, '--runtime', 'https://example.com/app/', '--out', output, '--json');
  const result = JSON.parse(stdout);
  expect((await readFile(output, 'utf8')).trim()).toBe(result.url);
  await expect(decodeApplication(new URL(result.url).hash)).resolves.toBe('<h1>你好</h1>');
});
it('does not overwrite an existing output file', async () => {
  const input = join(directory, 'input.html'); const output = join(directory, 'keep.txt');
  await writeFile(input, '<p>OK</p>'); await writeFile(output, 'keep me');
  await expect(invoke(input, '--runtime', 'https://example.com/', '--out', output)).rejects.toMatchObject({ code: 1 });
  expect(await readFile(output, 'utf8')).toBe('keep me');
});
it('fails on invalid UTF-8, missing input and missing runtime', async () => {
  const invalid = join(directory, 'invalid.html'); await writeFile(invalid, Buffer.from([0xff]));
  for (const args of [[invalid, '--runtime', 'https://example.com/'], [join(directory, 'missing.html'), '--runtime', 'https://example.com/'], [invalid]]) {
    await expect(invoke(...args)).rejects.toMatchObject({ code: 1 });
  }
});
it('prints help without requiring an input file', async () => {
  expect((await invoke('--help')).stdout).toContain('--runtime');
});
