# URL App

把完整的轻量 HTML 应用装进一个 URL。用一次部署的静态 Runtime，在浏览器中校验、恢复与隔离运行。

**V0.1** · TypeScript · Vite · Gzip · Base64URL · SHA-256

目标站点：[Core1x.github.io/url-app](https://core1x.github.io/url-app/)（首次使用需完成 GitHub Pages 配置，见下文）。

## 已实现

- 单文件 UTF-8 HTML → URL → 浏览器应用，中文、Emoji、内联样式与 JS 交互。
- 网页粘贴/文件导入、沙箱预览、链接复制/下载、体积统计与计算器示例。
- Node CLI 与浏览器共用打包协议；源码无上传、无账户、无后端存储。
- 严格 v1 字段解析、SHA-256/长度校验、流式解压限制和友好错误。
- `sandbox="allow-scripts"` + CSP；默认禁止外部资源与 API 请求。
- Vitest 单元/CLI 集成测试；Playwright Chromium、Firefox、WebKit 浏览器测试。
- CI 和 GitHub Pages 部署工作流。

## 本地运行

要求 Node.js **24+**，npm。浏览器需支持 Gzip Compression Streams 与 Web Crypto；公网使用 HTTPS，本地使用 localhost/127.0.0.1。

```bash
npm ci
npm run dev
```

打开终端显示的本机地址，点击「载入计算器」→「生成链接并预览」。本机 URL 只有本机可以使用；跨设备分享请将 Runtime 地址改为已部署的 HTTPS 入口。

```bash
npm run build
npm run preview
```

静态站点在 `dist/`，无需 Node 服务。`dist-cli/url-app.mjs` 是独立 Node CLI。

## CLI

```bash
npm run pack:html -- examples/calculator/index.html --runtime https://core1x.github.io/url-app/ --out share-url.txt
node dist-cli/url-app.mjs examples/calculator/index.html --runtime https://core1x.github.io/url-app/ --json
node dist-cli/url-app.mjs --help
```

`--runtime` 必填；`--out` 不覆盖已有文件；`--json` 返回包含链接和统计的 JSON；`--max-url-length` 可设置更低的长度限制。直接调用构建后的 CLI 时，stdout 仅输出链接或 JSON，stderr 输出统计/提示。npm 自身可能向 stdout 写入命令横幅，脚本集成请使用 `node dist-cli/url-app.mjs`。

## 输入边界与体积策略

首版接受**已经自包含的 HTML**：内联 `<style>`、`<script>` 和 Data URL 图片。打包器会拒绝显式外链脚本/样式、普通图片路径、嵌套 iframe、base、refresh 等不支持的输入。它不是完整的静态依赖分析器；CSS 中的 URL、JS 动态依赖和外部 API 在 Runtime 仍会受 CSP 限制。首版不自动下载或内联外部资源，也不修改源码的空白与执行语义。

| 项目策略 | 限制 |
|---|---|
| 链接分享预警 | 大于 8 KiB |
| 完整 URL 硬上限 | 256 KiB（ASCII URL 字符） |
| 原始/解压后 HTML | 1 MiB UTF-8 字节 |
| 压缩/解压读取期限 | 10 秒（尽力限制） |

这些是本项目策略，**不是所有浏览器和聊天软件通用的上限**。短小工具最适合。刷新会恢复初始状态；不提供持久化数据、认证或后端能力。

## GitHub Pages

1. 将此项目推送到自己的 GitHub 仓库。
2. 在 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
3. 向 `main` 推送，或从 **Actions → Deploy GitHub Pages → Run workflow** 运行部署。
4. 工作流先运行单元测试、类型检查、构建和三个浏览器的端到端测试，再上传/部署 `dist/`。
5. 对本仓库，入口为 `https://core1x.github.io/url-app/`。Vite 使用相对资源路径，支持仓库子目录和自定义域名。

Runtime 必须持续由静态主机提供；生成链接后开发者电脑可关闭，但公共 Runtime 不能关闭或换掉路径。应用数据在 fragment 中，初始 HTTP 请求不会发送它；这不是加密，持有链接者都可以解码源码。**不要放入秘密。**

## 验证

```bash
npx playwright install chromium firefox webkit
npm run check
```

Linux CI 安装浏览器时使用 `npx playwright install --with-deps chromium firefox webkit`。

测试会运行真实 Node CLI，并使用生产构建做浏览器测试。截图和失败轨迹在 `test-results/`。详细验证记录见 [docs/verification.md](docs/verification.md)。

## 结构

```text
packages/protocol/    协议、编码、压缩与限制
packages/packager/    HTML 兼容检查、打包 API、Node CLI
packages/runtime/    校验解码、iframe sandbox
apps/runtime-web/    静态 Runtime + 网页打包器
examples/calculator/ 单文件计算器
tests/               单元、CLI 集成和浏览器测试
docs/                用户方案、架构、协议、安全与验证说明
```

## 安全与后续范围

SHA-256 仅检查一致性，**不证明作者身份或内容可信**。iframe/CSP 不是用于执行任意恶意代码的完整安全边界：自导航、CPU/内存耗尽等风险仍存在。仅打开可信来源的应用；完整说明见 [docs/security.md](docs/security.md)。

V0.2 再处理 Vite/React/Vue 构建产物及资源内联；Brotli/WASM、分卷、`.uapp` 文件格式留待后续版本。本版不兼容 FloppyURL 的 Brotli/分卷链接。

## 来源与许可证

参考 [Xelckis/FloppyURL](https://github.com/Xelckis/FloppyURL) 的 URL hash 自包含分发思路；本项目按用户提供的方案独立实现 TypeScript/Gzip 版本，没有复制其 Go/WASM/页面源码。详见 [NOTICE.md](NOTICE.md)。沿用本仓库既有 [MIT License](LICENSE)。
