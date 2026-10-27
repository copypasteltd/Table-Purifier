# 技术决策 / Implementation decisions

适用：源码 0.1.0、需求 v3.2、DEV3、B1.0.0。Scope: source handoff, not live integration acceptance.

| 决策 / Decision | 当前方案和原因 / Approach and rationale |
| --- | --- |
| 载体 / Surfaces | 支付宝、抖音优先；Web/API 后续。Alipay and Douyin first, as requested. |
| 客户端 / Client | 共享原生 XML/JS/CSS + esbuild，保留已构建源码和 B 18 页/32 组件。Preserve existing source and the B map. |
| Taro | 尚未采用；React + TS + Taro 待独立评估。之前比较不足，不能宣称原生天然更优；本轮未迁移。Earlier comparison was incomplete; no inherent-superiority claim or migration. |
| Agent | 官方 Codex SDK 0.164.0，完整 Skill/工具预载，由 Agent 自主理解、读取、清洗和成表。Codex owns interpretation and constrained transformations. |
| 可信 Host / Trusted Host | 权限、用户确认、价格、资金、独立验收、发布和清理在模型外。Business authority remains outside the Agent. |
| 隔离 / Isolation | Ubuntu 22.04 原生 Landlock/seccomp/cgroup；禁止 Docker/WSL/VM。真实 Ubuntu 验收待做。Native isolation target; live verification pending. |
| 生命周期 / Lifecycle | 输入前完整预载，保存结果后销毁整个任务环境；CLOSED 不恢复，结果保留。Full preload, durable results, irreversible runtime closure. |
| 再加工 / Rework | 新 Session、父结果引用、必要原件重传、新确认和报价；审核后原单纠错不重置预算。Fresh sessions and exact plans; reviewed correction uses original entitlement. |
| 结果 / Results | 独立持久区、九文件、摘要回读、原子发布和清理 outbox。Durable results and cleanup have separate observable states. |
| 支付 / Payment | 原平台验签查单、原单位整数、幂等退款账本；客户端 success 不放行，分/钻石不兑换。Server payment facts and separate units. |
| 展示 / Media | 实际模板/组件/控制器 + 独立浏览器适配 + 合成夹具，不是宿主、模型或资金验收。Reproducible source preview, not live acceptance. |
| 文档 / Docs | 当前双语入口 + 不变历史快照，不改旧清单伪造通过。Guides evolve; frozen evidence stays intact. |

## Taro 后续评估 / Future Taro evaluation

独立迁移任务应先验证 React/TypeScript/Taro 的路由、状态、B 组件映射，以及两平台登录、支付、上传、文件系统、下载和规范编辑。保留七步门禁、实付校验、规则编辑与证据链；分别验收支付宝/抖音、iOS/Android。能编译不等于迁移完成。

A future migration should prove routing, state, B components and every host adapter. Preserve lifecycle gates, verified payment, schema/rule editing and evidence. Validate each platform/OS; compilation alone is insufficient.

## 整个 container 的含义 / Meaning of the entire container

这里指任务专属原生隔离环境，不授权 Docker。产出后停止所有后代进程、撤销令牌和通道，清理原件、正文、脚本、中间结果、OCR、缓存及正文日志和受控副本。独立最终结果、必要投影、纯私有规范及最小订单/清理凭据按各自生命周期保存；主动隐私删除另行执行。

The container is the dedicated native task environment. Stop descendants, revoke access and remove task content and transient data. Independent artifacts and necessary minimal business records follow separate lifecycles; explicit privacy deletion is an additional operation.
