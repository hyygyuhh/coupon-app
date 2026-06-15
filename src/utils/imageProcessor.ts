/**
 * 图片预处理工具 —— 为 OCR 识别优化图片（v2，增强版）
 *
 * 优化策略：
 * 1. 自动压缩：手机截图通常 1080+ px，过大会拖慢 OCR 且降低识别率
 * 2. 灰度化 + 自适应对比度：让文字与背景对比更鲜明
 * 3. 自适应阈值（Otsu）：自动计算最佳二值化阈值
 * 4. 边缘增强 + 锐化：提升文字边缘清晰度
 * 5. 多种分辨率扫描：尝试多种预处理策略取综合结果
 * 6. 分层策略：先用轻量处理，失败再用增强处理
 *
 * 处理流程：
 *  File → 读取为 Image → 压缩到合适尺寸 → Canvas 处理 → 导出为 Blob
 */

/**
 * 把 File 读成 HTMLImageElement
 */
function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve(img);
      // 注意：不要立即 revokeObjectURL，后续 canvas.drawImage 可能还需要
      // 在整个处理完成后统一释放
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("无法加载图片"));
    };
    img.src = url;
  });
}

/**
 * 对图片进行灰度化 + 对比度增强，返回处理后的 Blob
 * 同时输出多种分辨率版本（主图 + 高分辨率增强图）
 */
export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
  url?: string;
  revoke?: () => void;
}

interface ProcessOptions {
  // 目标宽度（图片超过此宽度会压缩）；默认 1800
  targetWidth?: number;
  // JPEG 质量 0-1；默认 0.92
  quality?: number;
  // 是否做灰度化；默认 true
  grayscale?: boolean;
  // 对比度增强系数（0-2，1 为原）；默认 1.35
  contrast?: number;
  // 是否应用自适应阈值（Otsu二值化）；默认 false
  adaptiveThreshold?: boolean;
  // 是否应用边缘增强；默认 false
  edgeEnhance?: boolean;
  // 是否应用锐化；默认 false
  sharpen?: boolean;
  // 锐化强度（0-1）；默认 0.5
  sharpenAmount?: number;
}

const DEFAULTS: Required<ProcessOptions> = {
  targetWidth: 1800,
  quality: 0.92,
  grayscale: true,
  contrast: 1.35,
  adaptiveThreshold: false,
  edgeEnhance: false,
  sharpen: false,
  sharpenAmount: 0.5,
};

/**
 * 使用 Otsu 方法计算最佳二值化阈值
 */
function otsuThreshold(histogram: number[]): number {
  const total = histogram.reduce((sum, val) => sum + val, 0);
  let sumB = 0;
  let wB = 0;
  let maximum = 0;
  let threshold = 0;

  for (let i = 0; i < histogram.length; i++) {
    wB += histogram[i];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;

    sumB += i * histogram[i];
    const mB = sumB / wB;
    const mF = (histogram.reduce((sum, val, idx) => sum + idx * val, 0) - sumB) / wF;

    const between = wB * wF * Math.pow(mB - mF, 2);
    if (between > maximum) {
      maximum = between;
      threshold = i;
    }
  }
  return threshold;
}

/**
 * 应用自适应阈值（Otsu二值化）
 */
