"""Write v3.2 / DEV3 documentation around the user's mandatory seven-step session flow."""
from __future__ import annotations

import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OLD=ROOT/'docs/背景/v3.1与开发v2.0-会话流程调整前/files'
STAMP='P07｜业务v3.2｜开发P07-DEV 3.0.0｜2026-10-27｜设计B青绿资料夹1.0.0。设计资料，软件及真实Agent/资金/设备测试未执行。'
FLOW='S1 创建会话并完整预加载Skill → S2 用户提交信息 → S3 Agent分析 → S4 用户确认或调整 → S5 预估计费 → S6 实付后批量产出 → S7 独立保存结果、释放Agent并销毁任务运行环境。'
BASE='''所有新资料处理任务均执行统一七步；PROVIDED和DISCOVER只影响规范来源，不能改变步骤顺序。查看已保存结果走独立结果服务，不启动新Agent或重复收费。用户调整返回分析与确认，旧确认和未付报价失效。结果文件独立保留；整个任务container销毁。本地container指受限Windows原生任务环境，禁止Docker/WSL/VM/MXC。

首版支付宝与抖音原生小程序均为P0，Web/API为P1；未来入口亦须遵守同一合同。保留B视觉/18页/32组件，首页增加会话初始化/完整技能加载/失败状态。模型/SDK/权限/认证、价格和平台能力必须实证，不能以本资料为上线或测试通过。
'''


def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))


def write(path,body):
    p=ROOT/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(body.strip()+'\n',encoding='utf-8')


def md(path,title,body):write(path,'# '+title+'\n\n'+STAMP+'\n\n'+body)


