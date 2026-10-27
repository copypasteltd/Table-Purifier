# 完整开发文档：先会话与完整Skill的七步流程

P07｜业务v3.2｜开发P07-DEV 3.0.0｜2026-10-27｜设计B青绿资料夹1.0.0。设计资料，软件及真实Agent/资金/设备测试未执行。

S1 创建会话并完整预加载Skill → S2 用户提交信息 → S3 Agent分析 → S4 用户确认或调整 → S5 预估计费 → S6 实付后批量产出 → S7 独立保存结果、释放Agent并销毁任务运行环境。

所有新资料处理任务均执行统一七步；PROVIDED和DISCOVER只影响规范来源，不能改变步骤顺序。查看已保存结果走独立结果服务，不启动新Agent或重复收费。用户调整返回分析与确认，旧确认和未付报价失效。结果文件独立保留；整个任务container销毁。本地container指受限Windows原生任务环境，禁止Docker/WSL/VM/MXC。

首版支付宝与抖音原生小程序均为P0，Web/API为P1；未来入口亦须遵守同一合同。保留B视觉/18页/32组件，首页增加会话初始化/完整技能加载/失败状态。模型/SDK/权限/认证、价格和平台能力必须实证，不能以本资料为上线或测试通过。

## 当前文档

| 专题 | 内容 |
| --- | --- |
| [技术选型与架构决策](01-技术选型与架构决策.md) | 当前实现合同，未实施 |
| [工程结构与本地环境](02-工程结构与本地环境.md) | 当前实现合同，未实施 |
| [数据库设计与迁移](03-数据库设计与迁移.md) | 当前实现合同，未实施 |
| [API实现与契约](04-API实现与契约.md) | 当前实现合同，未实施 |
| [任务队列与并发恢复](05-任务队列与并发恢复.md) | 当前实现合同，未实施 |
| [Agent文件读取与工具](06-文件解析OCR与整理引擎.md) | 当前实现合同，未实施 |
| [规范发现与人工决定](07-规范发现与人工决定.md) | 当前实现合同，未实施 |
| [独立验收、持久结果与私有规范](08-独立验收产物与私有规范.md) | 当前实现合同，未实施 |
| [双小程序与B组件实现](09-双小程序与B组件实现.md) | 当前实现合同，未实施 |
| [订单支付退款与对账](10-订单支付退款与对账.md) | 当前实现合同，未实施 |
| [安全隐私与运行环境销毁](11-安全隐私与删除执行.md) | 当前实现合同，未实施 |
| [测试策略与持续集成](12-测试策略与持续集成.md) | 当前实现合同，未实施 |
| [原生部署监控与故障手册](13-原生部署监控与故障手册.md) | 当前实现合同，未实施 |
| [开发任务与交接标准](14-开发任务与交接标准.md) | 当前实现合同，未实施 |
| [配置字典与外部接入清单](15-配置字典与外部接入清单.md) | 当前实现合同，未实施 |
| [Codex Agent业务封装与运行协议](16-Codex-Agent业务封装与运行协议.md) | 当前实现合同，未实施 |
| [改版差异与官方能力核对](17-改版差异与官方能力核对.md) | 当前实现合同，未实施 |
| [18 统一七步与销毁](18-统一七步流程与Session生命周期.md) | 全部用户任务唯一正常流程 |


## 结构工件与执行状态

资源在[当前开发指针](../../assets/development/active.json)与v3.0.0目录：[七步合同](../../assets/development/v3.0.0/workflow.contract.json)、[完整预载合同](../../assets/development/v3.0.0/skill-preload.contract.json)、[Skill完整包](../../assets/development/v3.0.0/skill/manifest.json)、[环境销毁合同](../../assets/development/v3.0.0/cleanup.contract.json)、[Agent运行](../../assets/development/v3.0.0/agent-runtime.contract.json)/[工具](../../assets/development/v3.0.0/agent-tools.contract.json)/[输入](../../assets/development/v3.0.0/agent-input.schema.json)/[完成](../../assets/development/v3.0.0/agent-completion.schema.json)与[示例](../../assets/development/v3.0.0/agent-contract-examples.json)。

[OpenAPI56项](../../assets/development/v3.0.0/openapi.json)、[传输端点](../../assets/development/v3.0.0/transport.openapi.json)、[领域schema](../../assets/development/v3.0.0/domain.schema.json)/[正反例](../../assets/development/v3.0.0/contract-examples.json)、[参考DDL](../../assets/development/v3.0.0/schema-reference.sql)/[64表目录](../../assets/development/v3.0.0/database-catalog.json)、[配置](../../assets/development/v3.0.0/config.example.json)/[schema](../../assets/development/v3.0.0/config.schema.json)、[产物schema](../../assets/development/v3.0.0/artifact-manifest.schema.json)、[页面映射](../../assets/development/v3.0.0/ui-implementation-map.json)、[66任务](../../assets/development/v3.0.0/backlog.json)、[240测试计划](../../assets/development/v3.0.0/test-plan.json)及[接入清单](../../assets/development/v3.0.0/integration-register.json)均为设计。

旧资料[152文件快照](../背景/v3.1与开发v2.0-会话流程调整前/snapshot-manifest.json)保留。软件、SDK完整加载、运行清理、真实存储/DB/平台/付款测试均未执行。[静态报告](../评审/P07-七步会话流程-v3.2-核验-2026-10-27.md)只验文档与合同。运行scripts/verify_development_docs.py或verify_requirements_baseline.py进入当前版本核验；封存/打包使用seal_session_first_baseline.py和package_session_first_docs.py。
