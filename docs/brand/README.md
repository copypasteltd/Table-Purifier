# 词元拾序 · 品牌定型 / Approved brand identity

[中文项目说明](../../README.md) · [English project guide](../../README.en.md) · [小程序简介与描述](miniapp-listing.md) · [正式素材](../../assets/brand/ciyuan-shixu/v1.0.0/README.md) · [十款探索留存](logo-exploration.md)

用户于 **2026-11-01** 明确定稿：产品名称为 **词元拾序**，Logo 使用 **06「折纸归档 / Folded Paper」**。正式版本为 `P07-BRAND-CIYUANSHIXU-1.0.0`，唯一机器入口为 [current.json](../../assets/brand/current.json)。后续新内容默认使用该名称与图形，不再延续候选推荐。

The user approved **词元拾序** and **06 Folded Paper** on 2026-11-01. The versioned identity and its JSON pointer are authoritative for future work. Table Purifier remains the existing English project alias; a separate English brand name has not been approved.

![词元拾序 · 正式品牌展示](../../assets/brand/ciyuan-shixu/v1.0.0/brand-board.png)

## 名称与表达 / Name and meaning

| 项目 / Item | 定型 / Decision |
| --- | --- |
| 对外中文名 / Public Chinese name | **词元拾序**，四字连写，不加空格 |
| 读音 / Pronunciation | cí yuán shí xù；Ciyuan Shixu is a pronunciation aid |
| 产品说明 / Product descriptor | AI 资料整理与规范成表工具 |
| 主说明语 / Main descriptive line | 把零散资料，整理成有据可查的表格 |
| 图形 / Symbol | **06 折纸归档**，复用本轮实际生成原图 |
| 英文项目别名 / English project alias | Table Purifier；沿用仓库身份，不将其声明为新批准的英文品牌 |
| 历史名称 / Previous name | 表格修复站；只用于历史资料和路径说明 |

“词元”对应资料中可被理解、提取与关联的信息单元；“拾序”表达拾起分散资料、建立清晰秩序。含义说明服务于品牌表达，不把用户输入限制为纯文本，也不改变文件、图片与表格的产品范围。

The name connects individual information units with the act of collecting and ordering them. It describes the existing multi-format product; it does not narrow supported inputs to text.

## 图形与组合 / Mark and lockups

原图中青绿文档、暖橙表格与浅色折页共同表达“资料 → 结构 → 交付”。使用选定图形的实际像素，不重新生成、重画或更换风格。1254×1254 RGBA 原图保留原字节，SHA-256 为 `bb4f0cc9e23200d060753468f75fe8676e7656f0aa4d93d5fd16a86220f2b830`。

- **主组合**：彩色图形 +「词元拾序」字标，提供横式和竖式透明 PNG。
- **纯图标**：小程序图标、头像、favicon；首次介绍产品时与名称配合。
- **深色背景**：使用彩色图形与白色字标组合，或选用提供的反白图形。
- **单色图形**：按原透明轮廓派生墨绿版、白色版；不能还原彩色折面的全部层次。

All deliverables reuse the approved raster. Color, monochrome and reverse symbol files, horizontal/stacked Chinese lockups, avatars and a share cover are provided. The Chinese wordmark is typeset locally using Microsoft YaHei; font files are excluded. No editable SVG/AI vector master is claimed.

## 色彩、尺寸与留白 / Color, size and space

| 用途 / Role | 色值 / Color | 使用规则 / Use |
| --- | --- | --- |
| 图形青绿 / Logo jade | `#167864` | 品牌图形、宣传色；图形本身保留实际渐变 |
| 图形暖橙 / Logo orange | `#EB9B4A` | 折面、强调色；不用作小字号正文 |
| 纸页浅杏 / Paper | `#FADEB7` | 纸页与品牌铺底 |
| 正文字色 / Ink | `#203C32` | 中文字标、正文 |
| 界面背景 / Background | `#EAF1EE` | 延续 B 方案的轻阅读背景 |
| 界面主色 / UI primary | `#17745E` | 延续 B 方案按钮、链接与可交互状态 |

