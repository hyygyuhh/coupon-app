/**
 * AI 视觉识别服务
 * 
 * 使用 AI 大模型的视觉能力直接识别优惠券图片，
 * 一步完成 OCR 识别 + 结构化解析，准确率最高。
 * 
 * 支持的服务商：
 * - OpenAI (GPT-4V / GPT-4o)
 * - Anthropic (Claude 3.5 Sonnet)
 * - Google (Gemini Pro Vision)
 * - DeepSeek (DeepSeek Vision)
 */

import type { CouponInput } from "../types/coupon";

export type AIVisionProvider = "openai" | "anthropic" | "google" | "deepseek" | "kimi";

export interface AIVisionConfig {
  provider: AIVisionProvider;
  apiKey: string;
  baseURL?: string; // 自定义 API 地址（用于代理）
}

const CONFIG_KEY = "ai-vision-config";

export function getAIVisionConfig(): AIVisionConfig {
  const stored = localStorage.getItem(CONFIG_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // ignore
    }
  }
  return {
    provider: "openai",
    apiKey: "",
    baseURL: "",
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

// AI 提示词
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

/**
 * 调用 OpenAI GPT-4V / GPT-4o
 */
async function callOpenAI(
  imageDataUrl: string,
  config: AIVisionConfig
): Promise<AIVisionResult> {
  const baseURL = config.baseURL || "https://api.openai.com/v1";
  
  const response = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini", // 最便宜的视觉模型
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
              image_url: { url: imageDataUrl },
            },
            {
              type: "text",
              text: "请识别这张优惠券图片，返回 JSON 格式结果。",
            },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API 错误: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  return parseAIResponse(content);
}

/**
 * 调用 Anthropic Claude
 */
async function callAnthropic(
  imageDataUrl: string,
  config: AIVisionConfig
): Promise<AIVisionResult> {
  const baseURL = config.baseURL || "https://api.anthropic.com/v1";

  // 提取 base64 和媒体类型
  const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) throw new Error("无效的图片数据");
  const [, mediaType, base64Data] = match;

  const response = await fetch(`${baseURL}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Data,
              },
            },
            {
              type: "text",
              text: "请识别这张优惠券图片，返回 JSON 格式结果。",
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API 错误: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.content?.[0]?.text || "";

  return parseAIResponse(content);
}

/**
 * 调用 Google Gemini
 */
async function callGoogle(
  imageDataUrl: string,
  config: AIVisionConfig
): Promise<AIVisionResult> {
  const baseURL = config.baseURL || "https://generativelanguage.googleapis.com/v1beta";

  // 提取 base64 数据
  const match = imageDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) throw new Error("无效的图片数据");
  const [, imageFormat, base64Data] = match;

  const response = await fetch(
    `${baseURL}/models/gemini-1.5-flash:generateContent?key=${config.apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: SYSTEM_PROMPT + "\n\n请识别这张优惠券图片，返回 JSON 格式结果。" },
              {
                inline_data: {
                  mime_type: `image/${imageFormat}`,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2000,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google API 错误: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  return parseAIResponse(content);
}

/**
 * 调用 DeepSeek Vision
 */
async function callDeepSeek(
  imageDataUrl: string,
  config: AIVisionConfig
): Promise<AIVisionResult> {
  const baseURL = config.baseURL || "https://api.deepseek.com/v1";

  const response = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
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
              image_url: { url: imageDataUrl },
            },
            {
              type: "text",
              text: "请识别这张优惠券图片，返回 JSON 格式结果。",
            },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepSeek API 错误: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  return parseAIResponse(content);
}

/**
 * 调用 Kimi (Moonshot)
 * API: https://agentrs.jd.com/api/saas/openai-u/v1/chat/completions
 */
async function callKimi(
  imageDataUrl: string,
  config: AIVisionConfig
): Promise<AIVisionResult> {
  const baseURL = config.baseURL || "https://agentrs.jd.com/api/saas/openai-u/v1";

  // 提取 base64 数据
  const match = imageDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) throw new Error("无效的图片数据");
  const [, imageFormat, base64Data] = match;

  const response = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: "Kimi-K2.6",
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
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Kimi API 错误: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  return parseAIResponse(content);
}

/**
 * 解析 AI 返回的 JSON
 */
function parseAIResponse(content: string): AIVisionResult {
  // 尝试提取 JSON
  let jsonStr = content;

  // 如果包含 markdown 代码块，提取其中的 JSON
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  // 尝试找到 JSON 对象
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
    // 返回空结果而不是抛出错误
    return {
      coupons: [],
      rawText: content,
      confidence: 0,
    };
  }
}

/**
 * 使用 AI 视觉模型识别优惠券
 */
export async function recognizeWithAIVision(
  file: File,
  onProgress?: (progress: number, status: string) => void
): Promise<AIVisionResult> {
  const config = getAIVisionConfig();

  if (!config.apiKey) {
    throw new Error("请先在设置中配置 AI 视觉识别的 API Key");
  }

  onProgress?.(0.1, "正在准备图片");

  // 将文件转换为 base64
  const imageDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  onProgress?.(0.3, `正在调用 ${config.provider} AI 识别`);

  try {
    let result: AIVisionResult;

    switch (config.provider) {
      case "openai":
        result = await callOpenAI(imageDataUrl, config);
        break;
      case "anthropic":
        result = await callAnthropic(imageDataUrl, config);
        break;
      case "google":
        result = await callGoogle(imageDataUrl, config);
        break;
      case "deepseek":
        result = await callDeepSeek(imageDataUrl, config);
        break;
      case "kimi":
        result = await callKimi(imageDataUrl, config);
        break;
      default:
        throw new Error(`不支持的 AI 服务商: ${config.provider}`);
    }

    onProgress?.(1, "识别完成");
    return result;
  } catch (error: any) {
    console.error("[AI Vision] 识别失败:", error);
    onProgress?.(0, `识别失败: ${error.message}`);
    throw error;
  }
}

/**
 * 判断是否应该使用 AI 视觉识别
 */
export function shouldUseAIVision(): boolean {
  const config = getAIVisionConfig();
  return !!config.apiKey;
}
