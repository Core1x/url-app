# URL-native 无状态前端应用分发系统
## 技术实现方案与开发计划

**项目代号：** URL App
**项目类型：** 开源工具 / 前端应用分发系统
**核心方向：** URL-native Application Distribution
**技术路线：** TypeScript + Vite + WebAssembly（后续增强）

---

# 1. 项目概述

## 1.1 项目背景

传统 Web 应用的发布通常需要经过构建、上传、部署和配置域名等步骤。即使是一个只有 HTML、CSS 和 JavaScript 的小型应用，也需要通过静态服务器或 CDN 提供访问服务。

本项目希望探索一种不同的应用分发模式：

将完整的前端应用经过压缩、编码后，直接封装进 URL。用户访问链接时，由一个通用的浏览器运行时读取 URL 中的数据，在客户端完成解码、解压和应用渲染。

每个应用不需要独立部署，所有应用共用一份 Runtime。

## 1.2 核心目标

构建一个 URL-native 前端应用分发系统，实现：

1. 支持将 HTML、CSS、JavaScript 打包成一个可分享的 URL。
2. 支持在浏览器中自动解码、解压和恢复网页。
3. 支持应用的正常交互和 JavaScript 执行。
4. 所有应用共用一个通用 Runtime。
5. Runtime 可以部署在 GitHub Pages 等静态托管平台。
6. 应用代码和初始数据随 URL 分发，不依赖独立的应用服务器。
7. 后续支持 Vite、React、Vue 等现代前端项目。

## 1.3 非目标

第一阶段不考虑：

- 后端 API 和数据库服务。
- 多用户实时协作。
- 用户认证和权限管理。
- 复杂的服务端业务逻辑。
- 大型网站和大型媒体资源的完整打包。
- 依赖服务器保存的持久化状态。

项目定位是轻量级、可交互、可分享的无状态前端应用，而不是传统网站托管平台的替代品。

---

# 2. 核心产品形态

系统由两个相互独立的部分构成。

### 2.1 Packager：应用打包器

负责将开发者的前端应用转换为可分发的 URL。

输入：
- HTML
- CSS
- JavaScript
- 前端项目构建产物

输出：
- 压缩后的应用数据
- Base64URL 编码
- 最终可分享 URL

Packager 可以提供 CLI 和网页端两种入口。

### 2.2 Runtime：浏览器运行时

负责读取 URL 中的应用数据，并在浏览器中完成恢复和执行。

主要职责：
- 读取 URL Fragment。
- 解析协议版本和压缩格式。
- 解码 Base64URL。
- 解压应用数据。
- 校验数据完整性。
- 创建隔离的 iframe。
- 将应用注入 iframe 并运行。

Runtime 只需部署一次，所有应用共用。

### 2.3 整体架构

```text
              Developer
                  |
                  v
          Frontend Application
                  |
                  v
              Packager
                  |
       +----------+----------+
       |                     |
       v                     v
   Minification          Asset Inline
       |                     |
       +----------+----------+
                  |
                  v
             Compression
                  |
                  v
             Base64URL
                  |
                  v
          Generate Share URL
                  |
                  v
             User Browser
                  |
                  v
         Static Runtime Hosting
                  |
                  v
           Runtime Bootstrap
                  |
                  v
         Decode & Decompress
                  |
                  v
          Integrity Validation
                  |
                  v
          Sandboxed iframe
                  |
                  v
          Running Application
```

注意：URL 中的 Fragment（# 后面的内容）不会随初始 HTTP 请求发送到服务器。服务器只提供通用 Runtime，实际应用数据由浏览器自行读取。

---

# 3. 技术栈设计

第一版优先选择成熟的 Web 技术，避免过早引入复杂的 WASM 开发。

| 模块 | 技术方案 | 用途 |
|---|---|---|
| 开发语言 | TypeScript | 主体开发语言 |
| 构建工具 | Vite | 项目构建 |
| 打包优化 | esbuild | JavaScript 压缩 |
| 单文件打包 | vite-plugin-singlefile | 内联 CSS/JS |
| 压缩算法 | Gzip | 第一版数据压缩 |
| 编码方式 | Base64URL | URL 安全编码 |
| 浏览器解压 | DecompressionStream | 客户端解压 |
| 应用执行 | iframe sandbox | 隔离执行 |
| 测试 | Vitest + Playwright | 单元测试和浏览器测试 |
| 静态托管 | GitHub Pages | Runtime 部署 |

