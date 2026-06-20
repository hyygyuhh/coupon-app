/**
 * AI 视觉识别服务
 *
 * 支持多种 AI 模型识别优惠券图片：
 * - Qwen2.5-VL-7B
 * - 讯飞星火图像理解
 *
 * 注：浏览器直接调用第三方 API 时可能遇到 CORS 跨域限制，
 * 本模块会自动尝试通过公共 CORS 代理转发请求。
 */

import type { CouponInput } from "../types/coupon";

export type AIProvider = "qwen" | "xunfei";

export interface AIVisionConfig {
  provider: AIProvider;
  qwenApiKey: string;
  qwenBaseURL: string;
  xunfeiApiKey: string;
  xunfeiModelId: string;
  xunfeiBaseURL: string;
  useCorsProxy: boolean;
}

const CONFIG_KEY = "ai-vision-config";

export function getAIVisionConfig(): AIVisionConfig {
  const stored = localStorage.getItem(CONFIG_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return {
        provider: parsed.provider || "qwen",
        qwenApiKey: parsed.qwenApiKey || parsed.apiKey || "",
        qwenBaseURL: parsed.qwenBaseURL || parsed.baseURL || "https://agentrs.jd.com/api/saas/openai-u/v1",
        xunfeiApiKey: parsed.xunfeiApiKey || "",
        xunfeiModelId: parsed.xunfeiModelId || "",
        xunfeiBaseURL: parsed.xunfeiBaseURL || "https://maas-api.cn-huabei-1.xf-yun.com/v2",
        useCorsProxy: parsed.useCorsProxy !== undefined ? parsed.useCorsProxy : true,
      };
    } catch {
      // ignore
    }
  }
  return {
    provider: "qwen",
    qwenApiKey: "",
    qwenBaseURL: "https://agentrs.jd.com/api/saas/openai-u/v1",
    xunfeiApiKey: "",
    xunfeiModelId: "",
    xunfeiBaseURL: "https://maas-api.cn-huabei-1.xf-yun.com/v2",
    useCorsProxy: true,
  };
}

export function saveAIVisionConfig(config: AIVisionConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

// 识别结果
export interface AIVisionResult {
  coupons: CouponInput[];
  rawText?: string;
  confidence: number;
}

const SYSTEM_PROMPT = `你是一个优惠券识别助手。用户会发送一张或多张优惠券的截图，请识别并提取优惠券信息。

请返回 JSON 格式的结果，包含 coupons 数组，每个元素包含：
- name: 优惠券名称（必填）
- platform: 平台名称，如"霸王茶姬"、"瑞幸咖啡"、"美团"等
- amount: 面额，如"¥20"、"满100减20"、"5折"、"免单"
- expiryDate: 到期日期，格式为 YYYY-MM-DD
- note: 使用说明或限制条件

注意事项：
1. 只识别真正的优惠券，忽略"使用规则"、"适用门店"等说明文字
2. 如果图片中有多张券，返回多个元素
3. 如果无法识别到有效优惠券，返回空数组
4. 日期请转换为 YYYY-MM-DD 格式
5. 面额统一格式：¥数字、满X减Y、X折、免单

只返回 JSON，不要其他文字。`;

// CORS 代理列表（按优先级尝试）
// 注意：代理只负责转发请求，不会修改请求头或响应内容
const CORS_PROXIES = [
  "https://corsproxy.io/?",
  "https://api.allorigins.win/raw?url=",
];

/**
 * 使用 CORS 代理执行 fetch 请求
 * 先尝试直连，失败再依次尝试代理
 */
async function fetchWithCorsProxy(
  url: string,
  options: RequestInit,
  useProxy: boolean
): Promise<Response> {
  // 先尝试直连
  if (!useProxy) {
    return await fetch(url, options);
  }

  const attempts: string[] = [];
  let lastError: Error | null = null;

  // 1) 先直连
  try {
    attempts.push("直连");
    const response = await fetch(url, options);
    return response;
  } catch (e: any) {
    lastError = e;
    console.warn("[CORS] 直连失败，尝试代理:", e?.message);
  }

  // 2) 依次尝试 CORS 代理
  for (const proxyPrefix of CORS_PROXIES) {
    try {
      attempts.push(`代理:${proxyPrefix.split("?")[0]}`);
      const proxiedUrl = proxyPrefix + encodeURIComponent(url);
      const response = await fetch(proxiedUrl, options);
      return response;
    } catch (e: any) {
      lastError = e;
      console.warn("[CORS] 代理失败:", e?.message);
    }
  }

  // 3) 全部失败
  throw new Error(
    `所有请求方式均失败（尝试：${attempts.join(" / ")}）。` +
      `最后错误: ${lastError?.message || "Failed to fetch"}。` +
      `\n原因：浏览器 CORS 跨域限制。` +
      `\n建议：检查 API Key 是否正确，或在设置中开启 CORS 代理。`
  );
}

/**
 * 调用 Qwen2.5-VL-7B
 * API: https://agentrs.jd.com/api/saas/openai-u/v1/chat/completions
 */
async function callQwen(
  imageDataUrl: string,
  config: AIVisionConfig
): Promise<AIVisionResult> {
  const baseURL = config.qwenBaseURL || "https://agentrs.jd.com/api/saas/openai-u/v1";

  const match = imageDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) throw new Error("无效的图片数据");
  const [, imageFormat, base64Data] = match;

  const body = JSON.stringify({
    model: "Qwen2.5-VL-7B",
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:image/${imageFormat};base64,${base64Data}`,
            },
          },
          {
            type: "text",
            text: "请识别这张优惠券图片，返回 JSON 格式结果。",
          },
        ],
      },
    ],
    max_tokens: 2000,
    temperature: 0.5,
  });

  const response = await fetchWithCorsProxy(
    `${baseURL}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        Authorization: `Bearer ${config.qwenApiKey}`,
      },
      body,
    },
    config.useCorsProxy
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Qwen API 错误: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  return parseAIResponse(content);
}

