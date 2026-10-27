# Codex Agent 业务封装与运行协议

P07-AGENT-2｜P07-DEV 2.0.0｜2026-10-27｜完整实现设计，尚未运行真实任务。

## 产品里的 Agent 是什么

它是一位在受控资料工作区内工作的“成表专员”。收到用户目标、资料和可选规范后，自己打开文件、检查结构、决定用哪些工具，必要时写程序完成批量处理，检查实际表格再修正。用户通过小程序提交资料、采用规范和审核问题，普通流程不暴露终端或要求用户学编程。

后端 API 不为它逐条指定“先 OCR 再提取再归并”；它只冻结可以处理的资料、目标、验收标准和预算。Agent 对完成资料业务负责；系统验证它是否达到标准。既要有 Codex 的实际工具/代码执行，也要有可检验的业务交付，不能只接一个名为 Codex 的聊天模型。

## 两种用户路径

**已有规范。** 用户上传报价 Excel、Word、截图并附上采购标准表，选择“一条供应商报价一行”。Agent 在预检预算内理解模板、提示不可读项，用户确认 scope/字段/规则后由 API10 绑定规范。正式执行中 Agent 自主读全范围、写清洗代码、统一已批准单位、跨资料关联，保留原值和定位；例如型号缺失或两处价格冲突，保留 null/多候选与待核，不编造。生成规范、目标表、问题与来源文件，经独立回读后发布。

**没有规范。** 用户只提交上述资料和“做成报价对比表”。受限预检给可读性/局部建议，不能把前三单元当完整发现。确认后，正式 Agent 分析全部确认范围，识别“供应商报价”粒度、型号/规格/数量/单价/币种/交期等字段，发现只有一份出现的保修也可能重要，给出保留理由和预览。当前 turn 结束、Run WAITING_SCHEMA、释放计算。用户手机编辑或采用，API20 冻结绑定；同源同版本的 Agent thread 继续清洗成表，交独立验收与发布。

**人工纠错。** 用户在结果问题卡选择依据或补值，先看变更影响再提交。后台按同批次预留一轮，建立 child Run、新 workspace/new thread，只读父结果与决定。Agent 重做受影响内容并验证整套结果，新版本成功发布才消耗轮次，原结果一直可追溯。

## Backend 四个角色

| 角色 | 拥有什么 | 不能做什么 |
| --- | --- | --- |
| Business API | 用户/资料授权、scope、采用、决定、订单、grant、版本 | 不靠流程引擎替 Agent 决定每个文件怎么整理 |
| Agent Host / Worker | Codex 会话、授权工作区、租约、预算、进度、检查点、中止 | 不替用户采用规范/冲突，不凭自报完成发布 |
| Codex Agent | 自主读取/分析/脚本/清洗/规范推荐/成表/自查 | 不越资料范围、不编事实、不动商户/DB/发布记录 |
| Validator / Publisher | 冻结标准的独立验证、回读与原子发布 | 不新增业务事实或修改标准替 Agent 放行 |

## 输入清单

[agent-input.schema.json](../../assets/development/v2.0.0/agent-input.schema.json)包含 task/run/operation/attempt、fence/epoch、执行 phase、PROVIDED/DISCOVER 模式、goal/version、源/合同 hash、workspace ID、带 SOURCE/TEMPLATE 角色的相对路径/hash/字节/阅读范围、范围账本、可空 binding、采用回执、父结果/决定、剩余预算及 SDK/CLI/model/instructions/toolkit/unitizer/validator 版本。

工作目录由宿主绑定，不接受客户端任意服务器路径。控制清单和输入只读；修改清单并不扩大真实 ACL。PREFLIGHT 可没有 Run，只挂载允许语义分析的最多 3 单元；正式 EXECUTE 必须有 Run。PROVIDED 正式执行必须有 binding；DISCOVER 继续和 REVISE 必须有服务端绑定回执。这里“采用回执”也包括 PROVIDED 的 API10 确认绑定，不强迫它走 API20。

上下文较大时 Agent 可生成索引/摘要/分块文件再逐步阅读，但必须有完整 scope/coverage 和跨块对象关系；上下文压缩不是删掉后半资料。绑定规范、源角色、当前决定及预算随继续任务再明确装入，不依赖模型记忆维护权限。

## 指令与工具

业务指令要求：完整检查授权范围、区别资料/模板、不得编值、保留来源、重要字段不按频次删、规范须用户采用、冲突输出问题、每候选唯一去向。可用技能补充格式/证据/安全导出知识，但技能不是另一台固定编排器。

