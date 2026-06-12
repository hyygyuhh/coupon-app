/**
 * OCR 识别服务 —— 基于 tesseract.js 在浏览器内完成识别
 * 支持中文 + 英文混合识别，首次识别会下载语言包（~10MB），之后走缓存
 */

import { createWorker, Worker } from "tesseract.js";

let workerPromise: Promise<Worker> | null = null;

async function getWorker(
  onProgress?: (p: number, status: string) => void
): Promise<Worker> {
  if (workerPromise) return workerPromise;

  workerPromise = (async () => {
    const worker = await createWorker(["chi_sim", "eng"], 1, {
      logger: (m) => {
        if (m.status === "recognizing text" || m.status === "loading tesseract core" ||
            m.status === "initializing tesseract" || m.status === "loading language traineddata" ||
            m.status === "initializing api") {
          onProgress?.(m.progress, m.status);
        }
      },
    });
    // 仅保留单通道图像，识别更快
    await worker.setParameters({
      tessedit_pageseg_mode: "6", // 假定为一个统一的文本块
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
  const worker = await getWorker(onProgress);
  const { data } = await worker.recognize(file);

  onProgress?.(1, "识别完成");
  return {
    text: data.text || "",
    confidence: data.confidence || 0,
  };
}

/**
 * 重设 Worker（用于异常恢复 —— 不过 tesseract.js 一般稳定，这里仅保留作为备用 API）
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
