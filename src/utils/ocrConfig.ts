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
      return JSON.parse(stored);
    } catch {
      // ignore
    }
  }
  return {
    engine: "local",
    baiduApiKey: "",
    baiduSecretKey: "",
  };
}

export function saveOCRConfig(config: OCRConfig): void {
  localStorage.setItem(OCR_CONFIG_KEY, JSON.stringify(config));
}
