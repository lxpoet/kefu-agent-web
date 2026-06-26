/**
 * 阿里云百炼（DashScope）OpenAI 兼容 API 适配器
 * 用于将通义千问模型接入客服系统
 *
 * API 文档: https://help.aliyun.com/zh/model-studio/developer-reference/compatibility-of-openai-with-dashscope/
 */
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
export declare function getDashScopeApiKey(): string | null;
/**
 * 检查 DashScope 是否已配置
 */
export declare function isDashScopeConfigured(): boolean;
/**
 * 调用 DashScope 流式 Chat Completion API
 * 兼容 OpenAI 格式，使用 SSE 流式返回
 */
export declare function streamChatCompletion(options: DashScopeStreamOptions, callbacks: DashScopeStreamCallbacks): Promise<void>;
/**
 * 预置的通义千问模型列表（仅使用 qwen3.6-plus 免费额度）
 */
export declare const DASHSCOPE_MODELS: {
    modelId: string;
    name: string;
    provider: string;
    description: string;
}[];
/**
 * 调用 DashScope Text Embedding API
 * 使用 text-embedding-v3 模型，返回 1024 维 Float32Array
 *
 * API 文档: https://help.aliyun.com/zh/model-studio/developer-reference/text-embedding-api
 */
export declare function getEmbedding(text: string): Promise<Float32Array>;
