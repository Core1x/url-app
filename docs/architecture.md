# 架构与 V0.1 决策

`HTML → Packager → UTF-8 / SHA-256 → Gzip → Base64URL → Fragment → Runtime → 有界解压 / 校验 → iframe`

协议模块不依赖 DOM/Node 专有 API；浏览器和 Node.js 24+ 共享 Web Crypto/Compression Streams。Node CLI 只负责文件系统、参数与终端输出。核心打包函数 `packHtml(html, runtimeUrl, options)` 返回链接、原始大小、压缩大小、长度、hash、warnings。

Runtime 的 `decodeApplication(fragment)` 只返回通过校验的 HTML；`createSandbox(html)` 在执行入口统一安装隔离和 CSP。应用本身从不获得宿主存储或交互能力。

`apps/runtime-web` 使用 Vite 构建。hash 非空时只加载小型 Runtime；空 hash 时动态加载网页打包器；HTML 兼容检查的 parse5 等代码在用户打包时才加载。静态路径使用相对 base，适配 GitHub Pages `/url-app/` 子目录。

网页端自动生成源自当前地址的 Runtime 链接，可手动换成公网部署入口；本机入口始终提示不能用于跨设备分享。生成后再次解码校验再预览；修改源码或地址即使有异步任务未结束，也会使旧结果失效。

首版保留源码，不默认精简。用户方案同时提出“第一阶段单文件 HTML”和“CSS/JS 内联”；本版将前者作为输入契约，自动内联/构建工具集成在 V0.2 实现。这样不会错误改写 JS、模板或有语义的空格。

网页导入/粘贴/预览前移到本次首版，以便用户直接体验闭环；没有引入完整 V1.0 的分卷、WASM 或文件协议。Node CLI 保持可独立使用。

FloppyURL 参考代码使用 Go/Brotli/WASM 和不同 payload 格式。本实现不复用其代码和许可证文件，也不兼容其链接。参见 NOTICE.md。
