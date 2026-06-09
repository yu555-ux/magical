import type { ApiSettings, ApiTarget, Task } from './types';

interface ChatRequest {
  messages: Array<{ role: string; content: string }>;
  [key: string]: any;
}

interface CallResult {
  targetUsed: ApiTarget;
  response: Response;
}

interface RouterDeps {
  fetch?: typeof fetch;
}

export function createApiRouter(settings: ApiSettings, deps: RouterDeps = {}) {
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  const useSecondary = !!settings.secondary?.enabled;

  function targetFor(task: Task): ApiTarget {
    if (!useSecondary) return 'primary';
    return task === 'story' ? 'primary' : 'secondary';
  }

  function endpointFor(target: ApiTarget) {
    if (target === 'secondary' && settings.secondary) {
      return {
        baseUrl: settings.secondary.baseUrl,
        apiKey: settings.secondary.apiKey,
        model: settings.secondary.model,
      };
    }
    return { baseUrl: settings.baseUrl, apiKey: settings.apiKey, model: settings.model };
  }

  async function callOnce(target: ApiTarget, body: ChatRequest, signal?: AbortSignal): Promise<Response> {
    const ep = endpointFor(target);
    return await fetchImpl(`${ep.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ep.apiKey}`,
      },
      body: JSON.stringify({ ...body, model: ep.model }),
      signal,
    });
  }

  async function call(task: Task, payload: ChatRequest, signal?: AbortSignal): Promise<CallResult> {
    const target = targetFor(task);
    if (target === 'secondary') {
      try {
        const res = await callOnce('secondary', payload, signal);
        if (!res.ok) throw new Error(`secondary HTTP ${res.status}`);
        return { targetUsed: 'secondary', response: res };
      } catch {
        const res = await callOnce('primary', payload, signal);
        return { targetUsed: 'primary', response: res };
      }
    }
    const res = await callOnce('primary', payload, signal);
    return { targetUsed: 'primary', response: res };
  }

  /**
   * Agent 模式：发送带工具定义的流式请求。
   * 使用主 API，通过 fetch + ReadableStream 返回流式响应。
   */
  async function callAgent(
    payload: {
      messages: Array<{ role: string; content: string }>;
      tools?: Record<string, unknown>[];
      temperature?: number;
      top_p?: number;
      top_k?: number;
      frequency_penalty?: number;
      presence_penalty?: number;
      max_tokens?: number;
    },
    signal?: AbortSignal,
  ): Promise<Response> {
    const ep = endpointFor('primary');
    const body: Record<string, unknown> = {
      model: ep.model,
      messages: payload.messages,
      stream: true,
    };

    // 添加工具
    if (payload.tools && payload.tools.length > 0) {
      body.tools = payload.tools;
      body.tool_choice = 'auto';
    }

    // 添加采样参数
    if (payload.temperature !== undefined) body.temperature = payload.temperature;
    if (payload.top_p !== undefined) body.top_p = payload.top_p;
    if (payload.top_k !== undefined) body.top_k = payload.top_k;
    if (payload.frequency_penalty !== undefined) body.frequency_penalty = payload.frequency_penalty;
    if (payload.presence_penalty !== undefined) body.presence_penalty = payload.presence_penalty;
    if (payload.max_tokens !== undefined) body.max_tokens = payload.max_tokens;

    return await fetchImpl(`${ep.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ep.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });
  }

  return { targetFor, call, callAgent };
}

export type ApiRouter = ReturnType<typeof createApiRouter>;