function applyOtsuThreshold(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const histogram = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
    histogram[Math.round(gray)]++;
  }

  const threshold = otsuThreshold(histogram);

  for (let i = 0; i < data.length; i += 4) {
    const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const val = gray >= threshold ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = val;
    data[i + 3] = 255;
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * 应用边缘增强（Sobel算子）
 */
function applyEdgeEnhance(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const output = new Uint8ClampedArray(data.length);

  const sobelX = [
    [-1, 0, 1],
    [-2, 0, 2],
    [-1, 0, 1],
  ];
  const sobelY = [
    [-1, -2, -1],
    [0, 0, 0],
    [1, 2, 1],
  ];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0;
      let gy = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
          gx += gray * sobelX[ky + 1][kx + 1];
          gy += gray * sobelY[ky + 1][kx + 1];
        }
      }

      const magnitude = Math.sqrt(gx * gx + gy * gy);
      const idx = (y * width + x) * 4;
      output[idx] = output[idx + 1] = output[idx + 2] = Math.min(255, magnitude);
      output[idx + 3] = 255;
    }
  }

  for (let i = 0; i < output.length; i++) {
    data[i] = output[i];
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * 应用锐化（USM锐化）
 */
function applySharpen(ctx: CanvasRenderingContext2D, width: number, height: number, amount: number): void {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const kernel = [
    [-1, -1, -1],
    [-1, 9 + amount * 4, -1],
    [-1, -1, -1],
  ];

  const output = new Uint8ClampedArray(data.length);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let r = 0, g = 0, b = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const weight = kernel[ky + 1][kx + 1];
          r += data[idx] * weight;
          g += data[idx + 1] * weight;
          b += data[idx + 2] * weight;
        }
      }

      const idx = (y * width + x) * 4;
      output[idx] = Math.max(0, Math.min(255, r));
      output[idx + 1] = Math.max(0, Math.min(255, g));
      output[idx + 2] = Math.max(0, Math.min(255, b));
      output[idx + 3] = 255;
    }
  }

  for (let i = 0; i < output.length; i++) {
    data[i] = output[i];
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * 将一张图片进行预处理并输出 JPEG Blob
 */
export async function processImage(
  file: File | Blob,
  options: ProcessOptions = {}
): Promise<ProcessedImage> {
  const opts = { ...DEFAULTS, ...options };
  const img = await loadImage(file);

  // 计算目标尺寸（保持比例）
  const scale = Math.min(1, opts.targetWidth / img.width);
  const targetW = Math.round(img.width * scale);
  const targetH = Math.round(img.height * scale);

  // 1. 基础绘制 + 压缩
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("当前浏览器不支持 Canvas");
  }

  // 白色背景打底（避免透明图片在 JPEG 下出现黑底）
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, targetW, targetH);

  // 使用高质量重采样
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, targetW, targetH);

  // 2. 灰度化 + 对比度增强（通过 ImageData 像素级处理）
  if (opts.grayscale) {
    const imgData = ctx.getImageData(0, 0, targetW, targetH);
    const data = imgData.data;
    
    if (opts.contrast !== 1) {
      const contrastFactor = opts.contrast;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        let gray = 0.299 * r + 0.587 * g + 0.114 * b;
        gray = (gray - 128) * contrastFactor + 128;
        gray = Math.max(0, Math.min(255, gray));
        data[i] = data[i + 1] = data[i + 2] = gray;
      }
    } else {
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        data[i] = data[i + 1] = data[i + 2] = gray;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // 3. 边缘增强（在灰度化之后，阈值化之前）
  if (opts.edgeEnhance) {
    applyEdgeEnhance(ctx, targetW, targetH);
  }

  // 4. 锐化
  if (opts.sharpen) {
    applySharpen(ctx, targetW, targetH, opts.sharpenAmount);
  }

  // 5. 自适应阈值（Otsu二值化）
  if (opts.adaptiveThreshold) {
    applyOtsuThreshold(ctx, targetW, targetH);
  }

  // 6. 导出为 JPEG（比 PNG 小 3-5 倍，且 tesseract 对 JPEG 友好）
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("图片导出失败"));
      },
      "image/jpeg",
      opts.quality
    );
  });

  // 清理原始图片 URL
  try {
    URL.revokeObjectURL(img.src);
  } catch {
    // ignore
  }

  return {
    blob,
    width: targetW,
    height: targetH,
  };
}

