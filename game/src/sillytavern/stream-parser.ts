/**
 * Streaming XML tag parser for AI responses.
 *
 * State machine:
 *   NORMAL      — outside any registered tag; chars emit as `raw`.
 *   BUFFER_TAG  — saw `<`; accumulating tag name until `>` (or overflow).
 *   TAGGED      — inside a transparent tag; chars emit as `tag-chunk`,
 *                 nested `<` re-enters BUFFER_TAG so closing tag can be detected.
 *   OPAQUE      — inside `thinking`/`think`-style tag; chars emit as `tag-chunk`
 *                 but inner `<...>` is NOT parsed; we only watch for `</tagname>`.
 *
 * Tag nesting: when a registered tag opens inside another, the parent state is
 * pushed onto a stack and restored when the child closes.
 */

export type ParserEvent =
  | { type: 'tag-open'; tag: string }
  | { type: 'tag-chunk'; tag: string; chunk: string }
  | { type: 'tag-close'; tag: string; full: string }
  | { type: 'option-line'; line: string }
  | { type: 'raw'; chunk: string };

type State = 'NORMAL' | 'BUFFER_TAG' | 'TAGGED' | 'OPAQUE';

interface StackFrame {
  state: State;
  currentTag: string;
  currentBuf: string;
  optionBuf: string;
}

const PARTIAL_LIMIT = 64;

export class StreamTagParser {
  private state: State = 'NORMAL';
  private partial = '';
  private currentTag = '';
  private currentBuf = '';
  private optionBuf = '';
  private events: ParserEvent[] = [];
  private stack: StackFrame[] = [];
  private priorState: State = 'NORMAL';

  constructor(
    private readonly tags: string[],
    private readonly opaqueTags: string[],
  ) {}

  feed(chunk: string): ParserEvent[] {
    this.events = [];
    for (const ch of chunk) this.consumeChar(ch);
    return this.events;
  }

  finish(): ParserEvent[] {
    this.events = [];
    if (this.state === 'BUFFER_TAG' && this.partial) {
      this.events.push({ type: 'raw', chunk: '<' + this.partial });
      this.partial = '';
    }
    // Flush from innermost to outermost
    while (this.state === 'TAGGED' || this.state === 'OPAQUE') {
      if (this.state === 'TAGGED' && this.currentTag === 'option' && this.optionBuf) {
        this.events.push({ type: 'option-line', line: this.optionBuf });
        this.optionBuf = '';
      }
      this.events.push({ type: 'tag-close', tag: this.currentTag, full: this.currentBuf });
      this.currentBuf = '';
      this.currentTag = '';
      this.restoreParent();
    }
    this.state = 'NORMAL';
    return this.events;
  }

  reset() {
    this.state = 'NORMAL';
    this.priorState = 'NORMAL';
    this.partial = '';
    this.currentTag = '';
    this.currentBuf = '';
    this.optionBuf = '';
    this.stack = [];
  }

  private pushParent() {
    this.stack.push({
      state: this.priorState,
      currentTag: this.currentTag,
      currentBuf: this.currentBuf,
      optionBuf: this.optionBuf,
    });
  }

  private restoreParent() {
    if (this.stack.length > 0) {
      const frame = this.stack.pop()!;
      this.state = frame.state;
      this.currentTag = frame.currentTag;
      this.currentBuf = frame.currentBuf;
      this.optionBuf = frame.optionBuf;
    } else {
      this.state = 'NORMAL';
      this.currentTag = '';
      this.currentBuf = '';
      this.optionBuf = '';
    }
  }

  private consumeChar(ch: string) {
    if (this.state === 'NORMAL') {
      if (ch === '<') {
        this.priorState = 'NORMAL';
        this.state = 'BUFFER_TAG';
        this.partial = '';
      } else {
        this.events.push({ type: 'raw', chunk: ch });
      }
      return;
    }
    if (this.state === 'BUFFER_TAG') {
      if (ch === '>') {
        this.flushTagBuffer();
        return;
      }
      if (this.partial.length >= PARTIAL_LIMIT) {
        this.events.push({ type: 'raw', chunk: '<' + this.partial + ch });
        this.partial = '';
        this.state = 'NORMAL';
        return;
      }
      this.partial += ch;
      return;
    }
    if (this.state === 'OPAQUE') {
      this.currentBuf += ch;
      const closeMarker = `</${this.currentTag}>`;
      if (this.currentBuf.endsWith(closeMarker)) {
        const full = this.currentBuf.slice(0, -closeMarker.length);
        this.events.push({ type: 'tag-chunk', tag: this.currentTag, chunk: ch });
        this.events.push({ type: 'tag-close', tag: this.currentTag, full });
        this.currentBuf = '';
        this.currentTag = '';
        this.restoreParent();
      } else {
        this.events.push({ type: 'tag-chunk', tag: this.currentTag, chunk: ch });
      }
      return;
    }
    if (this.state === 'TAGGED') {
      if (ch === '<') {
        this.priorState = 'TAGGED';
        this.state = 'BUFFER_TAG';
        this.partial = '';
        return;
      }
      if (this.currentTag === 'option' && ch === '\n') {
        this.events.push({ type: 'option-line', line: this.optionBuf });
        this.optionBuf = '';
      } else if (this.currentTag === 'option') {
        this.optionBuf += ch;
      }
      this.currentBuf += ch;
      this.events.push({ type: 'tag-chunk', tag: this.currentTag, chunk: ch });
      return;
    }
  }

