export interface paths {
    "/v1/p07/auth/platform-sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 平台凭据换会话
         * @description 凭据重放/过期拒绝
         */
        post: operations["P07-API01"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/capabilities": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 核定能力与动作
         * @description 关键资格不只信客户端OS
         */
        get: operations["P07-API02"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/tasks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 任务列表
         * @description 服务端归属与能力；平台事件独立验签/去重/对账
         */
        get: operations["P07-API44"];
        put?: never;
        /**
         * 创建任务草稿
         * @description READY_FOR_INPUT且完整Skill预加载证明匹配owner；此后才接收任何客户内容
         */
        post: operations["P07-API03"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/tasks/{id}/upload-sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 取得逐文件上传许可
         * @description 大小/类型预判，非公开桶权限
         */
        post: operations["P07-API04"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/uploads/{id}/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 确认原件持久接收
         * @description 服务端重算真实字节/类型/哈希
         */
        post: operations["P07-API05"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/tasks/{id}/sources": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 添加文字或已收源入草稿
         * @description 不接受任意URL，SOURCE与规范分开
         */
        post: operations["P07-API06"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/tasks/{id}/standard": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 读取目标规范草案
         * @description 只本人，未冻结不称已采用
         */
        get: operations["P07-API08"];
        put?: never;
        /**
         * 上传或选用/编辑目标规范
         * @description 样例区不计事实
         */
        post: operations["P07-API07"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/tasks/{id}/preflight": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 付费前全范围Agent分析
         * @description 完整拟处理范围分析；预览最多5条；不生成正式批量包；分析独立限额
         */
        post: operations["P07-API09"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/tasks/{id}/confirmations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 确认执行方案与不可变合同
         * @description 两种模式均已采用规范、明确源范围与策略，用户确认准确方案版本；付费前冻结
         */
        post: operations["P07-API10"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/tasks/{id}/quotes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 原平台商品报价
         * @description 确认之后才能估费，可信计量与原渠道价格表；不允许消费者FREE生产路径
         */
        post: operations["P07-API11"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/orders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 本人订单列表
         * @description 服务端归属与能力；平台事件独立验签/去重/对账
         */
        get: operations["P07-API51"];
        put?: never;
        /**
         * 同合同建原渠道订单
         * @description 每quote有效订单唯一，晚支付先查
         */
        post: operations["P07-API12"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/orders/{id}/checkout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 返回获准收银参数
         * @description 服务端核app/SKU/OS资格
         */
        post: operations["P07-API13"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/orders/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查原订单及必要通道核对
         * @description 客户端success非到账
         */
        get: operations["P07-API14"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/orders/{id}/refund-requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 原渠道退款申请
         * @description 申请非到账；实际可退按通道核实
         */
        post: operations["P07-API15"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/tasks/{id}/runs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 实付后启动或找回批量执行
         * @description 服务端CONFIRMED原实付且所有hash一致；拒绝free_grant；Run在此后创建
         */
        post: operations["P07-API16"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/runs/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 获取当前工作区状态
         * @description 父子run/结果区分
         */
        get: operations["P07-API17"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/runs/{id}/records": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 记录卡/选列表格分页
         * @description cursor绑定快照，最大100条
         */
        get: operations["P07-API21"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/runs/{id}/issues": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 问题分页与候选
         * @description 问题数与记录数分开
         */
        get: operations["P07-API22"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/evidence/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 按需读取依据
         * @description 原件到期410；可用摘录另标期限
         */
        get: operations["P07-API23"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/runs/{id}/decision-previews": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 提交前校值/影响范围
         * @description 未预选决定，范围必须确切
         */
        post: operations["P07-API24"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/runs/{id}/decisions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 为结果调整创建新会话入口
         * @description 新session先完整预载；带用户选择的父结果另行输入，再确认估费及核实实付权益，不复活旧container
         */
        post: operations["P07-API25"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/operations/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查询未知写动作
         * @description 只能本人，查不会重复执行
         */
        get: operations["P07-API26"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/runs/{id}/revisions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 查询或继续新会话中的修订意图
         * @description 同意图幂等；符合S1—S7与实付权益后才建child Run；关闭的环境不可恢复
         */
        post: operations["P07-API27"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/runs/{id}/artifacts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 指定结果9文件元信息
         * @description 原子发布，不把草案当正式包
         */
        get: operations["P07-API28"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/artifacts/{id}/download-link": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 权限内短链
         * @description 结果存储独立于运行环境，短链过期可重签；环境销毁不撤结果下载
         */
        post: operations["P07-API29"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/runs/{id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 取消与发布竞态裁决
         * @description 终态不反转，退款单独查
         */
        post: operations["P07-API30"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/orders/{id}/tickets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 提交售后请求
         * @description 默认最小摘要，正文另授权
         */
        post: operations["P07-API31"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/private-templates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 本人模板列表/版本摘要
         * @description 详情/复制/新版本/删除使用配套资源方法
         */
        get: operations["P07-API34"];
        put?: never;
        /**
         * 主动另存去事实规范
         * @description 结果规范主动另存去事实；独立持久对象不随container销毁
         */
        post: operations["P07-API32"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/artifacts/{id}/export-attempts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 记录设备取用观察
         * @description 用户确认与平台回执区分
         */
        post: operations["P07-API33"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/privacy/policies": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 告知用途/处理方/期限
         * @description 服务商未知不宣称零留存
         */
        get: operations["P07-API35"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/privacy/consents": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 记录必要处理同意/撤销
         * @description 系统平台授权独立，不用自写记录替代
         */
        post: operations["P07-API36"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/data-deletion-requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 分范围删除/注销
         * @description 已付履约/退款影响先说明，立即撤内容访问
         */
        post: operations["P07-API37"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/account-binding-challenges": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 可选跨端绑定挑战
         * @description 未获准/未实现默认关闭
         */
        post: operations["P07-API38"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/release-capabilities": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 内部能力证据/开关查询
         * @description 仅内部最小权限，不公开商户材料
         */
        get: operations["P07-API39"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/projects/{id}/source-increments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 增量协作范围
         * @description P1另定成员和计费
         */
        post: operations["P07-API40"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/format-capabilities": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * P1复杂格式说明
         * @description 未测试不可售
         */
        get: operations["P07-API41"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/open-api/runs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 开发者付费异步处理
         * @description P1亦须完整会话预载、确认估费与实付后生产，不提供绕过S1—S7的入口
         */
        post: operations["P07-API42"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/web/workspaces/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * P1大屏同领域投影
         * @description 不作受限小程序收银跳板
         */
        get: operations["P07-API43"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/tasks/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 任务详情与恢复指针
         * @description 服务端归属与能力；平台事件独立验签/去重/对账
         */
        get: operations["P07-API45"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/tasks/{id}/sources/{source_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * 仅草稿移除源/冻结后走新范围
         * @description 服务端归属与能力；平台事件独立验签/去重/对账
         */
        delete: operations["P07-API46"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/private-templates/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 模板详情
         * @description 服务端归属与能力；平台事件独立验签/去重/对账
         */
        get: operations["P07-API47"];
        put?: never;
        post?: never;
        /**
         * 删除模板未来复用权限
         * @description 服务端归属与能力；平台事件独立验签/去重/对账
         */
        delete: operations["P07-API49"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/private-templates/{id}/versions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 新模板版本或复制
         * @description 服务端归属与能力；平台事件独立验签/去重/对账
         */
        post: operations["P07-API48"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/data-deletion-requests/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 删除进度与仍保留类别
         * @description 服务端归属与能力；平台事件独立验签/去重/对账
         */
        get: operations["P07-API50"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/support/tickets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 无订单的一般帮助
         * @description 服务端归属与能力；平台事件独立验签/去重/对账
         */
        post: operations["P07-API52"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/platform-events/{provider}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 原始验签交易/退款回调，非消费者会话
         * @description 服务端归属与能力；平台事件独立验签/去重/对账
         */
        post: operations["P07-API53"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/tasks/{id}/schema-proposal": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 读取付费前规范方案
         * @description READY后的本任务会话，未销毁，仅可读当前提案
         */
        get: operations["P07-API18"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/tasks/{id}/schema-proposal/revisions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 付费前调整规范与处理策略
         * @description 新plan版本、旧确认/未付quote失效；调整返回S3/S4
         */
        post: operations["P07-API19"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/tasks/{id}/schema-adoptions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 报价前采用确切规范
         * @description PROVIDED/DISCOVER均在报价前采用FULL规范；不依赖已付Run，不触发批量
         */
        post: operations["P07-API20"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/agent-sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 先建会话并完整加载Skill
         * @description owner/当前阶段/幂等；完整预载失败不接收资料；销毁只作用运行环境，结果另存
         */
        post: operations["P07-API54"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/agent-sessions/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 查会话阶段与加载清理证明
         * @description owner/当前阶段/幂等；完整预载失败不接收资料；销毁只作用运行环境，结果另存
         */
        get: operations["P07-API55"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/p07/agent-sessions/{id}/close": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 终止并销毁任务运行环境
         * @description owner/当前阶段/幂等；完整预载失败不接收资料；销毁只作用运行环境，结果另存
         */
        post: operations["P07-API56"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** @enum {unknown} */
        ExecutionStatus: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED";
        /** @enum {string} */
        SchemaStatus: "NOT_REQUIRED_YET" | "PARTIAL_DRAFT" | "FULL_DRAFT" | "ADOPTED" | "SUPERSEDED";
        /** @enum {string} */
        QualityStatus: "NOT_EVALUATED" | "PASSED" | "NEEDS_REVIEW" | "BLOCKED";
        /** @enum {string} */
        ArtifactStatus: "NOT_READY" | "BUILDING" | "READY" | "FAILED" | "EXPIRED" | "REVOKED";
        /** @enum {unknown} */
        PaymentStatus: "NOT_CREATED" | "PENDING" | "CONFIRMED" | "FAILED" | "CLOSED" | "UNKNOWN";
        /** @enum {string} */
        RefundStatus: "NONE" | "REQUESTED" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "UNKNOWN";
        /** @enum {string} */
        FulfillmentStatus: "NOT_STARTED" | "IN_PROGRESS" | "DELIVERABLE" | "DELIVERED" | "FAILED" | "CANCELED";
        /** @enum {string} */
        OperationStatus: "PENDING" | "SUCCEEDED" | "FAILED";
        /** @enum {string} */
        ExportObservationStatus: "ARTIFACT_READY" | "FETCHED" | "CACHED" | "OPEN_REQUESTED" | "OPENED" | "EXPORT_REQUESTED" | "USER_CONFIRMED" | "PLATFORM_CONFIRMED" | "FAILED" | "UNKNOWN";
        /** @enum {string} */
        Mode: "PROVIDED" | "DISCOVER";
        /** @enum {string} */
        Provider: "ALIPAY" | "DOUYIN";
        Environment: {
            provider: components["schemas"]["Provider"];
            app_alias: string;
            /** @enum {string} */
            os: "ANDROID" | "IOS";
            host_version: string;
            base_sdk: string;
            build_id: string;
        };
        VersionSet: {
            task_version: number;
            source_set_version: number;
            goal_version: number;
            proposal_version?: number | null;
            result_version?: number | null;
        };
        AllowedActions: {
            action: string;
            enabled: boolean;
            reason_code: string | null;
            label: string;
        }[];
        Operation: {
            /** Format: uuid */
            operation_id: string;
            status: components["schemas"]["OperationStatus"];
            kind: string;
            resource_id: string | null;
            resource_kind: string | null;
            retry_of?: string | null;
            error_code: string | null;
            current_versions?: components["schemas"]["VersionSet"];
        };
        Error: {
            request_id: string;
            error: {
                code: string;
                message: string;
                retryable: boolean;
                operation_id?: string | null;
                current_versions?: components["schemas"]["VersionSet"] | null;
                details?: {
                    field: string;
                    code: string;
                    message: string;
                }[];
            };
        };
        Budget: {
            source_files: number;
            source_single_bytes: number;
            source_total_bytes: number;
            template_bytes: number;
            text_codepoints: number;
            processing_units: number;
            target_fields: number;
            candidate_records: number;
            compute_seconds_max: number;
            stage_auto_retries_max: number;
        };
        PolicySnapshot: {
            policy_id: string;
            /** @constant */
            runtime_cleanup: "AFTER_DURABLE_RESULT_PUBLISH";
            /** @constant */
            result_retention: "PERSIST_UNTIL_OWNER_REQUEST";
            /** @constant */
            result_auto_delete: false;
            delivery_summary: string;
            refund_summary: string;
            approved_sku_id: string | null;
            /** Format: date-time */
            effective_at: string;
        };
        ScopeUnit: {
            /** Format: uuid */
            source_id: string;
            /** Format: uuid */
            unit_id: string;
            /** @enum {string} */
            kind: "PDF_PAGE" | "IMAGE" | "DOCX_BLOCK" | "TEXT_REGION" | "SHEET_REGION" | "CSV_REGION";
            ordinal: number;
            /** @enum {string} */
            disposition: "READ" | "UNREADABLE" | "USER_EXCLUDED";
            reason: string | null;
        };
        Coverage: {
            confirmed_units: number;
            read_units: number;
            unreadable_units: number;
            excluded_units: number;
            scope_sha256: string;
            limitations: string[];
        };
        Locator: {
            version: string;
            /** @enum {string} */
            kind: "TEXT_SPAN" | "PDF_PAGE" | "IMAGE_BBOX" | "DOCX_PATH" | "SHEET_CELL" | "CSV_CELL";
            page_or_ordinal?: number | null;
            span?: number[] | null;
            bbox?: number[] | null;
            path?: string | null;
        };
        /** @description Restricted AST. Domain compiler checks op-specific operands, type, max depth/nodes. Never eval strings. */
        RuleNode: {
            /** @enum {string} */
            op: "FIELD" | "CONST" | "COMPARE" | "AND" | "OR" | "REQUIRED_IF" | "DECIMAL_ADD" | "DECIMAL_SUBTRACT" | "DECIMAL_MULTIPLY" | "DECIMAL_DIVIDE";
            field_id?: string;
            /** @description Decimal serialized as exact string; field binding determines semantic type. No floating JSON monetary value. */
            value?: string | number | boolean | null;
            /** @enum {string} */
            comparator?: "EQ" | "NE" | "GT" | "GE" | "LT" | "LE";
            args?: components["schemas"]["RuleNode"][];
        };
        SchemaField: {
            field_id: string;
            label: string;
            order: number;
            /** @enum {string} */
            type: "TEXT" | "DECIMAL" | "INTEGER" | "BOOLEAN" | "DATE" | "DATETIME" | "ENUM";
            required: boolean;
            nullable: boolean;
            unit: string | null;
            scale?: number | null;
            description: string;
            enum_values?: string[];
            closed_enum?: boolean;
        };
        SchemaDefinition: {
            /** Format: uuid */
            schema_id: string;
            version: number;
            /** @enum {string} */
            origin: "PROVIDED" | "DISCOVERED" | "PRIVATE_TEMPLATE" | "MANUAL";
            purpose: string;
            row_kind: string;
            fields: components["schemas"]["SchemaField"][];
            identity_keys: string[];
            rules: components["schemas"]["RuleNode"][];
            locale: string;
            timezone: string;
            /** @enum {string} */
            rounding: "HALF_UP" | "HALF_EVEN" | "NONE";
            export_policy: {
                version: string;
                formula_protection: boolean;
                /** @enum {string} */
                csv_encoding: "UTF-8-BOM";
                /** @enum {string} */
                csv_separator: "," | ";" | "\t";
            };
        };
        FieldSuggestion: {
            field: components["schemas"]["SchemaField"];
            reason: string;
            evidence_ids: string[];
            observed_count: number;
            relevant_count: number;
            from_sample: boolean;
            ambiguity: string | null;
        };
        ChangePreview: {
            changed_field_ids: string[];
            affected_record_ids: string[];
            unmapped_important: string[];
            new_issues: string[];
            requires_recompute: boolean;
        };
        Proposal: {
            /** Format: uuid */
            proposal_id: string;
            version: number;
            status: components["schemas"]["SchemaStatus"];
            source_set_version: number;
            goal_version: number;
            schema: components["schemas"]["SchemaDefinition"];
            suggestions: components["schemas"]["FieldSuggestion"][];
            coverage: components["schemas"]["Coverage"];
            preview_is_sample: boolean;
            preview_records: components["schemas"]["Record"][];
            unmapped_important: string[];
            change_preview: components["schemas"]["ChangePreview"] | null;
        };
        Source: {
            /** Format: uuid */
            source_id: string;
            /** @enum {string} */
            role: "SOURCE" | "TEMPLATE";
            name: string;
            bytes: number;
            sha256: string;
            mime: string;
            /** @enum {string} */
            status: "RECEIVED" | "VALIDATING" | "READABLE" | "PARTIAL" | "UNREADABLE" | "EXCLUDED" | "EXPIRED" | "DELETED";
            expires_at: string | null;
            readability_reason: string | null;
        };
        /** @description Compatibility name for full submitted-scope analysis before confirmation and pricing; not a three-unit sample. */
        PreflightReport: {
            /** Format: uuid */
            preflight_id: string;
            /** @enum {string} */
            status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
            source_set_version: number;
            goal_version: number;
            processing_units: number;
            readability: {
                /** Format: uuid */
                source_id: string;
                /** @enum {string} */
                status: "READABLE" | "PARTIAL" | "UNREADABLE";
                limitations: string[];
            }[];
            coverage: components["schemas"]["Coverage"];
            limits: components["schemas"]["Budget"];
            blocking_reasons: string[];
            current_proposal_id: string | null;
            /** Format: uuid */
            session_id: string;
            /** @constant */
            analysis_scope: "FULL_SUBMITTED_SCOPE";
            /** @constant */
            batch_allowed: false;
        };
        Task: {
            /** Format: uuid */
            task_id: string;
            version: number;
            mode: components["schemas"]["Mode"];
            goal: string | null;
            goal_version: number;
            source_set_version: number;
            current_run_id: string | null;
            current_result_version: number | null;
            latest_preflight: components["schemas"]["PreflightReport"] | null;
            sources: components["schemas"]["Source"][];
            allowed_actions: components["schemas"]["AllowedActions"];
            /** Format: date-time */
            updated_at: string;
            /** Format: uuid */
            agent_session_id: string;
        };
        FieldValue: {
            field_id: string;
            raw_text: string | null;
            /** @description Decimal serialized as exact string; field binding determines semantic type. No floating JSON monetary value. */
            typed_value: string | number | boolean | null;
            /** @enum {string} */
            status: "EXTRACTED" | "NORMALIZED" | "DERIVED" | "DEFAULTED" | "USER_PROVIDED" | "MISSING" | "CONFLICT" | "UNREADABLE";
            evidence_ids: string[];
            unit: string | null;
            transform_chain: {
                rule_id: string;
                version: string;
                input_field_ids: string[];
                description: string;
            }[];
        };
        Record: {
            /** Format: uuid */
            record_id: string;
            ordinal: number;
            /** @enum {string} */
            disposition: "ACCEPTED" | "NEEDS_REVIEW" | "EXCLUDED";
            fields: components["schemas"]["FieldValue"][];
            issue_ids: string[];
            exclusion_reason: string | null;
        };
        /** @description First three dispositions sum to total; issue_count may overlap and is not a fourth disposition. */
        Counts: {
            total_candidates: number;
            accepted: number;
            needs_review: number;
            excluded: number;
            issue_count: number;
        };
        Issue: {
            /** Format: uuid */
            issue_id: string;
            record_id: string | null;
            field_id: string | null;
            code: string;
            /** @enum {string} */
            severity: "INFO" | "WARNING" | "BLOCKER";
            message: string;
            allowed_decisions: ("CHOOSE_EVIDENCE" | "USER_VALUE" | "KEEP_UNRESOLVED")[];
            evidence_ids: string[];
            /** @enum {string} */
            status: "OPEN" | "RESOLVED" | "KEPT_UNRESOLVED";
        };
        /** @description CHOOSE_EVIDENCE requires evidence_id; USER_VALUE requires non-null value validated to binding; KEEP_UNRESOLVED preserves issue. */
        Decision: {
            /** Format: uuid */
            issue_id: string;
            /** Format: uuid */
            record_id: string;
            field_id: string;
            /** @enum {string} */
            action: "CHOOSE_EVIDENCE" | "USER_VALUE" | "KEEP_UNRESOLVED";
            /** Format: uuid */
            evidence_id?: string;
            /** @description Decimal serialized as exact string; field binding determines semantic type. No floating JSON monetary value. */
            user_value?: string | number | boolean | null;
            note?: string;
        } & (unknown & unknown & unknown);
        Run: {
            /** Format: uuid */
            run_id: string;
            /** Format: uuid */
            task_id: string;
            parent_run_id: string | null;
            parent_result_version: number | null;
            version: number;
            execution_status: components["schemas"]["ExecutionStatus"];
            schema_status: components["schemas"]["SchemaStatus"];
            quality_status: components["schemas"]["QualityStatus"];
            artifact_status: components["schemas"]["ArtifactStatus"];
            stage: string | null;
            binding_id: string | null;
            result_version: number | null;
            coverage: components["schemas"]["Coverage"];
            compute_used_ms: number;
            compute_limit_ms: number;
            revision_rounds_remaining: number;
            review_expires_at: string | null;
            allowed_actions: components["schemas"]["AllowedActions"];
        };
        /** @description Original channel unit; no implicit CNY conversion. */
        Amount: {
            amount_minor: number;
            amount_unit: string;
            provider: components["schemas"]["Provider"];
            sku_id: string;
        };
        Order: {
            /** Format: uuid */
            order_id: string;
            /** Format: uuid */
            contract_id: string;
            version: number;
            amount: components["schemas"]["Amount"];
            payment_status: components["schemas"]["PaymentStatus"];
            refund_status: components["schemas"]["RefundStatus"];
            fulfillment_status: components["schemas"]["FulfillmentStatus"];
            refunded_minor: number;
            allowed_actions: components["schemas"]["AllowedActions"];
            /** Format: date-time */
            updated_at: string;
        };
        Refund: {
            /** Format: uuid */
            refund_id: string;
            /** Format: uuid */
            order_id: string;
            status: components["schemas"]["RefundStatus"];
            amount: components["schemas"]["Amount"];
            /** Format: uuid */
            operation_id: string;
            retry_of: string | null;
        };
        Artifact: {
            /** Format: uuid */
            artifact_id: string;
            /** @enum {string} */
            name: "standard.xlsx" | "standard.json" | "result.xlsx" | "accepted.csv" | "result.json" | "issues.xlsx" | "provenance.jsonl" | "validation.json" | "manifest.json";
            bytes: number;
            sha256: string;
            media_type: string;
            /** @description Result file has no automatic expiry. Download URL has separate TTL. */
            expires_at: null;
        };
        PrivateTemplate: {
            /** Format: uuid */
            template_id: string;
            version: number;
            name: string;
            schema: components["schemas"]["SchemaDefinition"];
            sanitizer_version: string;
            /** Format: date-time */
            updated_at: string;
        };
        DeletionJob: {
            /** Format: uuid */
            deletion_request_id: string;
            /** Format: uuid */
            operation_id: string;
            /** @enum {string} */
            status: "REQUESTED" | "ACCESS_REVOKED" | "PURGING" | "COMPLETED" | "PARTIAL_FAILED";
            access_revoked_at: string | null;
            remaining_categories: string[];
            limitations: string[];
        };
        Capability: {
            capability_version: string;
            environment: components["schemas"]["Environment"];
            flags: {
                file_input: boolean;
                template_input: boolean;
                preview: boolean;
                export: boolean;
                payment: boolean;
            };
            commercial_enabled: boolean;
            reasons: {
                action: string;
                code: string;
                message: string;
            }[];
        };
        StandardDraft: {
            /** Format: uuid */
            draft_id: string;
            version: number;
            schema: components["schemas"]["SchemaDefinition"] | null;
            clarifications: string[];
            status: components["schemas"]["SchemaStatus"];
        };
        Ticket: {
            /** Format: uuid */
            ticket_id: string;
            /** @enum {string} */
            status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
            content_access_expires_at: string | null;
        };
        Request01: {
            provider: components["schemas"]["Provider"];
            app_alias: string;
            one_time_code: string;
        };
        Data01: {
            session_token: string;
            /** Format: date-time */
            expires_at: string;
            /** Format: uuid */
            account_id: string;
            identity_provider: components["schemas"]["Provider"];
        };
        Response01: {
            request_id: string;
            data: components["schemas"]["Data01"];
        };
        Data02: components["schemas"]["Capability"];
        Response02: {
            request_id: string;
            data: components["schemas"]["Data02"];
        };
        Request03: {
            mode: components["schemas"]["Mode"];
            optional_goal?: string;
            /** Format: uuid */
            client_request_id: string;
            /** Format: uuid */
            agent_session_id: string;
        };
        Data03: components["schemas"]["Task"];
        Response03: {
            request_id: string;
            data: components["schemas"]["Data03"];
        };
        Request04: {
            /** @enum {string} */
            role: "SOURCE" | "TEMPLATE";
            name: string;
            bytes: number;
            mime: string;
            sha256: string;
        };
        Data04: {
            /** Format: uuid */
            upload_id: string;
            /** @constant */
            method: "POST";
            /** Format: uri */
            limited_upload_target: string;
            upload_token: string;
            /** Format: date-time */
            expires_at: string;
            limits: {
                bytes: number;
                mime: string;
                sha256: string;
            };
        };
        Response04: {
            request_id: string;
            data: components["schemas"]["Data04"];
        };
        Request05: {
            observed_hash: string;
        };
        Data05: components["schemas"]["Source"];
        Response05: {
            request_id: string;
            data: components["schemas"]["Data05"];
        };
        Request06: {
            text?: string;
            /** Format: uuid */
            source_id?: string;
            /** @constant */
            role: "SOURCE";
            expected_task_version: number;
        } & (unknown | unknown);
        Data06: {
            source_set_version: number;
            task_version: number;
            received_source: components["schemas"]["Source"];
        };
        Response06: {
            request_id: string;
            data: components["schemas"]["Data06"];
        };
        Request07: {
            expected_task_version: number;
            /** Format: uuid */
            template_source_id?: string;
            /** Format: uuid */
            private_template_version_id?: string;
            fields_schema?: components["schemas"]["SchemaDefinition"];
        } & (unknown | unknown | unknown);
        Data07: components["schemas"]["StandardDraft"];
        Response07: {
            request_id: string;
            data: components["schemas"]["Data07"];
        };
        Data08: components["schemas"]["StandardDraft"];
        Response08: {
            request_id: string;
            data: components["schemas"]["Data08"];
        };
        Request09: {
            /** Format: uuid */
            agent_session_id: string;
            source_set_version: number;
            goal_version: number;
        };
        Data09: {
            /** Format: uuid */
            operation_id: string;
            /** Format: uuid */
            session_id: string;
            /** @constant */
            analysis_scope: "FULL_SUBMITTED_SCOPE";
            /** @constant */
            batch_allowed: false;
        };
        Response09: {
            request_id: string;
            data: components["schemas"]["Data09"];
        };
        Request10: {
            /** Format: uuid */
            session_id: string;
            /** Format: uuid */
            plan_id: string;
            plan_version: number;
            plan_hash: string;
            /** Format: uuid */
            binding_id: string;
            expected_versions: components["schemas"]["VersionSet"];
            /** Format: uuid */
            policy_consent_id: string;
        };
        Data10: {
            /** Format: uuid */
            contract_id: string;
            contract_hash: string;
            confirmed_plan: components["schemas"]["ConfirmedExecutionPlan"];
        };
        Response10: {
            request_id: string;
            data: components["schemas"]["Data10"];
        };
        Request11: {
            /** Format: uuid */
            session_id: string;
            /** Format: uuid */
            contract_id: string;
            /** Format: uuid */
            confirmed_plan_id: string;
            plan_hash: string;
            origin_environment: components["schemas"]["Environment"];
        };
        Data11: {
            /** @enum {unknown} */
            access_mode: "PAID" | "UNAVAILABLE";
            quote_id: string | null;
            plan_hash: string;
            amount: components["schemas"]["Amount"] | null;
            expires_at: string | null;
            policy: components["schemas"]["PolicySnapshot"];
            commercial_enabled: boolean;
            reason_codes: string[];
        };
        Response11: {
            request_id: string;
            data: components["schemas"]["Data11"];
        };
        Request12: {
            /** Format: uuid */
            quote_id: string;
            contract_hash: string;
        };
        Data12: components["schemas"]["Order"];
        Response12: {
            request_id: string;
            data: components["schemas"]["Data12"];
        };
        Request13: {
            expected_channel: components["schemas"]["Provider"];
        };
        Data13: {
            /** Format: uuid */
            order_id: string;
            provider: components["schemas"]["Provider"];
            /** @description Opaque approved adapter payload. Actual SDK fields and signature must be verified; never produced by a model. */
            provider_checkout_payload: {
                [key: string]: unknown;
            };
            expires_at: string | null;
        };
        Response13: {
            request_id: string;
            data: components["schemas"]["Data13"];
        };
        Data14: components["schemas"]["Order"];
        Response14: {
            request_id: string;
            data: components["schemas"]["Data14"];
        };
        Request15: {
            reason: string;
            /** Format: uuid */
            operation_reference: string;
            amount_minor?: number;
        };
        Data15: {
            operation: components["schemas"]["Operation"];
            refund: components["schemas"]["Refund"];
        };
        Response15: {
            request_id: string;
            data: components["schemas"]["Data15"];
        };
        Request16: {
            /** Format: uuid */
            session_id: string;
            /** Format: uuid */
            contract_id: string;
            /** Format: uuid */
            order_id: string;
            confirmed_plan_hash: string;
        };
        Data16: components["schemas"]["Run"];
        Response16: {
            request_id: string;
            data: components["schemas"]["Data16"];
        };
        Data17: components["schemas"]["Run"];
        Response17: {
            request_id: string;
            data: components["schemas"]["Data17"];
        };
        Data18: components["schemas"]["Proposal"];
        Response18: {
            request_id: string;
            data: components["schemas"]["Data18"];
        };
        Request19: {
            expected_proposal_version: number;
            instruction?: string;
            patch?: {
                /** @enum {string} */
                op: "ADD_FIELD" | "UPDATE_FIELD" | "REMOVE_FIELD" | "SET_ROW_KIND" | "SET_RULES";
                field_id?: string;
                field?: components["schemas"]["SchemaField"];
                row_kind?: string;
                rules?: components["schemas"]["RuleNode"][];
            }[];
        } & (unknown | unknown);
        Data19: {
            operation: components["schemas"]["Operation"];
            /** Format: uuid */
            proposal_id: string;
        };
        Response19: {
            request_id: string;
            data: components["schemas"]["Data19"];
        };
        Request20: {
            expected_proposal_version: number;
            expected_source_set_version: number;
            expected_goal_version: number;
            /** Format: uuid */
            session_id: string;
        };
        Data20: {
            /** Format: uuid */
            binding_id: string;
            schema_version: number;
            /** Format: uuid */
            session_id: string;
            /** @constant */
            batch_started: false;
        };
        Response20: {
            request_id: string;
            data: components["schemas"]["Data20"];
        };
        Data21: {
            result_version: number;
            records: components["schemas"]["Record"][];
            counts: components["schemas"]["Counts"];
            next_cursor: string | null;
        };
        Response21: {
            request_id: string;
            data: components["schemas"]["Data21"];
        };
        Data22: {
            result_version: number;
            issues: components["schemas"]["Issue"][];
            affected_records: number;
            next_cursor: string | null;
        };
        Response22: {
            request_id: string;
            data: components["schemas"]["Data22"];
        };
        Data23: {
            /** Format: uuid */
            evidence_id: string;
            /** Format: uuid */
            source_id: string;
            /** Format: uuid */
            source_unit_id: string;
            excerpt: string | null;
            locator: components["schemas"]["Locator"];
            authorized_page_url: string | null;
            expires_at: string | null;
            limitations: string[];
        };
        Response23: {
            request_id: string;
            data: components["schemas"]["Data23"];
        };
        Request24: {
            expected_result_version: number;
            decisions: components["schemas"]["Decision"][];
            scope: {
                target_record_ids: string[];
                predicate_hash?: string;
            };
        };
        Data24: {
            /** Format: uuid */
            preview_id: string;
            preview_hash: string;
            /** Format: date-time */
            expires_at: string;
            affected_records: number;
            exceptions: {
                /** Format: uuid */
                record_id: string;
                reason: string;
            }[];
            impact: components["schemas"]["ChangePreview"];
            will_reserve_rounds: number;
            /** @enum {string} */
            billing_class: "USER_REVISION" | "PLATFORM_CORRECTION";
        };
        Response24: {
            request_id: string;
            data: components["schemas"]["Data24"];
        };
        Request25: {
            /** Format: uuid */
            preview_id: string;
            preview_hash: string;
            expected_result_version: number;
        };
        Data25: {
            /** Format: uuid */
            operation_id: string;
            /** Format: uuid */
            new_session_id: string;
            /** Format: uuid */
            revision_intent_id: string;
            /** @constant */
            requires_seven_step_flow: true;
        };
        Response25: {
            request_id: string;
            data: components["schemas"]["Data25"];
        };
        Data26: components["schemas"]["Operation"];
        Response26: {
            request_id: string;
            data: components["schemas"]["Data26"];
        };
        Request27: {
            /** Format: uuid */
            decision_batch_id: string;
            expected_result_version: number;
        };
        Data27: {
            operation: components["schemas"]["Operation"];
            /** Format: uuid */
            child_run_id: string;
            authorized_retry: boolean;
        };
        Response27: {
            request_id: string;
            data: components["schemas"]["Data27"];
        };
        Data28: {
            /** Format: uuid */
            artifact_set_id: string;
            result_version: number;
            status: components["schemas"]["ArtifactStatus"];
            quality: components["schemas"]["QualityStatus"];
            manifest_hash: string;
            artifacts: components["schemas"]["Artifact"][];
            expires_at: string | null;
        };
        Response28: {
            request_id: string;
            data: components["schemas"]["Data28"];
        };
        Request29: {
            expected_result_version: number;
        };
        Data29: {
            /** Format: uri */
            signed_url: string;
            ttl_seconds: number;
            sha256: string;
            bytes: number;
        };
        Response29: {
            request_id: string;
            data: components["schemas"]["Data29"];
        };
        Request30: {
            expected_run_version: number;
            reason: string;
        };
        Data30: {
            operation: components["schemas"]["Operation"];
            resolved_status: components["schemas"]["ExecutionStatus"];
        };
        Response30: {
            request_id: string;
            data: components["schemas"]["Data30"];
        };
        Request31: {
            category: string;
            note: string;
            content_access_opt_in: boolean;
            /** Format: uuid */
            task_id?: string;
        };
        Data31: components["schemas"]["Ticket"];
        Response31: {
            request_id: string;
            data: components["schemas"]["Data31"];
        };
        Request32: {
            /** Format: uuid */
            binding_id: string;
            name: string;
            /** Format: uuid */
            policy_consent_id: string;
        };
        Data32: components["schemas"]["PrivateTemplate"];
        Response32: {
            request_id: string;
            data: components["schemas"]["Data32"];
        };
        Request33: {
            /** Format: uuid */
            client_attempt_id: string;
            observed_action: components["schemas"]["ExportObservationStatus"];
            /** @enum {string} */
            receipt_source: "CLIENT" | "USER";
            environment: components["schemas"]["Environment"];
            /** Format: date-time */
            observed_at: string;
            receipt_ref?: string;
        };
        /** @description Client cannot claim VERIFIED_PLATFORM. This endpoint never directly sets DELIVERED. */
        Data33: {
            /** Format: uuid */
            export_attempt_id: string;
            accepted_observation: components["schemas"]["ExportObservationStatus"];
        };
        Response33: {
            request_id: string;
            data: components["schemas"]["Data33"];
        };
        Data34: {
            items: components["schemas"]["PrivateTemplate"][];
            next_cursor: string | null;
        };
        Response34: {
            request_id: string;
            data: components["schemas"]["Data34"];
        };
        Data35: {
            policy_version: string;
            /** Format: uuid */
            policy_id: string;
            purposes: string[];
            processors: {
                name: string;
                purpose: string;
                region: string;
                retention: string;
                deletion_limitations: string;
            }[];
            retention_categories: {
                category: string;
                policy_id: string;
                duration_seconds: number | null;
                limitations: string;
            }[];
        };
        Response35: {
            request_id: string;
            data: components["schemas"]["Data35"];
        };
        Request36: {
            policy_version: string;
            scopes: string[];
            /** @enum {string} */
            action: "GRANT" | "WITHDRAW";
        };
        Data36: {
            /** Format: uuid */
            consent_id: string;
            /** @enum {string} */
            effect: "RECORDED" | "NEW_PROCESSING_STOPPED" | "WITHDRAWAL_PENDING_REVIEW";
            /** Format: date-time */
            effective_at: string;
        };
        Response36: {
            request_id: string;
            data: components["schemas"]["Data36"];
        };
        Request37: {
            resource_scope: {
                /** @enum {string} */
                kind: "TASK_CONTENT" | "PRIVATE_TEMPLATE" | "ACCOUNT";
                resource_ids: string[];
            };
            /** @constant */
            confirmation: true;
        };
        Data37: components["schemas"]["DeletionJob"];
        Response37: {
            request_id: string;
            data: components["schemas"]["Data37"];
        };
        Request38: {
            /** Format: uuid */
            current_verified_identity_id: string;
            target_provider: components["schemas"]["Provider"];
        };
        /** @description Optional P1. No implicit merge or cross-platform paid entitlement transfer. */
        Data38: {
            /** Format: uuid */
            challenge_id: string;
            /** Format: date-time */
            expires_at: string;
        };
        Response38: {
            request_id: string;
            data: components["schemas"]["Data38"];
        };
        Data39: {
            capability: components["schemas"]["Capability"];
            gates: {
                gate_id: string;
                /** @enum {string} */
                status: "PASS" | "FAIL" | "NOT_RUN";
                evidence_refs: string[];
            }[];
            evidence_index: string[];
        };
        Response39: {
            request_id: string;
            data: components["schemas"]["Data39"];
        };
        Request40: {
            expected_project_version: number;
            new_sources: string[];
        };
        Data40: {
            operation: components["schemas"]["Operation"];
            new_contract_id: string | null;
            impact: components["schemas"]["ChangePreview"];
        };
        Response40: {
            request_id: string;
            data: components["schemas"]["Data40"];
        };
        Data41: {
            format: string;
            supported: boolean;
            limits: components["schemas"]["Budget"];
            price_contract_required: boolean;
            limitations: string[];
        };
        Response41: {
            request_id: string;
            data: components["schemas"]["Data41"];
        };
        Request42: {
            /** Format: uuid */
            contract_id: string;
            payment_permission_ref: string;
            callback_endpoint_id?: string;
        };
        Data42: {
            operation: components["schemas"]["Operation"];
            /** Format: uuid */
            async_run_id: string;
            settlement_reference: string | null;
        };
        Response42: {
            request_id: string;
            data: components["schemas"]["Data42"];
        };
        Data43: {
            task: components["schemas"]["Task"];
            run: components["schemas"]["Run"] | null;
            allowed_actions: components["schemas"]["AllowedActions"];
        };
        Response43: {
            request_id: string;
            data: components["schemas"]["Data43"];
        };
        Data44: {
            items: components["schemas"]["Task"][];
            next_cursor: string | null;
        };
        Response44: {
            request_id: string;
            data: components["schemas"]["Data44"];
        };
        Data45: components["schemas"]["Task"];
        Response45: {
            request_id: string;
            data: components["schemas"]["Data45"];
        };
        Data46: {
            task_version: number;
            source_set_version: number;
            /** Format: uuid */
            removed_source_id: string;
        };
        Response46: {
            request_id: string;
            data: components["schemas"]["Data46"];
        };
        Data47: components["schemas"]["PrivateTemplate"];
        Response47: {
            request_id: string;
            data: components["schemas"]["Data47"];
        };
        Request48: {
            expected_template_version: number;
            name: string;
            schema: components["schemas"]["SchemaDefinition"];
            /** Format: uuid */
            policy_consent_id: string;
        };
        Data48: components["schemas"]["PrivateTemplate"];
        Response48: {
            request_id: string;
            data: components["schemas"]["Data48"];
        };
        Data49: {
            /** Format: uuid */
            template_id: string;
            future_reuse_revoked: boolean;
            historical_bindings_retained: boolean;
        };
        Response49: {
            request_id: string;
            data: components["schemas"]["Data49"];
        };
        Data50: components["schemas"]["DeletionJob"];
        Response50: {
            request_id: string;
            data: components["schemas"]["Data50"];
        };
        Data51: {
            items: components["schemas"]["Order"][];
            next_cursor: string | null;
        };
        Response51: {
            request_id: string;
            data: components["schemas"]["Data51"];
        };
        Request52: {
            category: string;
            note: string;
            /** Format: uuid */
            task_id?: string;
            expected_task_version?: number;
            content_access_opt_in: boolean;
        };
        Data52: components["schemas"]["Ticket"];
        Response52: {
            request_id: string;
            data: components["schemas"]["Data52"];
        };
        /** @enum {unknown} */
        SessionStatus: "INITIALIZING" | "READY_FOR_INPUT" | "INPUT_RECEIVED" | "ANALYZING" | "WAITING_CONFIRMATION" | "QUOTABLE" | "AWAITING_PAYMENT" | "BATCH_QUEUED" | "BATCH_RUNNING" | "PERSISTING_RESULTS" | "RELEASING_RUNTIME" | "CLOSED" | "INITIALIZATION_FAILED" | "FAILED" | "CANCELED";
        /** @enum {unknown} */
        CleanupStatus: "NOT_REQUESTED" | "PENDING" | "STOPPING" | "DELETING" | "SUCCEEDED" | "FAILED";
        SkillLoadReceipt: {
            skill_manifest_sha256: string;
            loaded_file_count: number;
            context_sha256: string;
            /** @constant */
            host_composition_verified: true;
            /** @constant */
            bootstrap_completed: true;
        };
        Session: {
            /** Format: uuid */
            session_id: string;
            version: number;
            status: components["schemas"]["SessionStatus"];
            task_id: string | null;
            skill_load_receipt: components["schemas"]["SkillLoadReceipt"] | null;
            cleanup_status: components["schemas"]["CleanupStatus"];
            result_id: string | null;
            /** @constant */
            result_files_preserved: true;
        };
        ExecutionPlan: {
            /** Format: uuid */
            plan_id: string;
            version: number;
            plan_hash: string;
            /** Format: uuid */
            session_id: string;
            source_set_sha256: string;
            schema_binding_sha256: string | null;
            skill_manifest_sha256: string;
            /** @enum {unknown} */
            status: "DRAFT" | "CONFIRMED" | "SUPERSEDED";
            /** @constant */
            analysis_scope: "FULL";
            estimated_records: number | null;
            preview_record_count: number;
            strategy_summary: string;
            limitations: string[];
        } & unknown;
        ConfirmedExecutionPlan: components["schemas"]["ExecutionPlan"] & {
            /** @constant */
            status?: "CONFIRMED";
        };
        Request54: {
            /** Format: uuid */
            client_request_id: string;
            skill_release_id: string;
        };
        Data54: {
            /** Format: uuid */
            session_id: string;
            /** @constant */
            status: "INITIALIZING";
            /** Format: uuid */
            operation_id: string;
        };
        Data55: components["schemas"]["Session"];
        Request56: {
            expected_version: number;
            reason: string;
        };
        Data56: {
            /** Format: uuid */
            operation_id: string;
            cleanup_status: components["schemas"]["CleanupStatus"];
            /** @constant */
            result_files_preserved: true;
        };
        Response54: {
            request_id: string;
            data: components["schemas"]["Data54"];
        };
        Response55: {
            request_id: string;
            data: components["schemas"]["Data55"];
        };
        Response56: {
            request_id: string;
            data: components["schemas"]["Data56"];
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    "P07-API01": {
        parameters: {
            query?: never;
            header: {
                /** @description Stable action key; same owner/route/key with different canonical payload returns 409. */
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Request01"];
            };
        };
        responses: {
            /** @description Versioned authorized resource */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response01"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API02": {
        parameters: {
            query: {
                provider: components["schemas"]["Provider"];
                app_alias: string;
                os: "ANDROID" | "IOS";
                host_version: string;
                base_sdk: string;
                build_id: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Versioned authorized resource */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response02"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API44": {
        parameters: {
            query?: {
                cursor?: string;
                limit?: number;
                mode?: components["schemas"]["Mode"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Versioned authorized resource */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response44"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API03": {
        parameters: {
            query?: never;
            header: {
                /** @description Stable action key; same owner/route/key with different canonical payload returns 409. */
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Request03"];
            };
        };
        responses: {
            /** @description Versioned authorized resource */
            201: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response03"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API04": {
        parameters: {
            query?: never;
            header: {
                /** @description Stable action key; same owner/route/key with different canonical payload returns 409. */
                "Idempotency-Key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Request04"];
            };
        };
        responses: {
            /** @description Versioned authorized resource */
            201: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response04"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API05": {
        parameters: {
            query?: never;
            header: {
                /** @description Stable action key; same owner/route/key with different canonical payload returns 409. */
                "Idempotency-Key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Request05"];
            };
        };
        responses: {
            /** @description Versioned authorized resource */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response05"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API06": {
        parameters: {
            query?: never;
            header: {
                /** @description Stable action key; same owner/route/key with different canonical payload returns 409. */
                "Idempotency-Key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Request06"];
            };
        };
        responses: {
            /** @description Versioned authorized resource */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response06"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API08": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Versioned authorized resource */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response08"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API07": {
        parameters: {
            query?: never;
            header: {
                /** @description Stable action key; same owner/route/key with different canonical payload returns 409. */
                "Idempotency-Key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Request07"];
            };
        };
        responses: {
            /** @description Versioned authorized resource */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response07"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API09": {
        parameters: {
            query?: never;
            header: {
                /** @description Stable action key; same owner/route/key with different canonical payload returns 409. */
                "Idempotency-Key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Request09"];
            };
        };
        responses: {
            /** @description Persisted acceptance; inspect operation for final outcome. */
            202: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response09"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API10": {
        parameters: {
            query?: never;
            header: {
                /** @description Stable action key; same owner/route/key with different canonical payload returns 409. */
                "Idempotency-Key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Request10"];
            };
        };
        responses: {
            /** @description Versioned authorized resource */
            201: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response10"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API11": {
        parameters: {
            query?: never;
            header: {
                /** @description Stable action key; same owner/route/key with different canonical payload returns 409. */
                "Idempotency-Key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Request11"];
            };
        };
        responses: {
            /** @description Versioned authorized resource */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response11"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API51": {
        parameters: {
            query?: {
                cursor?: string;
                limit?: number;
                payment_status?: components["schemas"]["PaymentStatus"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Versioned authorized resource */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response51"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API12": {
        parameters: {
            query?: never;
            header: {
                /** @description Stable action key; same owner/route/key with different canonical payload returns 409. */
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Request12"];
            };
        };
        responses: {
            /** @description Versioned authorized resource */
            201: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response12"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API13": {
        parameters: {
            query?: never;
            header: {
                /** @description Stable action key; same owner/route/key with different canonical payload returns 409. */
                "Idempotency-Key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Request13"];
            };
        };
        responses: {
            /** @description Versioned authorized resource */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response13"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API14": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Versioned authorized resource */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response14"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API15": {
        parameters: {
            query?: never;
            header: {
                /** @description Stable action key; same owner/route/key with different canonical payload returns 409. */
                "Idempotency-Key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Request15"];
            };
        };
        responses: {
            /** @description Persisted acceptance; inspect operation for final outcome. */
            202: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response15"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API16": {
        parameters: {
            query?: never;
            header: {
                /** @description Stable action key; same owner/route/key with different canonical payload returns 409. */
                "Idempotency-Key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Request16"];
            };
        };
        responses: {
            /** @description Versioned authorized resource */
            201: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response16"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API17": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Versioned authorized resource */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response17"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API21": {
        parameters: {
            query: {
                result_version: number;
                cursor?: string;
                limit?: number;
                disposition?: "ACCEPTED" | "NEEDS_REVIEW" | "EXCLUDED";
                fields?: string;
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Versioned authorized resource */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response21"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API22": {
        parameters: {
            query: {
                result_version: number;
                cursor?: string;
                limit?: number;
                severity?: "INFO" | "WARNING" | "BLOCKER";
                type?: string;
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Versioned authorized resource */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response22"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API23": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Versioned authorized resource */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response23"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API24": {
        parameters: {
            query?: never;
            header: {
                /** @description Stable action key; same owner/route/key with different canonical payload returns 409. */
                "Idempotency-Key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Request24"];
            };
        };
        responses: {
            /** @description Versioned authorized resource */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response24"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API25": {
        parameters: {
            query?: never;
            header: {
                /** @description Stable action key; same owner/route/key with different canonical payload returns 409. */
                "Idempotency-Key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Request25"];
            };
        };
        responses: {
            /** @description Persisted acceptance; inspect operation for final outcome. */
            202: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response25"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API26": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Versioned authorized resource */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response26"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API27": {
        parameters: {
            query?: never;
            header: {
                /** @description Stable action key; same owner/route/key with different canonical payload returns 409. */
                "Idempotency-Key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Request27"];
            };
        };
        responses: {
            /** @description Persisted acceptance; inspect operation for final outcome. */
            202: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response27"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API28": {
        parameters: {
            query: {
                result_version: number;
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Versioned authorized resource */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response28"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API29": {
        parameters: {
            query?: never;
            header: {
                /** @description Stable action key; same owner/route/key with different canonical payload returns 409. */
                "Idempotency-Key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Request29"];
            };
        };
        responses: {
            /** @description Versioned authorized resource */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response29"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API30": {
        parameters: {
            query?: never;
            header: {
                /** @description Stable action key; same owner/route/key with different canonical payload returns 409. */
                "Idempotency-Key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Request30"];
            };
        };
        responses: {
            /** @description Persisted acceptance; inspect operation for final outcome. */
            202: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response30"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API31": {
        parameters: {
            query?: never;
            header: {
                /** @description Stable action key; same owner/route/key with different canonical payload returns 409. */
                "Idempotency-Key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Request31"];
            };
        };
        responses: {
            /** @description Versioned authorized resource */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response31"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API34": {
        parameters: {
            query?: {
                cursor?: string;
                limit?: number;
                query?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Versioned authorized resource */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response34"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API32": {
        parameters: {
            query?: never;
            header: {
                /** @description Stable action key; same owner/route/key with different canonical payload returns 409. */
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Request32"];
            };
        };
        responses: {
            /** @description Versioned authorized resource */
            201: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response32"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API33": {
        parameters: {
            query?: never;
            header: {
                /** @description Stable action key; same owner/route/key with different canonical payload returns 409. */
                "Idempotency-Key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Request33"];
            };
        };
        responses: {
            /** @description Versioned authorized resource */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response33"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API35": {
        parameters: {
            query: {
                environment: "ALIPAY_ANDROID" | "ALIPAY_IOS" | "DOUYIN_ANDROID" | "DOUYIN_IOS";
                policy_version?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Versioned authorized resource */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response35"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API36": {
        parameters: {
            query?: never;
            header: {
                /** @description Stable action key; same owner/route/key with different canonical payload returns 409. */
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Request36"];
            };
        };
        responses: {
            /** @description Versioned authorized resource */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response36"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API37": {
        parameters: {
            query?: never;
            header: {
                /** @description Stable action key; same owner/route/key with different canonical payload returns 409. */
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Request37"];
            };
        };
        responses: {
            /** @description Persisted acceptance; inspect operation for final outcome. */
            202: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response37"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API38": {
        parameters: {
            query?: never;
            header: {
                /** @description Stable action key; same owner/route/key with different canonical payload returns 409. */
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Request38"];
            };
        };
        responses: {
            /** @description Versioned authorized resource */
            201: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response38"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API39": {
        parameters: {
            query: {
                environment: "ALIPAY_ANDROID" | "ALIPAY_IOS" | "DOUYIN_ANDROID" | "DOUYIN_IOS";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Versioned authorized resource */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response39"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API40": {
        parameters: {
            query?: never;
            header: {
                /** @description Stable action key; same owner/route/key with different canonical payload returns 409. */
                "Idempotency-Key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Request40"];
            };
        };
        responses: {
            /** @description Persisted acceptance; inspect operation for final outcome. */
            202: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response40"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API41": {
        parameters: {
            query: {
                format: string;
                mode: components["schemas"]["Mode"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Versioned authorized resource */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response41"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API42": {
        parameters: {
            query?: never;
            header: {
                /** @description Stable action key; same owner/route/key with different canonical payload returns 409. */
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Request42"];
            };
        };
        responses: {
            /** @description Persisted acceptance; inspect operation for final outcome. */
            202: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response42"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API43": {
        parameters: {
            query: {
                task_id: string;
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Versioned authorized resource */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response43"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API45": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Versioned authorized resource */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response45"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API46": {
        parameters: {
            query: {
                expected_task_version: number;
            };
            header: {
                /** @description Stable action key; same owner/route/key with different canonical payload returns 409. */
                "Idempotency-Key": string;
            };
            path: {
                id: string;
                source_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Versioned authorized resource */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response46"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API47": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Versioned authorized resource */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response47"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API49": {
        parameters: {
            query: {
                expected_template_version: number;
            };
            header: {
                /** @description Stable action key; same owner/route/key with different canonical payload returns 409. */
                "Idempotency-Key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Versioned authorized resource */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response49"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API48": {
        parameters: {
            query?: never;
            header: {
                /** @description Stable action key; same owner/route/key with different canonical payload returns 409. */
                "Idempotency-Key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Request48"];
            };
        };
        responses: {
            /** @description Versioned authorized resource */
            201: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response48"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API50": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Versioned authorized resource */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response50"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API52": {
        parameters: {
            query?: never;
            header: {
                /** @description Stable action key; same owner/route/key with different canonical payload returns 409. */
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Request52"];
            };
        };
        responses: {
            /** @description Versioned authorized resource */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response52"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API53": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                provider: "alipay" | "douyin";
            };
            cookie?: never;
        };
        /** @description Exact original provider bytes. Signature headers/media/ACK determined by verified channel adapter. */
        requestBody: {
            content: {
                "*/*": string;
            };
        };
        responses: {
            /** @description Only verified/recognized event accepted. Exact channel ACK/media is unresolved until approved provider integration; no generic JSON ACK is prescribed. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API18": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Versioned authorized resource */
            200: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response18"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API19": {
        parameters: {
            query?: never;
            header: {
                /** @description Stable action key; same owner/route/key with different canonical payload returns 409. */
                "Idempotency-Key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Request19"];
            };
        };
        responses: {
            /** @description Persisted acceptance; inspect operation for final outcome. */
            202: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response19"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API20": {
        parameters: {
            query?: never;
            header: {
                /** @description Stable action key; same owner/route/key with different canonical payload returns 409. */
                "Idempotency-Key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Request20"];
            };
        };
        responses: {
            /** @description Versioned authorized resource */
            201: {
                headers: {
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response20"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Authentication required or expired */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Capability/permission/license guard */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unavailable resource, including wrong owner */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Version/idempotency/business conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Content/grant expired or revoked */
            410: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Size/resource limit exceeded */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported media */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Semantic/rule error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Rate limited */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Dependency unavailable or P1 disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    "P07-API54": {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Request54"];
            };
        };
        responses: {
            /** @description Designed session lifecycle response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response54"];
                };
            };
        };
    };
    "P07-API55": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Designed session lifecycle response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response55"];
                };
            };
        };
    };
    "P07-API56": {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Request56"];
            };
        };
        responses: {
            /** @description Designed session lifecycle response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Response56"];
                };
            };
        };
    };
}