def main():
    req=read(ROOT/'assets/requirements/requirements.v3.2.json')['requirements']
    rules=read(ROOT/'assets/requirements/business-rules.v3.2.json')['rules']
    pages=read(ROOT/'assets/requirements/pages.v3.2.json')['pages']
    apis=read(ROOT/'assets/contracts/api-catalog.v3.2.json')['operations']
    domain=read(ROOT/'assets/contracts/domain-contract.v3.2.json')

    master=r'''
## 唯一正常处理流程

用户已明确：**结果文件不删除，删除整个流程的container。** 系统按下面七步实施。

| 步骤 | 用户交互 | 后端必须满足的条件 |
| --- | --- | --- |
| 1 创建会话 | 进入新整理任务，先看到准备状态 | 创建独立session/原生隔离工作区，完整装入本业务Skill，核全部文件/hash、上下文及工具/权限，bootstrap成功后READY_FOR_INPUT |
| 2 提交信息 | 上传/粘贴资料、用途和可选规范 | READY前连文字/文件/模板/目标都不接收；SOURCE与TEMPLATE分别存入本任务环境 |
| 3 Agent分析 | 查看资料理解、规范/整理建议、小样及问题 | 全部拟处理范围分析；Agent自主读文件/写分析代码/选择工具；至多5条代表预览，不批量生成正式九文件 |
| 4 确认或调整 | 修改字段、行粒度、规则、范围、冲突/缺失策略，再确认 | 两种模式都先采用准确规范并确认执行方案；调整回第3步，生成新plan版本、旧确认和未付quote失效 |
| 5 预估计费 | 查看明确范围、数量、预估金额与上限 | 报价只能引用当前已确认plan/source/binding/skill；价格由可信计量和获准价格表计算 |
| 6 实付后批量产出 | 原平台支付后查看生产进度与结果 | 服务端验付匹配订单/单位/金额/plan hash才发生产许可，启动一次Run；Agent批量清洗、成表并交独立验证 |
| 7 保存结果并销毁环境 | 领取结果，看到已保存/环境已清理状态 | 九文件复制至独立结果区、hash/readback/持久提交成功，原子发布结果指针及清理outbox；释放Agent并销毁全部任务环境，结果继续可下载 |

```mermaid
flowchart TD
 A[1 会话初始化 + 完整Skill预载] --> B[2 用户提交信息]
 B --> C[3 Agent全范围分析与方案]
 C --> D[4 用户确认或调整]
 D -->|调整 新版本| C
 D -->|确认准确方案| E[5 可信预估计费]
 E --> F[6 服务端确认实付后批量产出]
 F --> G[独立验收 + 九文件可靠存入结果区]
 G --> H[7 释放Agent并销毁任务container]
 G --> R[独立结果服务 持续可领取]
 H --> R
```

登录、必要告知、能力和限频是任务的前置资格检查。所有新增处理任务，无论首页/模板/结果再加工、支付宝/抖音/未来Web/API，都从S1开始。同一未结束任务重连找回原session，不能每次切页重复建环境；已销毁session不复活。查看已有结果不属于新处理任务。

## 完整Skill的准确含义

本业务版本发布包列出SKILL.md、全部references、工具脚本/说明及资源清单。Host在客户提交任何内容前读取全部资源、校hash，将完整内容装配进受信任bootstrap上下文，并核实际上下文容量、工具/权限/认证后执行初始化。仅展示name/description、把文件放磁盘或让模型回声hash，都不满足加载完成。缺件/hash错/上下文放不下/工具失败必须初始化失败、回收已分配环境，不能降为懒加载。

Codex官方技能默认逐步加载；本产品明确使用Host的EAGER_FULL策略，不宣称存在`preloadAllSkills`开关。上下文压缩或恢复后，在继续客户turn前重附完整锁定Skill和当前不可变业务控制事实。Skill版本/hash参与计划与报价；中途不静默升级。第三方库是已安装工具依赖，不是要把全部依赖源码塞入技能正文。

本版skill包是完整的业务设计资源，尚未实现SDK注入、bootstrap、工具程序或真实加载测试。后续真实工具脚本纳入同一版本清单并实证，才能开放真实会话。[官方Skill加载说明](https://learn.chatgpt.com/docs/build-skills)。

## 付费前与付费后

付费前完成完整资料理解、规范推荐、关键策略澄清、方案确认与小样。完整分析不是只看前三单元；小样只是展示方式。初始化/分析/调整成本由平台承担，有独立、有限的时间/调用/次数/闲置预算，实测锁定前不开服务；不能在用户付费时倒收未确认的前置成本。

付费后执行已确认方案的正式批量清洗、跨源拆合、字段与来源处理、九文件和独立验证。Agent可以在预算内换工具、写代码和修复候选，但不能改规范/价格、调用支付/退款/DB、代用户确认或自行发布。

报价说明数量、范围、原单位金额、费用上限、限制与交付。LLM给难点/计量建议，可信计量与价格表才是售价依据。默认固定确认范围与封顶金额；超限停止说明，不能隐藏加价。UNKNOWN、客户端success、过期报价、plan hash错或伪free_grant均不发生产许可。无获准收银能力时关闭收费生产路径；测试夹具不是消费者免费绕过。

## container销毁与结果保留

运行区例：`runtime/sessions/<server-session-id>/`，包含只读输入、上下文、Agent代码、分析/OCR/缓存、候选、checkpoint及任务日志；临时接收/受控溢出副本也绑定该生命周期。结果区例：`runtime/results/<owner-id>/<result-id>/`，独立权限/归属与九文件。结果不能是指向工作区的junction、软链接、临时路径或待删副本；仅rename一个文件还不足以证明独立持久提交。

顺序固定：候选验收 → 复制全部结果到独立存储 → 回读/核hash与实际存储持久提交 → 原子发布结果指针及清理outbox → fence/中止并回收Codex与工具进程树 → 撤销挂载/任务权限 → 删除整个任务环境及受控副本 → 核实清理 → 留最小回执。清理器由可信Host控制，不能让Agent自己写清理脚本并声称成功。

删除：原始上传/接收副本、客户会话正文、Codex任务落盘上下文、分析/预览、中间表、生成脚本、OCR/抽取缓存、scratch、原始stdout/stderr、checkpoint及非结果DB正文/缓存。保留：最终九文件、由结果生成的记录/问题/来源投影、最小结果归属/hash、用户主动保存的私有规范、必要订单/支付及清理凭据。公共Skill、运行时二进制与其他任务不能被清理。

结果中的必要来源摘录与定位可以保留，原始全文档不作为隐蔽“结果副本”保存。环境销毁后来源页明确原件已清理，只展示结果内可用证据；不能继续伪装可看完整原件。结果文件不因销毁container或短链TTL到期被删除，下载只依赖结果权限，短链可重签。用户日后主动删除结果属于单独数据管理动作，不由流程结束自动触发。

本地不启动Docker、WSL、虚拟机或MXC；container是任务隔离运行环境抽象。具体原生SDK/会话落盘/受限身份/进程/缓存删除需试验。不能声称SDK一个close调用自动擦除一切；平台供应商副本/备份按经验证合同处理，未确认不承诺物理零留存。

## 失败、取消、等待与再加工

初始化失败、未付任务闲置到期、用户取消、最终失败都要终止并清理环境；已有独立结果不删除。等待确认/付款不占活跃计算，有限闲置期限需显示并在配置锁定，未付环境不无限驻留。支付未知先查原订单，晚付按原订单事实履约/退款，不自动复活已清环境。

保存失败不可当作产出成功销毁唯一可恢复材料；按已付合同恢复或失败/退款。结果已保存但清理失败时结果仍READY，cleanup为PENDING/FAILED并幂等重试告警；不能把发出删除请求写SUCCEEDED，也不能为重试清理重跑生产/收费。进程崩溃后outbox继续清理，关闭会话不可从旧备份/checkpoint复活。

产出后调整从新session和完整Skill开始，用户选取父结果及必要重传原件作为新输入，再分析/确认/估费/核实付款权益。业务修订可以关联父结果/child Run，但不能恢复旧runtime。平台纠错可核原实付权益覆盖，不伪造新付款或向用户二次收费；新增需求按新确认报价付费。

## 版本影响与执行状态

业务升级v3.2，开发升级P07-DEV 3.0.0；v3.1/DEV2原样归档。42功能/126AC/24BR/18NFR/8指标/24异常/18页继续追踪，API新增3项session接口共56项，API18—20转为task路径，因为采用发生在付款和Run创建之前。原“先付费发现后采用”、前三单元局部预检作为主路径、付费Run等待规范、消费者free_grant生产及自动7天删结果退出当前流程。

执行Run只使用QUEUED/RUNNING/SUCCEEDED/FAILED/CANCELED；付费前等待发生在Session WAITING_CONFIRMATION/AWAITING_PAYMENT。Session CLOSED、结果READY及清理SUCCEEDED分别记录。产品/SDK/加载/清理/资金/设备测试均NOT_RUN，当前完成的是设计与合同更新。
'''
    md('docs/需求深化/07-统一七步流程与Session生命周期.md','统一七步流程与Session生命周期',master)
    md('docs/开发/18-统一七步流程与Session生命周期.md','统一七步流程与Session生命周期',master)

    md('docs/01-产品需求PRD.md','表格修复站产品需求',FLOW+'\n\n'+BASE+r'''
## 目标与交互

把任意形态目标下的获支持资料变成有依据、可核查、可继续使用的规范表。用户已有规范时按规范；没有规范时由Codex Agent在报价前分析全部资料并建议规范，用户确认后生产。首版支持文字、TXT/Markdown、CSV、XLSX、DOCX、PDF、JPG/PNG；不承诺所有扩展名都能读。

主界面是原生资料夹、规范卡、计划确认、预估费用、进度、记录/问题及领取页。自然语言可用于说明与调整；用户不需要手工映射每个正常字段或操纵终端。首页先显示会话准备状态，READY前不接收客户信息。Agent是资料业务执行主体，工具/代码由它选择。

## 交付与留存

标准、结果、accepted CSV、问题、来源与验证共九文件。结果独立持久保存，运行环境在发布后整个销毁；再次加工新建会话。记录缺失、冲突、不可读与待核真实状态，不补造值；模板示例不是事实，低频重要字段不能随意丢弃。

## 基线与完成定义

42功能（38P0/4P1）、126AC、24BR、18NFR、8指标、24异常、18页/32B组件、56API设计。完成需真实SDK/完整Skill/权限/工具、质量标准集、数据库/清理/结果存续、双平台四环境/正式收银与发布证据。文档检查不能替代产品测试。

详细流程见[七步合同](需求深化/07-统一七步流程与Session生命周期.md)，完整功能见[42需求及126AC](02-功能需求与用户流程.md)。
''')
    body=FLOW+'\n\n'+BASE+'\n## 功能、流程与验收\n\n'
    for r in req:
        body+=f"### {r['id']} {r['title']}\n\n优先级：{r['priority']}。{r['user_story']}。\n\n输入/前提：{r['inputs_and_preconditions']}。\n\n流程：{r['normal_flow']}\n\n边界：{r['exceptions_and_boundaries']}\n\n"
        body+='| 验收编号 | 可观察条件 | 状态 |\n| --- | --- | --- |\n'
        body+='\n'.join('| '+a['id']+' | '+a['criterion']+' | NOT_RUN |' for a in r['acceptance_criteria'])+'\n\n'
        body+='页面：'+', '.join(r['page_ids'])+'；API：'+', '.join(r['api_ids'])+'；主测试：'+r['primary_test_id']+'。\n\n'
    body+='## 唯一主流程\n\n'+FLOW+'\n\n[详细七步与销毁边界](需求深化/07-统一七步流程与Session生命周期.md)。'
    md('docs/02-功能需求与用户流程.md','功能需求与用户流程',body)
    md('docs/03-架构数据与接口.md','系统架构、数据与接口',FLOW+'\n\n'+r'''
```mermaid
flowchart LR
 A[原生小程序] --> B[业务API]
 B --> S[Session Host 完整Skill bootstrap]
 S --> C[Codex Agent 分析与已付批量]
 C <--> T[受限原生任务环境 / 文档脚本工具]
 C --> V[独立验证与可信发布器]
 V --> R[独立结果存储与结果API]
 V --> O[事务发件箱 清理器]
 O --> X[停止Agent 销毁整个任务环境]
 R --> A
 B --> P[原平台验付 订单与报价]
```

身份会话先完成认证与必要告知；Agent session是新任务的第一个业务资源。初始化不携带客户资料，完整Skill与工具就绪才允许创建关联Task和上传。付费前规范提案关联Task/session；用户确认后合同绑定plan/schema/source/skill，估费与原订单引用该版本。仅实付确认后创建生产Run。

Session、Run、Schema、Quality、Artifact、Payment、Refund、Fulfillment、Operation、Export及Cleanup分别投影。Result READY不等于环境已清，也不等于用户设备已导出。CLOSED不再恢复Agent；结果仍可下载。DB保存最小关联与结果投影；源正文/分析上下文随环境清理。

新增API54/55/56用于先建会话/查加载阶段/关闭清理；API18—20由runs路径改到tasks路径；API03必须ready_agent_session，API09完整付费前分析，API10确认计划，API11之后才估费，API16只接受原实付。56项接口仍为草案，未部署。

文件、路径、权限、hash、owner由服务端核实；Agent无资金、DB、规范采用或持久发布权。原生ACL/受限身份与Codex权限需要真实反例验证，cwd不是租户读隔离。禁止本地虚拟化。

[完整会话/留存合同](需求深化/07-统一七步流程与Session生命周期.md)、[接口目录](../assets/contracts/api-catalog.v3.2.json)、[开发设计](开发/README.md)。
''')
    commerce=r'''
## 收费时机

必须先完成完整会话预载、提交信息、Agent分析和用户确认；随后才预估计费。PROVIDED与DISCOVER一致，无模板完整规范发现不再放到付款之后。初始化/分析/调整费用由平台承担并设独立有限预算，不能把已发生成本事后加到未确认价格。

报价绑定session、confirmed plan ID/version/hash、source/binding/Skill hash、原平台app/OS/SKU、价格表版本、可信计量、原单位金额/上限、有效期及交付/退款政策。LLM只能建议复杂度/工作量，不能决定实收价格；默认按确认范围封顶，超限停止说明，不隐性加费。价目与分析/空闲阈值实测试验锁定前关闭生产。

## 实付与生产

正常消费者生产只接受服务端原渠道验签/正式查单CONFIRMED；客户端success、UNKNOWN、旧quote、金额/单位/计划hash不匹配及free_grant都不能启动。获准平台收银资格、app/类目/SKU/OS能力独立真机证明；未核不借Web/其他平台绕过。不以公开免费生产路径跳过用户要求的实付门槛。

相同合同只有一张原订单。幂等请求/重复/乱序回调追加正确资金事实，只产生一次生产许可/Run/outbox；未知先查原单，不盲建第二单。用户调整未付方案先令旧确认/报价失效并查清旧单状态；旧单UNKNOWN不能当未付失败。晚付款记入原单，按可履行原合同或原路退，不覆盖新单。

## 结果与清理

付款后Agent生成批量九文件，经独立验证、复制独立结果存储、hash/readback与持久提交，原子发布result pointer和清理outbox。随即释放Agent并销毁任务环境，结果文件继续保留。结果可领取不等于平台已认可履约，FETCHED/CACHED不能一概充实际导出。

保存失败不能先销毁唯一材料；在授权预算内恢复，否则按合同失败/原路退款。0候选不捏造行；若已付按原承诺退。结果已可靠保存但清理失败，结果可用、清理重试告警，不能重跑收款。订单与清理最小凭据独立于客户上下文留存；不为售后无限保存整个源环境。

## 修订与保留

产出后环境已销毁，调整从新session完整预载开始，用户选择父结果及必要重传原件，再分析/确认/估费。原合同平台纠错可核原实付权益覆盖，新增需求按新报价实付；不伪造免费通道流水或复活旧container。

结果不因流程结束、短链TTL或旧7天候选被自动删除；下载按owner/结果权限重新签链。私有规范仅用户主动另存的去事实版本独立保留。原始输入、会话正文、中间文件和任务日志随container清理；结果内必要出处摘录属于结果，不保留隐藏完整原件副本。

## 对账与外部证据

支付/退款按原平台原单位分别记账，验商户/app/订单/金额；不混算虚拟单位。外部提交未知按原请求查，退款申请不等于到账；并发/晚到/重复/响应丢失需真实故障证据。平台主体/类目/规则/SDK/退款和计价参数均未实证，当前所有生产收费开关关闭。
'''
    md('docs/04-计费交易与运营.md','计费、交易与运营',FLOW+'\n\n'+commerce)
    body=FLOW+'\n\n## 42项主测试映射\n\n| 主测试 | 需求 | 核验目标 | 状态 |\n| --- | --- | --- | --- |\n'
    body+='\n'.join('| '+r['primary_test_id']+' | '+r['id']+' | '+r['title']+'；对应3条AC分别验收 | NOT_RUN |' for r in req)
    body+=r'''

## 七步专项与内容标准

完整预载前拒绝全部客户输入；完整范围分析后才确认；未确认不报价；未实付不生产；旧报价/版本/付款未知不能绕门槛；持久保存前不销毁；销毁后结果仍可用；清理失败重试；关闭session不可复活。详见开发240项计划，全部NOT_RUN。

至少30组人工标准答案（至少10无模板），覆盖稀有字段、缺失/冲突、币种/前导零/日期、拆合、混合格式和不可读/超限。不能由同Agent自产答案自证质量，不能只算schema通过率。真实SDK/bootstrap/代码/工具轨迹、耗时费用与恢复/取消/清理反例需记录。

## 四环境与发布

支付宝/抖音×Android/iOS分别验证资料选择、规范、确认估费、获准实付、批量和实际Excel取用；源码/真机/平台开通/正式资金/数据库与清理均待执行。禁止容器/WSL/VM测试依赖。静态文档核验与产品测试独立，当前无产品PASS。

工作包W01—W12延续，但需增加完整Skill初始化、付费前分析/确认、报价实付门槛和结果独立清理。旧85—118人日/10—14周只作历史参考，不作为本版估算承诺。
'''
    md('docs/05-验收测试与实施计划.md','验收测试与实施计划',body)

    md('docs/需求深化/01-用户故事与业务规则.md','用户故事与业务规则',FLOW+'\n\n'+BASE+'\n## 24条业务不变量\n\n| ID | 规则 |\n| --- | --- |\n'+'\n'.join('| '+r['id']+' | '+r['rule']+' |' for r in rules))
    body='## 关键实体\n\nAgentSession先于Task：session ID/owner/status/Skill manifest hash/preload receipt/工作区/cleanup/result ID。Task在READY后创建，持有来源/目标/规范草案。ExecutionPlan记录版本、source/binding/Skill hash、策略和用户确认；确认后Contract/Quote/Order绑定它。Batch Run仅在实付后创建，Result与结果投影独立于会话环境。\n\n'
    body+='类型：UUID服务端ID；UTC时间；金额整数+原单位；事实decimal字符串；标识文本；原文件hash与canonical JSON hash分开。字段保raw/value/status/来源；每候选唯一去向。\n\n## 状态轴\n\n'
    for axis,values in domain['axes'].items():body+='- '+axis+'：'+', '.join(values)+'。\n'
    body+='\n## 会话迁移\n\n| 从 | 到 | 守卫 |\n| --- | --- | --- |\n'+'\n'.join('| '+x['from']+' | '+x['to']+' | '+x['guard']+' |' for x in domain['session_transitions'])
    body+='\n\n## 并发与终态\n\n同会话单turn、同合同单活动计算租约；所有写按owner/expected version/fence/epoch。Run终态不重开。付费前没有等待规范的生产Run，等待在session轴。结果发布与清理outbox原子，结果READY/cleanup FAILED可同时成立。用户/支付等待不计活跃计算，环境闲置期限单独配置。销毁后仅最小元数据/结果存续，不保留可恢复正文。\n\n[领域合同](../../assets/contracts/domain-contract.v3.2.json)。'
    md('docs/需求深化/02-数据字典与状态迁移.md','数据字典与状态迁移',body)
    # Preserve the precise extraction/format requirements while replacing the old paid-discovery gate section.
    old=(OLD/'docs/需求深化/03-整理引擎与规范验收规格.md').read_text(encoding='utf-8')
    start=old.index('## 计量定义')
    detail=old[start:].replace('在预检锁定','在付费前分析与确认方案时锁定').replace('预检锁定','付费前分析与计划确认锁定')
    md('docs/需求深化/03-整理引擎与规范验收规格.md','Agent整理与独立验收规格',FLOW+'\n\n'+BASE+'\n## Agent阶段权限\n\nBOOTSTRAP无客户内容，完整技能先装；ANALYZE/ADJUST全范围理解和至多5条预览；BATCH/REPAIR需已确认计划/绑定及实付回执，才能生成九文件。读取方法、代码与工具顺序由Agent自主决定，独立验证不能被Agent改写。\n\n'+detail)
    nfrs=read(ROOT/'assets/requirements/nonfunctional.v3.2.json')['requirements']
    metrics=read(ROOT/'assets/requirements/quality-metrics.v3.2.json')['metrics']
    body=BASE+'\n## 非功能要求\n\n| ID | 要求 | 状态 |\n| --- | --- | --- |\n'+'\n'.join('| '+x['id']+' | '+x['requirement']+' | NOT_RUN |' for x in nfrs)
    body+='\n\n## 结果与运行数据\n\n结果存储不在任务workspace下面；可靠持久发布后清理所有任务上下文/输入/临时及受控副本。清理器核进程退出、权限撤销、文件实际不存在，结果仍可读。结果正文/投影访问受控，日志正文不得借运营审计保留；只留最小支付/结果/清理凭据。供应商保留与删除据真实合同，不声称未经证实的零留存。\n\n## 质量指标\n\n'
    for q in metrics:body+='- '+q['id']+'：'+q.get('name',q.get('title','质量指标'))+'，具体分母/范围见结构清单，测量NOT_RUN。\n'
    body+='\n[完整NFR](../../assets/requirements/nonfunctional.v3.2.json)、[8指标](../../assets/requirements/quality-metrics.v3.2.json)。'
    md('docs/需求深化/04-非功能安全与运营需求.md','非功能、安全与运营',body)
    cases=read(ROOT/'assets/requirements/exception-cases.v3.2.json')['cases']
    md('docs/需求深化/05-异常恢复与验收场景.md','异常恢复与验收场景',FLOW+'\n\n## 24项原业务异常\n\n| 场景 | 给定/操作 | 预期 |\n| --- | --- | --- |\n'+'\n'.join('| '+x['id']+' '+x['title']+' | '+x['given']+'；'+x['when']+' | '+x['expected']+' |' for x in cases)+'\n\n## 七步故障专项\n\n新增20项工程生命周期计划覆盖初始化/完整预载/上下文容量、确认与报价失效、实付唯一生产、结果持久存储与清理竞态、环境删除后下载、清理重试、不可复活及未付弃置。当前全部NOT_RUN，真机/真实SDK/数据库/文件/进程反例才是产品证据。\n\n[240项开发计划](../../assets/development/v3.0.0/test-plan.json)。')
    body='## 版本与设计兼容\n\n用户明确将流程定为先会话完整预载、确认后估费、实付后批量，产出保存结果并销毁container。业务v3.2/P07-DEV3.0替代v3.1/DEV2，旧资料在docs/背景原样快照。B1.0.0颜色、字形、组件及18页ID保留；首页预加载状态/MP04确认估费/来源原件清理说明属于本版行为细化，不覆写冻结图稿。\n\n## 追踪矩阵\n\n| 需求 | 页面 | API | AC/主测 |\n| --- | --- | --- | --- |\n'
    body+='\n'.join('| '+r['id']+' | '+', '.join(r['page_ids'])+' | '+', '.join(r['api_ids'])+' | '+', '.join(a['id'] for a in r['acceptance_criteria'])+' / '+r['primary_test_id']+' |' for r in req)
    body+='\n\n## 待验证\n\nSDK精确参数/认证、完整技能上下文实际注入与压缩恢复、原生跨任务读写隔离、工作区/会话落盘/缓存全部回收、独立结果持久性和价格/预算均需真实试验。两宿主文件和收银/退款资格延续原待核；未测开关关闭。每次变更同步指针、需求/API/页面/AC/任务/测试与回归，不拿文档检查当产品通过。'
    md('docs/需求深化/06-需求追踪与变更管理.md','需求追踪与变更管理',body)

    # Mini-program contracts keep the visual framework while making entry/confirmation/payment order explicit.
    mini={
        '01-产品形态与功能分层.md':('产品形态与功能分层',BASE+'\n## 用户旅程\n\n'+FLOW+'\n\n有规范与无规范共用同一路径，规范推荐和用户确认都在付款前。普通任务手机完成；不把终端/SDK事件暴露给用户。四根入口整理/任务/规范/我的，普通查看结果不启动Agent。'),
        '02-移动端页面与交互规格.md':('移动端页面与交互规格','## 页面合同\n\n| 页 | 展示/提交守卫 | 恢复 |\n| --- | --- | --- |\n'+'\n'.join('| '+p['page_id']+' '+p['title']+' | '+p['visible_content']+'；'+p['submit_guard']+' | '+p['recovery']+' |' for p in pages)+'\n\n首页初始化中禁用资料入口，失败可重试会话准备。确认页一键明确采用/确认准确版本，随后才进入费用卡；调整回Agent分析，不能继续使用旧quote。批量与分析状态清楚区分。结果页可显示“结果已保存，运行环境清理中/已销毁”；清理状态不影响可靠结果领取。来源页不再承诺原件长期回看。B版式/32组件/18页ID与三锚点继续参照冻结稿。'),
        '03-双平台能力与文件进出.md':('双平台能力与文件进出',BASE+'\n## 独立能力证据\n\n文件选择、上传、后端读取、原生预览和实际用户可见导出分别验证。会话完整READY前不向服务端提交资料；宿主文件选择本地临时句柄不等于后端已接收。临时文件和上传接收副本与session绑定，产出后随环境清理；最终结果下载来自独立结果区。缓存≠实际导出，短链TTL≠结果删除期限。\n\n两端×Android/iOS文件/模板输入、结果领取、前后台与弱网均要真机证明；官方平台材料继承原v3.1复核，当前没有新设备/支付证据，相关开关全部关闭。'),
        '04-账号订单支付与权益.md':('账号订单支付与权益',commerce),
        '05-数据隐私与安全.md':('数据隐私与安全',BASE+'\n## 初始化与授权\n\n客户输入前创建独立会话，完整Skill只来自可信发布版本，附件不是指令。按需告知处理方/资料用途，不把桌面auth/商户/DB秘密给工具。cwd不等于读隔离，原生身份/ACL/网络/进程树实际测试后启用。\n\n## 产出后的清理\n\n九文件独立保存并发布后停止Agent、清会话正文/源/中间物/脚本/缓存/原始日志及受控副本。结果文件及其必要来源投影独立保留，不复制完整原件规避清理。私有规范主动另存去事实；结果/模板删除是用户另行数据管理动作。外部供应商按可验证合同，不承诺未经证明物理零留存。清理失败如实显示待清理并重试。'),
        '06-双端验收与发布清单.md':('双端验收与发布清单',BASE+'\n## 四环境逐一验收\n\n支付宝Android/iOS、抖音Android/iOS均验初始化/完整Skill未就绪禁止提交，资料分析与规范确认在估费前，原渠道实付后批量，九文件独立保存，整个任务环境销毁后下载仍可用。界面保持B组件与可访问性；实际选择/取用/支付/退款独立证据。\n\n仍需G01—G10的主体/类目/域名/隐私、质量标准集、正式资金/对账、恢复/清理/安全、运维与发布证明，不能拿mock/设计图/静态校验替代。目前产品/真机/资金测试均NOT_RUN。'),
        '07-Web进阶版与跨端衔接.md':('Web进阶版与跨端衔接','Web为P1，提供大屏对照/复杂批改等进阶能力，不成为普通手机任务前提。新增Web/API处理任务也必须先建session完整预载，再提交/分析/确认/估费/实付/批量并销毁环境。跨端身份不按昵称/手机号自动合并，结果权限和原平台付费权益分别验证；已保存结果跨端查看不重新开Agent。'),
    }
    for name,(title,body) in mini.items():md('docs/小程序/'+name,title,body)
    body='## 56项自有接口\n\n'+FLOW+'\n\n| ID | 方法与路径 | 业务守卫 |\n| --- | --- | --- |\n'+'\n'.join('| '+o['id']+' | '+o['method']+' '+o['path']+' | '+o['guards']+' |' for o in apis)
    body+='\n\n## 通用约束\n\n服务端owner、写幂等键、expected_version、UTC、精确金额/decimal，统一request_id与错误。鉴权session不等于Agent session；外部不能指定任意thread/服务器路径/命令。API18—20是Task级付费前规范接口，旧Run路径退出当前草案。未知操作查原operation；UNKNOWN支付不新收款。结果读取不依赖Agent存活，下载签名过期可续。\n\n[完整OpenAPI](../../assets/development/v3.0.0/openapi.json)、[状态合同](../../assets/contracts/domain-contract.v3.2.json)。'
    md('docs/小程序/08-接口载荷与状态合同.md','接口载荷与状态合同',body)

    # Developer topics: retain detailed invariants through machine contracts; remove the old contradictory business order.
    dev={
        '01-技术选型与架构决策.md':('技术选型与架构决策',r'''
官方TypeScript `@openai/codex-sdk` 封装真正的资料成表Agent；它自主读写文件、选工具、写运行清洗代码、检查修正。业务服务负责先建session/完整Skill、确认/价格/实付门槛及持久发布/销毁，不替Agent规定固定解析顺序。

目标栈：双原生小程序/共享TypeScript，Node24/Fastify5，PostgreSQL18可靠队列/outbox，Python3.13与文档/OCR库为Agent工具，独立验证器/发布器/清理器。精确SDK/CLI/model/认证/权限/patch实际试验锁定；本地原生Windows，不用Docker/WSL/VM/MXC/Redis。

新增决定：Session先于Task，完整Skill先于任何客户信息；完整分析/规范确认先于报价；原实付先于批量Run；独立结果持久发布先于整个runtime销毁。结果与运行环境不同生命周期，禁止临时工作区承担永久下载。
'''),
        '02-工程结构与本地环境.md':('工程结构与本地环境',r'''
`src/mini-alipay`、`src/mini-douyin`为原生页面；`src/shared`共享纯合同；`src/api`任务/方案/订单/结果；`src/agent`官方SDK、完整Skill装配、bootstrap、会话映射；`src/worker`队列/预算/停止/发布清理；`src/engine/tools`可选读取/代码/OCR；`src/engine/validation`可信独立验收。

`runtime/sessions/<session-id>`存本次Agent/源/上下文/代码/临时数据；`runtime/intake`接收副本强关联同生命周期；`runtime/results/<owner>/<result-id>`独立保留九文件；工具依赖/共享Skill不得被任务清理。结果不能位于session内部或用链接依赖session。

源码/启动脚本和真实工具尚未实现。先做SDK完整Skill上下文/权限/认证/进程清理的原生试验，再做合成双模式真实链路。不改HOME/CODEX_HOME或全局配置，不复制桌面登录凭据。真实依赖/DB/缓存/临时输出遵守本项目路径。
'''),
        '03-数据库设计与迁移.md':('数据库设计与迁移',r'''
参考目录64表：原62表调整会话/任务/预分析/合同关系，新增execution_plans与runtime_cleanup_jobs。Session/workspace可在没有Task/源/Run时初始化；Task创建必须关联已READY且完整预载的session。预分析全范围，旧preflights表名只是内部兼容。SchemaBinding与执行计划在报价前明确，生产Run在原实付后创建。

执行方案保存版本/plan/source/binding/skill hash与确认时间，正文随环境清理，只留必要合同摘要。原子提交九文件独立结果指针及cleanup outbox；cleanup有独立状态/幂等键/回执，结果READY不代表清理成功。关闭后session只剩无正文最小墓碑，不能恢复旧thread。

SQL为未执行参考，必须补真实RLS/GRANT、跨实体owner/task/plan一致性与不可变/状态触发器，并做新库/升级/回退/并发测试。网络/大文件/模型不放长事务；全局领取jobs用SKIP LOCKED，提交核fence/epoch。源/预览/会话/原始工具正文投影必须清除，结果记录/问题/必要来源投影独立保留。
'''),
        '04-API实现与契约.md':('API实现与契约',r'''
56项业务API：新增54创建Agent session/完整预载、55查阶段与证明、56终止清理。03要求ready session，上传/文本接口经Task回查session READY；09进行付费前完整分析；18—20规范接口移到Task，采用不依赖已付Run；10冻结确认计划、11估费、12—14原订单、16只在实付核验后批量。

`Request54`不能带用户文件/goal/text；`Request16`必须有session/contract/order/plan hash，free_grant不是可接受输入。调用55查询得到READY也不能代替服务端在每次写入口检查真实preload receipt。接口schema只验结构，owner、阶段、实付、持久存储与完整Skill上下文须实际验证。

写Idempotency-Key/expected versions，统一错误与operation查询。旧确认/quote或已CLOSED session返回明确阶段/版本错误；客户端success和支付UNKNOWN不授权。所有消费者及P1新增入口复用同一guards，无任意shell/thread/路径代理接口。
'''),
        '05-任务队列与并发恢复.md':('任务队列与并发恢复',r'''
Job类型是BOOTSTRAP、ANALYZE、ADJUST、PAID_BATCH、PUBLISH、CLEANUP等持久意图，Agent内部读取/工具/脚本循环不拆固定业务流水线。Bootstrap先完整装Skill，成功后开放输入。分析与确认/付款等待属于session，付款前没有生产Run。

同session一个active turn，DB租约/fence/epoch决定写权；用户确认/支付等待不占active compute，idle期限另锁定。分析预算平台承担，与已付900秒批量合同预算分离；重试与获准纠错计原合同，未知外部副作用先查原调用。

进行中崩溃恢复同时核thread映射、文件inventory、Skill/源/plan/binding、付款及剩余预算，旧writer必须先中止/撤权。产出后持久提交result+cleanup outbox，清理器停止进程树/清任务上下文，CLOSED不再恢复。复制/提交结果失败不能当产出成功删唯一材料；已存结果的清理重试不重跑Agent或收费。
'''),
        '06-文件解析OCR与整理引擎.md':('Agent文件读取与工具',r'''
S3/ADJUST可全范围读取拟处理资料，自主写分析代码、建索引/提出规范和最多5条小样；无完整九文件正式生产权限。S6/BATCH/REPAIR须核实付/确认计划/source/binding/skill hash，才开放批量候选目录与导出工具。工具相同但phase许可不同，不能只靠提示词标注付费前。

支持文字/TXT/Markdown/CSV/XLSX/DOCX/PDF/JPG/PNG；Python/Node、openpyxl/python-docx/pypdf、页图/OCR是可选能力。Agent可换方法/写受限清洗代码，不能执行上传宏/脚本/抓任意URL或改可信unitizer/validator。SOURCE/TEMPLATE隔离，原值与稳定定位、变换/拆合/覆盖账本保留。

10源/20,000,000单件/50,000,000总源/5,000,000模板/50,000粘贴码点/50单元/50字段/1000候选硬上限。PDF页/独立图单位，DOCX确定4,000码点块且单表行不拆，CSV/XLSX不虚构OCR页；展开/内存/网络/进程树预算真实试验锁定。超限/不可读明确报告，不截前几行标FULL。
'''),
        '07-规范发现与人工决定.md':('规范发现与人工决定',r'''
PROVIDED和DISCOVER均在付款前处理规范。Agent读全部拟处理范围，已有规范则理解/提示歧义，没有则推荐粒度/字段/类型/规则，保留低频关键字段与未映射项。用户明确采用FULL准确版本，再确认执行计划；付款不代替采用。

调整源/目标/字段/粒度/冲突策略创建新plan，旧确认和未付quote失效；UNKNOWN旧单先核事实。规范规则仍用受限AST，不能eval用户代码；Agent自己可写受限清洗脚本。缺失null、冲突待核、默认/派生/人工值有明确依据。

环境在产出后销毁，结果修订需要新session先完整预载，用户选父结果/必要重传原件再提交。计划确认与估费后核新付款或原实付纠错权益，才建child Run，新结果不覆盖旧版；不恢复旧线程上下文。
'''),
        '08-独立验收产物与私有规范.md':('独立验收、持久结果与私有规范',r'''
Agent生成九文件候选：standard.xlsx/json、result.xlsx、accepted.csv、result.json、issues.xlsx、provenance.jsonl、validation.json、manifest.json。规范空白无本次真实源值；result含全部候选和状态/移出依据，accepted仅通过行。准确数值/编码/日期/危险公式保护需要回读；manifest核其他8文件，自身hash由外层返回。

独立验证器核冻结规范、来源/摘录/定位、规则、完整范围/重要信息与候选唯一去向，Agent自评不是通过。反馈可让Agent在已付预算内修候选，不能改标准/验证器或删难行。0候选交诊断不造行。

发布器把九文件复制到独立结果区，按真实存储语义核持久提交、hash/readback及fence/权限，短事务提交Result指针和清理outbox后才销毁整个环境。结果留存及下载不依赖workspace。来源只留结果必要摘录/定位，不暗存全原件。私有规范用户主动保存、去事实/证据/访问引用，独立于任务环境。
'''),
        '09-双小程序与B组件实现.md':('双小程序与B组件实现',r'''
B青绿资料夹1.0.0颜色/字形/间距与32组件/18页ID保留，冻结三页图稿不覆写。首页新增session准备/失败/READY状态，只有READY才能提交；规范页与计划确认在估费/支付前。分析和已付批量进度用真实活动标签/数量，不伪造线性百分比。

MP08/MP12从持久结果服务取用，可显示环境清理状态，下载不重建Agent。MP11只展示结果内证据，完整原件已删除时明确说明。调整结果创建新会话完整预载；原任务切页/断网恢复不重复建单。平台my/tt适配分开，共享纯TS不带宿主SDK；实际文件/收银/导出四环境分别验收。
'''),
        '10-订单支付退款与对账.md':('订单支付退款与对账',commerce),
        '11-安全隐私与删除执行.md':('安全隐私与运行环境销毁',r'''
完整Skill预加载是Host明确装配策略，客户附件/隐藏单元格/控制文件均为不可信资料；不得混进AGENTS/Skill控制路径。受限Windows身份/ACL/Codex文件网络权限与Job Object回收需实证，cwd/workspace-write不构成多租户读隔离。Agent不能拿DB/商户/模型长期秘密、任意网络或发布/清理权限。

任务原件、会话、脚本、OCR、stdout/stderr、分析/预览/checkpoint都可能含正文，跟随整个runtime销毁；不能仅删顶层目录而把会话留在用户全局Codex路径、TEMP、数据库或对象接收区。实际SDK/会话落盘可控性/凭据继承/受控备份副本测试通过后才开放。禁止修改用户全局安全设置或用danger-full-access绕过。

结果九文件/结果投影、独立私有规范和最小订单/清理凭据保留；不存全原件规避清理。发布和清理两个事实分开，清理器核停止/撤权/实际删除，失败幂等重试告警。供应商副本据真实保留删除合同，未证实不宣称零留存；恢复备份先重放销毁墓碑，关闭环境不可复活。
'''),
        '12-测试策略与持续集成.md':('测试策略与持续集成',r'''
240项计划全部NOT_RUN：原126AC/24异常/18NFR/8指标/20工程/24Agent计划按新流程同步，新增20生命周期专项。测试关注真实前置门槛、完整Skill实际上下文、原实付、结果独立持久及整个环境销毁，不只断言目录名/配置boolean。

至少30组人工答案含10无模板；完整输入、字段事实/粒度/来源/范围与重要字段独立标注。真实官方SDK/CLI/model/skill/tool版本与工具/代码事件、质量/耗时/费用、取消/恢复/清理证据封存。mock只能测前端/故障支路，不代表真实Agent或资金通过。

Windows原生CI：文档/schema/OpenAPI/SQL语法 → 单元/合同 → 工具/真DB → 真实Agent/完整Skill/进程/存储/清理 → 双端四环境/正式收银。无容器/WSL/VM/Testcontainers。当前仅运行文档静态核验，不执行产品测试。
'''),
        '13-原生部署监控与故障手册.md':('原生部署监控与故障手册',r'''
原生API/Worker/scheduler/PostgreSQL/私有结果服务；每个会话独立受限工作区和Codex运行映射。锁SDK/CLI/model/Skill/工具/权限/认证/DB/policy，实际bootstrap/停止/存储/清理试验后灰度。数据/依赖/缓存/输出在本项目路径，不启动本地虚拟化。

监控分开记录初始化失败、全范围分析覆盖、确认等待、未付闲置、quote版本冲突、支付未知、单次批量意图、result durability、cleanup lag/failure、进程树残留和已清环境下载。常规日志无正文，关联session/plan/order/run/result/cleanup ID即可。

故障：保存结果失败先保留可恢复材料按合同重试/失败退款；结果已存但清理卡死只重试清理；支付未知查原单，晚付不盲复活环境；CLOSED恢复请求拒绝转新session。备份/缓存策略不无限保存整个运行环境，恢复先销毁墓碑。停新单仍保留原结果/查单/退款/售后。
'''),
        '14-开发任务与交接标准.md':('开发任务与交接标准',r'''
66项任务全部NOT_STARTED：原60项按新需求/56API重映射，新增BOOTSTRAP/ANALYSIS/QUOTE/PAYGATE/PERSIST/DESTROY六专项，归入W02/W04/W10/W06/W09。先证明真实完整Skill先于输入，再做全范围分析/确认/预估/实付批量/持久结果/销毁闭环。

交接需代码、精确版本/配置、真实bootstrap内容清单/hash/上下文证据、原实付与唯一生产意图、结果存储回执、进程/文件/会话/缓存清理凭据及清理后下载证据。真实客户正文不进仓库/公开资产。240计划不是已实现测试；旧85—118人日/10—14周未重估，不承诺工期。
'''),
        '15-配置字典与外部接入清单.md':('配置字典与外部接入清单',r'''
配置新增session_flow：EAGER_FULL、READY前拒输入、FULL_SUBMITTED_SCOPE、最多5条预览、确认后报价/实付后批量、消费者FREE关闭、结果不自动删、发布后销毁环境。结果根runtime/results与session根runtime/sessions分开；接收区副本runtime/intake随session生命周期清理。

bootstrap/analysis compute、调整次数、idle timeout和价格政策未实测时为null，session_flow.enabled=false；启用schema要求有限正值、Agent启用及加载清理证据flag。flag本身不是证据。SDK/CLI/model/auth/权限/outbound精确映射仍需实证，不虚构preloadAllSkills或deleteContainer快捷API。

20项外部接入待核，正式平台商品/文件/退款与四环境能力均关闭。候选分析/闲置参数不会自动成为用户收费或结果删除条款；已确认quote/plan参数不能被全局更新覆盖。
'''),
        '16-Codex-Agent业务封装与运行协议.md':('Codex Agent业务封装与运行协议',r'''
官方Codex SDK提供真正的工具/代码/文件会话能力，Host封装资料成表Agent。SDK基本startThread/run/resume关系按锁定版本适配；工作区、完整上下文注入、流式/取消/认证/落盘参数需核实际类型。App Server实验能力首版关闭，不fork内核或另造固定文件业务流水线。

P07-AGENT-3 phase：BOOTSTRAP无客户输入，完整加载锁定Skill；ANALYZE/ADJUST没有生产Run与候选包权限，完整理解/规范计划/最多5条预览；BATCH/REPAIR有session/task/run和Skill预载、source/plan/binding及服务端实付回执hash才生成候选九文件。

最终信封SESSION_READY/PLAN_READY/RESULT_READY/FAILED只是Agent不可信输出，Host核phase、实际预载内容、归属/范围/付款、文件/hash与独立验收。Agent不得自报付款、确认、价格、发布或销毁成功。上下文压缩/恢复需重附完整Skill与当前控制事实。

原生产Run WAITING_SCHEMA路径退出；采用/确认在付款前的session完成。结果发布后销毁整个环境，新加工新session完整加载。SDK不会被假定有一条close即可擦除所有日志/文件/供应商副本，Host清理器负责实际证据。

[官方SDK](https://learn.chatgpt.com/docs/codex-sdk)、[Skill默认加载](https://learn.chatgpt.com/docs/build-skills)、[非交互执行](https://learn.chatgpt.com/docs/non-interactive-mode)。
'''),
        '17-改版差异与官方能力核对.md':('改版差异与官方能力核对',r'''
本版是用户明确的业务流程变更：先会话完整技能后输入，付费前完整分析/规范采用/用户确认，确认后估费，实付后批量，保存结果后销毁整个runtime且结果不删。取代DEV2先付费发现后采用、局部3单元预检主路径、等待规范生产Run、消费者free_grant和7天删结果候选。

官方Skill默认逐步加载，因此本版完整预载是Host额外明确装配/校验策略，不是注册技能就自动完成；真实SDK注入/上下文上限/压缩继续/权限/清理/数据政策仍待试验。只读CLI帮助和官方查阅不是集成、零留存或生产就绪证明。

v3.1业务与DEV2清单逐字节核对后归档152文件；B冻结图稿和早期v3.0、DEV1快照保留。当前42功能/126AC、56API、64参考表、66未开工任务、240未执行测试；19篇开发文档。所有生成器/入口按active版本保护，避免旧脚本写回旧流程。
'''),
    }
    for name,(title,body) in dev.items():
        md('docs/开发/'+name,title,FLOW+'\n\n'+body+'\n\n[统一七步细则](18-统一七步流程与Session生命周期.md)。')

    readme=FLOW+'\n\n'+BASE+'\n## 当前文档\n\n| 专题 | 内容 |\n| --- | --- |\n'
    for name,(title,_) in dev.items():readme+='| ['+title+']('+name+') | 当前实现合同，未实施 |\n'
    readme+='| [18 统一七步与销毁](18-统一七步流程与Session生命周期.md) | 全部用户任务唯一正常流程 |\n'
    readme+=r'''

## 结构工件与执行状态

资源在[当前开发指针](../../assets/development/active.json)与v3.0.0目录：[七步合同](../../assets/development/v3.0.0/workflow.contract.json)、[完整预载合同](../../assets/development/v3.0.0/skill-preload.contract.json)、[Skill完整包](../../assets/development/v3.0.0/skill/manifest.json)、[环境销毁合同](../../assets/development/v3.0.0/cleanup.contract.json)、[Agent运行](../../assets/development/v3.0.0/agent-runtime.contract.json)/[工具](../../assets/development/v3.0.0/agent-tools.contract.json)/[输入](../../assets/development/v3.0.0/agent-input.schema.json)/[完成](../../assets/development/v3.0.0/agent-completion.schema.json)与[示例](../../assets/development/v3.0.0/agent-contract-examples.json)。

[OpenAPI56项](../../assets/development/v3.0.0/openapi.json)、[传输端点](../../assets/development/v3.0.0/transport.openapi.json)、[领域schema](../../assets/development/v3.0.0/domain.schema.json)/[正反例](../../assets/development/v3.0.0/contract-examples.json)、[参考DDL](../../assets/development/v3.0.0/schema-reference.sql)/[64表目录](../../assets/development/v3.0.0/database-catalog.json)、[配置](../../assets/development/v3.0.0/config.example.json)/[schema](../../assets/development/v3.0.0/config.schema.json)、[产物schema](../../assets/development/v3.0.0/artifact-manifest.schema.json)、[页面映射](../../assets/development/v3.0.0/ui-implementation-map.json)、[66任务](../../assets/development/v3.0.0/backlog.json)、[240测试计划](../../assets/development/v3.0.0/test-plan.json)及[接入清单](../../assets/development/v3.0.0/integration-register.json)均为设计。

旧资料[152文件快照](../背景/v3.1与开发v2.0-会话流程调整前/snapshot-manifest.json)保留。软件、SDK完整加载、运行清理、真实存储/DB/平台/付款测试均未执行。[静态报告](../评审/P07-七步会话流程-v3.2-核验-2026-10-27.md)只验文档与合同。运行scripts/verify_development_docs.py或verify_requirements_baseline.py进入当前版本核验；封存/打包使用seal_session_first_baseline.py和package_session_first_docs.py。
'''
    md('docs/开发/README.md','完整开发文档：先会话与完整Skill的七步流程',readme)
    reqindex=FLOW+'\n\n'+BASE+'\n## 需求入口\n\n'
    for name,label in [('01-产品需求PRD.md','产品目标'),('02-功能需求与用户流程.md','42功能与126AC'),('03-架构数据与接口.md','系统与接口'),('04-计费交易与运营.md','确认/预估/实付及留存'),('05-验收测试与实施计划.md','验收与实施')]:reqindex+='- ['+label+'](../'+name+')。\n'
    reqindex+='\n## 深化专题\n\n'
    for p in sorted((ROOT/'docs/需求深化').glob('0*.md')):reqindex+='- ['+p.stem+']('+p.name+')。\n'
    reqindex+='\n## 双端专项\n\n'
    for p in sorted((ROOT/'docs/小程序').glob('*.md')):reqindex+='- ['+p.stem+'](../小程序/'+p.name+')。\n'
    reqindex+='\n## 机器入口与留存\n\n[当前需求指针](../../assets/requirements/active.json)、[42需求](../../assets/requirements/requirements.v3.2.json)、[追踪](../../assets/requirements/traceability.v3.2.json)、[页合同](../../assets/requirements/pages.v3.2.json)、[24规则](../../assets/requirements/business-rules.v3.2.json)、[56API](../../assets/contracts/api-catalog.v3.2.json)、[状态](../../assets/contracts/domain-contract.v3.2.json)、[流程](../../assets/flows/mini-program-flows.v3.2.json)。B冻结基线不覆写；v3.1/DEV2已原样归档。所有产品测试NOT_RUN。'
    md('docs/需求深化/README.md','完整需求文档索引',reqindex)
    md('docs/实施/小程序优先开发任务与里程碑.md','小程序优先开发任务与里程碑',FLOW+'\n\n'+BASE+'\n## 工作包\n\nW01 SDK/平台/价格与数据政策试验；W02 session先建/完整预载/DB/队列；W03上传/计量/工具；W04付费前分析与规范/计划确认；W05已付批量清洗；W06独立验证/持久结果/outbox；W07双端B页面；W08宿主输入/结果实际导出；W09整个任务环境清理与私有规范；W10确认估费/实付/退款/对账；W11质量/七步/清理后下载/四环境；W12原生运维/审核/灰度。\n\n66项任务/240项测试均未执行。旧85—118人日/10—14周未经本版重估，仅历史参考；M0真实SDK/完整Skill/权限/计费/清理可行性后重估，不因文档更新而扣开发工时。')
    md('README.md','表格修复站',FLOW+'\n\n'+BASE+'\n唯一工作根目录：`E:\\dev\\sandbox\\支付宝黑客松\\表格修复站`。\n\n先读[统一七步流程](docs/需求深化/07-统一七步流程与Session生命周期.md)、[完整需求](docs/需求深化/README.md)及[开发文档](docs/开发/README.md)。\n\n当前业务v3.2、开发3.0.0，42功能/126AC、56API、64参考表、66未开工任务、240未执行测试、18页/32组件。结果文件独立保存；任务运行环境产出后整体销毁。本次是文档/合同更新，真实软件、完整技能加载、付款/批量/环境清理仍未实现。\n\n[B设计定型](docs/设计定型/B-青绿资料夹-v1.0.0/README.md)、[旧版原样快照](docs/背景/v3.1与开发v2.0-会话流程调整前/snapshot-manifest.json)、[当前需求指针](assets/requirements/active.json)、[当前开发指针](assets/development/active.json)。')
    write('AGENTS.md',r'''
# 表格修复站工作约定

- 唯一项目工作根目录E:\dev\sandbox\支付宝黑客松\表格修复站。所有项目命令/源码/文档/依赖/运行数据均在此目录。本地严禁Docker、WSL、VM、MXC等虚拟化；浏览器使用后关闭本次不用标签。
- 当前业务v3.2，开发P07-DEV 3.0.0。先读docs/需求深化/07-统一七步流程与Session生命周期.md和docs/开发/README.md及active指针。用户明确所有处理任务：S1先创建session并完整预载Skill→S2提交→S3 Agent分析→S4用户确认/调整→S5估费→S6实付后批量→S7独立保存结果、释放Agent并销毁整个任务container。结果文件不删除。
- READY/完整Skill正文、全部references/工具脚本内容装配校验成功前不接收客户文字/目标/模板/文件。仅元数据发现/磁盘存在/模型echo不算完整预载；缺件/超上下文不降级懒加载。当前skill包是产品设计资源，未安装或实际运行。
- 官方TypeScript Codex SDK为资料成表Agent内核，所有资料读取/分析/清洗/规范推荐/成表由Agent自主选工具/写运行受限代码。Python/OCR/文档库是工具，不恢复固定解析模型流水线。确认/价格/资金/独立验收/发布/清理由可信业务Host负责。
- PROVIDED与DISCOVER均在报价前全范围分析、规范采用与执行方案确认；调整回分析/确认，旧确认与未付quote失效。正常消费者free_grant不能绕实付，客户端success/UNKNOWN不放行批量。付费Run在实付后创建，不使用WAITING_SCHEMA主路径。
- 运行区runtime/sessions与独立结果区runtime/results不同生命周期。九文件复制/readback/hash/真实持久提交并原子发布result+cleanup outbox后，停止Agent/工具进程树、撤权、清完整源/会话正文/脚本/中间/OCR/缓存/临时/正文日志/检查点及受控副本。清理失败如实重试告警；结果与其必要投影、私有规范、最小订单/清理凭据独立保留。不删全项目runtime、共享Skill、依赖或其他任务。
- container在当前本地实现为原生隔离运行环境，不代表允许调Docker/WSL。只设cwd/workspace-write不算租户读隔离；不得danger-full-access/复制桌面auth/泄漏DB或商户秘密。SDK权限/认证/上下文/会话落盘/清理效果须实际试验。
- CLOSED环境不复活；再次加工新session完整预载，用户选父结果/必要重传源，重新确认估费/核实实付权益。原结果不可变，child Run不覆盖父版。查看已存结果不新建Agent或重复收费；原件已清理时不能伪造原件在线查看。
- P0支付宝、抖音原生小程序；Web/API为P1且未来同样遵循七步。B青绿资料夹1.0.0冻结图稿/文档/清单不覆写，18页/32组件保留，当前行为细化另在v3.2记录。无证据的四环境/收银/文件能力及Agent默认关闭。
- 当前42功能/126AC/24BR/18NFR/8指标/24异常/56API。v3.1与DEV2原样归档152文件；B/v3.0/DEV1与旧ZIP留存。SQL/OpenAPI/Skill/脚本生成器是设计工件，软件/真实SDK/资金/清理/设备均未实现验证；不把文档静态PASS写作产品PASS。
- 更新运行scripts/verify_requirements_baseline.py和scripts/verify_development_docs.py（均按active路由当前核验）；封存seal_session_first_baseline.py、打包package_session_first_docs.py。旧生成/封存脚本版本保护，禁止写回旧流程。报价/分析/闲置预算实测锁定，旧7天删结果候选不生效。
''')
    print('Updated current root, five main, eight mini-program, seven deep, 19 development and implementation docs for the universal seven-step flow.')


if __name__=='__main__':
    main()
    from expand_session_first_engineering import main as expand_engineering
    expand_engineering()
