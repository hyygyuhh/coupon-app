import { getOCRConfig } from "./ocrConfig";

/**
 * 百度 OCR API 调用
 * 文档: https://cloud.baidu.com/doc/OCR/index.html
 */

// 获取 Access Token
async function getAccessToken(apiKey: string, secretKey: string): Promise<string> {
  const tokenUrl = "https://aip.baidubce.com/oauth/2.0/token";
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: apiKey,
    client_secret: secretKey,
  });

  const response = await fetch(`${tokenUrl}?${params}`, {
    method: "POST",
  });

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

  const response = await fetch(`${apiUrl}?access_token=${accessToken}`, {
    method: "POST",
    body: formData,
  });

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