/**
 * 解析 AI 返回的 JSON
 */
function parseAIResponse(content: string): AIVisionResult {
  let jsonStr = content;

  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  const jsonObjectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonObjectMatch) {
    jsonStr = jsonObjectMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr);
    const coupons: CouponInput[] = (parsed.coupons || []).map((c: any) => ({
      name: c.name || "",
      platform: c.platform || "",
      amount: c.amount || "",
      expiryDate: c.expiryDate || "",
      note: c.note || "",
      code: c.code || "",
      url: c.url || "",
      tags: c.tags || [],
    }));

    return {
      coupons,
      rawText: content,
      confidence: 95,
    };
  } catch (e) {
    console.error("解析 AI 响应失败:", e, content);
    return {
      coupons: [],
      rawText: content,
      confidence: 0,
    };
  }
}

/**
 * 调用讯飞星火图像理解
 * API: https://maas-api.cn-huabei-1.xf-yun.com/v2/chat/completions
 */
async function callXunfei(
  imageDataUrl: string,
  config: AIVisionConfig
): Promise<AIVisionResult> {
  const baseURL = config.xunfeiBaseURL || "https://maas-api.cn-huabei-1.xf-yun.com/v2";
  const modelId = config.xunfeiModelId || "imagev3";

  const match = imageDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) throw new Error("无效的图片数据");
  const [, imageFormat, base64Data] = match;

  const body = JSON.stringify({
    model: modelId,
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:image/${imageFormat};base64,${base64Data}`,
            },
          },
          {
            type: "text",
            text: "请识别这张优惠券图片，返回 JSON 格式结果。",
          },
        ],
      },
    ],
    max_tokens: 2000,
    temperature: 0.5,
  });

  const response = await fetchWithCorsProxy(
    `${baseURL}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        Authorization: `Bearer ${config.xunfeiApiKey}`,
      },
      body,
    },
    config.useCorsProxy
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`讯飞星火 API 错误: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  return parseAIResponse(content);
}

/**
 * 使用 AI 识别优惠券（根据配置选择服务商）
 */
export async function recognizeWithAI(
  file: File,
  onProgress?: (progress: number, status: string) => void
): Promise<AIVisionResult> {
  const config = getAIVisionConfig();

  const hasKey = config.provider === "qwen" ? config.qwenApiKey : config.xunfeiApiKey;
  if (!hasKey) {
    throw new Error(`请先在设置中配置 ${config.provider === "qwen" ? "Qwen" : "讯飞星火"} API Key`);
  }

  onProgress?.(0.1, "正在准备图片");

  const imageDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const providerName = config.provider === "qwen" ? "Qwen" : "讯飞星火";
  onProgress?.(0.3, `正在调用 ${providerName} AI 识别`);

  try {
    const result = config.provider === "qwen"
      ? await callQwen(imageDataUrl, config)
      : await callXunfei(imageDataUrl, config);
    onProgress?.(1, "识别完成");
    return result;
  } catch (error: any) {
    console.error(`[${providerName} AI] 识别失败:`, error);
    onProgress?.(0, `识别失败: ${error.message}`);
    throw error;
  }
}

/**
 * 判断是否配置了 API Key
 */
export function hasAIConfig(): boolean {
  const config = getAIVisionConfig();
  return config.provider === "qwen" ? !!config.qwenApiKey : !!config.xunfeiApiKey;
}

// 兼容旧函数名
export const recognizeWithQwen = recognizeWithAI;
export const hasQwenConfig = hasAIConfig;