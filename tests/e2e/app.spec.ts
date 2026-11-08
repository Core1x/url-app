import { expect, test } from '@playwright/test';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

function link(html: string): string {
  const bytes = Buffer.from(html);
  return '/#' + new URLSearchParams({ uapp: '1', codec: 'gzip', size: String(bytes.length), sha256: createHash('sha256').update(bytes).digest('hex'), payload: gzipSync(bytes).toString('base64url') });
}

test('a URL boots and preserves Unicode, inline styles and JS interaction after refresh', async ({ page }) => {
  await page.goto(link('<style>button{color:rgb(12, 34, 56)}</style><button id="counter">你好 0</button><script>let n=0;document.querySelector("button").onclick=()=>document.querySelector("button").textContent="你好 "+(++n)</script>'));
  const button = page.frameLocator('iframe').getByRole('button');
  await expect(button).toHaveText('你好 0');
  await expect(button).toHaveCSS('color', 'rgb(12, 34, 56)');
  await button.click(); await expect(button).toHaveText('你好 1');
  await page.reload(); await expect(button).toHaveText('你好 0');
});

test('packager can upload, preview, export and open in a fresh browser context', async ({ page, browser }) => {
  await page.goto('/');
  await page.getByLabel('导入 HTML 文件').setInputFiles({ name: 'demo.html', mimeType: 'text/html', buffer: Buffer.from('<h1>独立应用 🌏</h1><button onclick="this.textContent=\'运行成功\'">点我</button>') });
  await page.getByRole('button', { name: '生成链接并预览' }).click();
  const output = page.getByLabel('分享链接');
  await expect(output).toHaveValue(/#uapp=1&codec=gzip/);
  const url = await output.inputValue();
  await expect(page.frameLocator('iframe').getByRole('heading')).toHaveText('独立应用 🌏');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载链接' }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('url-app-link.txt');
  const context = await browser.newContext();
  try {
    const other = await context.newPage(); await other.goto(url);
    await other.frameLocator('iframe').getByRole('button').click();
    await expect(other.frameLocator('iframe').getByRole('button')).toHaveText('运行成功');
  } finally { await context.close(); }
  await page.getByLabel('HTML 源码').fill('<p>新的应用</p>');
  await expect(output).toHaveValue('');
  await expect(page.getByRole('button', { name: '复制链接' })).toBeDisabled();
});

test('calculator demo works without eval or external dependencies', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: '载入计算器' }).click();
  await page.getByRole('button', { name: '生成链接并预览' }).click();
  const frame = page.frameLocator('iframe');
  await frame.getByRole('button', { name: '7', exact: true }).click();
  await frame.getByRole('button', { name: '+', exact: true }).click();
  await frame.getByRole('button', { name: '3', exact: true }).click();
  await frame.getByRole('button', { name: '=', exact: true }).click();
  await expect(frame.locator('output')).toHaveText('10');
  await page.screenshot({ path: testInfo.outputPath('playground.png'), fullPage: true });
});

test('invalid hashes fail closed and can return to the packager', async ({ page }) => {
  await page.goto('/#uapp=1&payload=broken');
  await expect(page.getByRole('alert')).toContainText('字段');
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.getByRole('button', { name: '返回打包器' }).click();
  await expect(page.getByLabel('HTML 源码')).toBeVisible();
});

test('corrupt hashes never execute and unsupported browsers receive an actionable message', async ({ page }) => {
  const url = link('<script>document.body.textContent="should not execute"</script>');
  await page.goto(url.replace(/sha256=[a-f0-9]{64}/, 'sha256=' + '0'.repeat(64)));
  await expect(page.getByRole('alert')).toContainText('完整性校验失败');
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.addInitScript(() => { Object.defineProperty(window, 'DecompressionStream', { value: undefined }); });
  await page.reload(); // Changing only the fragment does not create a new Document.
  await page.goto(url);
  await expect(page.getByRole('alert')).toContainText('不支持 Gzip 解压');
});

test('sandbox blocks parent DOM/storage, fetch, external resources, popups, forms and top navigation', async ({ page }) => {
  const requests: string[] = [];
  // A browser can emit a request event before CSP rejects it. Interception is
  // downstream of CSP and records requests that actually reach the network layer.
  await page.route('https://example.invalid/**', route => { requests.push(route.request().url()); return route.abort(); });
  await page.addInitScript(() => localStorage.setItem('host-secret', 'private'));
  const html = `<img src="https://example.invalid/pixel"><script src="https://example.invalid/evil.js"></script>
    <form action="https://example.invalid/post"><button id="submit">submit</button></form>
    <button id="top">navigate top</button><pre id="result"></pre>
    <script>
      const result = {};
      try { parent.document.body.dataset.owned='yes'; result.dom='allowed'; } catch { result.dom='blocked'; }
      try { result.storage=parent.localStorage.getItem('host-secret'); } catch { result.storage='blocked'; }
      result.popup = window.open('https://example.invalid/popup') === null ? 'blocked' : 'allowed';
      document.querySelector('#top').onclick=()=>{try{top.location='https://example.invalid/top'}catch{}};
      fetch('https://example.invalid/api').then(()=>result.fetch='allowed').catch(()=>result.fetch='blocked').finally(()=>document.querySelector('#result').textContent=JSON.stringify(result));
    </script>`;
  await page.goto(link(html));
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('#result')).toContainText('"fetch":"blocked"');
  expect(JSON.parse(await frame.locator('#result').innerText())).toEqual({ dom: 'blocked', storage: 'blocked', popup: 'blocked', fetch: 'blocked' });
  await frame.locator('#submit').click(); await frame.locator('#top').click();
  await expect(frame.locator('#result')).toBeVisible();
  expect(await page.locator('body').getAttribute('data-owned')).toBeNull();
  expect(new URL(page.url()).hostname).toBe('127.0.0.1');
  expect(requests).toEqual([]);
});

test('hash changes replace the app and clearing hash removes executable content', async ({ page }) => {
  await page.goto(link('<h1>first</h1>'));
  await expect(page.frameLocator('iframe').getByRole('heading')).toHaveText('first');
  const next = link('<h1>second</h1>');
  await page.evaluate(hash => { location.hash = hash; }, next.slice(1));
  await expect(page.frameLocator('iframe').getByRole('heading')).toHaveText('second');
  await page.evaluate(() => { location.hash = ''; });
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByLabel('HTML 源码')).toBeVisible();
});

test('mobile layout fits the viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: '生成链接并预览' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath('mobile.png'), fullPage: true });
});

test('a slow older hash cannot replace the newer application', async ({ page }) => {
  await page.addInitScript(() => {
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    let count = 0;
    crypto.subtle.digest = async (...args) => {
      const result = await digest(...args);
      if (++count === 1) {
        document.documentElement.dataset.digestPending = 'yes';
        await new Promise(resolve => setTimeout(resolve, 300));
        document.documentElement.dataset.digestPending = 'done';
      }
      return result;
    };
  });
  await page.goto(link('<h1>old application</h1>'));
  await expect(page.locator('html')).toHaveAttribute('data-digest-pending', 'yes');
  await page.evaluate(hash => { location.hash = hash; }, link('<h1>new application</h1>').slice(1));
  await expect(page.frameLocator('iframe').getByRole('heading')).toHaveText('new application');
  await expect(page.locator('html')).toHaveAttribute('data-digest-pending', 'done');
  await expect(page.frameLocator('iframe').getByRole('heading')).toHaveText('new application');
});