### 3.1 为什么第一版不使用 WASM？

现代浏览器已经提供 Compression Streams API，可以完成 Gzip 数据解压。

第一版没有必要为了 Brotli 提前引入 WASM 运行时。

这样可以减少：
- WASM 编译和运行时配置。
- Go 与 JavaScript 的互操作问题。
- 额外的二进制资源。
- 开发和调试成本。

后续如果需要提高压缩率，再引入 Brotli + WASM。

### 3.2 压缩算法演进

- V0.1：Gzip。
- V0.2：完善压缩性能和资源处理。
- V1.0：增加 Brotli/WASM 可选解码方案。

Runtime 必须检测当前浏览器支持的解压格式，不能假设所有浏览器都支持同一种压缩算法。

---

# 4. URL 数据协议设计

这是项目中最重要的基础设计之一。

如果没有统一的数据协议，后续升级打包器和运行时就会出现兼容性问题。

## 4.1 第一版协议

建议采用以下格式：

```text
https://app.example.com/
#uapp=1&codec=gzip&size=12345&sha256=abcdef...&payload=H4sIA...
```

字段说明：

| 字段 | 含义 |
|---|---|
| uapp | 协议标识及版本 |
| codec | 压缩算法 |
| size | 解压后的原始字节长度 |
| sha256 | 原始应用数据的 SHA-256 |
| payload | Base64URL 编码的压缩数据 |

使用 URLSearchParams 解析 Fragment。

Base64URL 不包含普通 URL 查询参数中的分隔符，可以直接作为 payload 字段的值。

## 4.2 数据处理流程

Packager：

1. 获取完整 HTML。
2. 将必要 CSS 和 JS 内联。
3. 将字符串转换为 UTF-8 字节。
4. 计算原始数据 SHA-256。
5. 使用 Gzip 压缩。
6. Base64URL 编码。
7. 生成包含协议元数据的 URL。

Runtime：

1. 读取 URL Fragment。
2. 解析协议版本。
3. 检查压缩算法是否支持。
4. 解码 Base64URL。
5. 执行解压。
6. 检查解压后的数据大小。
7. 计算 SHA-256 并核对完整性。
8. 创建 iframe。
9. 加载 HTML。

## 4.3 协议兼容策略

协议版本必须保持明确。

例如：

- v1：Gzip + HTML。
- v2：支持更多压缩算法和资源类型。
- v3：支持应用清单和分卷数据。

Runtime 应当能够识别不支持的协议版本，并给出明确错误提示，而不是直接执行异常数据。

---

# 5. 核心模块实现方案

## 5.1 Packager

第一阶段只接受单文件 HTML。

需要实现：

- 文件读取。
- HTML 精简。
- CSS/JS 内联。
- UTF-8 编码。
- Gzip 压缩。
- Base64URL 编码。
- SHA-256 计算。
- URL 生成。
- URL 长度检测。

建议提供统一接口：

```typescript
interface PackagerOptions {
  compression: "gzip";
  maxUrlLength?: number;
}

interface PackagerResult {
  url: string;
  originalSize: number;
  compressedSize: number;
  urlLength: number;
  sha256: string;
}
```

## 5.2 Runtime

Runtime 是整个系统的核心执行入口。

建议拆分为：

- FragmentParser：解析 URL。
- PayloadDecoder：Base64URL 解码。
- Decompressor：解压。
- IntegrityChecker：完整性校验。
- SandboxManager：创建 iframe。
- ErrorHandler：异常处理。

避免把所有逻辑都写进一个 HTML 文件。

## 5.3 iframe 执行隔离

不能直接将不可信应用 HTML 注入 Runtime 自身的 DOM。

建议使用：

```html
<iframe sandbox="allow-scripts"></iframe>
```

第一版不添加 `allow-same-origin`。

同时在应用 HTML 中加入 CSP：

```html
<meta
  http-equiv="Content-Security-Policy"
  content="
    default-src 'none';
    script-src 'unsafe-inline';
    style-src 'unsafe-inline';
    img-src data: blob:;
    font-src data:;
    connect-src 'none';
    object-src 'none';
    base-uri 'none';
    form-action 'none';
  "
>
```

这是一个针对内联静态应用的初始策略，后续需要根据资源类型进行细化。

