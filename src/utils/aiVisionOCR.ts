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
 * 讯飞 HMAC-SHA256 签名生成
 * API Key 格式：<api_key>:<api_secret>
 */
async function generateXunfeiSignature(
  apiKey: string,
  apiSecret: string,
  fullUrl: string
): Promise<{ authorization: string; date: string; host: string }> {
  const url = new URL(fullUrl);
  const host = url.host;
  const date = new Date().toUTCString();
  const requestLine = `POST ${url.pathname} HTTP/1.1`;

  // 签名原文：host: xxx\ndate: xxx\nPOST /path HTTP/1.1
  const signatureOrigin = `host: ${host}\ndate: ${date}\n${requestLine}`;

  // 使用 Web Crypto API 做 HMAC-SHA256
  const keyData = new TextEncoder().encode(apiSecret);
  const msgData = new TextEncoder().encode(signatureOrigin);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  const signature = btoa(
    String.fromCharCode(...new Uint8Array(signatureBuffer))
  );

  const authorization = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;

  return { authorization, date, host };
}

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
 *
 * 严格按官方文档实现：https://www.xfyun.cn/doc/spark/%E5%9B%BE%E5%83%8F%E7%90%86%E8%A7%A3API-http.html
 *
 * 关键点（来自官方文档）:
 *   1. 鉴权方式：OpenAI 兼容接口 - Bearer Token（无需 HMAC 签名）
 *   2. API Key: 从「服务管控 > 模型服务列表」复制对应服务的 APIKey（简单字符串）
 *   3. 请求地址: https://maas-api.cn-huabei-1.xf-yun.com/v2（2026年1月10日后发布服务）
 *   4. messages.role: 仅支持 "user"（文档明确标注）
 *   5. Model ID: 从「服务管控 > 模型服务列表」获取（如：xqwen2d5s32bvl 等）
 */
async function callXunfei(
  imageDataUrl: string,
  config: AIVisionConfig
): Promise<AIVisionResult> {
  const rawKey = config.xunfeiApiKey.trim();
  const modelId = config.xunfeiModelId || "";
  const baseURL = config.xunfeiBaseURL || "https://maas-api.cn-huabei-1.xf-yun.com/v2";

  if (!rawKey) {
    throw new Error("请先在设置中填写讯飞 API Key");
  }
  if (!modelId) {
    throw new Error("请先在设置中填写讯飞 Model ID（从服务管控页面获取）");
  }

  // API Key 处理：按官方文档是简单字符串，但若用户粘贴的是 "api_key:api_secret"，
  // 取冒号前面的部分作为真正的 Key（兼容两种输入）
  const colonIdx = rawKey.indexOf(":");
  const apiKey = colonIdx > 0 ? rawKey.substring(0, colonIdx).trim() : rawKey;

  const match = imageDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) throw new Error("无效的图片数据");
  const [, imageFormat, base64Data] = match;

  // 按官方文档：role 只支持 "user"，content 为包含 text + image_url 的数组
  // 将系统提示合并到用户消息的 text 里
  const fullPrompt = `${SYSTEM_PROMPT}\n\n请识别这张优惠券图片，返回 JSON 格式结果。`;

  const requestBody = {
    model: modelId,
    messages: [
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
            text: fullPrompt,
          },
        ],
      },
    ],
    max_tokens: 2048,
    temperature: 0.5,
    stream: false,
  };

  const url = `${baseURL}/chat/completions`;

  // Debug 日志（脱敏 Key）
  const maskedKey = apiKey.length > 8
    ? apiKey.substring(0, 4) + "..." + apiKey.substring(apiKey.length - 4)
    : "***";
  console.log(`[Xunfei] 请求: POST ${url}`);
  console.log(`[Xunfei]   API Key: ${maskedKey} (长度: ${apiKey.length})`);
  console.log(`[Xunfei]   Model ID: ${modelId}`);
  console.log(`[Xunfei]   Headers: Authorization=Bearer, Content-Type=application/json`);

  const response = await fetchWithCorsProxy(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    },
    config.useCorsProxy
  );

  console.log(`[Xunfei]   响应状态: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Xunfei]   错误响应: ${errorText}`);
    throw buildXunfeiError(response.status, errorText, {
      apiKeyLength: apiKey.length,
      modelId,
      url,
    });
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  console.log(`[Xunfei]   成功，响应内容长度: ${content.length}`);

  return parseAIResponse(content);
}

function buildXunfeiError(
  status: number,
  errorText: string,
  info: { apiKeyLength: number; modelId: string; url: string }
): Error {
  let hint = "";

  if (status === 401) {
    hint =
      "\n\n🔧 401 鉴权失败（参考官方文档）：\n" +
      `   - API Key 长度: ${info.apiKeyLength} 字符\n` +
      `   - 使用的 Model ID: ${info.modelId}\n` +
      `   - 请求地址: ${info.url}\n` +
      "   排查步骤:\n" +
      "   1. 登录讯飞开放平台，进入「服务管控 > 模型服务列表」\n" +
      "   2. 找到你开通的图像理解服务，复制「APIKey」（不是 WebSocket 接口的 APPID/APIKey/APISecret）\n" +
      "   3. 复制该服务对应的「Model ID」（通常是 xqwen2d5s32bvl 这类格式）\n" +
      "   4. 确认 API 地址：2026年1月10日后发布的服务用 /v2，之前的用 /v1\n" +
      "   5. 确认账号额度充足\n" +
      "\n⚠️ 注意：HTTP OpenAI 兼容接口使用简单的 Bearer Token，\n" +
      "       与 WebSocket 接口的 APPID/APISecret 不是一套密钥！\n" +
      "\n原始错误信息：";
  } else if (status === 403) {
    hint =
      "\n\n🔧 403 错误：\n" +
      "   - 可能是模型 ID 与 API Key 不匹配（APIKey 只对对应服务的模型有权限）\n" +
      "   - 可能是地区/IP 限制\n" +
      "   - 请确认 Model ID 与 API Key 来自同一个服务\n" +
      "\n原始错误信息：";
  } else if (status === 500 || status === 503) {
    hint =
      "\n\n⚠️ 服务端错误：通常是账号额度不足或 Model ID 错误，请到讯飞控制台检查。\n原始错误：";
  } else if (status === 0 || status === 400 || status === 429) {
    hint =
      "\n\n⚠️ 请求失败或被限流：请稍后重试，或检查参数是否正确。\n原始错误：";
  }

  return new Error(`讯飞星火 API 错误: ${status || "网络"}${hint}${errorText}`);
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