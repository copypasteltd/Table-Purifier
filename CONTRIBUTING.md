# 贡献与同步 / Contributing and synchronization

[中文入口](README.md) · [English entry](README.en.md) · [工作约定 / Agent instructions](AGENTS.md)

## 中文

1. 在仓库内阅读当前需求、源码实施说明和相关合同，保持七步流程、结果独立保存、实付批量和 B 设计。不要修改冻结历史清单来迁就新行为。
2. 修改共享小程序源码后运行 `npm run build:miniapps`，同时提交 `miniapp/src` 和两端生成源码；不要仅修改生成页。当前没有采用 Taro，迁移需要独立任务。
3. 按改动运行必要检查：`npm run check`、`npm run build:miniapps`、Python 工具测试。当前需求/合同静态入口为 `python -X utf8 scripts/verify_repository_baseline.py`；旧脚本保留原字节，其直接入口仍面向旧根文档。依赖见仓库验证文档，不把静态校验称为产品验收。
4. 同步更新中英 README、相关需求/技术文档和本文件下方所述中英更新说明。UI/流程变化先执行 `npm run design:audit`，将通过的收据保存至实施验证记录、更新相关链接，再执行 `npm run docs:capture`、`npm run docs:media`、`npm run docs:verify`；媒体明确标识合成资料和真实验收范围。
5. 检查 `git status`、暂存差异、敏感文件与大文件；不提交实际 `.env`、密钥、客户资料、运行目录、依赖或输出 ZIP。
6. 编写说明“改了什么、为什么、怎样验证、仍有什么边界”的提交。用户持续要求提交并推送指定仓库；不要擅自 force push 或覆盖他人修改。推送后核对本地和远端 SHA。

```bash
git diff --check
git diff --cached --stat
git commit -m "docs: describe the concrete change and its validation"
git push origin main
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

变更记录写入 [CHANGELOG.md](CHANGELOG.md)：未发布改动放 `Unreleased`，确认版本时记录日期；每条重要变更包含中文和英文，资金/隐私/结果格式变化写清用户影响。仓库同步授权不包含部署或小程序发布。浏览器预览完成后关闭本次页面和进程，严禁 Docker / WSL / VM。

## English

Read the current requirements, implementation guides and relevant contracts before editing. Preserve the seven-step lifecycle, persistent results, verified-payment gate and B design. Do not rewrite frozen historical manifests to accommodate new behavior.

Edit shared mini-program source and run `npm run build:miniapps`; commit both shared and generated native projects. Current source does not use Taro. Run checks relevant to the change, including `npm run check`, mini-program builds and Python tool tests. Requirement/contract changes also need the static baseline verifiers described in the verification guide.

Maintain both READMEs, affected requirements and technical documents, and bilingual CHANGELOG entries. For UI changes, run `npm run design:audit`, version the passing receipt and update its links. Regenerate affected screenshots, recordings, GIFs and manifests, then run `npm run docs:verify`. Label synthetic preview material accurately.

Review staged changes and exclude real `.env`, keys, customer material, runtime data, dependencies and generated archives. Describe behavior, purpose, validation and remaining limits in commits. The user's standing instruction authorizes committing and pushing completed changes to this repository; verify remote HEAD afterward. Never force-push or overwrite others' work. Git synchronization does not authorize deployment. Close task-created browser resources and never invoke Docker / WSL / VMs.
