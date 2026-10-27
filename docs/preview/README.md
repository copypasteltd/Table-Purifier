# 页面预览与媒体复现 / Preview and media reproduction

[中文](../../README.md) · [English](../../README.en.md) · [媒体](../media/README.md)

加载 `miniapp/src` 的真实页面模板、32 个组件、业务控制器、字段编辑和主题，用浏览器映射原生节点及事件。构建只在文档 bundle 内替换 client/platform，使用这里独立的合成夹具；生产适配器和配置不改写。

The documentation build renders actual native templates, components, controller, schema editor and theme, substituting independent client/platform fixtures without modifying production source.

## 边界 / Scope

- 资料、身份、Session、报价、订单、模型、生产、CLOSED 均为内存夹具。All states are synthetic and in memory.
- 不连接业务 API、数据库、Codex、支付或真实下载；不证明宿主渲染或 Ubuntu 清理。No live integration or native-device acceptance.
- 预览收费/导出 flags 不改变产品默认关闭的能力。Fixture flags do not enable product capabilities.
- CSP 禁止网络连接，临时服务只监听 `127.0.0.1`、提供五个白名单资源。CSP denies connections; the loopback server serves five allowlisted assets.
- 录制鼠标、表单和实际控制器动作，未拍摄平台 IDE。Recordings show browser source interaction, not a platform IDE.

## 准备 / Prerequisites

先 `npm ci`。本机需有浏览器所需系统库，PATH 中的 FFmpeg/FFprobe，及项目 Python 环境中的 Pillow；脚本不提权安装系统包。浏览器二进制下载在本项目：

```powershell
# Windows PowerShell
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD/runtime/tools/playwright"
npx playwright install chromium --only-shell
```

```bash
# Ubuntu / POSIX
export PLAYWRIGHT_BROWSERS_PATH="$PWD/runtime/tools/playwright"
npx playwright install chromium --only-shell
```

Dependencies, browser binaries and caches stay inside ignored project runtime. No credentials or Docker/WSL are needed or used.

## 查看 / Explore

```bash
npm run docs:preview
```

打开 `http://127.0.0.1:4173`，抖音增加 `?provider=DOUYIN`。右侧索引可查看 18 页；重播/刷新重置内存。完成后关闭标签、Ctrl+C 终止本次预览。

Open the loopback URL; add the provider query for Douyin. Use the selector or Restart. Close unused tabs and stop the preview when done.

## 采集与转码 / Capture and encode

```bash
npm run docs:capture
npm run docs:media
npm run docs:verify
```

1. `capture-docs.mjs` 遍历两端 18 页，采集 430×920 页面截图，以 1600×1060 录制完整交互；检查页面错误、会话就绪、付款夹具门禁和结果状态。`try/finally` 关闭页面、上下文、浏览器和临时 HTTP 服务。
2. WebM 和时间线只存 `runtime/docs-recording`。FFmpeg 制作 H.264 / yuv420p / faststart MP4、加速流程 GIF 和来源依据 GIF，Pillow 制作两张页面联系表。
3. `capture-receipt.json` 记录真实来源摘要及真实性范围；`manifest.json` 保存最终媒体 SHA-256、大小、尺寸、时长、编码及录制时间线。
4. `verify-repository-docs.mjs` 只读校验链接、36 个页面、摘要与来源一致性，不启动浏览器或业务服务。

The capture traverses both providers and exercises actual controller actions, asserting fixture lifecycle gates and closing resources even on failure. Raw WebM stays ignored. FFmpeg/Pillow produce committed MP4/GIF/contact sheets; JSON records source hashes, boundaries and metadata. The final verifier reads local files only.

生成覆盖同路径展示素材，不修改冻结 B 原稿、真实结果、密钥或生产配置。UI/控制器变化后重采受影响媒体，随中英说明提交推送。Generated presentation assets overwrite previous media only; refresh and commit evidence after relevant source changes.
