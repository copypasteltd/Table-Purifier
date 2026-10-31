# 表格修复站 · 10 款 Logo 选型 / Ten logo directions

日期 / Date: 2026-11-01（Asia/Taipei）。状态 / Status: 待用户选型 / Awaiting selection。

使用用户指定的 sub2-image-gen 路径生成，模型请求固定为 gpt-image-2.5、high、PNG，未使用替代模型。十款均保留生成原图、提示词和不含密钥的收据。All ten concepts were generated through the requested skill; no provider/model substitution.

![10 款 Logo 总览 / Overview](logo-overview.png)

| 编号 | 款式 / Direction | 图形含义 | 建议场景 | 文件 |
| --- | --- | --- | --- | --- |
| 01 | 青绿资料夹 / Jade Folder | 资料夹、表头与归档口形成一个整体图形，强调资料进入后有序归档。 | 小程序主图标、产品导航 | [展示稿](previews/01-jade-folder.png) · [透明原图](originals/01-jade-folder.png) · [1024 PNG](exports/01-jade-folder/1024.png) |
| 02 | 瑞士模数 / Swiss Grid | 不齐的输入模块与严整网格形成独特的节奏，突出整理与规范。 | 技术品牌、开发者入口 | [展示稿](previews/02-swiss-grid.png) · [透明原图](originals/02-swiss-grid.png) · [1024 PNG](exports/02-swiss-grid/1024.png) |
| 03 | 负形汇流 / Converge | 分散资料沿两条路径汇入中间表格，强调多源成表。 | 企业官网、商务材料 | [展示稿](previews/03-converge.png) · [透明原图](originals/03-converge.png) · [1024 PNG](exports/03-converge/1024.png) |
| 04 | TP 连字 / TP Monogram | 将 T 的表头与 P 的收纳腔结合，适合长期独立品牌。 | 企业品牌、站点页头、名片 | [展示稿](previews/04-tp-monogram.png) · [透明原图](originals/04-tp-monogram.png) · [1024 PNG](exports/04-tp-monogram/1024.png) |
| 05 | 清泉成表 / Clear Spring | 用清澈水滴表达清洗，通过内部表格避免被误认成纯水品牌。 | AI 整理产品、轻量工具 | [展示稿](previews/05-clear-spring.png) · [透明原图](originals/05-clear-spring.png) · [1024 PNG](exports/05-clear-spring/1024.png) |
| 06 | 折纸归档 / Folded Paper | 散页经过一次折叠成为表单，表达从杂乱到可交付。 | 海报、品牌故事、产品介绍 | [展示稿](previews/06-folded-paper.png) · [透明原图](originals/06-folded-paper.png) · [1024 PNG](exports/06-folded-paper/1024.png) |
| 07 | 朱印表格 / Vermilion Seal | 抽象印面与表格格线结合，强调依据、留痕与可信交付。 | 中文品牌、报告封面、质量说明 | [展示稿](previews/07-vermilion-seal.png) · [透明原图](originals/07-vermilion-seal.png) · [1024 PNG](exports/07-vermilion-seal/1024.png) |
| 08 | 极光流线 / Aurora Flow | 连续带状结构汇成表单，强调 AI 处理与流畅自动化。 | AI 产品宣传、深色站点、发布物料 | [展示稿](previews/08-aurora-flow.png) · [透明原图](originals/08-aurora-flow.png) · [1024 PNG](exports/08-aurora-flow/1024.png) |
| 09 | 小格伙伴 / Grid Buddy | 将表格格子拟成可靠的小伙伴，降低整理工具的使用距离。 | 抖音触达、新手引导、社媒头像 | [展示稿](previews/09-grid-buddy.png) · [透明原图](originals/09-grid-buddy.png) · [1024 PNG](exports/09-grid-buddy/1024.png) |
| 10 | 手作秩序 / Crafted Order | 有温度的格线与纸页轮廓，让工具更像值得信赖的整理助手。 | 创作者品牌、内容封面、生活化宣传 | [展示稿](previews/10-crafted-order.png) · [透明原图](originals/10-crafted-order.png) · [1024 PNG](exports/10-crafted-order/1024.png) |

## 文件使用 / Files

- `originals/`：实际返回的 1254×1254 RGBA 原图，原字节保存，有真实透明像素。The gateway returned 1254×1254 despite a 1024×1024 request; originals are retained unchanged.
- `exports/`：每款另附 1024 / 512 / 256 / 128 / 64 / 32 像素透明 PNG，统一居中和留白，只做裁边与缩放。Normalized transparent PNGs; no new artwork generated in post-processing.
- `previews/`：1600×1320 单款展示，中英品牌字使用本机字体排版，附浅色应用与头像示意。Text is typeset after generation; font files are not distributed.
- `logo-overview.png`：2600×1620 十款总览，同时展示 32 / 64 px 效果。
- `prompts/`、`receipts/`、`concepts.json`、`manifest.json`：生成依据、请求参数、实际尺寸与 SHA-256；不含网关密钥。Generation provenance and digests without credentials.

## 选型边界 / Selection boundary

这些是 10 个独立方向的候选 PNG，尚未选定最终品牌；没有改写冻结的 B 设计，也没有替换小程序或服务器上的品牌。These are alternatives, not ten approved production identities.

当前交付为位图，尚未制作可编辑 SVG/AI 矢量母版。32/64 像素效果用于人工比较，不代表平台真机审核或自动可读性评分。These are raster assets; small-size views are visual checks rather than device acceptance.

选定后应统一主标志、中英字标、反白/单色版、安全留白和各背景用法，再导入上线物料。After selection, finalize a single brand system before replacing product assets.

## 复现 / Reproduce

在仓库根目录使用 `scripts/generate-logo-concept.py --id 01 --skill-script <本机 sub2_image_gen.py 路径>` 重新请求单款；此操作会调用图像服务。展示与尺寸派生由 `scripts/build-logo-exploration.py` 完成，不请求图像接口。

Windows 排版使用 Microsoft YaHei。脚本通过外部技能执行请求，仓库不保存网关地址或 API Key。已有输出默认不重复请求；需要重新生成时显式添加 `--force`。Existing output is preserved unless `--force` is provided.
