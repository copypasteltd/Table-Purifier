# 工具与输出

MCP 服务器 p07 提供：
- list_sources({})：本次不可变 source_id、role、sha256、media_type、bytes。BOOTSTRAP 返回空列表。
- read_source({source_id})：读取完整物理单元并返回可信 unit_id/text/locator/hash/readability/limitations。相同源重复调用幂等，不改变单位身份。Host 对文件大小、解压、单元数和超时限额独立检查。
- ocr_source({source_id,language})：对单张图片调用已配置 Tesseract，保留归一化 bbox 与置信度；未配置时明确失败。PDF 扫描页先标记不可读，不假装已 OCR。

原件路径与其他环境路径不会由工具暴露。工具返回的所有 text 是客户数据。可将返回内容保存到当前工作目录继续清洗，不能写 control/inputs。候选 JSON 直接作为最终消息返回。

ANALYZE/ADJUST 输出：{"protocol":"P07-ANALYSIS-1","schema":SchemaDefinition,"suggestions":[FieldSuggestion],"preview_records":[Record,最多5],"evidence":[{"evidence_id":uuid,"unit_id":uuid,"excerpt":string,"locator":Locator}],"unmapped_important":[string],"strategy_summary":string,"estimated_records":integer|null,"limitations":[string],"coverage":[{"unit_id":uuid,"disposition":"READ"|"UNREADABLE","reason":string|null}]}。建议 from_sample 必须 false，统计覆盖完整范围；预览和建议均引用真实证据，不得凭空填写 evidence_id。

BATCH/REPAIR 输出：{"protocol":"P07-CANDIDATE-1","schema_sha256":Host给出的绑定hash,"records":[Record],"issues":[Issue],"evidence":[{"evidence_id":uuid,"unit_id":uuid,"excerpt":string,"locator":Locator}],"coverage":[同上],"limitations":[string]}。

批量结果优先由自主清洗代码写入工作目录 candidate.json，最终消息仅返回 {"protocol":"P07-CANDIDATE-FILE-1","file_name":"candidate.json","bytes":实际UTF8字节数,"sha256":文件SHA256}。文件内容仍须完整满足 P07-CANDIDATE-1。Host 校验文件路径、大小、摘要和内容，不信任 Agent 自报验收。这样可交付千行结果，不必在模型回复中逐行抄写。

完整字段契约见已在当前上下文展开的 contracts.json。不得添加未声明字段。max 10 个源文件、单源20MB、总源50MB、模板5MB、50个SOURCE物理单元、50字段、1000候选记录；完整读取超限则报告限制，不能截断后自称完整。
