# 文档导航 / Documentation index

[中文项目说明](../README.md) · [English project guide](../README.en.md) · [更新说明 / Changelog](../CHANGELOG.md)

当前实现、冻结规格、历史归档和演示媒体各有独立入口。Frozen documents retain their original status and bytes. Most original detailed specifications are Chinese; the English root README describes current architecture, lifecycle, use, configuration and verification boundaries.

| 阅读目标 / Goal | 入口 / Entry | 状态 / Status |
| --- | --- | --- |
| 产品、技术、使用 / Product, architecture, use | [中文](../README.md) / [English](../README.en.md) | 当前 / Current |
| 源码定位 / Source navigation | [源码入口](../SOURCE_README.md) | 当前 / Current |
| 需求和生命周期 / Requirements, lifecycle | [需求深化](需求深化/README.md)、[七步流程](需求深化/07-统一七步流程与Session生命周期.md) | v3.2 冻结 / Frozen |
| 开发合同 / Development contracts | [开发入口](开发/README.md)、[合同资源](../assets/development/v3.0.0) | DEV3 冻结 / Frozen |
| 实际实现 / Implementation | [技术说明](实施/源码技术说明.md)、[补充接口](实施/补充运输接口.md) | 当前源码 / Current source |
| 原开发证据 / Source evidence | [验证交付](实施/验证与交付记录.md)、[进度证据](实施/源码开发进度与证据.md) | 有限范围 / Scoped checks |
| 本轮仓库证据 / Handoff evidence | [仓库验证](repository-verification.md) | 源码、媒体、文档 / Source, media, docs |
| B 设计定型 / Frozen B design | [设计入口](设计定型/B-青绿资料夹-v1.0.0/README.md)、[原图与规格](../assets/design/b-jade-folders/v1.0.0) | B1.0.0 冻结 / Frozen |
| B 方案实现还原 / B fidelity | [逐页修复及验收](实施/B方案前端还原与验收.md) | 当前源码；真机待验 / Source; devices pending |
| 技术决策 / Decisions | [决策记录](implementation-decisions.md) | 当前与待评估 / Current and future |
| 截图、录屏、GIF / Media | [媒体索引](media/README.md)、[摘要](media/manifest.json) | 合成预览 / Synthetic preview |
| 复现展示 / Reproduce | [预览工具](preview/README.md) | 本地无凭据 / Local, no credentials |
| 维护与推送 / Maintain and push | [贡献说明](../CONTRIBUTING.md)、[工作约定](../AGENTS.md) | 持续约束 / Standing instructions |
| 原根入口 / Original root entries | [字节快照](背景/仓库入口更新前-2026-10-28/snapshot-manifest.json) | 历史原件 / Original bytes |

## 阅读顺序 / Reading order

1. 阅读当前语言的根 README。Read the root guide first.
2. 结合媒体理解用户操作，再读生命周期与需求。Review media, then lifecycle and requirements.
3. 按技术说明定位 API、Agent、Worker、支付、结果和清理。Use implementation guides to navigate source.
4. 修改前核对合同；完成后更新文档、说明和媒体，检查并推送。Check contracts, update evidence, verify and push.

## 历史状态 / Historical status

原需求/开发清单的 `NOT_IMPLEMENTED` / `NOT_RUN` 表达封存时的设计阶段。原 README / AGENTS 按原字节归档；静态核验只将这两个逻辑路径解析为历史副本，仍校验原大小、SHA-256 和目录范围。其余冻结文件直接检查原位置，旧清单和 B 原稿没有重封或篡改。

Only the two evolving root entry points resolve through historical copies during baseline verification. Original sizes, hashes and containment are still checked. Other frozen artifacts and B originals remain unchanged.

当前仓库级入口另将旧设计 ZIP 视为可选输出；只允许原设计核验中该 ZIP 缺失的一条链接错误，其余所有设计源文件、摘要、引用和规格仍须通过。历史打包 JSON 归档供无输出目录的干净副本核验。The current verifier permits only the explicitly absent historical design ZIP link; all source-design checks remain required. Archived JSON receipts support clean checkouts without generated output folders.

**静态 PASS、数据库夹具、浏览器文档预览、真实模型、支付、设备和 Ubuntu 清理不是同一类证据。** Static checks, fixture tests, source previews and live acceptance must remain distinct.
