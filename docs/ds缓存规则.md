# DeepSeek 上下文缓存规则

> 来源：https://api-docs.deepseek.com/guides/kv_cache（中文版）
> 定价：https://api-docs.deepseek.com/quick_start/pricing

## 概述

DeepSeek 的**上下文硬盘缓存技术**（Context Caching / KV Cache）默认对所有用户开启，无需修改代码即可使用。它缓存的是**输入 prompt 重复前缀的计算状态**，而非最终回答。

---

## 缓存命中规则

缓存命中的前提是**前缀已被"落盘"（写入硬盘缓存）**。每条缓存前缀是一个独立的完整单元，后续请求只有**完整匹配**缓存前缀单元时才能命中。

### 缓存前缀落盘的三种时机

1. **请求结束位置落盘**：每次请求的用户输入结束处与模型输出结束处会产生两个缓存前缀单元
2. **公共前缀检测落盘**：当系统检测到多次请求之间有公共前缀时，会将其作为独立缓存单元持久化
3. **按固定 token 间隔落盘**：长输入/长输出时系统会按固定间隔切分缓存单元

### 命中示例

- **多轮对话**：第一轮 `A+B`，第二轮 `A+B+C` → 第二轮可命中 `A+B` 的缓存
- **长文本QA**：前两次请求 `系统提示+财报` 未能命中，第三次请求因系统已识别公共前缀而命中

---

## API Response 字段

```json
{
  "usage": {
    "prompt_cache_hit_tokens": 10000,
    "prompt_cache_miss_tokens": 500,
    "prompt_tokens": 10500,
    "completion_tokens": 200,
    "total_tokens": 10700
  }
}
```

> `prompt_tokens = prompt_cache_hit_tokens + prompt_cache_miss_tokens`

---

## 定价（2025-2026）

| 模型 | 缓存命中 ($/1M tokens) | 缓存未命中 ($/1M tokens) | 输出 ($/1M tokens) |
|---|---|---|---|
| deepseek-v4-flash | $0.0028 | $0.14 | $0.28 |
| deepseek-v4-pro | $0.003625 | $0.435 | $0.87 |

> ⚠️ `deepseek-chat` 和 `deepseek-reasoner` 将于 **2026/07/24 15:59 UTC** 弃用。

---

## 重要说明

- 缓存是**"尽力而为"**（best-effort），不保证 100% 命中率
- 缓存构建耗时为**秒级**
- 不再使用的缓存会在**几小时到几天内**自动清空
- 硬盘缓存**只匹配输入前缀**，不影响输出随机性（temperature 仍生效）
- 缓存命中可带来约 **50x 成本降低**（以 V4 Flash 为例：$0.14 → $0.0028）

---

## 最佳实践

1. 将**稳定的内容放在前缀**（system prompt、文档、few-shot 示例）
2. 将**变动内容放在末尾**（当前用户问题）
3. **避免在 System Prompt 中插入动态变量**（时间戳、UUID、会话ID 等）
4. 监控 `prompt_cache_hit_tokens` / `prompt_cache_miss_tokens` 比例
