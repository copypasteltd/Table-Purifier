# 更新说明 / Changelog

产品源码版本与需求/设计冻结版本分别记录。Source releases and frozen specification versions are tracked separately.

## Unreleased / 待发布

后续修改在此补充中英说明、用户影响与验证。Add bilingual changes, user impact and validation here for subsequent updates.

## 0.1.0 — 2026-10-28

### 源码 / Source

- 交付支付宝、抖音各 18 页、32 组件及共享原生源码、TypeScript API / Worker、官方 Codex SDK Agent、文档工具、Ubuntu 原生隔离启动器、12 个 SQL 迁移与测试。
  Delivered shared native source and 18 pages / 32 components per platform, TypeScript API / Worker, official Codex SDK Agent, document tools, native Ubuntu launcher, twelve migrations and tests.
- 固定“先会话完整预载 → 提交 → Agent → 用户确认 → 估费 → 实付批量 → 保存结果后销毁任务环境”；结果持续保留，关闭环境不复活。
  Enforced full session preload before input, Agent analysis, user confirmation, quotation, verified paid production and runtime destruction after durable results; results persist and closed runtimes never resume.
- 两种规范模式、独立证据验收、九文件结果、订单/退款、再加工、原单纠错、私有规范、授权和主动删除均具有源码实现与夹具验证；外部真实集成仍待验收。
  Implemented both schema modes, independent evidence validation, nine-file results, orders/refunds, rework, original-order correction, private schemas, consent and deletion with fixture validation; live integrations remain unverified.

### 仓库与展示 / Repository and presentation

- 新建指定 Git 仓库，补齐中英 README、文档导航、技术决策、贡献规则、持续同步规则和本轮验证记录。
  Initialized the requested Git repository with bilingual READMEs, documentation navigation, decisions, contribution and synchronization rules, and handoff evidence.
- 保留 B 定型稿和全部冻结基线，原 README / AGENTS 按原字节归档；基线核验只对这两个入口解析历史快照，不改写旧清单。
  Preserved B design assets and frozen baselines; archived original README / AGENTS bytes and resolved those two baseline entries through their snapshots without rewriting historical manifests.
- 基于真实页面模板、组件和控制器制作两端 36 页截图、桌面总览、联系表、MP4、流程及来源依据 GIF，并提供复现脚本和 SHA-256 清单。
  Captured 36 source-page screenshots, desktop overviews, contact sheets, MP4 and workflow/evidence GIFs with reproducible scripts and SHA-256 manifests.
- 所有展示标识合成资料与模拟状态；没有真实模型、支付、真机或 Ubuntu 清理验收，不进行部署，不调用 Docker / WSL。
  Labeled all media as synthetic source previews; no live model, payments, native devices or Ubuntu cleanup acceptance, no deployment and no Docker / WSL use.

详细检查与边界见 [仓库验证](docs/repository-verification.md) 及 [源码交付记录](docs/实施/验证与交付记录.md)。See the verification records for executed checks and limits.
