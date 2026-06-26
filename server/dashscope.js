/**
 * 阿里云百炼（DashScope）OpenAI 兼容 API 适配器
 * 用于将通义千问模型接入客服系统
 *
 * API 文档: https://help.aliyun.com/zh/model-studio/developer-reference/compatibility-of-openai-with-dashscope/
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
/**
 * 获取 DashScope API Key
 * 优先从环境变量 DASHSCOPE_API_KEY 获取
 */
export function getDashScopeApiKey() {
    return process.env.DASHSCOPE_API_KEY || null;
}
/**
 * 检查 DashScope 是否已配置
 */
export function isDashScopeConfigured() {
    return !!getDashScopeApiKey();
}
/**
 * 调用 DashScope 流式 Chat Completion API
 * 兼容 OpenAI 格式，使用 SSE 流式返回
 */
export function streamChatCompletion(options, callbacks) {
    return __awaiter(this, void 0, void 0, function () {
        var apiKey, model, messages, _a, temperature, _b, max_tokens, response, errorText, reader, decoder, fullText, buffer, _c, done, value, lines, _i, lines_1, line, trimmed, data, parsed, delta, error_1;
        var _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    apiKey = getDashScopeApiKey();
                    if (!apiKey) {
                        callbacks.onError(new Error("未配置 DASHSCOPE_API_KEY 环境变量"));
                        return [2 /*return*/];
                    }
                    model = options.model, messages = options.messages, _a = options.temperature, temperature = _a === void 0 ? 0.7 : _a, _b = options.max_tokens, max_tokens = _b === void 0 ? 2048 : _b;
                    return [4 /*yield*/, fetch("".concat(DASHSCOPE_BASE_URL, "/chat/completions"), {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": "Bearer ".concat(apiKey),
                            },
                            body: JSON.stringify({
                                model: model,
                                messages: messages,
                                temperature: temperature,
                                max_tokens: max_tokens,
                                stream: true,
                                // 关闭 thinking 模式，避免 qwen3 系列模型等待 reasoning_content 导致响应延迟
                                enable_thinking: false,
                            }),
                        })];
                case 1:
                    response = _g.sent();
                    if (!!response.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, response.text()];
                case 2:
                    errorText = _g.sent();
                    console.error("[DashScope] API \u9519\u8BEF (".concat(response.status, "):"), errorText);
                    callbacks.onError(new Error("DashScope API \u9519\u8BEF (".concat(response.status, "): ").concat(errorText)));
                    return [2 /*return*/];
                case 3:
                    reader = (_d = response.body) === null || _d === void 0 ? void 0 : _d.getReader();
                    if (!reader) {
                        callbacks.onError(new Error("无法读取响应流"));
                        return [2 /*return*/];
                    }
                    decoder = new TextDecoder();
                    fullText = "";
                    buffer = "";
                    _g.label = 4;
                case 4:
                    _g.trys.push([4, 8, , 9]);
                    _g.label = 5;
                case 5:
                    if (!true) return [3 /*break*/, 7];
                    return [4 /*yield*/, reader.read()];
                case 6:
                    _c = _g.sent(), done = _c.done, value = _c.value;
                    if (done)
                        return [3 /*break*/, 7];
                    buffer += decoder.decode(value, { stream: true });
                    lines = buffer.split("\n");
                    buffer = lines.pop() || ""; // 保留不完整的行
                    for (_i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
                        line = lines_1[_i];
                        trimmed = line.trim();
                        if (!trimmed || !trimmed.startsWith("data:"))
                            continue;
                        data = trimmed.slice(5).trim();
                        if (data === "[DONE]") {
                            callbacks.onDone(fullText);
                            return [2 /*return*/];
                        }
                        try {
                            parsed = JSON.parse(data);
                            delta = (_f = (_e = parsed.choices) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.delta;
                            if (delta === null || delta === void 0 ? void 0 : delta.content) {
                                fullText += delta.content;
                                callbacks.onText(delta.content);
                            }
                        }
                        catch (_h) {
                            // 忽略解析错误
                        }
                    }
                    return [3 /*break*/, 5];
                case 7:
                    // 流结束
                    callbacks.onDone(fullText);
                    return [3 /*break*/, 9];
                case 8:
                    error_1 = _g.sent();
                    callbacks.onError(new Error("\u6D41\u8BFB\u53D6\u9519\u8BEF: ".concat(error_1 === null || error_1 === void 0 ? void 0 : error_1.message)));
                    return [3 /*break*/, 9];
                case 9: return [2 /*return*/];
            }
        });
    });
}
/**
 * 预置的通义千问模型列表（仅使用 qwen3.6-plus 免费额度）
 */
export var DASHSCOPE_MODELS = [
    { modelId: "qwen3.6-plus", name: "Qwen3.6 Plus (通义千问)", provider: "dashscope", description: "阿里云通义千问 3.6 Plus，最新旗舰模型" },
];
// ============= Embedding API =============
/**
 * 调用 DashScope Text Embedding API
 * 使用 text-embedding-v3 模型，返回 1024 维 Float32Array
 *
 * API 文档: https://help.aliyun.com/zh/model-studio/developer-reference/text-embedding-api
 */
export function getEmbedding(text) {
    return __awaiter(this, void 0, void 0, function () {
        var apiKey, response, errorText, json, embedding;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    apiKey = getDashScopeApiKey();
                    if (!apiKey) {
                        throw new Error("未配置 DASHSCOPE_API_KEY 环境变量");
                    }
                    return [4 /*yield*/, fetch("".concat(DASHSCOPE_BASE_URL, "/embeddings"), {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": "Bearer ".concat(apiKey),
                            },
                            body: JSON.stringify({
                                model: "text-embedding-v3",
                                input: text,
                            }),
                        })];
                case 1:
                    response = _c.sent();
                    if (!!response.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, response.text()];
                case 2:
                    errorText = _c.sent();
                    throw new Error("DashScope Embedding API \u9519\u8BEF (".concat(response.status, "): ").concat(errorText));
                case 3: return [4 /*yield*/, response.json()];
                case 4:
                    json = _c.sent();
                    embedding = (_b = (_a = json.data) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.embedding;
                    if (!embedding || !Array.isArray(embedding)) {
                        throw new Error("Embedding API 返回数据格式异常");
                    }
                    return [2 /*return*/, new Float32Array(embedding)];
            }
        });
    });
}
