/**
 * OCR 识别服务（v3，效率优化版）
 * ---------------------------------------------------------------
 * 效率优化：
 * 1. 智能扫描策略：先用最快模式，置信度足够则提前终止
 * 2. 并行图片预处理：Promise.all 同时生成多个变体
 * 3. 减少扫描次数：从 6 次降到 2-3 次
 * 4. 优化图片尺寸：根据图片内容动态调整
 * 5. Worker 预热：页面加载时提前初始化
 */

import { createWorker, Worker, createScheduler, Scheduler } from "tesseract.js";
import { processImage, type ProcessedImage } from "./imageProcessor";

export interface OCRResult {
  text: string;
  confidence: number;
  rounds?: {
    mode: string;
    text: string;
    confidence: number;
    width: number;
  }[];
}

// 全局 Worker 实例（单例模式）
let workerPromise: Promise<Worker> | null = null;
let schedulerPromise: Promise<Scheduler> | null = null;

// 状态映射
export const STATUS_MAP: Record<string, string> = {
  "loading tesseract core": "正在加载识别引擎",
  "initializing tesseract": "正在初始化引擎",
  "loading language traineddata": "正在下载语言包（首次使用）",
  "initializing api": "正在加载字库",
  "recognizing text": "正在识别文字",
};

type PSM = "11" | "6";

// 置信度阈值：高于此值则提前终止
const CONFIDENCE_THRESHOLD = 85;

/**
 * 获取或创建 Worker（单例）
 */
async function getWorker(): Promise<Worker> {
  if (workerPromise) return workerPromise;

  workerPromise = (async () => {
    console.log("[OCR] 初始化 Worker...");
    const start = performance.now();
    
    const worker = await createWorker("chi_sim+eng", 1, {
      logger: (m) => {
        if (m.status === "loading language traineddata") {
          console.log(`[OCR] 下载语言包: ${(m.progress * 100).toFixed(0)}%`);
        }
      },
    });

    const elapsed = ((performance.now() - start) / 1000).toFixed(1);
    console.log(`[OCR] Worker 初始化完成 (${elapsed}s)`);
    
    return worker;
  })();

  return workerPromise;
}

/**
 * 获取调度器（用于并行识别）
 */
async function getScheduler(): Promise<Scheduler> {
  if (schedulerPromise) return schedulerPromise;

  schedulerPromise = (async () => {
    const scheduler = createScheduler();
    // 添加 2 个 worker 实现并行识别
    const worker1 = await getWorker();
    scheduler.addWorker(worker1);
    return scheduler;
  })();

  return schedulerPromise;
}

/**
 * 单次识别
 */
async function recognizeOnce(
  worker: Worker,
  image: Blob,
  psm: PSM,
  onProgress?: (progress: number, status: string) => void
): Promise<{ text: string; confidence: number }> {
  await worker.setParameters({
    tessedit_pageseg_mode: psm,
  } as any);

  const { data } = await worker.recognize(image);

  return {
    text: data.text || "",
    confidence: data.confidence || 0,
  };
}

/**
 * 并行生成图片变体（优化预处理速度）
 */
async function generateVariantsParallel(file: File): Promise<ProcessedImage[]> {
  // 根据图片大小选择策略
  const img = await loadImage(file);
  const isLarge = img.width > 2000 || img.height > 3000;
  
  // 清理
  URL.revokeObjectURL(img.src);

  // 并行生成 2 个变体（减少到 2 个）
  const variants = await Promise.all([
    // 变体 1：标准灰度（主力）
    processImage(file, {
      targetWidth: isLarge ? 1600 : 1400,
      quality: 0.9,
      grayscale: true,
      contrast: 1.4,
    }),
    // 变体 2：彩色（备用）
    processImage(file, {
      targetWidth: isLarge ? 1600 : 1400,
      quality: 0.92,
      grayscale: false,
      contrast: 1.2,
    }),
  ]);

  return variants;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("无法加载图片"));
    };
    img.src = url;
  });
}

/**
 * 合并多轮结果
 */
