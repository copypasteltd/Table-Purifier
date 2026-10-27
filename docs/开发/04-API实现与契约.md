# API实现与契约

P07｜业务v3.2｜开发P07-DEV 3.0.0｜2026-10-27｜设计B青绿资料夹1.0.0。设计资料，软件及真实Agent/资金/设备测试未执行。

S1 创建会话并完整预加载Skill → S2 用户提交信息 → S3 Agent分析 → S4 用户确认或调整 → S5 预估计费 → S6 实付后批量产出 → S7 独立保存结果、释放Agent并销毁任务运行环境。


56项业务API：新增54创建Agent session/完整预载、55查阶段与证明、56终止清理。03要求ready session，上传/文本接口经Task回查session READY；09进行付费前完整分析；18—20规范接口移到Task，采用不依赖已付Run；10冻结确认计划、11估费、12—14原订单、16只在实付核验后批量。

`Request54`不能带用户文件/goal/text；`Request16`必须有session/contract/order/plan hash，free_grant不是可接受输入。调用55查询得到READY也不能代替服务端在每次写入口检查真实preload receipt。接口schema只验结构，owner、阶段、实付、持久存储与完整Skill上下文须实际验证。

写Idempotency-Key/expected versions，统一错误与operation查询。旧确认/quote或已CLOSED session返回明确阶段/版本错误；客户端success和支付UNKNOWN不授权。所有消费者及P1新增入口复用同一guards，无任意shell/thread/路径代理接口。


[统一七步细则](18-统一七步流程与Session生命周期.md)。
## 实施细则

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

异步完整分析、规范调整、决定修订、删除/退款等返回 HTTP 202 与稳定 operation_id/资源 ID；HTTP 202 只代表已持久接收。API26 返回 operation 的终态与最终资源引用，未知网络结果先查它。同一资源的 SUCCEEDED Run 不因修订重新进入 RUNNING，新 child Run 可通过任务当前指针找回。

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

幂等请求的 request_hash 排除 trace/request_id，包含全部业务输入和条件版本。接口响应脱敏后持久保存，不存一次性商户秘密；需要收银参数时查原支付尝试并按通道规则重新取得同原单参数，而不是返回已过期参数后悄悄建第二单。



## 上传与下载的传输协议

API04 返回上传许可：upload_id、POST 目标、单用途短 token、精确 bytes/hash/mime 限制和 expiry。宿主实际文件选择/上传能力由平台适配器决定；默认传输协议支持 multipart 的唯一 `file` part，文件名当展示文本；服务端流式写 quarantine、边读边限字节/算 hash。其他表单参数不构成业务角色事实，角色从 upload_session 读取。

上传 token 仅授权既定 upload_id，不能上传新路径/列目录/改 owner。一个许可成功写入后返回 received；重传同摘要可返回原资源，不拼接重叠片段。complete(API05) 重新查持久对象、实测 MIME/字节/hash 后登记 source_files，API06 才加入 task 草稿。**临时上传完成不等于已进入冻结范围。**

API29 的下载返回 300 秒候选期限的一次用途 grant。URL 不带会话 Bearer，token hash 入库，日志不得记录完整 query。每个新 GET/Range 请求都校 owner/grant/resource/tombstone/expiry/退款撤权；Range 只读完整不可变已发布对象，响应 Content-Disposition 做安全文件名。不得给不可撤销的长期公开对象 URL。已发出的流/用户本地副本无法远程收回；并发 Range 也不把半下载记为导出。

下载字节/上传许可本身不是 56 业务 API 的额外“已实现”数量；其真实行为需宿主适配和传输测试。

API23返回结果内必要依据摘录/定位；原件已随环境清理时不能签原件页。仅有明确作为结果保存的证据页对象才可签EVIDENCE_PAGE grant，不能保留隐藏的完整原始文件。最终产物与证据grant用途互斥，均按owner/result校验。



## 版本化分页与缓存

records/issues 的 cursor 为服务端签名 opaque token，含 owner、run、result_version、filter/fields hash、last stable key、expiry。请求结果版本与游标不符 409；不能跨结果翻页混数据。default=20、max=100，记录卡只传所选 3—5 展示字段，详情/依据按需取。

tasks/orders/templates 使用 `(updated_at,id)` 稳定倒序分页，响应 cursor；变更列表允许重新起页，不能声称数据库快照永久稳定。敏感响应 `Cache-Control: no-store`，手机只保存 IDs/恢复指针。能力配置带 capability_version，允许缓存公开摘要，但每次关键动作重新校验服务端资格。



## 数值与规范化 hash

JSON 协议整数范围限定到 JavaScript 安全整数 ±(2^53−1)，金额/计数/版本非负或正数按各自 schema；数据库 bigint 上限更大不等于可直接透传。事实 DECIMAL 不转浮点，原数值字符串与批准量纲共同比较。

内部 canonicalization_version=`P07-CJ1`：对象键按 Unicode 标量值序列排序、数组顺序保留、UTF-8 无 BOM、无可选空格，字符串保留原 Unicode（不隐式 NFC 变换）、转义双引号/反斜线/控制字符，不转义普通中文或斜线；拒绝孤立代理码点、NaN/Infinity和浮点数，整数用十进制最短表达。跨 Node/Python 提供含emoji/组合字符/键序/0/false/null的同hash fixture。原文件 hash 始终取原字节，不使用该JSON规范化规则。

### 修订、规范和付款的当前语义

API20先采用当前FULL规范，API10再明确确认plan/source/binding/skill；两种模式均如此。可以由一个用户确认动作顺序调用两个幂等操作，失败时找回原操作。API11仅PAID/UNAVAILABLE，没有消费者FREE分支；API16只消费服务端核实的原实付许可。

API25仅登记新会话修订意图；不能在旧已销毁环境中立即生成child Run。新会话完整预载后，才提交已选父结果与必要原件，经过分析/确认/估费/核实实付权益再创建child Run。API24如果读取已有结果计算确定性决定预览，无Agent则不创建会话；需要Agent读取或语义分析的请求必须先走S1。

API54—56的200响应也只表示返回对应状态；INITIALIZING或cleanup PENDING都不是实际完成。所有资料写入口要在服务端复核READY证明，不信任客户端先读55所得状态。原件清理后API23只提供结果内必要摘录/定位，原件页不存在应明确返回限制，不能签回已删除对象。
