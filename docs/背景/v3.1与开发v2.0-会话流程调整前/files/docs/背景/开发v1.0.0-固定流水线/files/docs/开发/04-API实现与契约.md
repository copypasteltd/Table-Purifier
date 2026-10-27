# API 实现与契约

P07-DEV 1.0.0｜业务 v3.1｜[OpenAPI](../../assets/development/v1.0.0/openapi.json)为开发请求/响应结构；所有端点未实现。

## API 分组与版本

业务前缀 `/v1/p07`，operationId 保持 P07-API01—53。精确 method/path 沿用 [v3.1 目录](../../assets/contracts/api-catalog.v3.1.json)，开发版补全类型、错误、查询参数和安全要求；不重编号。OpenAPI 采用 3.1.1 作为选定兼容版本，不声称它是最新版本。[规范](https://spec.openapis.org/oas/v3.1.1.html)。

| API | 实现模块 | 主要资源 |
| --- | --- | --- |
| 01—02、35—39 | identity / capabilities / privacy | 平台换会话、能力、告知/删除、可选绑定、内部开关 |
| 03—11、44—46 | intake / contracts | 草稿、上传许可/complete、源、规范、预检、确认、报价 |
| 12—15、31、51、53 | commerce / support | 原渠道订单、收银、查询、退款、售后及原始平台事件 |
| 16—30 | runs / schemas / decisions / artifacts | 启动、恢复、采用、分页、依据、决定、操作和领取 |
| 32—34、47—49 | templates / export | 去事实规范、列表/版本、取用观察 |
| 40—43 | P1 extension | 增量、复杂格式、开发者异步 API、Web；默认关闭 |
| 50、52 | deletion / support | 删除进度、无订单帮助 |

传输和运维端点单列 [transport.openapi.json](../../assets/development/v1.0.0/transport.openapi.json)：一次上传许可对应的二进制 POST、可撤权 GET 下载、live/ready 探针。它们服务既有业务合同，不增加消费者产品范围，且与平台 my/tt API 无关。

## 鉴权与信任边界

API01 用真实一次性宿主凭据换服务端会话；凭据只发一次、不存正文日志，app_alias 只能选服务端配置中的 app。正式适配器从平台认证响应获得 subject，不信任客户端自报 subject/owner。API02/35 可在无登录时返回已公开能力/政策摘要，不含秘密；具体资源接口都要求本人会话。

API39 用内部 operator 身份和 role，不能复用普通手机 Bearer。API53 使用平台原始 body + 官方原始 header 验签/解密契约，必须在 JSON 改写前保留原字节；不使用消费者 Bearer，也不接受自创 `paid=true`。API42 为 P1 scoped key + 明确支付许可，不能借用消费者 token。安全 schema 只声明内部鉴权类别，不猜测真实供应商验签 header 名称。

会话 token 短期、可撤销，数据库只存 hash；客户端仅受控保存必要 token/资源 ID，不缓存正文/支付签名。所有资源按已验证 owner 查询；越权返回不泄露资源存在性的 404，鉴权失效 401，合法但不允许动作 403。

## 请求、响应和操作

JSON 请求拒绝未知顶层字段（有明确定义的结构化扩展除外），所有 ID/版本/金额/时间类型固定；正文上限在路由单独配置，上传流不用 JSON parser。统一返回：

```json
{
  "request_id": "req_synthetic_001",
  "data": {"operation_id": "00000000-0000-4000-8000-000000000001", "status": "PENDING"}
}
```

异步预检、规范调整、决定修订、删除/退款等返回 HTTP 202 与稳定 operation_id/资源 ID；HTTP 202 只代表已持久接收。API26 返回 operation 的终态与最终资源引用，未知网络结果先查它。同一资源的 SUCCEEDED Run 不因修订重新进入 RUNNING，新 child Run 可通过任务当前指针找回。

错误固定 `error.code/message/retryable/current_versions/operation_id/details` 和 request_id。message 为安全可展示摘要，details 仅字段/限制/冲突信息，不含 SQL、堆栈、密钥、其他账户数据或完整原文。

| HTTP / code | 客户端动作 |
| --- | --- |
| 400 INVALID_REQUEST / 422 RULE_CONTRADICTION | 就近指出非法字段/规则，不自动重发 |
| 401 SESSION_EXPIRED | 重新登录后查询原 operation，不盲目重建 |
| 403 CAPABILITY_DISABLED / LICENSE_REQUIRED | 展示服务端原因；不能外跳付款 |
| 404 RESOURCE_NOT_FOUND | 不泄露跨账户资源 |
| 409 VERSION_CONFLICT / IDEMPOTENCY_MISMATCH | 拉取当前版本；保留本地草稿供比较 |
| 409 OPERATION_IN_PROGRESS / CONTRACT_FROZEN | 查原动作或创建明确新范围 |
| 410 CONTENT_EXPIRED / GRANT_REVOKED | 说明失效范围和仍可用售后 |
| 413 LIMIT_EXCEEDED / 415 UNSUPPORTED_MEDIA | 展示实测限制/支持方式，不悄悄截断 |
| 429 RATE_LIMITED | 遵守 Retry-After；不变更幂等键 |
| 503 DEPENDENCY_UNAVAILABLE | 查询原操作，按安全幂等规则退避 |

## 幂等与版本

所有目录标 `idempotency_required=true` 的消费者写接口使用 `Idempotency-Key`。服务端记录 owner + operationId + key_hash + canonical_request_hash；同键同载荷返回原响应/操作，同键不同载荷 409。外部 I/O 前先持久操作意图；不能只靠短内存缓存。保留期至少覆盖对应合同、回调与重试窗口，W01 在政策配置锁定，过期不能删除业务唯一约束。

`expected_*_version` 是业务结构字段。DELETE46/49 以 query 中 expected_version；其余写入以各自请求结构中的 task/result/proposal/version 提供。回调 API53 在数据库内锁定 order/refund/version，不要求平台发送我们自定义的 expected_version；API52 如关联 task 则检查 expected_task_version，无 task 时没有既存资源需要乐观锁。这是目录 `version_check_required` 的实现细化，不改动原平台协议。

API25 提交 preview_id + preview_hash + expected_result_version，不接受未经预览的新 decisions。API27 只找回原批次的既有操作；确认永久失败且获准重试才建立 retry_of 新 Operation，不能凭 API27 多扣一轮。API20 采用必须同时核源集/用途/提案；旧版一律 409。

PROVIDED 的 API07/08 返回规范草案；API10 范围确认时同时核 provided_standard_draft_id/version、用户明确选择并生成 immutable binding，响应 binding_id。这样无需先建 Run 才能绑定，避免“合同要规范、规范要Run”的循环。DISCOVER 的 API10 绑定模式/范围但 binding_id=null，正式分析后的采用由 API20 完成。API09 的异步预检报告在 API45 的 latest_preflight 读取，API26 用于找回动作。

API11 的 access_mode 明确 PAID / FREE / UNAVAILABLE：PAID 才有 quote_id/amount，FREE 仅服务端试用政策可签 free_grant_id 且金额/quote为空，UNAVAILABLE 不发任何许可。关闭收费不自动授予免费。API12只接受PAID报价；API16消费原单许可或上述free grant。API28尚无完整产物组时返回409 ARTIFACT_NOT_READY，成功响应固定9个文件元信息。

幂等请求的 request_hash 排除 trace/request_id，包含全部业务输入和条件版本。接口响应脱敏后持久保存，不存一次性商户秘密；需要收银参数时查原支付尝试并按通道规则重新取得同原单参数，而不是返回已过期参数后悄悄建第二单。

## 上传与下载的传输协议

API04 返回上传许可：upload_id、POST 目标、单用途短 token、精确 bytes/hash/mime 限制和 expiry。宿主实际文件选择/上传能力由平台适配器决定；默认传输协议支持 multipart 的唯一 `file` part，文件名当展示文本；服务端流式写 quarantine、边读边限字节/算 hash。其他表单参数不构成业务角色事实，角色从 upload_session 读取。

上传 token 仅授权既定 upload_id，不能上传新路径/列目录/改 owner。一个许可成功写入后返回 received；重传同摘要可返回原资源，不拼接重叠片段。complete(API05) 重新查持久对象、实测 MIME/字节/hash 后登记 source_files，API06 才加入 task 草稿。**临时上传完成不等于已进入冻结范围。**

API29 的下载返回 300 秒候选期限的一次用途 grant。URL 不带会话 Bearer，token hash 入库，日志不得记录完整 query。每个新 GET/Range 请求都校 owner/grant/resource/tombstone/expiry/退款撤权；Range 只读完整不可变已发布对象，响应 Content-Disposition 做安全文件名。不得给不可撤销的长期公开对象 URL。已发出的流/用户本地副本无法远程收回；并发 Range 也不把半下载记为导出。

下载字节/上传许可本身不是 53 业务 API 的额外“已实现”数量；其真实行为需宿主适配和传输测试。

依据页由 API23 按授权按需签同一下载网关的 EVIDENCE_PAGE grant，严格绑定 evidence/source_unit/result；它不授予原始对象目录访问。产物 grant 与依据页 grant 用途互斥，来源到期/删除一样撤权。不可用页返回明确限制和可保留摘录，不发公开原图链接。

## 版本化分页与缓存

records/issues 的 cursor 为服务端签名 opaque token，含 owner、run、result_version、filter/fields hash、last stable key、expiry。请求结果版本与游标不符 409；不能跨结果翻页混数据。default=20、max=100，记录卡只传所选 3—5 展示字段，详情/依据按需取。

tasks/orders/templates 使用 `(updated_at,id)` 稳定倒序分页，响应 cursor；变更列表允许重新起页，不能声称数据库快照永久稳定。敏感响应 `Cache-Control: no-store`，手机只保存 IDs/恢复指针。能力配置带 capability_version，允许缓存公开摘要，但每次关键动作重新校验服务端资格。

## 接口交接与生成

OpenAPI `$ref`、operationId 与 v3.1 method/path 校验；生成的 shared DTO 留在 src/shared/contracts/generated，手写类型扩展放独立文件。Fastify 路由 JSON Schema 与 OpenAPI 共源，不能各写一份逐渐漂移。支付/OCR/模型真实响应进入 provider 私有合同，不污染公共 API。

本次核验使用项目 runtime 内的 OpenAPI 专用验证器检查完整规范结构，并核对引用、参数、模型 schema 和映射；没有启动 HTTP 服务。W02 还要补请求/响应 fixture、Fastify inject 与权限/错误/幂等合约测试，W08/W10 再补真实宿主/通道行为。准确检查范围与工具版本以核验报告为准。

## 数值与规范化 hash

JSON 协议整数范围限定到 JavaScript 安全整数 ±(2^53−1)，金额/计数/版本非负或正数按各自 schema；数据库 bigint 上限更大不等于可直接透传。事实 DECIMAL 不转浮点，原数值字符串与批准量纲共同比较。

内部 canonicalization_version=`P07-CJ1`：对象键按 Unicode 标量值序列排序、数组顺序保留、UTF-8 无 BOM、无可选空格，字符串保留原 Unicode（不隐式 NFC 变换）、转义双引号/反斜线/控制字符，不转义普通中文或斜线；拒绝孤立代理码点、NaN/Infinity和浮点数，整数用十进制最短表达。跨 Node/Python 提供含emoji/组合字符/键序/0/false/null的同hash fixture。原文件 hash 始终取原字节，不使用该JSON规范化规则。
