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
 * 从响应数据中提取文本内容（兼容多种返回格式）
 *   格式1: { choices: [{ message: { content: "..." } }] }  —— OpenAI 图像理解格式
 *   格式2: { choices: [{ text: "..." }] }                  —— OpenAI completions 格式
 *   格式3: { result: "..." } 或 { data: "..." } 或 { text: "..." }  —— 自定义 OCR 返回
 *   格式4: string 原始文本
 */
function extractXunfeiContent(data: any): string {
  // 格式1: chat.completions
  if (data?.choices?.[0]?.message?.content) {
    return data.choices[0].message.content;
  }
  // 格式2: completions
  if (data?.choices?.[0]?.text) {
    return data.choices[0].text;
  }
  if (typeof data?.choices?.[0] === "string") {
    return data.choices[0];
  }
  // 格式3: 扁平返回
  if (data?.content) return data.content;
  if (data?.result) return data.result;
  if (data?.data) {
    return typeof data.data === "string" ? data.data : JSON.stringify(data.data);
  }
  if (data?.output) {
    return typeof data.output === "string" ? data.output : JSON.stringify(data.output);
  }
  if (data?.text) return data.text;
  // 兜底：字符串化
  if (typeof data === "string") return data;
  return JSON.stringify(data);
}

/**
 * 调用讯飞星火
 *
 * 鉴权策略（基于用户实际反馈调整）：
 *   1. 若 API Key 包含 api_secret（格式 api_key:api_secret）→ 先尝试 HMAC-SHA256 签名鉴权
 *   2. 否则尝试 Bearer Token 鉴权
 *   3. 同时尝试多种请求体格式（chat/completions、completions 等）
 *
 * 讯飞 MaaS 平台上不同模型使用的鉴权方式不同：
 *   - 部分模型使用 Bearer Token（OpenAI 兼容）
 *   - 部分模型（如 xoppaddleocrv16）要求 HMAC-SHA256 签名
 */

interface XunfeiBody {
  model: string;
  [key: string]: any;
}

