# V0.1 验证记录

环境：2026-11-08，Windows，Node.js 24.19.0。

| 检查 | 本地结果 |
|---|---|
| TypeScript 类型检查 | 通过 |
| Vite 静态构建 + 独立 Node CLI | 通过 |
| Vitest 协议/打包/真实 CLI 测试 | 46 / 46 通过 |
| Playwright Chromium | 9 / 9 通过 |
| Playwright WebKit | 9 / 9 通过 |
| Playwright Firefox | 本机测试浏览器无法启动：Windows SideBySide 报缺少 mozglue 程序集；需在 Linux CI 验证 |
| 桌面与 390px 移动布局 | 截图检查；移动布局无横向溢出 |
| 独立代码审核 | 未发现需要修复的问题；审核者独立运行 46 / 46 测试 |
| 生产依赖审计 | npm 官方源返回 0 vulnerabilities |

测试覆盖：Unicode 精确往返、独立 zlib Gzip 互操作、缺失/重复/非法字段、错误版本/编码、篡改 hash、大小不匹配、Gzip 损坏、无效 UTF-8、超限 URL/HTML/解压流、密集节点解析、CLI 输出防覆盖、刷新恢复、独立浏览器上下文、沙箱及 CSP、hash 异步竞态、编辑后失效的分享结果。

Firefox 的启动失败发生在应用加载前；没有把此情况计为通过，也没有从默认 `npm run check` 或 CI 中移除 Firefox。CI 在 Ubuntu 运行完整三浏览器测试。

本地测试只证明同一机器上的多个浏览器上下文可恢复应用。公网部署、开发者电脑关闭后访问、真实手机/其他设备与聊天软件截断行为仍需单独验证，不能由本地测试替代。
