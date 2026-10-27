# 仓库整理验证 / Repository handoff verification

日期：2026-10-28。版本：源码 0.1.0、业务 v3.2、DEV3、B1.0.0。

本轮完成源码与文档入口整理、中英 README、可复现页面预览、截图/录屏/GIF、仓库规则和 Git 交付准备。以下是实际执行的检查，不代表外部真实集成验收。

This handoff organizes source and documentation, bilingual READMEs, reproducible preview/media and repository workflow. Checks below cover source and fixtures, not live integration acceptance.

[机器记录 / Machine record](实施/验证记录/repository-verification-2026-10-28.json) · [媒体清单 / Media manifest](media/manifest.json) · [采集凭据 / Capture receipt](media/capture-receipt.json) · [原源码交付 / Earlier source evidence](实施/验证与交付记录.md)

## 执行结果 / Executed results

| 检查 / Check | 结果 / Result | 范围 / Scope |
| --- | --- | --- |
| `npm run check` | PASS；12 文件、83 测试 | 类型检查、单元/原生 PostgreSQL 集成、TypeScript 构建 / Types, unit/native DB fixtures, build |
| `npm run build:miniapps` | PASS；两端各 18 页、32 组件 | 原生工程生成，不是 IDE/真机验收 / Source generation only |
| Python 工具 / Tools | PASS；11 测试 | 文档读取、完整性、格式边界与安全用例 / Document-tool cases |
| 新仓库级冻结核验 / Current static baseline | PASS | 原图/合同/历史字节/引用/Schema/OpenAPI/SQL 静态语法与映射 / Static artifacts and relationships |
| `npm run docs:verify` | PASS | 双语入口、链接、36 页、43 媒体、来源与摘要 / Docs, links, source/media hashes |
| `npm audit --omit=dev` | PASS；0 漏洞 / vulnerabilities | 本次执行时的生产依赖审计 / Audit at check time |
| 暂存文件审阅 / Staged review | PASS | 内容与 index 一致、排除运行数据/密钥、文件大小、凭据签名 / Identity, exclusions and size checks |
| `git diff --cached --check` | PASS | 保留原 CRLF 字节，旧验证日志保留已有末尾空行 / Preserve historical byte layout |
| 干净安装 / Clean install | PASS | 从暂存文件复制；默认 `npm ci` 生命周期脚本开启，离线缓存；安装 378 包 / Staged snapshot, lifecycle scripts enabled |
| 干净构建 / Clean build | PASS | typecheck、build、两端生成、文档媒体核验 / Types, build, mini programs, docs/media |
| 干净冻结核验 / Clean baseline | PASS；2368 检查 | 无本机 output 目录，仅用仓库归档 / No local output dependency |
| 源码 ZIP / Source package | PASS | 精确文件清单和逐字节 SHA-256 校验；输出 ZIP 不入 Git / Byte-verified manifest; ZIP ignored |

干净副本位于项目被忽略的 `runtime/repository-verification/clean-source`，没有复用原项目 node_modules、.env 或输出目录。npm 缓存和静态校验 Python 依赖位于同一项目 runtime；静态工具通过明确 PYTHONPATH 复用，不是全局安装或容器环境。构建后生成的两端源码大小分别为 406527 / 411593 字节（不计自身清单）。

The clean snapshot uses its own node_modules and no original .env/output. Project-local npm cache and static Python tools are explicitly reused. No global installation or virtualization is involved. Generated platform source totals are 406527 / 411593 bytes excluding each manifest.

[主检查日志 / Main checks](实施/验证记录/repository-npm-check-2026-10-28.txt) · [干净安装 / Clean install](实施/验证记录/repository-clean-install-2026-10-28.txt) · [干净构建 / Clean build](实施/验证记录/repository-clean-build-2026-10-28.txt) · [干净基线 / Clean baseline](实施/验证记录/repository-clean-baseline-2026-10-28.json)

## 冻结与当前入口 / Frozen and current entry points

原 README、AGENTS 按原字节归档；旧校验脚本也保留原字节。当前入口为 `scripts/verify_repository_baseline.py`，只对这两个持续演进的根文档解析历史快照，仍校验原大小、摘要和路径范围。

旧设计 ZIP 属于可选打包输出；干净仓库只允许旧设计核验中这一个特定 ZIP 缺失链接，其他任何错误仍失败。全部 B 原图、规格、源文件、哈希、对比度和引用检查保留。三个历史快照中的打包 JSON 和两个原打包凭据均留存，生成 ZIP 不提交。没有改写冻结清单或把历史 NOT_IMPLEMENTED 改成产品 PASS。

Original entry points and legacy verifiers retain exact bytes. The new repository verifier resolves only the two evolving root documents to their original snapshots. It permits one explicitly missing historical design ZIP link, retaining every source-design check. Historical JSON receipts are preserved; generated ZIPs are not shipped in Git. Frozen statuses are not rewritten.

准备静态工具后，在根目录执行（Ubuntu 用 python3）：

```bash
python -m pip install --target runtime/tools/document-validation -r scripts/requirements-docs.txt
python -X utf8 scripts/verify_repository_baseline.py
npm run docs:verify
```

Static tool versions: jsonschema 4.26.0, openapi-spec-validator 0.9.0, pglast 8.7. Tools install only inside project runtime. The new verifier's optional report also stays under runtime; it does not overwrite frozen reports.

## 媒体与资源 / Media and resources

- 两端共 36 张 430×920 页面截图，另有 2 张桌面总览和 2 张联系表。36 page captures plus two desktop captures and two contact sheets.
- MP4：47.92 秒，1440×954，H.264 / yuv420p / faststart，无音轨，约 1.11 MB。Full source-interaction recording with no audio.
- 流程 GIF：26.4 秒，880×748，4,974,105 字节；来源依据 GIF：7.01 秒，430×920。Accelerated workflow and evidence clips.
- 共 43 个媒体文件，逐文件摘要、尺寸、时长和来源可核对。43 media files with hashes, dimensions, durations and source provenance.
- 自动流程完成，页面运行异常 0。本次创建的标签、上下文、浏览器、临时 HTTP 服务均已关闭。No page runtime exceptions; capture-owned resources closed.
- 所有输入、报价、付款、Agent 和清理状态是明确标识的合成夹具。All states are synthetic and labeled.

## 未执行范围 / Not run

真实专用 Codex 调用、真实平台登录/收银/退款、支付宝/抖音 × iOS/Android 四环境、Ubuntu 原生隔离与进程树清理仍未实测。目标运行环境 Ubuntu 22.04；当前开发检查在 Windows、Node 22.14.0、npm 10.9.2、Python 3.13.1 完成。Agent、平台和收费开关继续默认关闭。

No live dedicated Codex, platform identity/payment/refund, four native device environments or native Ubuntu isolation/cleanup acceptance was performed. Ubuntu 22.04 remains the runtime target. Local checks used Windows / Node 22.14.0 / npm 10.9.2 / Python 3.13.1. Real capability gates remain off.

没有部署、上线、提审，也没有调用 Docker、WSL 或虚拟机。本轮 Git 推送与远端 SHA 一致性在最终交付时单独核对；此文档不嵌入自身提交 SHA，避免自引用。

No deployment, publication, platform submission or virtualization. The final handoff verifies remote Git SHA separately from this versioned evidence file.