工具合同定义能力而不规定顺序：检查文件、可信计量、文档读取、页图/OCR、生成脚本执行、候选文件、独立验证反馈、检查点。Agent 可以反复组合，在预算内换方法和修代码。可信计量/验证程序不可由 Agent 改写；上传的脚本不因它读过就获执行权。工具由固定发布版本准备，不在客户任务中随意联网安装。

详细模板：[Agent instructions](../../assets/development/v2.0.0/agent-instructions.md)、[可选 Skill](../../assets/development/v2.0.0/skill-template.md)、[工具合同](../../assets/development/v2.0.0/agent-tools.contract.json)。这些是本产品设计资源，没有安装到当前用户技能或启动任何 Agent。

## 官方 SDK 接缝

首版 Node Host 使用官方 `@openai/codex-sdk`。已核的基本关系是 `new Codex()` → `startThread()` → `thread.run()`；同 thread 再 `run` 继续，重启后按持久化 ID `resumeThread(threadId)`。具体工作区、权限、输出 schema、流式事件、取消/超时、认证和会话落盘选项，必须核对实际锁定版本类型及运行行为。

内部接口可以定义 `start / continueAfterAdoption / observe / interrupt / recover / close`，但**这些是本项目 adapter 方法名，不冒充官方 SDK 签名**。每次 invocation 带不可变输入/hash/租约，事件记录 thread/turn/item 与业务标识映射。不能用承诺不存在的 `runAgentAndPublish` 或默认开启实验 dynamicTools/App Server。

SDK 不满足某能力时先用官方非交互 CLI 做受控适配试验：`codex exec` 的 `--json` 提供事件，`--output-schema` 约束最终信封，`--output-last-message` 留最终输出；准确会话 ID 恢复。沙箱/工作区/审批参数按本机 help 与锁定版本核对，禁止 full access/自动提权。不要在客户终端暴露这些参数。

根据[官方 SDK](https://learn.chatgpt.com/docs/codex-sdk)及[非交互模式](https://learn.chatgpt.com/docs/non-interactive-mode)选择 SDK 做后台任务；[App Server](https://learn.chatgpt.com/docs/app-server)当前实验，首版不开。P0 不 fork Codex Rust、不另建通用 Agent 平台、不接普通模型 API 然后声称整个业务由 Codex 运行时执行。

## 完成信封与发布

[agent-completion.schema.json](../../assets/development/v2.0.0/agent-completion.schema.json)只允许 PREFLIGHT_READY / PROPOSAL_READY / RESULT_READY / FAILED，含输入/源/绑定 hash、分析范围、规范状态、候选文件相对路径/hash、coverage、提案/预览/问题和用户摘要。

PROPOSAL_READY 必须 FULL_DRAFT + FULL 范围以及提案、预览、覆盖账本，经宿主核对才进入 WAITING_SCHEMA。RESULT_READY 必须 ADOPTED + binding hash + 至少九个候选文件引用；schema 验证只是第一步，还要核准确九文件名称、来源、数量、字节/hash和内容。Agent 无权直接把业务 Run 改 SUCCEEDED。

Agent 生成九文件候选。可信验证器回读规范/结果/来源账本，给规则、事实证据、范围覆盖、重要信息和记录去向结果；可将问题反馈 Agent 修复。最终发布器按独立报告重建/核 `validation.json` 和 `manifest.json`，回读全套文件并核当前租约/权限/版本，短事务提交不可变 result pointer/outbox。不能采信 Agent 写的 PASSED，也不能让 Agent 修改验证代码。

用户看到的是可解释结果和问题。字段缺事实、冲突未解可以形成 NEEDS_REVIEW 结果；关键结构/范围/证据阻断则拒绝假成功。零候选只交诊断，不制造完成业务行。后续取用仍需权限/到期/退款检查，缓存与实际导出/平台履约分开。

## 先实现的最小纵向链路

先完成一个真实 SDK 工作区、一个已有规范合成案例、一个全范围发现并采用继续的案例。收集真实工具/生成脚本、候选文件、来源、checkpoint、独立验收、耗时/费用。再扩全格式和失败/修订/删除/恢复，最后接原生双端。首个演示也必须使用真实 Codex 任务，fake-runtime 只能标合成前端演示。

这版交付是完整工程设计，不是上述链路的执行结果。服务认证与数据政策、SDK 精确版本及原生隔离、真实质量/成本仍须试验，当前生产开关关闭。
