export type OCREngine = "local" | "baidu";

export interface OCRConfig {
  engine: OCREngine;
  baiduApiKey: string;
  baiduSecretKey: string;
}

const OCR_CONFIG_KEY = "ocr-config";

export function getOCRConfig(): OCRConfig {
  const stored = localStorage.getItem(OCR_CONFIG_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // 兼容旧数据
      return {
        engine: parsed.engine === "baidu" ? "baidu" : "local",
        baiduApiKey: parsed.baiduApiKey || "",
        baiduSecretKey: parsed.baiduSecretKey || "",
      };
    } catch {
      // ignore
    }
  }
  // 默认使用本地 OCR，避免浏览器 CORS 直接阻断识别
  return {
    engine: "local",
    baiduApiKey: "",
    baiduSecretKey: "",
  };
}

export function saveOCRConfig(config: OCRConfig): void {
  localStorage.setItem(OCR_CONFIG_KEY, JSON.stringify(config));
}