  private flushTagBuffer() {
    const tagText = this.partial;
    this.partial = '';
    const isClose = tagText.startsWith('/');
    const name = isClose ? tagText.slice(1) : tagText;

    if (isClose) {
      if (this.currentTag && this.currentTag === name) {
        // Matching close for current tag
        if (this.currentTag === 'option' && this.optionBuf) {
          this.events.push({ type: 'option-line', line: this.optionBuf });
          this.optionBuf = '';
        }
        this.events.push({ type: 'tag-close', tag: this.currentTag, full: this.currentBuf });
        this.currentBuf = '';
        this.currentTag = '';
        this.restoreParent();
      } else if (this.stack.some(f => f.currentTag === name)) {
        // Close tag matches a parent — auto-close current tag, then retry
        if (this.currentTag && this.currentBuf) {
          if (this.currentTag === 'option' && this.optionBuf) {
            this.events.push({ type: 'option-line', line: this.optionBuf });
            this.optionBuf = '';
          }
          this.events.push({ type: 'tag-close', tag: this.currentTag, full: this.currentBuf });
        }
        this.currentBuf = '';
        this.currentTag = '';
        this.restoreParent();
        // Re-process the close tag against the now-restored parent
        if (this.currentTag === name) {
          if (this.currentTag === 'option' && this.optionBuf) {
            this.events.push({ type: 'option-line', line: this.optionBuf });
            this.optionBuf = '';
          }
          this.events.push({ type: 'tag-close', tag: this.currentTag, full: this.currentBuf });
          this.currentBuf = '';
          this.currentTag = '';
          this.restoreParent();
        } else {
          this.events.push({ type: 'raw', chunk: `</${name}>` });
          this.state = 'NORMAL';
        }
      } else {
        // Stray close
        this.events.push({ type: 'raw', chunk: `</${name}>` });
        this.state = 'NORMAL';
      }
      return;
    }

    if (!this.tags.includes(name)) {
      this.events.push({ type: 'raw', chunk: `<${name}>` });
      this.state = 'NORMAL';
      return;
    }

    // Opening a nested tag — push parent onto stack (use priorState since we're in BUFFER_TAG now)
    if (this.priorState === 'TAGGED' || this.priorState === 'OPAQUE') {
      this.pushParent();
    }
    this.priorState = 'NORMAL';

    this.currentTag = name;
    this.currentBuf = '';
    this.optionBuf = '';
    this.events.push({ type: 'tag-open', tag: name });
    this.state = this.opaqueTags.includes(name) ? 'OPAQUE' : 'TAGGED';
  }
}

// ── Tool Call Delta Buffer ──

/** 流式 tool_call 累积缓冲区 */
export interface ToolCallAccumulator {
  id: string;
  name: string;
  arguments: string;
  complete: boolean;
}

/**
 * 解析 SSE chunk 中的 tool_call delta。
 * 返回当前累积中的所有工具调用（含未完成的）。
 *
 * OpenAI 流式格式：
 *   delta.tool_calls: [{ index, id?, type?, function?: { name?, arguments? } }]
 */
export function parseToolCallDeltas(
  data: unknown,
  accumulators: Map<number, ToolCallAccumulator>,
): Map<number, ToolCallAccumulator> {
  const parsed = data as any;
  const toolCalls = parsed?.choices?.[0]?.delta?.tool_calls;
  if (!Array.isArray(toolCalls)) return accumulators;

  for (const tc of toolCalls) {
    const index: number = tc.index ?? 0;

    let acc = accumulators.get(index);
    if (!acc) {
      acc = { id: '', name: '', arguments: '', complete: false };
      accumulators.set(index, acc);
    }

    if (tc.id) acc.id = tc.id;
    if (tc.type === 'function' || tc.function) {
      const func = tc.function ?? {};
      if (func.name) acc.name = func.name;
      if (func.arguments) acc.arguments += func.arguments;
    }
    // 也支持简化的 delta 格式
    if (tc.name && !acc.name) acc.name = tc.name;
    if (typeof tc.arguments === 'string') acc.arguments += tc.arguments;
  }

  return accumulators;
}

/** 从 SSE chunk 提取文本 delta */
export function parseTextDelta(data: unknown): string {
  const parsed = data as any;
  return parsed?.choices?.[0]?.delta?.content ?? '';
}

/** 从 SSE chunk 提取 thinking delta（DeepSeek reasoning_content） */
export function parseThinkingDelta(data: unknown): string {
  const parsed = data as any;
  // DeepSeek / XAI 格式
  const reasoningContent = parsed?.choices?.[0]?.delta?.reasoning_content ?? '';
  if (reasoningContent) return reasoningContent;
  // OpenRouter 格式
  const reasoning = parsed?.choices?.[0]?.delta?.reasoning ?? '';
  return reasoning;
}

/** 从 SSE chunk 提取 usage */
export function parseUsage(data: unknown): { hit: number; miss: number; generated: number } | null {
  const parsed = data as any;
  const usage = parsed?.choices?.[0]?.usage ?? parsed?.usage;
  if (!usage) return null;
  return {
    hit: usage.prompt_cache_hit_tokens ?? 0,
    miss: usage.prompt_cache_miss_tokens ?? 0,
    generated: usage.completion_tokens ?? 0,
  };
}

/** 检查 accumulator 中的所有工具调用是否参数接收完整（以 "}" 结尾的 JSON 字符串或空参数） */
export function areToolCallsComplete(accumulators: Map<number, ToolCallAccumulator>): boolean {
  for (const acc of accumulators.values()) {
    if (!acc.name) continue; // 还未收到 name，不算完整
    const trimmed = acc.arguments.trim();
    // 空参数也视为完成（如无参数工具）
    if (trimmed === '') { acc.complete = true; continue; }
    // 尝试 parse JSON，成功则完成
    try { JSON.parse(trimmed); acc.complete = true; } catch { acc.complete = false; return false; }
  }
  return true;
}
