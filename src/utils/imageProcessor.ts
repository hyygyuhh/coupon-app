/**
 * 图片预处理工具 —— 为 OCR 识别优化图片
 *
 * 优化策略：
 * 1. 自动压缩：手机截图通常 1080+ px，过大会拖慢 OCR 且降低识别率
 * 2. 灰度化 + 对比度增强：让文字与背景对比更鲜明
 * 3. 多种分辨率扫描：尝试 3 种分辨率取综合结果
 *
 * 处理流程：
 *  File → 读取为 Image → 压缩到合适尺寸 → Canvas 处理（灰度/对比度）→ 导出为 Blob
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
}

const DEFAULTS: Required<ProcessOptions> = {
  targetWidth: 1800,
  quality: 0.92,
  grayscale: true,
  contrast: 1.35,
};

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
  if (opts.grayscale && opts.contrast !== 1) {
    const imgData = ctx.getImageData(0, 0, targetW, targetH);
    const data = imgData.data;
    const contrastFactor = opts.contrast;
    // 对比度公式：value = (value - 128) * factor + 128
    // 先做灰度化，再做对比度增强，一次性处理节省循环
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // 加权灰度：感知亮度公式
      let gray = 0.299 * r + 0.587 * g + 0.114 * b;
      // 对比度增强
      gray = (gray - 128) * contrastFactor + 128;
      // 截断到 0-255
      gray = gray < 0 ? 0 : gray > 255 ? 255 : gray;
      data[i] = data[i + 1] = data[i + 2] = gray;
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // 3. 导出为 JPEG（比 PNG 小 3-5 倍，且 tesseract 对 JPEG 友好）
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
 * 生成多种分辨率的图片（用于 OCR 多次扫描）
 * 返回 3 种：
 *   - 标准分辨率（推荐 1500px 宽）—— 对大多数截图效果最佳
 *   - 高分辨率（推荐 2200px 宽）—— 小文字需要更高分辨率
 *   - 原始压缩（不灰度，保留原色）—— 有时彩色图片识别更准
 */
export async function generateMultiResolution(
  file: File | Blob
): Promise<ProcessedImage[]> {
  const results: ProcessedImage[] = [];

  // 策略 1：1500px，灰度 + 高对比（主力）
  results.push(
    await processImage(file, {
      targetWidth: 1500,
      quality: 0.9,
      grayscale: true,
      contrast: 1.35,
    })
  );

  // 策略 2：2200px，灰度 + 更强对比（针对小字/低分辨率）
  results.push(
    await processImage(file, {
      targetWidth: 2200,
      quality: 0.88,
      grayscale: true,
      contrast: 1.5,
    })
  );

  // 策略 3：1800px，彩色，中等对比（针对某些彩色背景/对比强烈的截图）
  results.push(
    await processImage(file, {
      targetWidth: 1800,
      quality: 0.92,
      grayscale: false,
      contrast: 1.25,
    })
  );

  return results;
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
