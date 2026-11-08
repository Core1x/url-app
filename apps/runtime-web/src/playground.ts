import calculator from '../../../examples/calculator/index.html?raw';
import { createSandbox, decodeApplication } from '../../../packages/runtime/src/index';
import { AppError, MAX_HTML_BYTES, errorMessage } from '../../../packages/protocol/src/index';
import type { PackagerResult } from '../../../packages/packager/src/index';

export function renderPlayground(root: HTMLElement): () => void {
  root.innerHTML = `
    <div class="page">
      <header class="site-header">
        <a class="brand" href="./" aria-label="URL App 首页">URL<span>/</span>APP<span class="version">V0.1</span></a>
        <nav><span class="local-badge"><i></i> 在你的浏览器中打包</span><a href="https://github.com/Core1x/url-app" target="_blank" rel="noopener noreferrer">GitHub ↗</a></nav>
      </header>
      <main>
        <section class="hero">
          <div><p class="eyebrow">SMALL APPS. ONE LINK.</p><h1>一个链接，<br>就是整个应用<span class="hero-dot">。</span></h1><p class="hero-description">把 HTML、样式与交互装进一个 URL。<br>无需单独部署，分享链接，即刻运行。</p></div>
          <div class="hero-note"><span class="orbit">↗</span><p>应用随链接同行</p><span>HTML → GZIP → URL</span></div>
        </section>
        <div class="workspace">
          <section class="panel editor-panel" aria-labelledby="source-heading">
            <div class="panel-heading"><div><span class="step">01</span><h2 id="source-heading">装入你的应用</h2></div><button id="load-demo" class="text-button">载入计算器 <span>↗</span></button></div>
            <form id="pack-form">
              <div class="editor-toolbar"><span><i class="file-dot"></i><span id="file-name">index.html</span></span><label class="upload-label" for="html-file">导入文件 ↑</label><input id="html-file" class="visually-hidden" type="file" accept=".html,.htm,text/html" aria-label="导入 HTML 文件"></div>
              <label class="visually-hidden" for="html-source">HTML 源码</label><textarea id="html-source" spellcheck="false" placeholder="<!doctype html>&#10;<html>&#10;  把完整 HTML 粘贴到这里，&#10;  或载入计算器，开始第一次分享。&#10;</html>"></textarea>
              <div class="editor-footnote"><span>单文件 HTML · CSS / JS 需内联</span><span id="source-size">0 B / 1 MiB</span></div>
              <label class="field-label" for="runtime-base">Runtime 地址 <span>应用链接的运行入口</span></label><input id="runtime-base" type="url" required spellcheck="false" autocomplete="off">
              <div class="action-row"><p>文件与代码在本机处理<br>不会上传到服务器</p><button id="generate" class="button primary" type="submit">生成链接并预览 <span>→</span></button></div>
            </form>
          </section>
          <section class="panel preview-panel" aria-labelledby="preview-heading">
            <div class="panel-heading"><div><span class="step">02</span><h2 id="preview-heading">看看它如何运行</h2></div><span class="sandbox-label">SANDBOX</span></div>
            <div id="preview-stage"><div class="preview-empty"><div class="preview-symbol">&lt; / &gt;</div><h3>小应用，大可能</h3><p>计算器、交互卡片、临时工具…<br>生成链接后，在这里预览。</p><span class="empty-chip">你的下一个想法，只差一个链接</span></div></div>
            <div class="preview-caption"><i></i><span>隔离执行 · 默认禁止外部资源与 API 请求</span></div>
          </section>
        </div>
        <div id="feedback" class="feedback" role="status" aria-live="polite" hidden></div>
        <section class="share-panel" aria-labelledby="share-heading">
          <div class="share-title"><div><span class="step">03</span><h2 id="share-heading">带上链接，分享出去</h2></div><span id="share-state">等待生成</span></div>
          <div id="stats" class="stats" hidden><span>原始 HTML <b id="original-size"></b></span><span>压缩后 <b id="compressed-size"></b></span><span>链接长度 <b id="url-length"></b></span><span>压缩节省 <b id="savings"></b></span></div>
          <label class="visually-hidden" for="share-url">分享链接</label><div class="share-actions"><input id="share-url" readonly placeholder="你的应用链接将出现在这里"><button id="copy" class="button primary" disabled>复制链接</button><button id="download" class="button secondary" disabled>下载链接</button><a id="open-app" class="button secondary" target="_blank" rel="noopener noreferrer" hidden>打开应用 ↗</a></div>
          <p class="share-note">链接包含完整源码，持有者都能读取。请勿放入密码、API Key 或其他秘密。长链接可能被分享平台截断。</p>
        </section>
        <section class="principles"><article><span>01 / SELF-CONTAINED</span><h3>数据就在链接里</h3><p>HTML、CSS 和 JavaScript 随 URL 分发。</p></article><article><span>02 / SHARED RUNTIME</span><h3>部署一次，分享多次</h3><p>所有小应用共用同一份静态运行时。</p></article><article><span>03 / STATELESS</span><h3>轻量，从头开始</h3><p>每次打开恢复初始状态，不保留上次操作。</p></article></section>
      </main>
      <footer class="site-footer"><span>URL APP <span class="muted">/ 实验性的应用分发方式</span></span><a href="https://github.com/Core1x/url-app/blob/main/docs/security.md" target="_blank" rel="noopener noreferrer">使用边界与安全说明 ↗</a></footer>
    </div>`;

  const get = <T extends HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  const source = get<HTMLTextAreaElement>('html-source');
  const base = get<HTMLInputElement>('runtime-base');
  const output = get<HTMLInputElement>('share-url');
  const generate = get<HTMLButtonElement>('generate');
  const copy = get<HTMLButtonElement>('copy');
  const download = get<HTMLButtonElement>('download');
  const open = get<HTMLAnchorElement>('open-app');
  const preview = get('preview-stage');
  const emptyPreview = preview.innerHTML;
  let revision = 0;
  let lastResult: PackagerResult | undefined;
  base.value = location.origin + location.pathname;

  function message(text: string, error = false): void {
    const feedback = get('feedback');
    feedback.textContent = text;
    feedback.hidden = !text;
    feedback.classList.toggle('error', error);
    feedback.setAttribute('role', error ? 'alert' : 'status');
  }
  function invalidate(): void {
    revision++;
    lastResult = undefined;
    output.value = ''; copy.disabled = download.disabled = true;
    open.hidden = true; open.removeAttribute('href');
    get('stats').hidden = true; get('share-state').textContent = '等待生成';
    preview.innerHTML = emptyPreview;
    generate.disabled = false; generate.textContent = '生成链接并预览 →';
    get('source-size').textContent = `${new TextEncoder().encode(source.value).byteLength.toLocaleString()} B / 1 MiB`;
    message('');
  }
  source.addEventListener('input', invalidate);
  base.addEventListener('input', invalidate);
  get('load-demo').addEventListener('click', () => {
    source.value = calculator; get('file-name').textContent = 'calculator.html'; invalidate();
  });
  get<HTMLInputElement>('html-file').addEventListener('change', async event => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0]; if (!file) return;
    invalidate(); const current = revision;
    try {
      if (file.size > MAX_HTML_BYTES) throw new AppError('SIZE_LIMIT', 'HTML 文件不可超过 1 MiB。');
      const bytes = await file.arrayBuffer();
      if (current !== revision) return;
      source.value = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
      get('file-name').textContent = file.name;
      invalidate();
    } catch (error) {
      if (current === revision) message(error instanceof TypeError ? '文件不是有效的 UTF-8 HTML。' : errorMessage(error), true);
    } finally { input.value = ''; }
  });
  get<HTMLFormElement>('pack-form').addEventListener('submit', async event => {
    event.preventDefault(); invalidate(); const current = revision;
    const html = source.value; const runtimeUrl = base.value;
    generate.disabled = true; generate.textContent = '正在打包…';
    try {
      const { packHtml } = await import('../../../packages/packager/src/index');
      if (current !== revision) return;
      const result = await packHtml(html, runtimeUrl);
      const verified = await decodeApplication(new URL(result.url).hash);
      if (current !== revision) return;
      lastResult = result; output.value = result.url;
      copy.disabled = download.disabled = false; open.href = result.url; open.hidden = false;
      get('stats').hidden = false; get('share-state').textContent = '已生成 · 可分享';
      get('original-size').textContent = `${result.originalSize.toLocaleString()} B`;
      get('compressed-size').textContent = `${result.compressedSize.toLocaleString()} B`;
      get('url-length').textContent = `${result.urlLength.toLocaleString()} 字符`;
      get('savings').textContent = `${Math.round((1 - result.compressedSize / result.originalSize) * 100)}%`;
      preview.replaceChildren(createSandbox(verified));
      message(result.warnings.join(' '));
    } catch (error) { if (current === revision) message(errorMessage(error), true); }
    finally { if (current === revision) { generate.disabled = false; generate.textContent = '生成链接并预览 →'; } }
  });
  copy.addEventListener('click', async () => {
    if (!lastResult) return;
    const current = revision;
    try { await navigator.clipboard.writeText(lastResult.url); if (current === revision) message('链接已复制。请在接收端确认可以完整打开。'); }
    catch { if (current === revision) { output.focus(); output.select(); message('浏览器未允许自动复制，链接已选中，请按 Ctrl+C 或 ⌘C 复制。'); } }
  });
  download.addEventListener('click', () => {
    if (!lastResult) return;
    const url = URL.createObjectURL(new Blob([lastResult.url + '\n'], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'url-app-link.txt'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  return () => { revision++; };
}
