# 更新说明 / Changelog

产品源码版本与需求/设计冻结版本分别记录。Source releases and frozen specification versions are tracked separately.

## 2026-11-01 — 词元拾序品牌定稿 / Approved 词元拾序 identity

- 用户选定正式中文名称「词元拾序」与 06「折纸归档」，新增独立品牌 V1.0.0 和单一身份入口；保留选定原图与全部探索素材，未再次请求图像生成。
  Recorded the user-approved Chinese name and concept 06 as brand V1.0.0, preserving original artwork and historical candidates without a new image request.
- 提供六尺寸透明图形、横竖字标组合、单色/反白、深浅头像、分享封面、favicon、正式展示和可重现 ZIP；记录原图摘要和派生边界，不分发字体。
  Added transparent sizes, Chinese lockups, monochrome/reverse symbols, avatars, share cover, favicon, presentation and reproducible ZIP with provenance.
- 更新支付宝/抖音共用品牌、首页和原生标题/工程显示名，重建源码与预览截图、录屏、GIF；更新双语 README、品牌规则、维护约定与校验。
  Updated shared/native branding, home, navigation/project titles, screenshots, recording and GIFs; refreshed bilingual guides and integrity checks.
- 冻结 B 原稿、旧证据及需求合同保持原字节；本轮不更新服务器运行版本，不改变仓库/路径/服务标识，不声明真实平台发布或验收。
  Preserved frozen references/contracts and historical evidence. No server update, technical identifier rename or native-platform release/acceptance is included.

## 2026-11-01 — 10 款 Logo 候选 / Ten logo directions

- 使用用户指定的 Sub2 图像技能与 `gpt-image-2.5` 实际生成 10 个独立方向：资料夹、瑞士网格、负形汇流、TP 连字、清泉、折纸、朱印、极光、小格伙伴和手作秩序。未替换模型。
  Generated ten distinct candidates through the requested Sub2 skill and model, without provider/model substitution.
- 保存 10 张 RGBA 原图、60 张标准尺寸透明 PNG、10 张中英品牌展示和 1 张总览；留存提示词、透明度/尺寸实测和原始摘要，排版不分发字体或密钥。
  Retained ten originals, sixty transparent size exports, ten brand presentations, one overview, prompts and sanitized provenance; no credentials or font files distributed.
- 新增双语选型说明、素材说明与本地 ZIP 生成流程，更新中英 README 与文档导航。所有方案等待用户选定，冻结 B 设计、当前小程序及服务器品牌没有替换。
  Added bilingual selection guidance, asset documentation and local ZIP packaging; updated both READMEs. Selection remains pending, with the frozen B design and deployed product assets preserved.

## 2026-10-31 — 内网 HTTP 部署 / LAN HTTP deployment

- 按用户授权在 Ubuntu 22.04 主机 `192.168.31.20` 原生部署，HTTP 入口 `18707`；API `18708` 和独立 PostgreSQL 集群 `18709` 仅监听环回，配置系统服务和开机启动。
  Deployed natively on the authorized Ubuntu 22.04 host with HTTP port 18707, loopback-only API/database ports, system services and boot startup.
- 安装本项目独立 Node 24.22.2、Python 固定依赖及中英文 OCR。新增可复现部署脚本、专用 cgroup 层级、非 root 进程隔离、独立数据库角色和十二项迁移；不调用 Docker/WSL，不配置 HTTPS。
  Added a dedicated Node runtime, pinned Python tools, OCR, deployment scripts, project-only cgroup hierarchy, non-root isolation, separate database roles and twelve migrations. No Docker/WSL or HTTPS setup.
- 增加生产 HTTP 显式开关和配置回归；HTTP 地址不发送 HSTS 或强制升级指令。默认生产配置仍须 HTTPS 或明确选择 HTTP。
  Added explicit production HTTP opt-in and regression checks; HTTP addresses emit neither HSTS nor insecure-request upgrades. Production retains its default transport guard.
- 用户名、随机密码和运行密钥明文保存在服务器 `/root/cfg/table-purifier/`，仅 root 可读，Git 不含真实值。提供双语部署/维护、穿透地址、配置和缺失凭据说明。
  Saved plaintext credentials root-only under the requested server configuration path and excluded real values from Git; added bilingual installation, maintenance and forwarding instructions.
- 实测 HTTP、迁移就绪、数据库运行角色、原生 canary、运行中子进程树清理及服务重启恢复；浏览器仍为合成资料预览，专用模型、真实平台和支付未配置。
  Checked HTTP, migration readiness, runtime roles, native canaries, live synthetic process-tree cleanup and service restart recovery; previews remain synthetic and dedicated model/platform/payment credentials are still unconfigured.

[部署说明 / Deployment guide](docs/deployment/README.md) · [核验记录 / Verification](docs/deployment/verification-2026-10-31.json)

## Unreleased / 待发布

- 按 B1.0.0 原稿修复共享前端：资料夹正文标题、独立文件/字段卡、真实表头、统一 19 图标、固定操作和图标导航；保留两端 18 页 / 32 组件。
  Aligned the shared frontend with B1.0.0: folder body titles, file/field cards, real table headers, 19 consistent icons, fixed actions and icon navigation; retained 18 pages / 32 components per provider.
- 首页用途和模式跨页保留；同一问题刷新或查看来源返回后保留明确选择；字段表单按需展开保留草稿；结果和领取支持展开全部字段与九文件。
  Preserved in-memory goal/mode across navigation and explicit decisions on refresh/evidence return; added draft-preserving field collapse and expandable complete records/artifacts.
- 新增两端 164 个布局组合与 14 项交互回归、同组报价资料的原稿/修复前/修复后对照；更新 36 页截图、联系表、MP4、GIF、双语说明和来源摘要。
  Added 164 layout cases, 14 interaction regressions and reference/before/after comparisons using the same synthetic quotation fixture; refreshed 36 page captures, contact sheets, MP4/GIFs, bilingual guides and source hashes.
- 检查仍区分源码、夹具、浏览器与真实平台验收；未部署，未调用 Docker/WSL，未改动冻结原稿或历史哈希。
  Kept source/fixture/browser checks separate from native/live acceptance. No deployment, Docker/WSL, frozen-reference edits or historical hash rewrites.

[还原与验收说明 / Fidelity record](docs/实施/B方案前端还原与验收.md)

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
