import './style.css';
import { createSandbox, decodeApplication } from '../../../packages/runtime/src/index';
import { AppError, MAX_URL_LENGTH, errorMessage } from '../../../packages/protocol/src/index';

const app = document.querySelector<HTMLDivElement>('#app')!;
let epoch = 0;
let dispose: (() => void) | undefined;

async function route(): Promise<void> {
  const current = ++epoch;
  dispose?.(); dispose = undefined;
  app.replaceChildren();
  if (!location.hash || location.hash === '#') {
    const { renderPlayground } = await import('./playground');
    if (current === epoch) dispose = renderPlayground(app);
    return;
  }
  app.innerHTML = `<div class="runtime-shell"><header class="runtime-bar"><a class="brand" href="./">URL<span>/</span>APP</a><span id="runtime-status" role="status">正在解码并校验应用…</span><button id="return-home" class="button small secondary">返回打包器</button></header><main id="runtime-content"><div class="loading"><span class="pulse"></span><p>正在恢复链接中的应用</p></div></main></div>`;
  document.querySelector('#return-home')!.addEventListener('click', () => {
    history.replaceState(null, '', location.pathname + location.search);
    void route();
  });
  try {
    if (location.href.length > MAX_URL_LENGTH) throw new AppError('URL_LIMIT', '完整链接超过 256 KiB 硬限制。');
    const html = await decodeApplication(location.hash);
    if (current !== epoch) return;
    document.querySelector('#runtime-status')!.textContent = '完整性已校验 · 隔离运行';
    document.querySelector('#runtime-content')!.replaceChildren(createSandbox(html));
  } catch (error) {
    if (current !== epoch) return;
    document.querySelector('#runtime-status')!.textContent = '应用未运行';
    const message = document.createElement('div');
    message.className = 'runtime-error'; message.setAttribute('role', 'alert');
    const title = document.createElement('h1'); title.textContent = '无法打开这个应用';
    const detail = document.createElement('p'); detail.textContent = errorMessage(error);
    message.append(title, detail);
    document.querySelector('#runtime-content')!.replaceChildren(message);
  }
}

window.addEventListener('hashchange', () => { void route(); });
void route();
