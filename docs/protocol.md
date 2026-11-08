# URL App v1

`https://host/path/#uapp=1&codec=gzip&size=123&sha256=<64 lowercase hex>&payload=<unpadded Base64URL>`

| 字段 | 约束 |
|---|---|
| uapp | 字符串 `1` |
| codec | 字符串 `gzip` |
| size | 1…1048576 的十进制 UTF-8 字节数；无符号、无前导零 |
| sha256 | 原始 UTF-8 字节的 SHA-256；小写 64 位十六进制 |
| payload | Gzip 字节的 RFC 4648 URL 安全 Base64，无 padding |

只允许这五个字段，每个必须出现一次且非空。顺序不影响解析；生成器按表中顺序输出。标准 URLSearchParams 负责 fragment 解析。非规范 Base64 尾部位、非法字符、缺失/重复/未知字段、未知版本/算法均拒绝。

生成器先检查单文件输入及 1 MiB 限制，再对原始 UTF-8 字节计算 hash、Gzip 压缩并编码；保留 Runtime 路径与 query，替换原有 fragment。Runtime URL 仅接受 HTTPS 或 localhost/127.0.0.1/[::1] 的 HTTP，不接受账号密码。

Runtime 顺序为：协议/大小预检查 → Base64URL → Gzip 流式解压 → 实际字节长度 → SHA-256 → 严格 UTF-8 → iframe。每个解压块先计数，超过声明大小立刻取消；不先读完整解压结果再检查。完整 URL 与 fragment 都有 256 KiB 上限。

完整性校验针对原始 HTML 字节，**不包含**后续注入的 CSP 前缀。文本中 BOM 保留。Gzip 输出可因实现不同而变化，但恢复出的字节与 SHA-256 必须一致。

常见错误码：`INVALID_ENVELOPE`、`UNSUPPORTED_VERSION`、`UNSUPPORTED_CODEC`、`INVALID_BASE64`、`INVALID_SIZE`、`INVALID_HASH`、`SIZE_LIMIT`、`URL_LIMIT`、`SIZE_MISMATCH`、`HASH_MISMATCH`、`DECOMPRESSION_FAILED`、`INVALID_UTF8`、`UNSUPPORTED_BROWSER`、`TIMEOUT`。失败时不创建可执行 iframe。

v1 不承载运行后的状态、资源清单或分片。后续版本必须明确版本号；不得静默把未知数据当 HTML 执行。
