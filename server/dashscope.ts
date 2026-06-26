/**
 * 阿里云百炼（DashScope）OpenAI 兼容 API 适配器
 * 用于将通义千问模型接入客服系统
 * 
 * API 文档: https://help.aliyun.com/zh/model-studio/developer-reference/compatibility-of-openai-with-dashscope/
 */

const DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";

export interface DashScopeMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface DashScopeStreamOptions {
  model: string;
  messages: DashScopeMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface DashScopeStreamCallbacks {
  onText: (text: string) => void;
  onDone: (fullText: string) => void;
  onError: (error: Error) => void;
}

/**
 * 获取 DashScope API Key
 * 优先从环境变量 DASHSCOPE_API_KEY 获取
 */
export function getDashScopeApiKey(): string | null {
  return process.env.DASHSCOPE_API_KEY || null;
}

/**
 * 检查 DashScope 是否已配置
 */
export function isDashScopeConfigured(): boolean {
  return !!getDashScopeApiKey();
}

/**
 * 调用 DashScope 流式 Chat Completion API
 * 兼容 OpenAI 格式，使用 SSE 流式返回
 */
export async function streamChatCompletion(
  options: DashScopeStreamOptions,
  callbacks: DashScopeStreamCallbacks
): Promise<void> {
  const apiKey = getDashScopeApiKey();
  if (!apiKey) {
    callbacks.onError(new Error("未配置 DASHSCOPE_API_KEY 环境变量"));
    return;
  }

  const { model, messages, temperature = 0.7, max_tokens = 2048 } = options;

  const response = await fetch(`${DASHSCOPE_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens,
      stream: true,
      // 关闭 thinking 模式，避免 qwen3 系列模型等待 reasoning_content 导致响应延迟
      enable_thinking: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[DashScope] API 错误 (${response.status}):`, errorText);
    callbacks.onError(new Error(`DashScope API 错误 (${response.status}): ${errorText}`));
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError(new Error("无法读取响应流"));
    return;
  }

  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // 保留不完整的行

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;

        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") {
          callbacks.onDone(fullText);
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.content) {
            fullText += delta.content;
            callbacks.onText(delta.content);
          }
        } catch {
          // 忽略解析错误
        }
      }
    }

    // 流结束
    callbacks.onDone(fullText);
  } catch (error: any) {
    callbacks.onError(new Error(`流读取错误: ${error?.message}`));
  }
}

/**
 * 预置的通义千问模型列表（仅使用 qwen3.6-plus 免费额度）
 */
export const DASHSCOPE_MODELS = [
  { modelId: "qwen3.6-plus", name: "Qwen3.6 Plus (通义千问)", provider: "dashscope", description: "阿里云通义千问 3.6 Plus，最新旗舰模型" },
];

// ============= Embedding API =============

/**
 * 调用 DashScope Text Embedding API
 * 使用 text-embedding-v3 模型，返回 1024 维 Float32Array
 *
 * API 文档: https://help.aliyun.com/zh/model-studio/developer-reference/text-embedding-api
 */
export async function getEmbedding(text: string): Promise<Float32Array> {
  const apiKey = getDashScopeApiKey();
  if (!apiKey) {
    throw new Error("未配置 DASHSCOPE_API_KEY 环境变量");
  }

  const response = await fetch(`${DASHSCOPE_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "text-embedding-v3",
      input: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DashScope Embedding API 错误 (${response.status}): ${errorText}`);
  }

  const json = await response.json();
  const embedding = json.data?.[0]?.embedding;
  if (!embedding || !Array.isArray(embedding)) {
    throw new Error("Embedding API 返回数据格式异常");
  }

  return new Float32Array(embedding);
}
