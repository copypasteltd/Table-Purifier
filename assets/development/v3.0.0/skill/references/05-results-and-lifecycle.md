# 九文件与生命周期
候选九文件：standard.xlsx、standard.json、result.xlsx、accepted.csv、result.json、issues.xlsx、provenance.jsonl、validation.json、manifest.json。规范无本次事实；result含所有候选和状态，accepted仅通过行。独立验证器核标准、事实依据、覆盖和安全导出，manifest核其余8。可信发布器把全部结果复制独立结果区，逐项hash/readback并原子提交结果指针+清理outbox后停止Agent。销毁task container不会删除结果。原件全文消失后来源页仅展示结果内必要摘录/位置，不能伪造原件访问。重新加工用新会话和用户选择的父结果/必要重传源。
