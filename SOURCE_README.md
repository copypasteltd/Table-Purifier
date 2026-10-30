# 表格修复站源码入口

2026-10-31 用户另行授权的 Ubuntu 内网原生 HTTP 部署及维护见[中文部署说明](docs/deployment/README.md) / [English deployment guide](docs/deployment/README.en.md)。源码构建、文档预览与真实业务接入仍分别验收。

本目录包含支付宝、抖音两套原生小程序源码、TypeScript 业务服务与后台 Worker、官方 Codex SDK Agent 封装、文档工具、PostgreSQL 迁移和测试。产品采用已定型的 B 青绿资料夹设计，面向“提供标准表”和“从资料发现标准表”两种模式。

当前交付是可安装依赖、检查和构建的源码。真实模型、真实支付、Ubuntu 原生隔离运行、小程序 IDE 与四种真机环境仍需后续接入验收。用户尚未准备相关凭据，本次没有部署、上线、发布，也没有调用 Docker、WSL 或虚拟机。

当前仓库主入口为 [中文 README](README.md)、[English README](README.en.md) 和 [文档导航](docs/README.md)。原根目录 README、AGENTS 按原字节留存在 [仓库入口历史快照](docs/背景/仓库入口更新前-2026-10-28/snapshot-manifest.json)，冻结清单不改写。具体源码核验见 [验证与交付记录](docs/实施/验证与交付记录.md)，本轮媒体与 Git 交付见 [仓库整理验证](docs/repository-verification.md)。不要把静态 PASS、夹具或浏览器文档预览当作真实模型、支付、设备验收。

## 源码目录

| 路径 | 内容 |
| --- | --- |
| `src/api` | Fastify 接口、冻结合同校验、上传/领取运输接口、运营纠错审核 |
| `src/domain` | Session、任务、规范、确认、估费、订单、结果、再加工、隐私与模板 |
| `src/agent` | Codex SDK、完整 Skill、限域模型代理、文档工具、原生隔离与计量 |
| `src/worker` | 带租约和 fencing 的任务执行、独立发布、整个环境清理、主动删除 |
| `src/platforms` | 支付宝/抖音登录、签名、支付查询、回调验签与原路退款 |
| `src/storage`、`src/validation` | 独立结果存储、九文件产出、规则与证据验收 |
| `miniapp/src` | 两平台共用的原生页面模板、业务控制器和 B 组件 |
| `src/mini-alipay`、`src/mini-douyin` | 已生成的原生工程，各 18 页、32 组件 |
| `agent/skill`、`agent/tools` | 实际加载的完整业务 Skill、合同及 Python 工具 |
| `native` | Ubuntu 原生 Landlock/seccomp/cgroup 启动器 C 源码 |
| `migrations` | 12 个有摘要校验的 SQL 迁移，64 张参考表及 2 张新增表 |
| `config`、`.env.example` | 无真实密钥的配置模板 |
| `tests` | 单元、真实原生 PostgreSQL 集成与 Python 文档工具测试 |
| `assets/development/v3.0.0` | 冻结的 56 项接口和数据合同 |
| `assets/design/b-jade-folders/v1.0.0` | 保留的 B 定型稿、原图、页面参考、tokens 和组件规格 |
| `docs/实施` | 实际源码技术说明、补充接口和验证记录 |

## 开发检查

Node.js 支持范围由 package.json 约束为 `>=22.14.0 <27`；当前实际检查使用 Node 22.14.0、npm 10.9.2、TypeScript 5.9.3。依赖由 package-lock.json 锁定。数据库 SQL 使用 PostgreSQL 18 实测；Ubuntu 22.04 是运行兼容目标。

在项目根目录执行以下本地检查。这些命令不会部署服务或发布小程序：

```text
npm ci
npm run typecheck
npm test
npm run build
npm run build:miniapps
```

