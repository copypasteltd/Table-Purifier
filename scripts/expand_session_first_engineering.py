"""Carry reviewed, still-applicable engineering details into the current seven-step topics."""
from __future__ import annotations

import re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OLD=ROOT/'docs/背景/v3.1与开发v2.0-会话流程调整前/files/docs/开发'
MARKER='\n## 实施细则\n'


def main():
    keep={
        '01-技术选型与架构决策.md':['技术栈与职责','SDK、CLI 与 App Server 的选择'],
        '02-工程结构与本地环境.md':['项目结构','原生环境实施顺序'],
        '03-数据库设计与迁移.md':['数据模型与边界','通用字段与约束','关键索引与唯一性','RLS 与权限','迁移、删除与恢复'],
        '04-API实现与契约.md':['鉴权与信任边界','请求、响应和操作','幂等与版本','上传与下载的传输协议','版本化分页与缓存','数值与规范化 hash'],
        '05-任务队列与并发恢复.md':['租约、预算与提交','双重检查点'],
        '06-文件解析OCR与整理引擎.md':['可调用能力','接收防护与单位计量','脚本执行与证据','Agent 自查与独立验收'],
        '07-规范发现与人工决定.md':['无模板发现算法','问题决定协议'],
        '08-独立验收产物与私有规范.md':['独立验证器','九文件明确结构','原子发布协议','私有规范另存与复用'],
        '09-双小程序与B组件实现.md':['原生工程与共享边界','路由、页面与数据','B 设计的工程化','真机与交付证据'],
        '10-订单支付退款与对账.md':['上线资格与金额','乱序、晚到与付款历史','退款原子额度与未知结果','对账和履约补偿','必须完成的真实测试'],
        '11-安全隐私与删除执行.md':['原生权限边界','资料不是指令','认证、秘密与网络','日志、客户端与客服'],
        '12-测试策略与持续集成.md':['分层验证','黄金资料集与质量','原生 CI 与发布门槛'],
        '13-原生部署监控与故障手册.md':['原生拓扑','发布与回退','监控','故障卡'],
        '14-开发任务与交接标准.md':['交接完成定义'],
        '15-配置字典与外部接入清单.md':['必须关闭的外部依赖','更新与版本'],
        '16-Codex-Agent业务封装与运行协议.md':['官方 SDK 接缝'],
    }
    extras={
        '02-工程结构与本地环境.md':r'''
### 每任务原生工作区

```text
runtime/sessions/<server-session-id>/
  control/    只读Skill/完成schema/本阶段许可与不可变控制事实
  inputs/     READY后接收的SOURCE与TEMPLATE只读视图
  parent/     新加工会话中用户明确选择的父结果只读快照
  work/       Agent分析/清洗代码、解析索引和中间物
  proposal/   待确认规范/执行方案/至多5条预览
  candidate/  实付后才允许完整九文件候选
  session/    本次Codex落盘上下文/工具轨迹/检查点
runtime/intake/<server-session-id>/  接收与隔离副本，同步清理
runtime/results/<owner>/<result-id>/  独立持久结果，不在session子树
```

Task创建前工作区可以只有受信任控制资源。完整Skill正文/引用/脚本装配成功并完成bootstrap后才收客户信息。所有路径由Host生成；独立结果不能依靠到工作区的软链/硬链/挂载才能存活。共享依赖、共享Skill发布包及其他会话不属于本任务清理范围。
''',
        '03-数据库设计与迁移.md':r'''
### 当前必须实现的短事务

| 动作 | 前置与锁 | 同提交的事实 |
| --- | --- | --- |
| 初始化 | owner/请求幂等，先登记session/workspace | bootstrap job；没有客户资料和Task |
| 开放输入 | 当前fence、完整Skill/context/tool/bootstrap回执 | session READY及单次接收权限 |
| 创建Task | owner session为READY且证明匹配版本 | Task.agent_session_id、INPUT_RECEIVED；禁止复用到第二任务 |
| 采用规范 | task/plan/proposal/source/goal版本，FULL | immutable binding；不建Run、不执行批量 |
| 确认计划 | task/plan/binding版本与用户明确选择 | CONFIRMED plan、contract、确认事件，之后才可quote |
| 实付入账 | 锁原order，正式验签/查单事实 | ledger/event去重、CONFIRMED、原实付许可、outbox |
| 批量开始 | task/contract/实付许可/预算，无关闭清理 | 唯一root或获准child Run、job、fence |
| 发布 | 独立结果全部持久可读，当前run/epoch/fence | result/current、九文件READY、Run成功、履约及cleanup outbox |
| 销毁完成 | 进程终止、撤权和全部受控临时正文确已清除 | cleanup SUCCEEDED、session CLOSED、最小回执，结果保持 |

DRAFT plan.binding_id可以为空；CONFIRMED必须非空且有confirmed_at。processing_contracts必须引用准确confirmed_plan和binding。复合owner外键仍不足以证明同task/版本/阶段，须应用事务校验。统一锁顺序account→session/task→contract/order→run→operation/reservation→result/artifact；cleanup也遵守顺序。

没有真实用户部署旧数据库，本DDL是新草案；后续若已有数据，须把nullable→回填→约束切换拆为真实迁移。result artifact expires_at固定NULL，grant.expires_at仍是短链期限。临时源/会话正文不进长期备份；恢复不得复活已清理上下文，独立结果和最小财务/清理凭据按独立策略备份。
''',
        '04-API实现与契约.md':r'''
### 修订、规范和付款的当前语义

API20先采用当前FULL规范，API10再明确确认plan/source/binding/skill；两种模式均如此。可以由一个用户确认动作顺序调用两个幂等操作，失败时找回原操作。API11仅PAID/UNAVAILABLE，没有消费者FREE分支；API16只消费服务端核实的原实付许可。

API25仅登记新会话修订意图；不能在旧已销毁环境中立即生成child Run。新会话完整预载后，才提交已选父结果与必要原件，经过分析/确认/估费/核实实付权益再创建child Run。API24如果读取已有结果计算确定性决定预览，无Agent则不创建会话；需要Agent读取或语义分析的请求必须先走S1。

API54—56的200响应也只表示返回对应状态；INITIALIZING或cleanup PENDING都不是实际完成。所有资料写入口要在服务端复核READY证明，不信任客户端先读55所得状态。原件清理后API23只提供结果内必要摘录/定位，原件页不存在应明确返回限制，不能签回已删除对象。
''',
        '05-任务队列与并发恢复.md':r'''
### 阶段作业与清理故障

BOOTSTRAP/ANALYZE/ADJUST的限时/调用/轮数/idle参数在真实SDK试验后锁定，默认未配置时不开会话。确认/付款等待保留有限会话数据但不占计算租约。不能把预付分析预算记入之后用户实付费用。

| 故障边界 | 恢复方式 |
| --- | --- |
| 初始化缺Skill/hash/上下文容量 | 初始化失败；不收输入，停止清已分配环境 |
| 分析中断 | 仅同未关闭session恢复，重附完整Skill和准确输入版本 |
| 付款UNKNOWN | 查原单，不新收、不启动批量、不假定未付 |
| 已实付而环境已清 | 不复活旧环境；按原单进入新session/必要重传或原路退款 |
| 复制结果或持久提交失败 | 不标产出成功，不删唯一可恢复候选；有界重试后履约失败处置 |
| 发布提交成功而清理前崩溃 | cleanup outbox可靠重放，无需重新生产或收费 |
| 进程/文件占用导致清理失败 | cleanup FAILED/PENDING重试告警；结果继续授权访问 |

检查点/脚本/原始工具输出与会话正文一起清理；CLOSED仅留无正文墓碑，不再有可恢复检查点。不要以SDK的一次close调用代替进程树/临时文件/受控副本的实际回收。
''',
        '08-独立验收产物与私有规范.md':r'''
### 持久存储与销毁边界

所有九文件必须复制至独立结果区并逐项hash/readback，后端实际持久提交回执成功后再原子发布。仅rename成功、Promise返回、写入OS缓存或把源工作区路径存入DB都不足以证明结果已可靠保存。最终manifest的expires_at为null；下载grant另有短期expiry。

发布事务同时写cleanup outbox，之后Host fence运行环境、停止Agent和工具进程树、撤task读写凭据，清所有本次原件/接收副本/会话/分析/代码/中间/临时/原始日志/检查点及受控spill。核无活writer和残留受控数据后才能标CLOSED。结果记录/问题/必要来源投影存独立生命周期，不能外键级联删掉它们。

来源文件已清理后，结果内的必要摘录与定位仍能解释字段；不能保留整份原件伪装provenance。结果权限校owner，链接到期重新签发；清理不能撤掉正常结果下载。0候选/诊断包按明确服务政策处理，不能冒充正常成表成功；已有持久诊断文件同样与运行区分离。
''',
        '11-安全隐私与删除执行.md':r'''
### 可信清理器验收

删除目标由服务端session/workspace登记派生，解析绝对路径后必须严格位于本任务受控根；遇junction/symlink/重解析点不得递归到结果、共享依赖或其他任务。清理用单一原生实现，禁止跨shell拼接递归删除。先fence/停进程/撤权再删，失败留安全错误码和重试事实，不留正文日志解释。

SDK会话落盘、stdout/stderr、工具临时目录和临时环境变量的精确位置须实际试验；不能声称cwd覆盖全部输出。生产启动须限定任务TEMP/输出路径和服务权限，且枚举受控副本。供应商保留仅据经核合同处理，本地销毁不能被描述为无依据的供应商物理零留存。

结果文件/结果投影、主动另存的去事实私有规范及最小订单/清理回执保留；正文日志/完整会话/源/提案和工具输出不可借审计无限留存。清理后的新加工必须新会话和用户新输入，不能从旧备份偷偷恢复原件。
''',
        '15-配置字典与外部接入清单.md':r'''
### 新流程配置

| 分组 | 值与启用条件 |
| --- | --- |
| session_flow.enabled | 默认false；真实预载/清理/结果存续证据及所有必需预算齐备才可启用 |
| skill_loading_strategy | 固定EAGER_FULL；manifest完整资源内容/hash进入可信上下文 |
| accept_input_only_after_ready | 固定true；不能由UI状态代替服务端guard |
| analysis_scope/preview_records_max | FULL_SUBMITTED_SCOPE / 5，分析范围与展示样本分开 |
| require_confirmed_plan_before_quote | 固定true，所有plan/source/binding/skill版本锁定 |
| require_confirmed_payment_before_batch | 固定true，consumer free_grant固定false |
| result_auto_delete | 固定false，结果独立持久保留 |
| destroy_runtime_after_result_persistence | 固定true，实际持久发布后触发整个运行区清理 |
| bootstrap/analysis/adjustment/idle limits | 默认null，原生实测后配置正值；不得静默无限调用 |
| paths | sessions/intake/results分开，且结果根不在任务工作区下 |

JSON Schema只证明结构；preload_and_cleanup_tests_verified布尔值不是证据。发布控制还要核测试记录、锁定SDK/CLI/model/权限版本和真实清理/下载事实。商户/模型认证只配置服务端secret reference，不写assets，不给Agent通用网络/全局系统权限。
''',
        '16-Codex-Agent业务封装与运行协议.md':r'''
### Host Adapter与阶段封装

应用接口createSession/prepareFullSkill/submitInput/analyze/adjust/confirmPlan/quote/startPaidBatch/persistResult/destroyRuntime是我们自己的Host抽象，不能当作SDK原生方法。`startThread/run/resumeThread`的参数、事件、取消、上下文注入、会话落盘按固定版本实际适配。完整预加载是产品策略，不能用默认渐进加载替代。

| 阶段 | 资料/输出/权限 |
| --- | --- |
| BOOTSTRAP | task/run/input皆空；全Skill资源真实装配，工具/权限/认证就绪；无客户内容 |
| ANALYZE/ADJUST | 有Task/源和preload回执，无Run；全范围分析、规范/计划、最多5条小样；批量导出关闭 |
| BATCH/REPAIR | 有Run、准确确认计划/源/绑定及服务端实付回执；预算内生成九文件候选 |
| PUBLISH/CLEANUP | 由Host独立验证/保存/发布/停止/清理；Agent无这些可信写权限 |

输入phase/许可必须在工具和文件访问层执行，不能只依赖提示词。技能正文、全部references、受信任工具脚本和说明按发布清单读取/hash/装入实际上下文，失败阻断READY；模型echo hash不足以证明。上下文压缩/进行中恢复后继续客户turn前重附同一完整版本；放不下则初始化或恢复失败，不截断或懒加载。

PLAN_READY必须说明FULL分析范围、准确plan及有界预览且无正式候选包；RESULT_READY必须九文件齐全但只是Agent声明，Host仍独立验收。最终可信持久发布后整个运行环境清除，不能用旧thread继续回复用户或修订结果。当前全部是合同/设计资源，真实SDK/工具程序未实现。
''',
    }
    for name,titles in keep.items():
        old=(OLD/name).read_text(encoding='utf-8')
        sections={'## '+part.split('\n',1)[0]:'## '+part for part in re.split(r'(?m)^## ',old)[1:]}
        chunks=[sections['## '+title] for title in titles]
        detail='\n\n'.join(chunks)
        detail=detail.replace('development/v2.0.0/','development/v3.0.0/').replace('examples/v3.1/','examples/v3.2/')
        detail=detail.replace('P07-DEV 2.0.0','P07-DEV 3.0.0').replace('56 业务参考表 + 6 会话运行参考表','64 个参考表（含执行计划与运行清理）')
        detail=detail.replace('53 业务 API','56 业务 API').replace('62 个参考表','64 个参考表')
        # Reviewed obsolete paragraphs are removed rather than mixed into the current contract.
        paras=detail.split('\n\n')
        paras=[p for p in paras if not (p.startswith('PROVIDED 的 API07/08') or p.startswith('API11 的 access_mode') or p.startswith('24 小时/两轮/7 天为候选政策'))]
        detail='\n\n'.join(paras)
        detail=detail.replace('异步预检、规范调整','异步完整分析、规范调整')
        detail=detail.replace('预检最多 3 个单元做语义分析；其 Agent 工作区只提供允许的预览内容，不能把全源只读挂载后仅靠提示限制。',
            '付费前完整分析拟处理的全部范围，最多展示5条代表预览；分析与批量预算分开，完整批量导出由工具/目录权限限制，不能只靠提示词。')
        detail=detail.replace('原有 196 计划覆盖 126 AC、24 异常、18 NFR、8 指标与 20 工程边界；新增 24 项真实 Agent 边界，合计 220。不是已编写并执行的 220 个测试。',
            '240项计划覆盖126 AC、24异常、18 NFR、8指标、工程/Agent边界及新增20项七步生命周期专项。它们均未编写执行，不是240个已通过测试。')
        detail=detail.replace('有规范样例验证 API10 的 immutable binding；无规范样例验证全范围提案、稀有重要字段、API20 采用暂停/恢复。人工决定生成新 child Run/thread，父结果不变。',
            '两种模式都验证API20采用准确规范和API10确认执行方案先于估费/实付；无规范验证全范围提案与稀有重要字段。结果加工先新session完整预载、提交所选父结果/必要原件、分析确认估费并核实实付权益，再生成child Run/thread，父结果不变。')
        detail=detail.replace('900 秒为同合同累计 active compute 上限','900 秒为实付后同合同批量生产累计 active compute 上限')
        detail=detail.replace('仅保留必要 token/资源 ID','仅保留必要 token/资源 ID')
        detail=detail.replace('outbox DELIVERABLE。','outbox DELIVERABLE及cleanup outbox。')
        detail=detail.replace('大小/到期/内容版本一致','大小/持久保留策略/内容版本一致')
        detail=detail.replace('源/goal/contract/binding hash','源/goal/contract/binding hash')
        detail=detail.replace('expiry | 不自包含自身 hash','expiry（固定null） | 不自包含自身 hash')
        if name.startswith('04-'):
            detail=detail.replace('依据页由 API23 按授权按需签同一下载网关的 EVIDENCE_PAGE grant，严格绑定 evidence/source_unit/result；它不授予原始对象目录访问。产物 grant 与依据页 grant 用途互斥，来源到期/删除一样撤权。不可用页返回明确限制和可保留摘录，不发公开原图链接。',
                'API23返回结果内必要依据摘录/定位；原件已随环境清理时不能签原件页。仅有明确作为结果保存的证据页对象才可签EVIDENCE_PAGE grant，不能保留隐藏的完整原始文件。最终产物与证据grant用途互斥，均按owner/result校验。')
        if name.startswith('03-'):
            detail+='\n\nartifact_sets.expires_at固定NULL，临时对象回收不得作用于已持久结果。按持久结果、最小凭据、临时运行正文分别实施保留/清理；正文不进长期备份，CLOSED后不能从备份重建处理环境。\n'
        detail+=extras.get(name,'')
        path=ROOT/'docs/开发'/name; current=path.read_text(encoding='utf-8').split(MARKER,1)[0]
        path.write_text(current.rstrip()+MARKER+'\n'+detail.strip()+'\n',encoding='utf-8')
    # Add concrete failure/release requirements to the new lifecycle and changed visual behavior.
    for name,body in {
        '09-双小程序与B组件实现.md':'### 七步界面状态\n\nMP01准备中→READY前禁用输入；MP05区分免费前置分析与已付批量；MP06采用/确认；MP04仅确认后估费支付；MP08/12只读独立结果；MP17显示清理事实。B框架中的任务/规范/我的查看动作不创建Agent；新处理入口、再次整理和P1调用均先session。清理失败不误标结果失败，结果已保存但环境清理中必须可区分。',
        '12-测试策略与持续集成.md':'### 当前新增20项生命周期计划\n\n240计划全部NOT_RUN。新增用例要求真实SDK上下文/工具许可、未READY禁提交、调整废弃旧确认/quote、UNKNOWN拒批量、唯一生产、保存失败不得删唯一材料、原子发布清理、进程/副本回收、CLOSED拒恢复及清理后下载。静态Schema或mock只能作前置检查，不能提交为真实运行证据。',
        '13-原生部署监控与故障手册.md':'### 独立结果与清理值守\n\n部署结果区与会话区分别授权/备份；关闭新会话不停止原支付查单、下载、退款及清理worker。监控初始化失败率、Skill版本/hash、分析预算、等待idle、未决支付、持久发布延迟、清理积压/失败、孤儿进程/对象和清理后下载失败。清理错误先按session排查fence/进程/受控目录，不删除整个runtime根。备份恢复重放清理墓碑并确认无旧正文复活，再开放下载和任务入口。',
        '14-开发任务与交接标准.md':'### 当前顺序与验收输出\n\n先用合成资料实证原生SDK完整预载/跨任务隔离/进程树回收与独立结果，再实现session/全范围分析/确认方案、可信quote/原渠道实付批量、九文件持久发布+cleanup outbox、结果只读和新会话修订，最后双宿主四环境与对账。66项任务中P1继续PARKED，不能提前标完成。任何交接须列源码commit/锁版本/迁移/真实脱敏轨迹/30组黄金集及反例；文档静态PASS只作资料完整性证据。',
        '17-改版差异与官方能力核对.md':'### 现行版本边界\n\n业务v3.2/API56，开发3.0.0/64参考表/66任务/240计划；18页32组件和B图稿冻结。旧152文件原样快照为历史，不参与当前流程判定。官方默认Skill渐进加载；完整预载是用户指定的Host策略，尚无真实SDK上下文/清理证据。消费者必须原实付；平台纠错可验证原实付覆盖，不能宣称FREE绕过。结果不随runtime、idle或短链到期而删除。'
    }.items():
        p=ROOT/'docs/开发'/name
        with p.open('a',encoding='utf-8') as f:f.write('\n'+body+'\n')


if __name__=='__main__':
    main()
