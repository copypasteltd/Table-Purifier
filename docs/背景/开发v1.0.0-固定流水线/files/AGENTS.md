# 表格修复站工作约定

- 继承上级AGENTS.md。唯一工作根目录为 `E:\dev\sandbox\支付宝黑客松\表格修复站`，本项目命令使用该目录；跨项目索引维护除外。
- 当前需求基线v3.1：支付宝、抖音小程序均为P0，Web为P1。有规范按规范整理、无规范由系统分析推荐并采用后整理均为P0；不能因缺模板拦截。5份主文档在docs根，双端专项在docs/小程序，实施与取证分别在docs/实施和docs/资料。
- 主需求42项（38项P0/4项P1）；源码目录只预留，未实现、未验收。docs/背景为历史，不拿旧网页优先或消费者Machine Pay默认收银设计覆盖v3.1。
- 代码按src/mini-alipay、src/mini-douyin、src/shared、src/api、src/engine及P1的src/web分工。普通手机任务不依赖Web；平台身份/文件/支付/隐私分别适配、真机验证，不能用web-view套页算完整原生双端。
- 资料和规范角色分开，草案和已采用版本分开；不能删列/放宽规则制造通过。规范样例不成为事实，缺项/冲突不编造，保留来源和拆合关系。保存私有规范需去掉真实源值/证据/访问引用，独立留存不默认公开。
- 区分后端解析、宿主选择、上传、内嵌/原生预览及实际导出；缓存成功不能写成已存用户可见文件。所有能力默认待核，四环境证据支持后开放，不编造宿主API。抖音iOS两个官方入口本轮已一致，但目标app/SKU/OS、支付开通与服务期限政策未验证时收费关闭，不外跳绕收银。
- P0消费者支付按各平台获准通道；Machine Pay/A402开放API为P1。SDK/商户/类目、异步及退款真实契约待核；普通支付不自动代表赛事AI付认可。不按昵称/手机号自动合并两端身份或承诺付费权益通用。
- 真实源、规范、解析/OCR、结果、数据库、下载、日志、临时和缓存放本项目runtime，不在公共assets中放客户内容或商户秘密。合成设计资产不是测试PASS。
- 严禁本地Docker、WSL、虚拟机等虚拟化；使用Windows原生工具。浏览器调用后关闭本次已不用标签。目录/文档建立不代表产品实现，不伪报质量/流水/审核结果。

- 当前视觉基线为用户选定B「青绿资料夹」，P07-DS-B 1.0.0。先读assets/design/active.json及docs/设计定型/B-青绿资料夹-v1.0.0/README.md，按tokens、组件与18页规则实施；不以五方向历史中的A建议覆盖B。冻结图稿/文档/清单不覆写，调整需新增版本并更新active；3页图像不代表18页已绘制或产品已实现。

- 当前需求入口docs/需求深化/README.md，机器指针assets/requirements/active.json；42需求/126AC、24BR、18NFR/8指标、18页、53API草案、24异常需双向维护。v3.0在docs/背景原样快照，B1.0.0冻结资产不覆写，兼容细化见v3.1追踪说明。
- 执行Run终态不可逆，数据修订创建子Run/新结果；决定提交同批次只预留一轮，成功发布才消耗，平台纠错/永久失败不扣。待评估NOT_EVALUATED不能写通过；设备缓存不是系统导出。
- 24小时/两轮/7天及性能/清理/恢复数字为待验证候选政策或预算，须与获准SKU及实际环境一致才启用；文档结构检查不算产品测试。更新后运行scripts/verify_requirements_baseline.py并复核B留存。

- 当前开发文档入口docs/开发/README.md，机器指针assets/development/active.json，工程基线P07-DEV 1.0.0。实施先读对应专题与结构化工件；Node24/Fastify5/PostgreSQL18/Python3.13为目标栈，精确patch/原生SDK/供应商须试验锁定，不用Docker/WSL/Redis作为P0依赖。
- 开发参考DDL/OpenAPI/配置不是应用代码或已执行迁移；正式迁移必须补RLS/GRANT及真实数据库验证。收费及未核四环境能力默认关闭，PROVIDED在范围确认绑定、DISCOVER在全范围采用绑定；免费grant不制造金额/支付流水。
- 开发资料更新运行scripts/verify_development_docs.py并核原需求/B留存；哈希封存见scripts/seal_development_baseline.py，原导航与需求manifest已备份，勿覆盖provenance。文档静态核验不作真机、内容质量、资金或恢复测试PASS。
