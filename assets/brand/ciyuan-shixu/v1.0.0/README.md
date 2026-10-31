# 词元拾序 · 正式品牌资产 / Approved brand assets

版本 / Release: **P07-BRAND-CIYUANSHIXU-1.0.0**。用户于 2026-11-01 选定名称 **词元拾序** 与 **06 折纸归档**。完整规范见[品牌定型](../../../../docs/brand/README.md)，当前指针见[current.json](../../current.json)。

The user-approved name and mark are packaged here. Table Purifier is the existing project alias, not a separately approved English brand name. The original selected image is retained without regeneration.

![正式展示稿 / Brand board](brand-board.png)

| 文件 / Files | 用途 / Use |
| --- | --- |
| [1254 px RGBA 原图](originals/06-folded-paper.png) | 原字节母图 / Unchanged selected original |
| [1024](marks/logo-color-1024.png) / [512](marks/logo-color-512.png) / [256](marks/logo-color-256.png) / [128](marks/logo-color-128.png) / [64](marks/logo-color-64.png) / [32](marks/logo-color-32.png) | 六尺寸透明彩色图形 / Transparent color marks |
| [单色](marks/logo-mono-1024.png) / [反白](marks/logo-reverse-1024.png) | 原透明轮廓派生 / Alpha-derived monochrome/reverse symbols |
| [横式主标](lockups/logo-horizontal-color.png) / [深色背景横标](lockups/logo-horizontal-reverse.png) / [竖式](lockups/logo-stacked.png) | 图形 + 中文名称 + 产品说明 / Symbol + Chinese wordmark + descriptor |
| [浅底头像](avatars/avatar-light-1024.png) / [深底头像](avatars/avatar-dark-1024.png) | 1024 px，无文字 / Text-free avatars |
| [分享封面](social/share-card-1200x630.png) | 1200×630 / Launch/share cover |
| [favicon](favicon.ico) | 16/32/48/64 px；小尺寸仅保留轮廓识别 / Silhouette at tiny sizes |
| [清单](manifest.json) | 逐文件摘要、尺寸、来源与派生边界 / Digests and provenance |

主标图形最小 32 px、优先 64 px；四周留白至少为可见高度的 1/8。不得拉伸、裁切、改色或将旧名称放回正式组合。字体使用本机 Microsoft YaHei 排版，不附带字体文件。交付为位图，未创建 SVG/AI 矢量母版。

Use at least 32 px for the complete mark, preferably 64 px, with one-eighth-height clear space. Keep the supplied proportions, folds and colors. Typography uses local Microsoft YaHei; fonts are not redistributed. No editable vector master is claimed.

在项目根目录执行 `python -X utf8 scripts/build-brand-identity.py`，仅从留存原图派生，不调用图像服务。输出 ZIP 位于 `output/imagegen/ciyuan-shixu-brand-v1.0.0/Ciyuan-Shixu-Brand-v1.0.0.zip`，包含本目录文件及当前身份 JSON；ZIP 不入 Git。

The builder reproduces exports locally and writes an ignored delivery ZIP. The mini-program source uses the exact 128 px export; generated native bundles carry the same bytes. Updating this asset package does not deploy it to the server or publish mini programs.
