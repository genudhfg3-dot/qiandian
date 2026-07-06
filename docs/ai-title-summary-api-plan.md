# AI 标题与摘要 API 接入设计

当前版本仍使用本地启发式生成标题和摘要，优先保证本地优先和不外发。

## 建议接入方式

1. 用户在设置中显式开启“使用 AI 生成标题和摘要”。
2. 用户自行填写 API Base URL、模型名和 API Key。
3. 捕获窗关闭保存时，先本地写入 SQLite，状态为“待生成元数据”。
4. 后台调用 AI，只发送正文纯文本、来源标题和已有标签，不发送图片文件。
5. AI 返回 JSON：

```json
{
  "title": "用于列表展示的短标题",
  "summary": "用于搜索和摘要展示的 80 到 120 字摘要",
  "tags": ["可选标签"]
}
```

## 隐私边界

- 默认关闭，不自动外发。
- API Key 只保存在本机。
- 每次调用前可在设置中选择是否允许发送来源 URL。
- 调用失败时保留本地标题和摘要，不阻塞保存。

## 数据层建议

后续迁移可增加：

- entries.summary
- entries.metadata_status
- entries.metadata_updated_at
- app_settings.ai_enabled
- app_settings.ai_base_url
- app_settings.ai_model

本轮不直接接 API，避免在没有设置页、密钥保护和失败恢复的情况下引入外发风险。