安全原则：

1. 应用不能直接访问 Runtime 的 DOM。
2. 应用不能访问 Runtime 的 LocalStorage。
3. 默认禁止网络请求。
4. 默认禁止表单提交和弹窗。
5. 禁止应用修改顶层页面。
6. 对解压数据设置大小限制，防止压缩炸弹。
7. 不允许将密码、API Key 等秘密数据放入 URL。

如果后续需要应用调用宿主能力，必须设计受限的消息通信协议，并进行能力授权。

注意：iframe sandbox 和 CSP 是纵深防御，不代表可以保证任意恶意代码绝对安全。

---

# 6. URL 长度与分卷机制

这是系统最容易遇到的工程限制。

浏览器、代理、聊天软件和其他分享平台对 URL 长度的限制并不一致，不能将某个固定长度视为所有平台通用的上限。

## 6.1 V0.1

只支持单 URL。

Packager 计算最终 URL 长度：

- 正常长度：允许生成。
- 接近项目设定的长度阈值：警告。
- 超出项目设定的长度阈值：拒绝生成或建议导出数据文件。

初始可以将 8 KiB 作为分享兼容性预警值、256 KiB 作为默认硬限制。这两个数字是项目自己的产品策略，不是浏览器的通用限制，后续可以通过实际测试调整。

## 6.2 V1.0

设计分卷机制。

将一个完整 payload 拆成多个独立分片，每个分片拥有：

- 应用 ID。
- 协议版本。
- 当前分片编号。
- 总分片数量。
- 数据校验信息。

Runtime 收到第一个分片后，提示用户输入其他分片，完成拼装后再解压。

需要明确：多分片模式不能保证用户只分享一条链接就能完成全部传输。也可以提供多链接导出或 `.uapp` 文件导出。

如果希望只分享一个短链接，需要额外引入托管 payload 的存储服务，这就不再是纯 URL 自包含模式。

---

# 7. 开发阶段规划

## 阶段一：V0.1 — 最小可行系统

目标：完成单文件 HTML 到 URL，再从 URL 恢复网页的完整流程。

### 任务清单

- [ ] 创建 TypeScript 项目。
- [ ] 搭建 Vite 开发环境。
- [ ] 实现 HTML 文件读取。
- [ ] 实现 UTF-8 编码。
- [ ] 实现 Gzip 压缩。
- [ ] 实现 Base64URL 编码。
- [ ] 定义 URL 协议 v1。
- [ ] 实现 FragmentParser。
- [ ] 实现浏览器端解压。
- [ ] 实现 SHA-256 校验。
- [ ] 实现 iframe sandbox。
- [ ] 实现基本错误提示。
- [ ] 部署 Runtime 到 GitHub Pages。
- [ ] 完成跨设备链接访问测试。

### 验收标准

输入一个简单 HTML 文件，生成 URL。

复制到另一台设备或浏览器，能够直接打开完整网页。

网页中的按钮、输入框和 JavaScript 交互正常。

关闭开发者电脑后，生成的 URL 仍然有效。

**交付物：可运行的 URL-native 应用分发 Demo。**

## 阶段二：V0.2 — 现代前端应用支持

目标：从单文件 HTML 扩展到现代前端构建产物。

### 任务清单

- [ ] 支持 Vite 项目。
- [ ] 支持 React 项目。
- [ ] 支持 Vue 项目。
- [ ] 自动内联 CSS 和 JS。
- [ ] 处理图片和字体资源。
- [ ] 支持资源体积统计。
- [ ] 完善 URL 长度检测。
- [ ] 完善错误处理。
- [ ] 增加浏览器兼容性测试。
- [ ] 完善应用安全策略。

### 验收标准

一个普通 Vite + React 项目，可以通过 CLI 自动构建并生成可访问 URL。

无需单独部署该 React 应用。

**交付物：具备实际使用价值的应用打包器。**

## 阶段三：V1.0 — 完整应用分发系统

目标：从个人实验工具发展为可公开使用的开源项目。

### 任务清单

- [ ] 开发 Web UI 打包器。
- [ ] 支持文件上传和粘贴 HTML。
- [ ] 支持应用在线预览。
- [ ] 增加 Brotli/WASM 可选解码。
- [ ] 实现多分片数据协议。
- [ ] 支持 `.uapp` 文件导入导出。
- [ ] 提供 CLI 命令行工具。
- [ ] 完善协议版本管理。
- [ ] 增加性能测试。
- [ ] 完善安全测试。
- [ ] 编写使用文档。
- [ ] 发布开源项目。

