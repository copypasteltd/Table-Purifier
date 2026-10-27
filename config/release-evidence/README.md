# 实际能力证据格式

本目录暂不包含可开放收费的真实证据。示例中的 NOT_RUN 不得改为 PASS 来模拟验收；必须先完成相应真实环境验证。源码测试的依赖注入不产生产品发布证据。

数据库 capability_releases.evidence_index 需要以下结构，路径只允许本目录单个 JSON 文件名，逐份核对实际字节的 SHA-256：

```json
{
  "environment": {"provider":"ALIPAY","app_alias":"待配置","os":"ANDROID","host_version":"实际版本","base_sdk":"实际版本","build_id":"实际构建"},
  "refs": ["reviewed-device-report.json"],
  "files": [{"path":"reviewed-device-report.json","sha256":"实际文件SHA256"}]
}
```

每份收据协议为 P07-RELEASE-EVIDENCE-1，kind 为 REAL_ENVIRONMENT，绑定相同环境、capability_version、sku_id、settlement_unit、price_policy_sha256、flags_sha256；含 verified_at、valid_until（UTC ISO 时间）、reviewed_by 和不重复的 gates。字段严格，未知字段拒绝。摘要使用 `src/shared/crypto.ts` 的 P07-CJ1。

必需门槛为 SESSION_ISOLATION、WHOLE_RUNTIME_CLEANUP、MODEL_SEVEN_STEPS。所开放的能力还分别要求 FILE_INPUT、TEMPLATE_INPUT、PREVIEW、EXPORT、PLATFORM_PAYMENT；收银同时要求 ORIGINAL_REFUND、PRICE_UNIT、CALLBACK_REPLAY。每项均须实际 PASS，缺件、失败、过期、宿主/SDK/构建或商品/原单位不符都保持关闭。

这些是可信运营审核文件的完整性与范围检查，不会自动证明填写的事实。原始设备记录、交易证据、隔离探测日志应由运营按既定流程核对并保存到获准位置；不要在这里夹带商户密钥、整份客户原件或无关个人数据。本次不编造、导入或发布任何此类实际能力记录。
