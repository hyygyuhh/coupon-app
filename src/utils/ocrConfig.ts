export interface OCRConfig {
  kimiApiKey: string;
  kimiBaseURL: string;
}

const OCR_CONFIG_KEY = "ocr-config";

export function getOCRConfig(): OCRConfig {
  const stored = localStorage.getItem(OCR_CONFIG_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return {
        kimiApiKey: parsed.kimiApiKey || parsed.apiKey || "",
        kimiBaseURL: parsed.kimiBaseURL || parsed.baseURL || "https://agentrs.jd.com/api/saas/openai-u/v1",
      };
    } catch {
      // ignore
    }
  }
  return {
    kimiApiKey: "",
    kimiBaseURL: "https://agentrs.jd.com/api/saas/openai-u/v1",
  };
}

export function saveOCRConfig(config: OCRConfig): void {
  localStorage.setItem(OCR_CONFIG_KEY, JSON.stringify(config));
}