function mergeResults(
  rounds: { mode: string; text: string; confidence: number; width: number }[]
): string {
  if (rounds.length === 0) return "";
  if (rounds.length === 1) return rounds[0].text;

  // 计算中文丰富度
  function chineseRatio(text: string): number {
    const chars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const total = text.replace(/\s/g, "").length;
    return total > 0 ? chars / total : 0;
  }

  // 综合评分
  const scored = rounds.map((r) => {
    const ratio = chineseRatio(r.text);
    const score = r.confidence * (1 + ratio * 2);
    return { ...r, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const primary = scored[0];
  const primaryLines = new Set<string>();
  const resultLines: string[] = [];

  for (const line of primary.text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const key = trimmed.replace(/\s+/g, "");
    primaryLines.add(key);
    resultLines.push(trimmed);
  }

  // 补充次优结果中的中文行
  for (let i = 1; i < scored.length; i++) {
    const r = scored[i];
    if (r.confidence < primary.confidence * 0.7) continue;

    for (const line of r.text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || !/[\u4e00-\u9fa5]/.test(trimmed)) continue;
      const key = trimmed.replace(/\s+/g, "");
      if (!primaryLines.has(key)) {
        primaryLines.add(key);
        resultLines.push(trimmed);
      }
    }
  }

  return resultLines
    .map(stripOcrNoise)
    .filter((l) => l && l.length > 1)
    .join("\n");
}

function stripOcrNoise(line: string): string {
  if (!line) return line;
  return line
    .replace(/[<>\[\]()（）«»‹›→←↑↓■□★☆*~]+/g, " ")
    .replace(/\b(AUH|EHR|Vv|co|AD|LINO|LUCK|LINE|LOGO|LLNO|LNO|ARAH|AHE|AUV|AIA|AVA|HEY)\b/gi, " ")
    .replace(/^[A-Za-z]{1,4}\s+/, " ")
    .replace(/\s+[A-Za-z]{1,4}$/, " ")
    .replace(/["''""`']/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * 主入口：识别图片
 * 
 * 优化策略：
 * 1. 先用 PSM 11（稀疏文本）扫描第一个变体
 * 2. 如果置信度 >= 85，直接返回（提前终止）
 * 3. 否则继续扫描第二个变体
 * 4. 合并结果
 */
export async function recognizeImage(
  file: File,
  onProgress?: (progress: number, status: string) => void
): Promise<OCRResult> {
  onProgress?.(0, "正在读取图片");

  const startTime = performance.now();

  // 步骤 1：并行生成图片变体
  onProgress?.(0.05, "正在优化图片");
  const variants = await generateVariantsParallel(file);

  try {
    // 步骤 2：获取 Worker
    onProgress?.(0.15, "正在加载识别引擎");
    const worker = await getWorker();

    const rounds: {
      mode: string;
      text: string;
      confidence: number;
      width: number;
    }[] = [];

    // 步骤 3：第一轮扫描（PSM 11，最快）
    onProgress?.(0.2, "正在识别文字");
    const result1 = await recognizeOnce(worker, variants[0].blob, "11", (p) => {
      onProgress?.(0.2 + p * 0.35, "正在识别文字");
    });
    
    rounds.push({
      mode: "PSM11-灰度",
      text: result1.text,
      confidence: result1.confidence,
      width: variants[0].width,
    });

    // 步骤 4：检查是否可以提前终止
    if (result1.confidence >= CONFIDENCE_THRESHOLD) {
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
      console.log(`[OCR] 提前终止，置信度 ${result1.confidence.toFixed(1)}，耗时 ${elapsed}s`);
      
      onProgress?.(1, "识别完成");
      return {
        text: result1.text,
        confidence: result1.confidence,
        rounds,
      };
    }

    // 步骤 5：第二轮扫描（PSM 6，文本块）
    onProgress?.(0.6, "正在补充识别");
    const result2 = await recognizeOnce(worker, variants[0].blob, "6", (p) => {
      onProgress?.(0.6 + p * 0.15, "正在补充识别");
    });
    
    rounds.push({
      mode: "PSM6-灰度",
      text: result2.text,
      confidence: result2.confidence,
      width: variants[0].width,
    });

    // 步骤 6：如果前两轮置信度都不够，尝试彩色版本
    const avgConfidence = (result1.confidence + result2.confidence) / 2;
    
    if (avgConfidence < CONFIDENCE_THRESHOLD - 10) {
      onProgress?.(0.8, "正在尝试彩色识别");
      const result3 = await recognizeOnce(worker, variants[1].blob, "11", (p) => {
        onProgress?.(0.8 + p * 0.15, "正在尝试彩色识别");
      });
      
      rounds.push({
        mode: "PSM11-彩色",
        text: result3.text,
        confidence: result3.confidence,
        width: variants[1].width,
      });
    }

    // 步骤 7：合并结果
    onProgress?.(0.98, "正在整理识别结果");
    const merged = mergeResults(rounds);

    const finalConfidence =
      rounds.reduce((sum, r) => sum + r.confidence, 0) / rounds.length;

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
    console.log(`[OCR] 完成，${rounds.length} 轮扫描，平均置信度 ${finalConfidence.toFixed(1)}，耗时 ${elapsed}s`);

    onProgress?.(1, "识别完成");
    return {
      text: merged,
      confidence: finalConfidence,
      rounds,
    };
  } finally {
    // 清理
    for (const v of variants) {
      if (v.url) URL.revokeObjectURL(v.url);
    }
  }
}

/**
 * 预加载 OCR 引擎
 */
export async function preloadOCR(
  onProgress?: (progress: number, status: string) => void
): Promise<void> {
  onProgress?.(0, "正在准备识别引擎");
  try {
    await getWorker();
    onProgress?.(1, "OCR 引擎已就绪");
  } catch (error) {
    console.warn("OCR 预加载失败:", error);
    onProgress?.(1, "OCR 预加载失败");
  }
}

/**
 * 快速模式：单次扫描
 */
export async function recognizeImageFast(
  file: File,
  onProgress?: (progress: number, status: string) => void
): Promise<OCRResult> {
  onProgress?.(0, "正在读取图片");
  
  const variant = await processImage(file, {
    targetWidth: 1400,
    quality: 0.9,
    grayscale: true,
    contrast: 1.4,
  });

  onProgress?.(0.2, "正在加载识别引擎");
  const worker = await getWorker();

  onProgress?.(0.4, "正在识别文字");
  const result = await recognizeOnce(worker, variant.blob, "11", (p) => {
    onProgress?.(0.4 + p * 0.55, "正在识别文字");
  });

  onProgress?.(1, "识别完成");
  return {
    text: result.text,
    confidence: result.confidence,
    rounds: [
      {
        mode: "fast-PSM11",
        text: result.text,
        confidence: result.confidence,
        width: variant.width,
      },
    ],
  };
}
