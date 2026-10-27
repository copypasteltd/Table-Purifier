# Codex Agent业务封装与运行协议

P07｜业务v3.2｜开发P07-DEV 3.0.0｜2026-10-27｜设计B青绿资料夹1.0.0。设计资料，软件及真实Agent/资金/设备测试未执行。

S1 创建会话并完整预加载Skill → S2 用户提交信息 → S3 Agent分析 → S4 用户确认或调整 → S5 预估计费 → S6 实付后批量产出 → S7 独立保存结果、释放Agent并销毁任务运行环境。


官方Codex SDK提供真正的工具/代码/文件会话能力，Host封装资料成表Agent。SDK基本startThread/run/resume关系按锁定版本适配；工作区、完整上下文注入、流式/取消/认证/落盘参数需核实际类型。App Server实验能力首版关闭，不fork内核或另造固定文件业务流水线。

P07-AGENT-3 phase：BOOTSTRAP无客户输入，完整加载锁定Skill；ANALYZE/ADJUST没有生产Run与候选包权限，完整理解/规范计划/最多5条预览；BATCH/REPAIR有session/task/run和Skill预载、source/plan/binding及服务端实付回执hash才生成候选九文件。

最终信封SESSION_READY/PLAN_READY/RESULT_READY/FAILED只是Agent不可信输出，Host核phase、实际预载内容、归属/范围/付款、文件/hash与独立验收。Agent不得自报付款、确认、价格、发布或销毁成功。上下文压缩/恢复需重附完整Skill与当前控制事实。

原生产Run WAITING_SCHEMA路径退出；采用/确认在付款前的session完成。结果发布后销毁整个环境，新加工新session完整加载。SDK不会被假定有一条close即可擦除所有日志/文件/供应商副本，Host清理器负责实际证据。

[官方SDK](https://learn.chatgpt.com/docs/codex-sdk)、[Skill默认加载](https://learn.chatgpt.com/docs/build-skills)、[非交互执行](https://learn.chatgpt.com/docs/non-interactive-mode)。


[统一七步细则](18-统一七步流程与Session生命周期.md)。
## 实施细则

## 官方 SDK 接缝

首版 Node Host 使用官方 `@openai/codex-sdk`。已核的基本关系是 `new Codex()` → `startThread()` → `thread.run()`；同 thread 再 `run` 继续，重启后按持久化 ID `resumeThread(threadId)`。具体工作区、权限、输出 schema、流式事件、取消/超时、认证和会话落盘选项，必须核对实际锁定版本类型及运行行为。

内部接口可以定义 `start / continueAfterAdoption / observe / interrupt / recover / close`，但**这些是本项目 adapter 方法名，不冒充官方 SDK 签名**。每次 invocation 带不可变输入/hash/租约，事件记录 thread/turn/item 与业务标识映射。不能用承诺不存在的 `runAgentAndPublish` 或默认开启实验 dynamicTools/App Server。

SDK 不满足某能力时先用官方非交互 CLI 做受控适配试验：`codex exec` 的 `--json` 提供事件，`--output-schema` 约束最终信封，`--output-last-message` 留最终输出；准确会话 ID 恢复。沙箱/工作区/审批参数按本机 help 与锁定版本核对，禁止 full access/自动提权。不要在客户终端暴露这些参数。

根据[官方 SDK](https://learn.chatgpt.com/docs/codex-sdk)及[非交互模式](https://learn.chatgpt.com/docs/non-interactive-mode)选择 SDK 做后台任务；[App Server](https://learn.chatgpt.com/docs/app-server)当前实验，首版不开。P0 不 fork Codex Rust、不另建通用 Agent 平台、不接普通模型 API 然后声称整个业务由 Codex 运行时执行。


### Host Adapter与阶段封装

应用接口createSession/prepareFullSkill/submitInput/analyze/adjust/confirmPlan/quote/startPaidBatch/persistResult/destroyRuntime是我们自己的Host抽象，不能当作SDK原生方法。`startThread/run/resumeThread`的参数、事件、取消、上下文注入、会话落盘按固定版本实际适配。完整预加载是产品策略，不能用默认渐进加载替代。

| 阶段 | 资料/输出/权限 |
| --- | --- |
| BOOTSTRAP | task/run/input皆空；全Skill资源真实装配，工具/权限/认证就绪；无客户内容 |
| ANALYZE/ADJUST | 有Task/源和preload回执，无Run；全范围分析、规范/计划、最多5条小样；批量导出关闭 |
| BATCH/REPAIR | 有Run、准确确认计划/源/绑定及服务端实付回执；预算内生成九文件候选 |
| PUBLISH/CLEANUP | 由Host独立验证/保存/发布/停止/清理；Agent无这些可信写权限 |

输入phase/许可必须在工具和文件访问层执行，不能只依赖提示词。技能正文、全部references、受信任工具脚本和说明按发布清单读取/hash/装入实际上下文，失败阻断READY；模型echo hash不足以证明。上下文压缩/进行中恢复后继续客户turn前重附同一完整版本；放不下则初始化或恢复失败，不截断或懒加载。

PLAN_READY必须说明FULL分析范围、准确plan及有界预览且无正式候选包；RESULT_READY必须九文件齐全但只是Agent声明，Host仍独立验收。最终可信持久发布后整个运行环境清除，不能用旧thread继续回复用户或修订结果。当前全部是合同/设计资源，真实SDK/工具程序未实现。