集成测试会在项目 `runtime/tests` 下创建短期原生 PostgreSQL、独立应用/Worker 角色和临时文件，结束后清理。它不使用 Docker、WSL、系统 PostgreSQL 服务或其他项目的数据。

Python 工具依赖位于 `agent/tools/requirements.txt`，兼容目标 Python 3.10 及以上。先在项目 `runtime/python-tools` 准备专用解释器及锁定依赖，再执行工具测试：

```text
python -m unittest discover -s tests/tools -p test_read_document.py -v
```

上式中的 python 应选本项目工具解释器；Windows 为 `runtime/python-tools/Scripts/python.exe`，Ubuntu 为 `runtime/python-tools/bin/python3`。没有配置 OCR 引擎时不会伪造 OCR 成功。

## 配置入口

- `.env.example`：服务与独立 Worker 数据库连接、专用模型认证、平台身份和支付配置。真实 `.env` 不进入交付包。
- `config/isolation-profile.example.json`：非 root Ubuntu、已授权的 cgroup-v2 目录、固定可执行文件摘要、最小只读依赖范围。
- `config/processor-policy.example.json`：实际模型处理方及其地区、保存和删除限制。必须与数据库中用户看到的告知版本完全一致。
- `config/douyin-product.example.json`：经平台审核的交易商品与签名配置。
- `miniapp/config.example.json`：公网 HTTPS 业务域名、两端 App ID/别名和构建号。个人配置放在 `miniapp/config.local.json` 后重新构建。
- `config/release-evidence`：后续真实能力验收资料；未准备完整证据前，能力与收费保持关闭。

当前所有外部接入与收费开关默认关闭。不要把桌面 Codex 登录、全局 auth.json、个人 HOME 或 API 密钥交给任务 Agent。源码中的测试凭据、模拟模型和支付事实只在测试依赖注入中使用。

## 七步业务约束

1. 先创建 Session，完整预载 Skill 正文、references、合同和工具源码，并实际完成原生隔离探测与 Agent 初始化。
2. READY 后才接收目标、文字、文件和规范。
3. Codex Agent 自主选工具、读取全部已提交范围、分析资料并形成规范和不超过五行预览。
4. 用户采用或调整规范、确认当前执行方案；修改使旧确认和未付报价失效。
5. 可信 Host 对精确的资料、规范、方案和 Skill 版本估费，金额使用原平台整数单位并封顶。
6. 原平台付款经服务端核实后才能建立 PAID Run，批量处理与独立验收。
7. 九文件独立持久保存、摘要回读和原子发布后，停止所有任务进程、撤权并删除整个任务运行环境。结果文件继续保留。

已关闭环境不能复活。问题修改与平台纠错都从新 Session 和完整预载开始；必要原件由用户重传。平台纠错需限时售后授权、运营核实、精确新方案与原实付权益绑定，累计处理预算不重新计时。

交付文件固定为 `standard.xlsx`、`standard.json`、`result.xlsx`、`accepted.csv`、`result.json`、`issues.xlsx`、`provenance.jsonl`、`validation.json`、`manifest.json`。主动隐私删除可以删除用户选定结果；正常结束任务不会自动删除结果。

## 继续阅读

- [源码技术说明](docs/实施/源码技术说明.md)：边界、栈、数据流、计量、清理与已知限制。
- [补充运输接口](docs/实施/补充运输接口.md)：冻结 56 API 之外的实际接缝与运营审核。
- [验证与交付记录](docs/实施/验证与交付记录.md)：实际执行证据与未执行范围。
- [业务生命周期基线](docs/需求深化/07-统一七步流程与Session生命周期.md)和[开发文档入口](docs/开发/README.md)：完整需求与冻结合同。

源码归档与校验使用 Python 标准库：`python scripts/package_source.py`、`python scripts/verify_source_package.py`。归档生成在 `output/source`，包含逐文件 SHA-256 清单，不包含依赖目录、运行数据、真实配置、密钥或历史输出压缩包。
