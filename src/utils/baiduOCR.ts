import { getOCRConfig } from "./ocrConfig";

/**
 * 百度 OCR API 调用
 * 文档: https://cloud.baidu.com/doc/OCR/index.html
 *
 * 注意：百度 OCR API 响应未带 CORS 头，浏览器直接 fetch 会被拦截
 * 并抛出 "Failed to fetch" 错误。目前的处理方式：
 *   1. 在本文件中检测 CORS / 网络错误，抛出带有 "CORS_BLOCKED" 标记的错误
 *   2. 在 ocrService.ts 中 catch 后自动降级为本地 Tesseract.js OCR
 *   3. 用户无需手动切换，页面会自动回退
 */

// 判断错误是否来自浏览器的跨域/网络拦截
function isCorsError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = (err.message || "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("typeerror")
  );
}

// 获取 Access Token
async function getAccessToken(apiKey: string, secretKey: string): Promise<string> {
  const tokenUrl = "https://aip.baidubce.com/oauth/2.0/token";
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: apiKey,
    client_secret: secretKey,
  });

  let response: Response;
  try {
    response = await fetch(`${tokenUrl}?${params}`, {
      method: "POST",
    });
  } catch (err) {
    if (isCorsError(err)) {
      throw new Error(
        "CORS_BLOCKED: 浏览器无法直接调用百度 OCR API（跨域限制），将自动切换到本地识别"
      );
    }
    throw err;
  }

  if (!response.ok) {
    throw new Error(`获取 Access Token 失败: ${response.status}`);
  }

  const data = await response.json();
  if (data.access_token) {
    return data.access_token;
  }
  throw new Error(data.error_description || "获取 Access Token 失败");
}

// 通用文字识别（基础版）
async function basicGeneral(imageDataUrl: string, accessToken: string): Promise<string> {
  const apiUrl = "https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic";

  // 提取 base64 数据
  const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");

  const formData = new FormData();
  formData.append("image", base64Data);

  let response: Response;
  try {
    response = await fetch(`${apiUrl}?access_token=${accessToken}`, {
      method: "POST",
      body: formData,
    });
  } catch (err) {
    if (isCorsError(err)) {
      throw new Error(
        "CORS_BLOCKED: 浏览器无法直接调用百度 OCR API（跨域限制），将自动切换到本地识别"
      );
    }
    throw err;
  }

  if (!response.ok) {
    throw new Error(`百度 OCR 请求失败: ${response.status}`);
  }

  const data = await response.json();

  if (data.error_code) {
    throw new Error(data.error_msg || "百度 OCR 识别失败");
  }

  // 提取文字
  const words = (data.words_result || []).map((item: { words: string }) => item.words);
  return words.join("\n");
}

// 识别图片并返回文字
export async function recognizeWithBaidu(imageDataUrl: string): Promise<string> {
  const config = getOCRConfig();

  if (!config.baiduApiKey || !config.baiduSecretKey) {
    throw new Error("请先在设置中配置百度 OCR 的 API Key 和 Secret Key");
  }

  console.log("[百度 OCR] 开始识别...");

  // 获取 Access Token（有效期 30 天，可以缓存）
  const cacheKey = "baidu_ocr_token";
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const { token, expires } = JSON.parse(cached);
      if (Date.now() < expires) {
        console.log("[百度 OCR] 使用缓存的 Access Token");
        return await basicGeneral(imageDataUrl, token);
      }
    } catch {
      // ignore
    }
  }

  console.log("[百度 OCR] 获取新的 Access Token...");
  const token = await getAccessToken(config.baiduApiKey, config.baiduSecretKey);

  // 缓存 29 天
  localStorage.setItem(
    cacheKey,
    JSON.stringify({
      token,
      expires: Date.now() + 29 * 24 * 60 * 60 * 1000,
    })
  );

  return await basicGeneral(imageDataUrl, token);
}

/**
 * 判断错误消息是否为 CORS / 网络拦截错误，
 * 供上层服务判断是否需要降级到本地 OCR。
 */
export function isBaiduCorsError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message || "";
  return (
    msg.startsWith("CORS_BLOCKED") ||
    /failed to fetch/i.test(msg) ||
    /networkerror/i.test(msg)
  );
}
