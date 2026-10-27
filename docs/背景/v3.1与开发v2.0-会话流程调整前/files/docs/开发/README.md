# 表格修复站开发文档：Codex Agent 业务内核

**P07-DEV 2.0.0｜2026-10-27｜业务 v3.1｜B「青绿资料夹」1.0.0。** 当前为开发设计与参考合同，软件、真实 Codex 任务、数据库迁移、支付和真机均未实现或执行。

核心决定：**后端通过官方 TypeScript Codex SDK 封装一个“资料成表 Agent”。资料怎么读、如何分析、采用什么清洗方法、编写什么处理脚本、如何生成规范和表格，由 Codex Agent 自主完成。** Python、OCR、PDF/XLSX 库是它可选择的工具；Node 业务服务负责任务授权、版本、预算、订单、人工决定及最终发布。独立验证器检查结果，不接管整理业务。

唯一工作目录 `E:\dev\sandbox\支付宝黑客松\表格修复站`。全部项目内容和运行资料留在此目录；原生 Windows，不使用 Docker、WSL、虚拟机或 MXC。支付宝、抖音原生小程序为 P0，Web 为 P1。

## 先读什么

先读 [16 Agent 业务封装](16-Codex-Agent业务封装与运行协议.md)、[01 架构决定](01-技术选型与架构决策.md)及 [17 改版差异](17-改版差异与官方能力核对.md)。按固定阶段调 Python/模型的 v1 已退出当前实施，原件见[历史快照清单](../背景/开发v1.0.0-固定流水线/snapshot-manifest.json)。

| 专题 | 实施内容 |
| --- | --- |
| [01 技术选型与架构](01-技术选型与架构决策.md) | Codex SDK 内核、业务服务、工具及独立验收职责 |
| [02 工程结构与环境](02-工程结构与本地环境.md) | 项目目录、工作区、依赖/认证/权限锁定 |
| [03 数据库与迁移](03-数据库设计与迁移.md) | 56 业务表 + 6 Agent 内部参考表、事务/归属与 RLS |
| [04 API 合同](04-API实现与契约.md) | 53 项业务操作、幂等与版本；原生宿主 SDK 另核 |
| [05 队列与恢复](05-任务队列与并发恢复.md) | Run/thread/turn/租约、暂停采用、恢复/取消 |
| [06 文件读取与工具](06-文件解析OCR与整理引擎.md) | Agent 自主读文件、执行清洗代码及来源追踪 |
| [07 规范与人工决定](07-规范发现与人工决定.md) | PROVIDED 绑定、DISCOVER 全范围推荐/采用、子 Run |
| [08 验收与产物](08-独立验收产物与私有规范.md) | 候选九文件、独立回读、原子发布、私有规范 |
| [09 双端与 B 组件](09-双小程序与B组件实现.md) | 18 页、32 组件、两个原生工程与四环境 |
| [10 交易与对账](10-订单支付退款与对账.md) | 原渠道支付/退款/权益；Agent 不操作资金 |
| [11 安全与删除](11-安全隐私与删除执行.md) | 原生权限、资料指令隔离、会话/脚本/日志清理 |
| [12 测试与 CI](12-测试策略与持续集成.md) | 220 项计划、真实 Agent 评测与内容标准集 |
| [13 部署与故障](13-原生部署监控与故障手册.md) | 原生服务、Codex 进程树、版本/成本/恢复 |
| [14 开发任务](14-开发任务与交接标准.md) | 60 项任务与 W01—W12；全部未开工 |
| [15 配置与外部接入](15-配置字典与外部接入清单.md) | SDK/CLI/model/权限/认证锁定及默认关闭项 |
| [16 Agent 封装协议](16-Codex-Agent业务封装与运行协议.md) | 输入/输出、双模式示例、工具自主权与 SDK 接缝 |
| [17 改版与官方核对](17-改版差异与官方能力核对.md) | 改动原因、已核事实、未验证事项与旧版留存 |

## 当前可评审工件

[开发指针](../../assets/development/active.json)连接本版清单；[Agent 输入 schema](../../assets/development/v2.0.0/agent-input.schema.json)、[完成 schema](../../assets/development/v2.0.0/agent-completion.schema.json)、[运行时合同](../../assets/development/v2.0.0/agent-runtime.contract.json)、[工具合同](../../assets/development/v2.0.0/agent-tools.contract.json)、[业务门槛合同](../../assets/development/v2.0.0/pipeline-contract.json)及[合成示例](../../assets/development/v2.0.0/agent-contract-examples.json)共同定义 Agent 接口。pipeline 文件名仅为索引兼容，内容是自主 Agent 循环与必要业务门槛，不规定处理阶段。

[Agent 指令模板](../../assets/development/v2.0.0/agent-instructions.md)与[可选 Skill 模板](../../assets/development/v2.0.0/skill-template.md)是待实现产品的版本化业务指令，不是本次对话要执行的附件。[官方核对清单](../../assets/development/v2.0.0/official-source-register.json)记录依据与本机只读观察；没有把 CLI 帮助检查写成接入成功。

工程参考包括 [OpenAPI](../../assets/development/v2.0.0/openapi.json) / [传输端点](../../assets/development/v2.0.0/transport.openapi.json)、[领域 schema](../../assets/development/v2.0.0/domain.schema.json) / [正反示例](../../assets/development/v2.0.0/contract-examples.json)、[62 表目录](../../assets/development/v2.0.0/database-catalog.json) / [参考 SQL](../../assets/development/v2.0.0/schema-reference.sql)、[配置](../../assets/development/v2.0.0/config.example.json) / [schema](../../assets/development/v2.0.0/config.schema.json)、[产物 schema](../../assets/development/v2.0.0/artifact-manifest.schema.json)、[页面映射](../../assets/development/v2.0.0/ui-implementation-map.json)、[60 项任务](../../assets/development/v2.0.0/backlog.json)、[220 项测试计划](../../assets/development/v2.0.0/test-plan.json)及[外部证据清单](../../assets/development/v2.0.0/integration-register.json)。SQL 未执行，任务 NOT_STARTED，测试 NOT_RUN。

42 需求、126 AC、24 BR、18 NFR、8 指标、24 异常、18 页和 53 业务 API 继续按 [v3.1](../需求深化/README.md)与 [B 冻结基线](../设计定型/B-青绿资料夹-v1.0.0/README.md)验收。本次改变后台实现控制权，不新增消费者入口或改变收费权益。审阅、保留、轮次等候选政策仍待 SKU/实际环境验证。

更新后运行 `python -X utf8 scripts/verify_development_docs.py`。封存与打包使用 `scripts/seal_codex_agent_baseline.py`、`scripts/package_codex_agent_docs.py`；旧版生成/封存脚本已加版本保护。报告见[本版静态核验](../评审/P07-Codex-Agent开发文档-v2.0.0-核验-2026-10-27.md)。静态通过只说明文档/合同/引用一致，不说明产品或 Agent 已运行。
