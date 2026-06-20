/**
 * OCR 识别服务（Qwen AI 专用版）
 * ---------------------------------------------------------------
 * 使用 Qwen2.5-VL-7B 模型进行优惠券识别，一步完成识别+解析。
 */

import { hashFile } from "./crypto";

export interface OCRResult {
  text: string;
  confidence: number;
  rounds?: {
    mode: string;
    text: string;
    confidence: number;
    width: number;
  }[];
  aiCoupons?: Array<{
    name?: string;
    platform?: string;
    amount?: string;
    expiryDate?: string;
    note?: string;
    code?: string;
    url?: string;
    tags?: string[];
  }>;
}

interface OCRCacheEntry {
  result: OCRResult;
  timestamp: number;
}

const CACHE_KEY_PREFIX = "ocr_cache_";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CACHE_SIZE = 50;

async function getCacheKey(file: File): Promise<string> {
  const hash = await hashFile(file);
  return CACHE_KEY_PREFIX + hash;
}

async function getCachedResult(file: File): Promise<OCRResult | null> {
  try {
    const key = await getCacheKey(file);
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    
    const entry: OCRCacheEntry = JSON.parse(stored);
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.result;
  } catch {
    return null;
  }
}

async function setCachedResult(file: File, result: OCRResult): Promise<void> {
  try {
    const key = await getCacheKey(file);
    const entry: OCRCacheEntry = {
      result,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(entry));
    cleanupCache();
  } catch {
    // 忽略存储错误
  }
}

function cleanupCache(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_KEY_PREFIX)) {
        keys.push(key);
      }
    }
    
    if (keys.length <= MAX_CACHE_SIZE) return;
    
    keys.sort((a, b) => {
      const entryA = JSON.parse(localStorage.getItem(a) || "{}");
      const entryB = JSON.parse(localStorage.getItem(b) || "{}");
      return (entryA.timestamp || 0) - (entryB.timestamp || 0);
    });
    
    const toRemove = keys.slice(0, keys.length - MAX_CACHE_SIZE);
    for (const key of toRemove) {
      localStorage.removeItem(key);
    }
  } catch {
    // 忽略清理错误
  }
}

export function clearOCRCache(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // 忽略清理错误
  }
}

/**
 * 主入口：识别图片（使用 Kimi AI）
 */
export async function recognizeImage(
  file: File,
  onProgress?: (progress: number, status: string) => void
): Promise<OCRResult> {
  onProgress?.(0, "正在读取图片");

  const cached = await getCachedResult(file);
  if (cached) {
    console.log("[OCR] 使用缓存结果");
    onProgress?.(1, "识别完成");
    return cached;
  }

  const { recognizeWithAI, hasAIConfig } = await import("./aiVisionOCR");

  if (!hasAIConfig()) {
    throw new Error("请先在设置中配置 AI API Key");
  }

  try {
    const result = await recognizeWithAI(file, onProgress);

    const ocrResult: OCRResult = {
      text: result.rawText || "",
      confidence: result.confidence,
      rounds: result.coupons.map((c, i) => ({
        mode: `AI-${i + 1}`,
        text: `${c.name} ${c.amount || ""} ${c.expiryDate || ""}`.trim(),
        confidence: result.confidence,
        width: 0,
      })),
      aiCoupons: result.coupons,
    };

    setCachedResult(file, ocrResult);
    return ocrResult;
  } catch (error: any) {
    console.error("[OCR] AI 识别失败:", error);
    throw error;
  }
}

export function subscribeOCRStatus(fn: () => void): () => void {
  return () => {};
}

export function getOCRStatus(): { status: "idle" | "loading" | "ready" | "error"; progress: number; statusText: string } {
  return { status: "ready", progress: 1, statusText: "Qwen AI 已就绪" };
}

export async function preloadOCR(onProgress?: (progress: number, status: string) => void): Promise<void> {
  onProgress?.(1, "Qwen AI 已就绪");
}