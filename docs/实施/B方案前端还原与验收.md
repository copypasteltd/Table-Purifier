# B 方案前端还原与验收 / B design fidelity

本轮解决初始源码布局与选定稿偏离的问题。视觉目标仍是冻结的 **P07-DS-B1.0.0 青绿资料夹**，没有重做品牌或替换设计方向。业务继续采用七步流程和 v3.2 生命周期。

This revision brings the initial frontend closer to the retained B design. It preserves the frozen visual direction and the seven-step v3.2 lifecycle.

[三页更新总览](../media/design-review/after-board.png) · [首页对照](../media/design-review/comparison-MP01.png) · [规范对照](../media/design-review/comparison-MP06.png) · [问题对照](../media/design-review/comparison-MP10.png) · [机器验收记录](验证记录/ui-design-fidelity-2026-10-28.json)

## 设计依据与取舍 / Reference and decisions

- 原图：[B-selected-board.png](../../assets/design/b-jade-folders/v1.0.0/reference/B-selected-board.png)，以及 MP01 / MP06 / MP10 三张裁片。
- 尺度、颜色、布局与状态：[视觉规范](../设计定型/B-青绿资料夹-v1.0.0/01-视觉规范与设计变量.md)、[组件规范](../设计定型/B-青绿资料夹-v1.0.0/02-组件与交互状态.md)、[页面规范](../设计定型/B-青绿资料夹-v1.0.0/03-18页面定型规格.md)。这些文件及原稿均保持原字节；不以更新历史哈希消除差异。
- 原图为生成式设计参照，设备比例、示例内容与当前业务状态不完全相同。遵循定型后的 16 px 内容边距、24/34 主标题、18/26 章节标题、16/24 正文、12/18 注释、48 px 最小触控与 52 px 常用按钮；不通过整体缩放挤小文字与触控。
- 保留白色阅读区、淡青绿背景、主色 `#17745E`、无文字资料夹页签、细边框与统一图标。来源链接使用定型规范的绿色。导航栏与宿主胶囊仍由原生平台负责，预览中的系统栏只是文档外壳。
- 对原稿的必要交互修正：Session 就绪后才显示输入；问题决定初始不预选；先预览修改影响再确认；状态和已读范围来自数据；不存在的信息不编造时间、字段或百分比。

Reference images are illustrative rather than pixel goldens. The frozen logical scale and accessibility limits take precedence over stretching images into another viewport. Native chrome, device fonts and keyboards require later device verification. The original image's preselected decision is intentionally replaced by explicit user choice.

## 已修复的主要差异 / Main corrections

| 区域 / Area | 原问题 / Before | 当前行为 / After |
| --- | --- | --- |
| 资料夹 | 标题放进绿色页签，间距大 | 页签仅装饰，标题在正文，单页最多一个主资料夹 |
| 首页 | 两行标题、大状态块，目标输入易被底栏遮住 | 单行标题、紧凑说明、三份资料卡、两种规范选择、用途输入、固定检查按钮 |
| 文件卡 | 平铺文字，无图标 | 独立圆角边框、文件图标、名称与真实大小/状态；清空需确认并按最新版本逐项移除 |
| 推荐规范 | 所有字段平铺，缺少真正表头 | 规范摘要、三种代表字段卡、全部字段入口、有表头的四列表格与待补色块 |
| 问题详情 | 只显示问题文本、原始字段 ID 与纵向按钮 | 实际记录身份、问题字段、关键事实、来源卡、明确选项、分阶段固定操作 |
| 底部 | 文本导航、选中顶线，操作在正文中 | 同套图标与文字；首页操作及导航组成同一个固定容器，随内容高度排列 |
| 字段编辑 | 全部表单长铺 | 字段卡按需展开；收起保留未提交草稿；输入增加可访问名称 |
| 结果与领取 | 所有字段/九文件同时长铺 | 记录先显示五个关键字段，可展开全部；三个常用文件优先，其余六个可展开 |
| 跨页输入 | 首页用途、规范模式可能丢失 | 仅内存保存草稿，建立任务时传递，清理草稿时清空，不把正文放进设备存储 |
| 查看来源后返回 | 预览返回首页；刷新会重置决定 | 文档预览模拟原生页面栈；产品控制器刷新同一问题时保留用户选择 |

## 18 页覆盖 / Page coverage

