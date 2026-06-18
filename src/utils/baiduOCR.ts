import { getOCRConfig } from "./ocrConfig";

/**
 * 百度 OCR API 调用（通过 CORS 代理）
 *
 * 方案：使用 https://corsproxy.io/ 作为代理，
 * 将请求转发到百度 OCR API 并添加 CORS 响应头。
 * 格式：https://corsproxy.io/?[params]=百度接口地址
 *
 * 备选代理列表（如果主代理不可用会自动切换）：
 *   - https://corsproxy.io/
 *   - https://api.allorigins.win/raw?url=
 */

const PROXY_LIST = [
  "https://corsproxy.io",
  "https://api.allorigins.win/raw?url=",
];

// 当前使用的代理索引（失败时切换）
let proxyIndex = 0;

function getProxy(): string {
  return PROXY_LIST[proxyIndex];
}

function getProxiedUrl(targetUrl: string): string {
  const proxy = getProxy();
  if (proxy.includes("allorigins")) {
    return `${proxy}${encodeURIComponent(targetUrl)}`;
  }
  return `${proxy}/?url=${encodeURIComponent(targetUrl)}`;
}

// 切换到下一个代理
function rotateProxy(): boolean {
  if (proxyIndex < PROXY_LIST.length - 1) {
    proxyIndex++;
    return true;
  }
  return false;
}

// 重置代理（每次新请求从头尝试）
function resetProxy(): void {
  proxyIndex = 0;
}

// 获取 Access Token
async function getAccessToken(apiKey: string, secretKey: string): Promise<string> {
  const tokenUrl = "https://aip.baidubce.com/oauth/2.0/token";
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: apiKey,
    client_secret: secretKey,
  });

  const targetUrl = `${tokenUrl}?${params}`;

  let lastError: Error | null = null;

  // 尝试所有代理
  for (let attempt = 0; attempt < PROXY_LIST.length; attempt++) {
    resetProxy();
    for (let i = 0; i < PROXY_LIST.length; i++) {
      try {
        const proxyUrl = getProxiedUrl(targetUrl);
        console.log(`[百度 OCR] 通过代理获取 Token: ${proxyUrl.slice(0, 60)}...`);

        const response = await fetch(proxyUrl, { method: "GET" });

        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(`代理返回 ${response.status}: ${text.slice(0, 100)}`);
        }

        const data = await response.json();

        if (data.access_token) {
          console.log("[百度 OCR] Token 获取成功");
          return data.access_token;
        }
        throw new Error(data.error_description || "获取 Access Token 失败");
      } catch (err) {
        console.warn(`[百度 OCR] 代理 ${i + 1} 失败:`, err);
        lastError = err instanceof Error ? err : new Error(String(err));
        if (rotateProxy()) {
          // 切换到下一个代理重试
          continue;
        }
        break;
      }
    }
    // 所有代理都失败后，尝试无代理（部分网络可能可以直连）
    try {
      console.log("[百度 OCR] 尝试直连...");
      const response = await fetch(targetUrl, { method: "GET" });
      if (response.ok) {
        const data = await response.json();
        if (data.access_token) return data.access_token;
      }
    } catch {
      // 直连也失败，忽略
    }
  }

  throw lastError || new Error("所有代理均不可用");
}

// 通用文字识别（基础版）
async function basicGeneral(imageDataUrl: string, accessToken: string): Promise<string> {
  const apiUrl = "https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic";

  // 提取 base64 数据（去掉 data:image/...;base64, 前缀）
  const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");

  // 百度 OCR 接收 base64 字符串作为 image 参数
  const params = new URLSearchParams({ image: base64Data });
  const targetUrl = `${apiUrl}?access_token=${accessToken}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < PROXY_LIST.length + 1; attempt++) {
    resetProxy();
    for (let i = 0; i < PROXY_LIST.length; i++) {
      try {
        const proxyUrl = getProxiedUrl(targetUrl);

        const formData = new FormData();
        formData.append("image", base64Data);

        console.log(`[百度 OCR] 通过代理识别... (代理 ${i + 1})`);
        const response = await fetch(proxyUrl, {
          method: "POST",
          body: params,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });

        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(`代理返回 ${response.status}: ${text.slice(0, 100)}`);
        }

        const data = await response.json();

        if (data.error_code) {
          throw new Error(data.error_msg || `百度 OCR 错误: ${data.error_code}`);
        }

        // 提取文字
        const words = (data.words_result || []).map((item: { words: string }) => item.words);
        return words.join("\n");
      } catch (err) {
        console.warn(`[百度 OCR] 代理 ${i + 1} 失败:`, err);
        lastError = err instanceof Error ? err : new Error(String(err));
        if (rotateProxy()) {
          continue;
        }
        break;
      }
    }
  }

  throw lastError || new Error("所有代理均不可用");
}

// 识别图片并返回文字
export async function recognizeWithBaidu(imageDataUrl: string): Promise<string> {
  const config = getOCRConfig();

  if (!config.baiduApiKey || !config.baiduSecretKey) {
    throw new Error("请先在设置中配置百度 OCR 的 API Key 和 Secret Key");
  }

  console.log("[百度 OCR] 开始识别...");

  // 获取 Access Token（有效期 30 天，缓存）
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
 * 判断错误是否来自 CORS / 网络拦截（保持向后兼容）
 */
export function isBaiduCorsError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message || "";
  return (
    msg.includes("CORS_BLOCKED") ||
    /failed to fetch/i.test(msg) ||
    /networkerror/i.test(msg) ||
    msg.includes("代理返回")
  );
}
