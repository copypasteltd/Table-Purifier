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
