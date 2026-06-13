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

// 进度状态中文映射 —— 让用户更容易理解
const STATUS_MAP: Record<string, string> = {
  "loading tesseract core": "正在加载核心引擎...",
  "initializing tesseract": "正在初始化引擎...",
  "loading language traineddata": "正在下载语言包...",
  "initializing api": "正在准备识别环境...",
  "recognizing text": "正在识别图片...",
};

async function getWorker(): Promise<Worker> {
  if (workerPromise) return workerPromise;

  workerPromise = (async () => {
    // 使用 jsDelivr 镜像加速语言包下载
    // 通过在 createWorker 前设置全局变量来指定语言包路径
    (window as any).Tesseract = (window as any).Tesseract || {};
    (window as any).Tesseract.langPath = "https://cdn.jsdelivr.net/gh/tesseract-ocr/tessdata@main/";
    
    const worker = await createWorker(["chi_sim", "eng"], 1, {
      logger: (m) => {
        if (INTERESTING_STATUS.has(m.status)) {
          const statusText = STATUS_MAP[m.status] || m.status;
          currentOnProgress?.(m.progress, statusText);
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
 * 预加载 OCR 引擎（可在页面加载时调用，提前下载语言包）
 */
export async function preloadOCR(onProgress?: (progress: number, status: string) => void): Promise<void> {
  currentOnProgress = onProgress ?? null;
  try {
    await getWorker();
    currentOnProgress?.(1, "OCR 引擎已就绪");
  } catch (error) {
    console.warn("OCR 预加载失败:", error);
    // 预加载失败不影响后续使用，首次识别时会重新尝试
  }
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