| 页面 | 本轮落点 / Changes |
| --- | --- |
| MP01 首页 | 主标题、文件资料夹、两种模式、用途、合并固定底栏 |
| MP02 资料清单 | 文件卡与图标、输入标签、能力说明、原有移除/提交门禁 |
| MP03 规范输入 | 白色规范卡、字段层级、受限文件能力与已有规范入口 |
| MP04 预检报价 | 统一范围、报价、确认和告知卡；整数原单位、实付门禁保留 |
| MP05 进度 | 阶段卡与实际状态；不增加虚假百分比 |
| MP06 推荐规范 | 紧凑资料夹、字段示例、表头、小样、双按钮固定栏 |
| MP07 字段编辑 | 可收起字段、规则区、紧凑按钮组、保留草稿 |
| MP08 结果概览 | 记录卡、关键字段与全部字段展开、去向统计与问题入口 |
| MP09 问题列表 | 筛选、状态卡、问题卡、明确处理入口 |
| MP10 问题详情 | 真实记录上下文、保留依据、初始未选择、固定分阶段操作 |
| MP11 来源依据 | 完整摘录、定位与原件已清理说明 |
| MP12 结果领取 | 三个常用文件、其余六项展开、逐文件领取与规范另存 |
| MP13 任务列表 | 可继续的任务卡和统一图标导航 |
| MP14 我的规范 | 目录卡、搜索标签、版本与私有状态 |
| MP15 我的 | 订单卡、隐私/售后入口、图标导航 |
| MP16 订单详情 | 付款/履约/退款层级、原单位金额、原因标签 |
| MP17 隐私管理 | 用途、处理方、保存与删除卡；危险动作保持独立 |
| MP18 帮助售后 | 问题表单、明确标签、默认关闭的内容访问授权 |

两端由同一组件、模板、控制器生成，仍为每端 18 页、32 个注册组件。32 个组件均通过共享主题更新：C01 框架；C02 资料夹；C03 标题；C04–05 按钮/图标操作；C06–08 资料/模式/输入；C09–10 报价/进度；C11–15 规范/字段/编辑/记录/表格；C16–18 状态/依据/决定；C19–20 操作/导航；C21–24 任务/模板/文件/订单；C25–28 确认/反馈/隐私/消息；C29–32 筛选/来源预览/能力/版本警告。

## 源码和资产 / Source and assets

| 入口 | 职责 |
| --- | --- |
| `miniapp/src/theme.css` | 冻结色值、字号、间距、白色卡片、布局、固定栏与安全区 |
| `miniapp/src/components.js` | 32 个原生组件；可点击字段卡、资料夹和依据结构 |
| `miniapp/src/presentation.js` | 只读显示模型、类型/大小说明、真实记录身份；不回写规范事实 |
| `miniapp/src/navigation.js` | 两端构建和文档预览共用图标导航与标题映射 |
| `miniapp/src/assets/icons` | 19 个原创同系列图标，SVG 原稿及 4 倍 PNG；PNG 用于未实测的宿主 SVG 兼容性 |
| `scripts/build-miniapps.ts` | 生成原生工程、图标与逐文件摘要；不部署 |
| `docs/preview` | 同一源码的浏览器文档适配，仅使用合成资料 |

图标统一采用 24 单位画布、1.75 线宽、圆角线帽；底部选中态采用同系列实心版。没有外部图标 CDN 或新增框架。Taro 迁移不属于本次范围。

## 验收与复现 / Verification and reproduction

```bash
npm run build:miniapps
npm run design:audit
npm run docs:capture
npm run docs:media
npm run docs:verify
```

`design:audit` 覆盖两端 × 18 页 × 320/375/390/430 四种宽度，并补充三页报价场景、135% 文字模拟、横屏、长文件名、长字段及错误展示。检查整页溢出、48 px 触控、图标读取、主资料夹数量、16 px 边距、操作/导航重叠、页末控件可达及首页关键输入遮挡。

交互回归另检查用途/模式跨页、问题不代选、来源返回保留选择、字段收起保留草稿、九文件全部可达、记录全部字段可达及较短视口下用途输入可聚焦。每次运行自动关闭自己的页面、上下文、浏览器和临时服务，包括失败路径。

`design:before` 从 Git 初始提交 `a9d9699` 只读构建旧前端，使用与当前相同的合成报价场景采集三页，保存到媒体目录；不切换工作区。对照图保留参照图宽高比，仅对预览去掉文档标识/模拟状态栏以对齐原生导航起点，不拉伸、不计算虚假的像素一致率。普通媒体重建直接使用已版本化的修复前截图，无需历史构建。

These are source-layout and fixture interaction checks. The report identifies each viewport and scenario and records source hashes. It is **not** native Alipay/Douyin, real keyboard, system Dynamic Type, dark-theme, live Codex/payment or Ubuntu acceptance. The B light theme is the current target. Device fonts, native component isolation, actual safe areas, image compatibility and keyboard avoidance remain NOT_RUN until the dedicated platform credentials/devices are available. No deployment, Docker or WSL is performed.
