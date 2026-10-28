# 表格修复站 · 仓库工作约定

本文件约束当前源码与后续维护；历史设计阶段版本原字节归档于 `docs/背景/仓库入口更新前-2026-10-28/AGENTS.md`。

## 工作范围与用户约束

- 所有本地项目操作位于当前仓库根目录；本次为 `E:\dev\sandbox\支付宝黑客松\表格修复站`。依赖、缓存、浏览器二进制、运行数据、日志和输出均留在项目目录。
- 严禁调用本地 Docker、WSL、VM、MXC 或其他虚拟化环境。Ubuntu 22.04 是目标运行环境，不授权本地虚拟化、远程部署或系统服务安装。
- 不进行应用部署、小程序提审、上线或发布，除非用户明确指定。Git 仓库同步不等于部署授权。
- 浏览器使用后关闭本次不再需要的所有页面、上下文、浏览器和临时服务；失败路径也要释放。不要关闭用户自己的页面。
- 不主动调度子 Agent，除非用户或适用指令明确要求。不要把本产品使用 Codex Agent 的业务方案误解为当前开发任务的多 Agent 授权。
- 真实专用 Codex、App ID 和支付凭据暂未准备；不读取、复制或使用桌面 Codex 登录、全局 auth.json、个人 HOME 或商户秘密作为任务凭据。

## 产品不变量

- 业务 v3.2、开发合同 P07-DEV 3.0.0、设计 B1.0.0。先读根目录中英 README、`docs/README.md`、`docs/实施/源码技术说明.md` 与七步生命周期需求。
- S1 创建 Session 并完整预载 Skill → S2 用户提交 → S3 Agent 分析 → S4 用户确认/调整 → S5 估费 → S6 服务端核实实付后批量 → S7 独立保存结果、释放 Agent、销毁整个任务运行环境。最终结果文件不因正常结束而删除。
- 完整 Skill 正文、references、合同、工具源码与隔离/初始化成功前不接收用户目标、文本、模板、文件。缺件或超上下文不能降级为懒加载。
- Codex SDK 是读取、分析、清洗、规范建议和成表的内核；文档库/OCR/Python 为 Agent 工具。权限、确认、价格、付款、独立验收、发布和清理由可信 Host 持有。
- 两种输入模式都完成全范围分析、规范采用和执行方案确认后再估费；调整使旧确认和未付报价失效。客户端 success、UNKNOWN、free_grant 不能授权实付批量；抖音钻石和人民币分不可隐式换算。
- 九文件先持久保存、回读摘要、原子发布结果与清理 outbox，再停整个任务进程树、撤权和清理环境。仅 cwd/workspace-write 不算租户读隔离。清理失败如实重试，不删除整个项目 runtime 或其他任务。
- CLOSED 不复活；再加工与纠错均从新 Session 完整预载开始。历史结果不可变，必要原件重传。平台纠错须用户限时授权、运营审核、绑定精确方案和原实付权益，累计处理预算不重置。
- 小程序 P0、Web/API P1；当前原生共享模板 + esbuild，没有 Taro。不能把本次整理扩展成未经要求的框架迁移。B 定型原图、冻结规范、历史清单保持原字节。
- 冻结文档中的 NOT_IMPLEMENTED / NOT_RUN 是当时历史状态。当前源码、夹具测试、静态校验、文档预览、真实模型、付款、设备和 Ubuntu 验收必须分别记录，不能互相冒充。

## 后续更新、文档与 Git 同步（用户持续要求）

- 指定仓库：`git@github.com:copypasteltd/Table-Purifier.git`，默认分支 `main`。用户已明确要求本次和后续相关更新都同步提交、推送、更新说明；在此范围内无需反复询问是否推送。
- 每次完成修改时，同步维护 README.md 与 README.en.md、相关需求/技术文档、CHANGELOG.md 的中英更新说明。行为或界面变化须更新受影响截图、录屏、GIF、采集凭据及摘要清单。
- 前端改动先对照 B 原稿和定型规格，修改共享源后生成两端。运行 `npm run design:audit`，将通过的收据按当前日期保存并更新相关文档/校验入口；对照图保留原稿比例，不把浏览器检查称为真机或像素一致率。
- 执行与改动相关的检查；当前标准入口：`npm run check`、`npm run build:miniapps`、Python 文档工具测试、`python -X utf8 scripts/verify_repository_baseline.py`、`npm run docs:verify`。旧冻结校验脚本原样保留，使用新的仓库级静态入口。媒体按 `docs/preview/README.md` 重现。
- 推送前检查暂存内容、差异、文件大小、私有配置与密钥；不提交 node_modules、runtime、dist、输出 ZIP、真实凭据、客户数据或真实验收正文。演示仅使用明确标识的合成资料。
- 使用可解释的提交说明；不 force push，不覆盖远端已有修改，不改写冻结基线或替换历史状态以伪造通过。远端有更新先安全集成。
- 提交并推送 origin/main 后，用 `git ls-remote` 核对远端 SHA 与本地 HEAD，确认工作区状态；向用户报告提交、仓库链接、验证和真实阻塞。
- 若 SSH/网络/仓库权限阻塞，先完成可审阅的源码、文档、媒体和提交，说明具体错误；不声称已推送，不要求用户在聊天中粘贴密钥。

## English maintenance contract

Keep all work inside this repository. Never invoke local Docker, WSL or virtual machines; never deploy or publish the application without an explicit request. Close browser resources created for the task, including failure paths. Preserve the seven-step lifecycle, persistent results, full Skill preload, verified-payment gate and separate trusted Host / Agent responsibilities. Real credentials and live platform/device/Ubuntu verification are not ready.

For every completed future change, update both READMEs, affected documents and bilingual CHANGELOG entries. Refresh affected screenshots, recordings, GIFs and manifests. Run relevant checks, review staged content, commit and push to the specified origin/main, and verify remote HEAD. The user has already authorized this repository synchronization. Never force-push, commit secrets/customer data, rewrite frozen evidence or present fixture previews as live acceptance. Repository publishing does not authorize application deployment.