interface XunfeiAttempt {
  url: string;
  body: XunfeiBody;
  description: string;
}

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

  // 解析 API Key：支持 api_key:api_secret 格式
  const colonIdx = rawKey.indexOf(":");
  const hasSecret = colonIdx > 0 && colonIdx < rawKey.length - 1;
  const apiKey = hasSecret ? rawKey.substring(0, colonIdx).trim() : rawKey;
  const apiSecret = hasSecret ? rawKey.substring(colonIdx + 1).trim() : "";

  const match = imageDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) throw new Error("无效的图片数据");
  const [, imageFormat, base64Data] = match;

  // URL 归一化：用户如果已经带了具体路径就不追加
  const normalizeURL = (base: string, defaultPath: string): string => {
    const trimmed = base.replace(/\/+$/, "");
    if (
      trimmed.includes("/chat/") ||
      trimmed.endsWith("/chat/completions") ||
      trimmed.endsWith("/completions") ||
      trimmed.endsWith("/ocr") ||
      trimmed.endsWith("/predict") ||
      trimmed.endsWith("/generate")
    ) {
      return trimmed;
    }
    return trimmed + defaultPath;
  };

  const fullPrompt = `${SYSTEM_PROMPT}\n\n请识别这张优惠券图片，返回 JSON 格式结果。`;
  const imageUrl = `data:image/${imageFormat};base64,${base64Data}`;

  // 构造多种请求体格式
  const bodies: Omit<XunfeiAttempt, "url">[] = [
    {
      description: "chat/completions messages[text+image]",
      body: {
        model: modelId,
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: imageUrl } },
              { type: "text", text: fullPrompt },
            ],
          },
        ],
        max_tokens: 2048,
        temperature: 0.5,
        stream: false,
      },
    },
    {
      description: "chat/completions messages[image only]",
      body: {
        model: modelId,
        messages: [
          {
            role: "user",
            content: [{ type: "image_url", image_url: { url: imageUrl } }],
          },
        ],
        max_tokens: 2048,
        stream: false,
      },
    },
    {
      description: "completions prompt(image)",
      body: {
        model: modelId,
        prompt: imageUrl,
        max_tokens: 2048,
        temperature: 0.3,
        stream: false,
      },
    },
  ];

  // 可选的 API 路径（由宽到窄尝试）
  const paths = ["/chat/completions", "/completions"];

  // 调试日志
  const maskedKey =
    apiKey.length > 8
      ? apiKey.substring(0, 4) + "..." + apiKey.substring(apiKey.length - 4)
      : "***";
  const maskedSecret = apiSecret
    ? apiSecret.length > 8
      ? apiSecret.substring(0, 4) + "..." + apiSecret.substring(apiSecret.length - 4)
      : "***"
    : "(未提供)";

  console.log(`[Xunfei] ========== 请求开始 ==========`);
  console.log(`[Xunfei] Model ID: ${modelId}`);
  console.log(`[Xunfei] API Key: ${maskedKey} (长度: ${apiKey.length})`);
  console.log(`[Xunfei] API Secret: ${maskedSecret} (长度: ${apiSecret.length})`);
  console.log(`[Xunfei] Base URL: ${baseURL}`);
  console.log(
    `[Xunfei] 鉴权方式: ${hasSecret ? "优先 HMAC-SHA256 签名，失败再试 Bearer Token" : "Bearer Token"}`
  );

  const lastErrors: Array<{ status: number; text: string; url: string; auth: string }> = [];

  // ========== 阶段 1：HMAC-SHA256 签名鉴权（如果有 api_secret）==========
  if (hasSecret) {
    console.log(`[Xunfei] ===== 阶段 1：HMAC 签名鉴权 =====`);

    for (const path of paths) {
      for (const { body, description } of bodies) {
        const url = normalizeURL(baseURL, path);
        const authInfo = `HMAC(headers="host date request-line")`;
        console.log(
          `[Xunfei]   POST ${url} (${description})`
        );

        // 每次请求生成新的签名（date 必须实时）
        const sig = await generateXunfeiSignature(apiKey, apiSecret, url);
        const bodyStr = JSON.stringify(body);

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          host: sig.host,
          date: sig.date,
          Authorization: sig.authorization,
        };

        const response = await fetchWithCorsProxy(
          url,
          { method: "POST", headers, body: bodyStr },
          config.useCorsProxy
        );

        console.log(`[Xunfei]   → 状态: ${response.status}`);

        if (response.ok) {
          const data = await response.json();
          const content = extractXunfeiContent(data);
          console.log(
            `[Xunfei]   ✅ 成功！响应内容长度: ${content.length}`
          );
          if (content) {
            return parseAIResponse(content);
          }
          console.warn(`[Xunfei]   响应内容为空，继续尝试...`);
          lastErrors.push({
            status: response.status,
            text: "响应内容为空",
            url,
            auth: authInfo,
          });
          continue;
        }

        const errorText = await response.text();
        console.error(`[Xunfei]   ❌ 失败: ${errorText}`);
        lastErrors.push({ status: response.status, text: errorText, url, auth: authInfo });

        // HMAC 401 / "HMAC secret key does not match" 是鉴权问题，继续试其他路径没用
        // 但如果是 schema 错误（400/422/500），可能只是请求体格式不对，继续试
        if (
          response.status === 401 ||
          errorText.toLowerCase().includes("hmac signature cannot be verified") ||
          errorText.toLowerCase().includes("hmac secret key does not match") ||
          errorText.toLowerCase().includes("apikey not found")
        ) {
          // 401：停止阶段 1 的所有尝试，直接进入阶段 2
          console.log(`[Xunfei]   HMAC 鉴权被拒绝，切换到 Bearer Token 方式...`);
          break;
        }

        // 标记跳出双重循环
        if (lastErrors.length > 0) {
          const last = lastErrors[lastErrors.length - 1];
          if (last.status === 401 || last.text.toLowerCase().includes("hmac")) {
            break;
          }
        }
      }

      // 检查是否需要跳出路径循环
      if (lastErrors.length > 0) {
        const last = lastErrors[lastErrors.length - 1];
        if (last.status === 401 || last.text.toLowerCase().includes("hmac")) {
          break;
        }
      }
    }
  }

  // ========== 阶段 2：Bearer Token 鉴权 ==========
  console.log(`[Xunfei] ===== 阶段 2：Bearer Token 鉴权 =====`);

  for (const path of paths) {
    for (const { body, description } of bodies) {
      const url = normalizeURL(baseURL, path);
      console.log(`[Xunfei]   POST ${url} (${description})`);

      const response = await fetchWithCorsProxy(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        },
        config.useCorsProxy
      );

      console.log(`[Xunfei]   → 状态: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        const content = extractXunfeiContent(data);
        console.log(`[Xunfei]   ✅ 成功！响应内容长度: ${content.length}`);
        if (content) {
          return parseAIResponse(content);
        }
        lastErrors.push({
          status: response.status,
          text: "响应内容为空",
          url,
          auth: "Bearer",
        });
        continue;
      }

      const errorText = await response.text();
      console.error(`[Xunfei]   ❌ 失败: ${errorText}`);
      lastErrors.push({ status: response.status, text: errorText, url, auth: "Bearer" });

      // 401 鉴权失败：再换格式也没用
      if (response.status === 401) break;
    }

    if (lastErrors.length > 0) {
      const last = lastErrors[lastErrors.length - 1];
      if (last.status === 401) break;
    }
  }

  // 所有方案均失败
  const last = lastErrors[lastErrors.length - 1];
  throw buildXunfeiError(last?.status || 0, last?.text || "未知错误", {
    apiKeyLength: apiKey.length,
    apiSecretLength: apiSecret.length,
    hasSecret,
    modelId,
    url: last?.url || baseURL,
    lastAuth: last?.auth || "unknown",
    attempts: lastErrors.map((e) => `[${e.auth}] ${e.status} ${e.url}`).join("\n    "),
  });
}

function buildXunfeiError(
  status: number,
  errorText: string,
  info: {
    apiKeyLength: number;
    apiSecretLength: number;
    hasSecret: boolean;
    modelId: string;
    url: string;
    lastAuth: string;
    attempts?: string;
  }
): Error {
  let hint = "";

  if (status === 401) {
    const lc = errorText.toLowerCase();
    if (lc.includes("hmac secret key does not match")) {
      hint =
        "\n\n🔧 HMAC 签名秘钥不匹配：\n" +
        `   - API Key 长度: ${info.apiKeyLength} 字符，API Secret 长度: ${info.apiSecretLength} 字符\n` +
        `   - 使用的 Model ID: ${info.modelId}\n` +
        `   - 请求地址: ${info.url}\n` +
        `   - 最后使用的鉴权方式: ${info.lastAuth}\n` +
        "   排查步骤:\n" +
        "   1. 登录讯飞开放平台，进入「服务管控 > 模型服务列表」\n" +
        "   2. 找到对应服务，复制「APIKey」（完整的 api_key:api_secret 格式，两个值都不能少）\n" +
        "   3. 注意冒号前后都不能有空格或换行\n" +
        "   4. 确认 Model ID 与 API Key 来自同一个服务\n" +
        "   5. 确认账号额度充足\n" +
        "\n💡 常见问题: 如果粘贴的 key/secret 长度明显偏短或偏长，\n" +
        "       可能是复制时多复制或少复制了字符，请重新检查。\n" +
        "\n原始错误信息：";
    } else if (lc.includes("hmac signature cannot be verified")) {
      hint =
        "\n\n🔧 HMAC 签名无法验证（apikey not found）：\n" +
        "   请确认 API Key 的格式是 api_key:api_secret（冒号分隔，无空格）\n" +
        "   并从讯飞服务管控页面复制完整准确的字符串。\n" +
        "\n原始错误信息：";
    } else {
      hint =
        "\n\n🔧 401 鉴权失败：\n" +
        `   - API Key 长度: ${info.apiKeyLength} 字符\n` +
        `   - Model ID: ${info.modelId}\n` +
        `   - 请求地址: ${info.url}\n` +
        "   请在讯飞服务管控页面确认 API Key、Model ID 和 API 地址是否正确。\n" +
        "\n原始错误信息：";
    }
  } else if (status === 403) {
    hint =
      "\n\n🔧 403 错误：API Key 与 Model ID 不匹配，或地区/IP 受限\n请确认两者来自同一个服务。\n原始错误：";
  } else if (status === 404) {
    hint = "\n\n🔧 404 错误：API 路径不支持该模型\n原始错误：";
  } else if (status === 500 || status === 503) {
    hint =
      "\n\n⚠️ 服务端错误：账号额度不足 / 模型不可用 / 参数格式不匹配\n请在讯飞控制台确认额度与服务状态\n原始错误：";
  } else if (status === 400 || status === 422) {
    hint = "\n\n⚠️ 参数格式错误：请求体格式不被该模型支持\n原始错误：";
  } else if (status === 429) {
    hint = "\n\n⚠️ 请求过快或额度不足：请稍后重试\n原始错误：";
  } else {
    hint = "\n\n请求失败：\n";
  }

  if (info.attempts) {
    hint += `\n已尝试的方案:\n    ${info.attempts}`;
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