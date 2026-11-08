# V0.1 安全边界

本项目用于分发可信来源的小型自包含 HTML 应用。URL 中代码可执行，持有者可以解码全部内容。不要存入密码、API Key、个人秘密或可复用的身份凭证。

## 已实现的隔离

- 仅在 `iframe sandbox="allow-scripts"` 中执行应用；从不将其 HTML 注入宿主 DOM。
- 不添加 `allow-same-origin`、表单、弹窗、下载、顶层导航许可。子框架为 opaque origin，无法直接读取宿主 DOM、Cookie 或 LocalStorage。
- CSP 前缀放在**所有应用字节之前**；`default-src 'none'`，仅允许内联脚本/样式、data/blob 图片、data 字体。禁止连接、外部脚本、外部样式、iframe、worker、object、base 和表单。
- 不使用宿主 DOMParser 解析不可信 HTML，避免解析过程中提前请求资源；Packager 的兼容检查使用无网络副作用的 parse5。
- `referrerpolicy="no-referrer"`；禁用摄像头、麦克风、地理位置与剪贴板能力。
- 最多 256 KiB URL、1 MiB 原始 HTML；流式解压逐块比较声明大小。处理期限 10 秒，结束/超限取消 reader。
- hash 改变时旧 iframe 立即移除，异步解码的旧结果不会覆盖新页面。编辑源码/Runtime 地址后清空旧分享链接和预览。

## 明确不保证的事情

- **Hash 不是签名。** 攻击者可同时替换 HTML 和 hash；“完整性已校验”不等于“已确认可信”。
- **无法保证任意恶意代码零网络访问。** CSP 阻断资源和 API 请求，但 iframe sandbox 通常允许框架自行导航；导航到新文档后，原 srcdoc CSP 不保证继续适用。不要将它用于高风险不可信代码、机密数据或需要严格断网的环境。
- **不能抢占死循环。** 普通 iframe 不承诺独立进程，恶意同步脚本可卡住页面；流式解压超时也依赖事件循环，不能视为强制 CPU 限额。大小限制减少内存风险，但不是系统级资源配额。
- 不拦截页面中的欺骗性内容。沙箱内仍能显示任意文本/界面；宿主不从 iframe 接受任何能力授权消息。
- URL 可进入浏览历史、剪贴板、聊天记录、浏览器扩展和接收端日志。fragment 不随初始 HTTP 请求发送不代表私密。
- 应用可主动放弃 sandbox 提供的功能（例如自导航导致预览内容变化）；这不是可保存和恢复的应用状态协议。

## 测试与部署

浏览器测试验证父 DOM/LocalStorage、fetch、图片、脚本、表单、弹窗和顶层导航阻断，并在三个浏览器内核运行。不会声称这些有限测试证明所有恶意代码都安全。

建议使用独立、无登录态的 Runtime 域名，保持 HTTPS，避免同域承载敏感业务。第一版不开放任何宿主通信接口。

参考：[MDN iframe sandbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe)、[MDN CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP)、[Compression Streams](https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream)。