/**
 * 生成多种预处理策略的图片（用于 OCR 多次扫描）
 * 
 * 分层策略设计：
 * - Level 1（轻量）：快速处理，适合清晰截图
 * - Level 2（标准）：中等增强，适合一般情况
 * - Level 3（增强）：深度处理，适合模糊/低质量图片
 * 
 * 只有在低置信度时才会使用更高层级的处理
 */
export async function generateMultiResolution(
  file: File | Blob
): Promise<ProcessedImage[]> {
  const results: ProcessedImage[] = [];

  // ===== Level 1：轻量处理（快速）=====
  // 适合清晰的截图，处理速度快
  results.push(
    await processImage(file, {
      targetWidth: 1400,
      quality: 0.9,
      grayscale: true,
      contrast: 1.2,
    })
  );

  // ===== Level 2：标准处理（主力）=====
  // 对大多数截图效果最佳
  results.push(
    await processImage(file, {
      targetWidth: 1600,
      quality: 0.9,
      grayscale: true,
      contrast: 1.4,
      sharpen: true,
      sharpenAmount: 0.4,
    })
  );

  // ===== Level 3：增强处理（针对小字/低分辨率）=====
  // 更高分辨率 + 更强对比 + 锐化
  results.push(
    await processImage(file, {
      targetWidth: 2000,
      quality: 0.88,
      grayscale: true,
      contrast: 1.5,
      sharpen: true,
      sharpenAmount: 0.6,
    })
  );

  // ===== Level 4：自适应阈值处理（针对光照不均）=====
  // Otsu二值化，自动计算最佳阈值
  results.push(
    await processImage(file, {
      targetWidth: 1600,
      quality: 0.9,
      grayscale: true,
      contrast: 1.1,
      adaptiveThreshold: true,
    })
  );

  // ===== Level 5：彩色保留（针对特殊场景）=====
  // 保留彩色，有时彩色图片识别更准
  results.push(
    await processImage(file, {
      targetWidth: 1600,
      quality: 0.92,
      grayscale: false,
      contrast: 1.2,
    })
  );

  return results;
}

/**
 * 快速模式：只生成一种轻量处理的图片
 */
export async function generateFastVariant(
  file: File | Blob
): Promise<ProcessedImage> {
  return processImage(file, {
    targetWidth: 1400,
    quality: 0.9,
    grayscale: true,
    contrast: 1.3,
    sharpen: true,
    sharpenAmount: 0.3,
  });
}

/**
 * 增强模式：生成多种增强处理的图片（用于低质量图片）
 */
export async function generateEnhancedVariants(
  file: File | Blob
): Promise<ProcessedImage[]> {
  return Promise.all([
    processImage(file, {
      targetWidth: 1800,
      quality: 0.88,
      grayscale: true,
      contrast: 1.6,
      sharpen: true,
      sharpenAmount: 0.7,
    }),
    processImage(file, {
      targetWidth: 1800,
      quality: 0.88,
      grayscale: true,
      contrast: 1.2,
      adaptiveThreshold: true,
    }),
    processImage(file, {
      targetWidth: 2000,
      quality: 0.85,
      grayscale: true,
      contrast: 1.5,
      edgeEnhance: true,
      sharpen: true,
      sharpenAmount: 0.5,
    }),
  ]);
}

/**
 * 从 File 获取原始图片尺寸（用于显示给用户的上传信息）
 */
export async function getImageSize(
  file: File
): Promise<{ width: number; height: number; sizeKB: number }> {
  const img = await loadImage(file);
  const size = {
    width: img.width,
    height: img.height,
    sizeKB: Math.round(file.size / 1024),
  };
  try {
    URL.revokeObjectURL(img.src);
  } catch {
    // ignore
  }
  return size;
}

/**
 * 清理 ProcessedImage 的临时资源（如果有创建 URL 的话）
 */
export function cleanupImage(img: ProcessedImage): void {
  if (img.revoke) {
    try {
      img.revoke();
    } catch {
      // ignore
    }
  }
}