### 验收标准

用户可以通过网页或 CLI 将一个前端应用打包为 URL，并将 URL 分享给其他用户。

Runtime 可以独立部署和更新，不需要为每个应用重新部署。

**交付物：完整的开源应用分发工具。**

---

# 8. 建议仓库结构

```text
url-app/
├── packages/
│   ├── packager/
│   │   ├── src/
│   │   │   ├── html/
│   │   │   ├── compression/
│   │   │   ├── encoding/
│   │   │   ├── protocol/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── runtime/
│   │   ├── src/
│   │   │   ├── parser/
│   │   │   ├── decoder/
│   │   │   ├── decompressor/
│   │   │   ├── sandbox/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── protocol/
│       ├── src/
│       └── package.json
│
├── apps/
│   ├── playground/
│   └── runtime-web/
│
├── examples/
│   ├── hello-world/
│   ├── calculator/
│   └── todo-app/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── docs/
│   ├── architecture.md
│   ├── protocol.md
│   └── security.md
│
├── package.json
└── README.md
```

---

# 9. 测试方案

## 9.1 功能测试

- 简单 HTML 页面。
- CSS 样式恢复。
- JavaScript 事件处理。
- 中文和 Unicode 字符。
- 图片内联。
- 大小不同的 payload。
- 刷新后恢复。
- 不同浏览器打开。
- 不同设备复制链接访问。

## 9.2 异常测试

- URL 缺少 payload。
- Base64URL 编码错误。
- Gzip 数据损坏。
- SHA-256 校验失败。
- 协议版本不支持。
- payload 超出大小限制。
- 解压失败。
- 浏览器不支持相应解压格式。

## 9.3 安全测试

- 尝试访问父页面 DOM。
- 尝试读取父页面 LocalStorage。
- 尝试发起网络请求。
- 尝试打开弹窗。
- 尝试顶层页面跳转。
- 尝试表单提交。
- 测试恶意 HTML 和脚本。

## 9.4 性能测试

记录：

- 原始 HTML 大小。
- 压缩后大小。
- Base64URL 编码后大小。
- 最终 URL 长度。
- 解码耗时。
- 解压耗时。
- iframe 首次渲染耗时。

---

# 10. 风险与技术决策

| 风险 | 应对方案 |
|---|---|
| URL 过长 | 限制体积、分卷或文件导出 |
| 压缩率不足 | 后续引入 Brotli/WASM |
| 浏览器兼容性 | 特性检测和多浏览器测试 |
| 不可信 JavaScript | iframe sandbox + CSP |
| 压缩炸弹 | 解压大小和资源消耗限制 |
| 资源无法内联 | 明确支持的资源类型 |
| 协议升级破坏旧链接 | 版本化协议和向后兼容 |
| 用户误以为 URL 私密 | 明确提示 URL 内容可被持有链接的人访问 |

### 必须坚持的设计原则

1. Packager 和 Runtime 解耦。
2. 协议版本独立管理。
3. 优先实现端到端可运行的最小系统。
4. 不为追求技术复杂度而过早引入 WASM。
5. 安全隔离从第一个版本开始。
6. 不把纯前端应用分发包装成后端部署替代品。
7. 尽量保持应用数据自包含，减少外部依赖。

---

# 11. 第一个开发里程碑

建议不要立即开始开发全部模块。

第一阶段只需要完成以下闭环：

```text
demo.html
    |
    v
Node.js Packager
    |
    v
Gzip + Base64URL
    |
    v
Generate URL
    |
    v
GitHub Pages Runtime
    |
    v
Browser Decompression
    |
    v
Sandboxed iframe
    |
    v
Application Running
```

第一个 Demo 可以设计成一个简单的交互式计算器。

它能够证明：

- URL 确实携带了完整应用。
- Runtime 能够恢复应用。
- 应用能够正常执行 JavaScript。
- 不需要为应用本身部署服务器。
- 不同设备可以通过同一链接运行相同应用。

**最终目标：让 URL 成为一种新的前端应用分发载体。**

用户不再需要关心应用部署在哪里，只需要获取一个链接，就可以运行一个完整的轻量级 Web 应用。
