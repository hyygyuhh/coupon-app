/**
 * OCR 识别服务 —— 基于 tesseract.js 在浏览器内完成识别
 * 支持中文 + 英文混合识别，首次识别会下载语言包（~10MB），之后走缓存
 */

import { createWorker, Worker } from "tesseract.js";

let workerPromise: Promise<Worker> | null = null;
// 当前正在执行识别的回调（可随时更新，避免被首次调用时的闭包锁定）
let currentOnProgress: ((p: number, status: string) => void) | null = null;

// 关注的进度状态 —— 其他 tesseract 内部状态（如 "loading tesseract core" 等）
// 统一归到"准备中"，让 UI 更简洁
const INTERESTING_STATUS = new Set<string>([
  "loading tesseract core",
  "initializing tesseract",
  "loading language traineddata",
  "initializing api",
  "recognizing text",
]);

async function getWorker(): Promise<Worker> {
  if (workerPromise) return workerPromise;

  workerPromise = (async () => {
    const worker = await createWorker(["chi_sim", "eng"], 1, {
      logger: (m) => {
        if (INTERESTING_STATUS.has(m.status)) {
          currentOnProgress?.(m.progress, m.status);
        }
      },
    });
    // 假定为一个统一的文本块 —— 对优惠券截图识别更准
    await worker.setParameters({
      tessedit_pageseg_mode: "6",
    } as any);
    return worker;
  })();

  return workerPromise;
}

export interface OCRResult {
  text: string;
  confidence: number;
}

/**
 * 识别图片文件（File）为文本
 */
export async function recognizeImage(
  file: File,
  onProgress?: (progress: number, status: string) => void
): Promise<OCRResult> {
  // 关键：每次识别都挂自己的回调，避免复用首次调用的闭包
  currentOnProgress = onProgress ?? null;

  const worker = await getWorker();
  const { data } = await worker.recognize(file);

  currentOnProgress?.(1, "识别完成");
  return {
    text: data.text || "",
    confidence: data.confidence || 0,
  };
}

/**
 * 重设 Worker（用于异常恢复 —— 一般不需要主动调用）
 */
export async function resetWorker(): Promise<void> {
  if (workerPromise) {
    try {
      const w = await workerPromise;
      await w.terminate();
    } catch {
      // ignore
    }
    workerPromise = null;
  }
}