Logo 原图包含渐变，以上前三项是规范调色板；不要把像素替换为三个纯色来重画主标。品牌橙不取代原有警示/风险状态色。

完整图形显示尺寸**至少 32 px，优先 64 px 以上**。16/24 px 仅供 favicon 轮廓识别，不承诺内部格子清晰。图形四周至少保留可见高度的 **1/8**，导出的方形图标已采用约 78% 可见高度。不得拉伸、旋转、裁切折角、添加外描边、重排格子、将旧名称与新图形混用。避免把图形直接放到繁杂照片上；先加纯色底。

Keep at least one eighth of the visible mark height as clear space. Prefer 64 px or larger; 32 px is the full-mark minimum and favicon-only sizes retain silhouette rather than fine detail. Keep aspect ratio, all folds and the supplied color treatment. Palette tokens describe intended colors rather than exact flat fills in the shaded raster.

## 产品落点与历史关系 / Product integration and history

支付宝、抖音共用 `miniapp/src/brand.js`，从 `assets/brand/current.json` 读取批准名称；原生导航标题、工程显示名、首页图形与名称统一。后端 `src/shared/brand.ts` 读取同一入口，为新生成的 Excel 作者元数据提供正式名称；已经持久保存的结果不重写。品牌图片从正式 128 px 版本原字节复制，两端生成清单记录品牌 release 和输入摘要。文档预览、截图、MP4/GIF 同步更新。

冻结 B1.0.0 原图、颜色/组件/业务规格与历史候选图片保留原字节；新品牌是当前源码之上的独立品牌版本。旧需求文档中的「表格修复站」按历史产品称谓解读。仓库名 `Table-Purifier`、工作目录、API 前缀、数据库/服务名和结果合同不随名称改变。

The shared mini-program source and documentation media use the approved identity. Frozen B artifacts and the ten original candidate presentations remain historical evidence. Existing repository paths, API contracts and operational identifiers retain their technical identity.

正式版本定型后，图形、名称或规范发生实质调整时递增品牌版本并更新 `current.json`，不覆盖已经交付的版本。Future material identity changes increment the brand version and update the pointer instead of replacing a delivered release.

本轮更新仅覆盖本地源码、品牌资产、展示与 Git 文档。**没有更新服务器上的运行版本，没有小程序发布或真实平台验收**。2026-10-31 的部署截图和核验仍属于原版本，不冒充本轮新品牌截图。

This change updates source/assets/docs and Git. It does not update the running LAN deployment or claim platform publication or native-device acceptance. Historical deployment evidence remains dated and unchanged.

## 留存与重现 / Assets and reproduction

[正式资产目录](../../assets/brand/ciyuan-shixu/v1.0.0/README.md)提供原图、六尺寸透明图形、字标组合、头像、分享封面、favicon、展示稿及逐文件摘要。打包输出为 `output/imagegen/ciyuan-shixu-brand-v1.0.0/Ciyuan-Shixu-Brand-v1.0.0.zip`，ZIP 不入 Git；Git 中保留可重现源文件。

```powershell
python -X utf8 scripts/build-brand-identity.py
npm run build:miniapps
npm run design:audit
npm run docs:capture
npm run docs:media
npm run docs:verify
```

品牌打包只调用本地 Pillow，不再调用模型或图像服务，不使用浏览器/虚拟化。后续的界面采集独立调用浏览器，脚本在成功与失败路径均关闭自己的页面、上下文、浏览器和临时 HTTP 服务。

Brand packaging uses existing local artwork and Pillow, without a new image request. UI/media capture is a separate browser workflow with cleanup on success and failure. Browser previews use synthetic fixtures throughout.

本轮检查结果与范围见[品牌更新核验](verification-2026-11-01.json)。Verification results and limits are recorded separately.
