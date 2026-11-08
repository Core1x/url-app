# 参考项目与依赖

URL App 的概念参考为 [Xelckis/FloppyURL](https://github.com/Xelckis/FloppyURL)，该项目使用 Apache-2.0 许可证。实现前已阅读其 README、main.go、descompressor.go 与 Website/index.html。

本仓库按用户提供的《URL-native 无状态前端应用分发系统》方案独立编写 TypeScript/Gzip 实现，没有复制、翻译或分发 FloppyURL 的 Go、WASM 或 HTML/JS 源码。原有 MIT LICENSE（Copyright 2026 Core1x）保留。

运行时及打包器使用原生 Web API。网页打包器与 CLI 内含 MIT 许可的 parse5 和 BSD-2-Clause 许可的 entities；构建输出会附带其第三方许可说明。开发依赖以 package-lock.json 为准，各自保留原许可证。
