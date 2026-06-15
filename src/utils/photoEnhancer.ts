/**
 * 拍照图像增强器 —— 专为手机/相机拍摄的优惠券截图优化
 *
 * 拍照 vs 截图的差异：
 * 拍照：角度畸变、光线不均、对比度低、有阴影/反光、文字可能模糊
 * 截图：平整、高对比、干净、无畸变
 *
 * 拍照增强策略：
 * 1. 自适应直方图均衡化 —— 解决光照不均（中间亮四周暗）
 * 2. 强力对比度增强 —— 让文字从背景中更突出
 * 3. 锐化（Unsharp Mask）—— 补偿手机镜头的软焦
 * 4. 自适应二值化 —— 把文字变成纯黑白，消除灰色噪点
 * 5. 去噪（可选）—— 轻微的高斯模糊去噪点，保留边缘
 */

import { processImage, type ProcessedImage } from "./imageProcessor";

/**
 * 判断一张图片是否"看起来像拍照"（而非截图）
 * 启发式判断：尺寸比例异常、分辨率特别高、宽高比非标准
 */
function looksLikeCameraPhoto(width: number, height: number): boolean {
  // 手机拍照通常有 Exif 信息，这里用启发式规则判断
  // 如果图片宽度 >= 2500px 且宽高比是常见的手机比例（3:4 / 4:3 / 9:16）
  // 或者尺寸特别大（> 4000px）
  if (width > 4000) return true;
  const ratio = width / height;
  // 常见手机比例
  if (ratio > 0.55 && ratio < 0.85) return true; // 竖拍 3:4 ~ 9:16
  if (ratio > 1.1 && ratio < 1.5) return true;   // 横拍 4:3 ~ 3:2
  return false;
}

/**
 * 自适应直方图均衡化（CLAHE-lite）
 * 对灰度图像的每个局部块分别做直方图均衡化，解决光照不均问题
 *
 * @param imageData ImageData 对象（会被直接修改）
 * @param clipLimit 对比度截断值，越大对比度越强（建议 2-3）
 * @param tileSize 局部块大小，越小细节越多但计算越慢（建议 8-16）
 */
function applyCLAHE(
  imageData: ImageData,
  clipLimit = 2.5,
  tileSize = 16
): void {
  const { data, width, height } = imageData;
  const tilesX = Math.ceil(width / tileSize);
  const tilesY = Math.ceil(height / tileSize);

  // 第一步：计算每个 tile 的直方图和裁剪
  const numBins = 256;
  const histograms: number[][] = [];
  const tileStats: { lo: number; hi: number }[] = [];

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const hist = new Array(numBins).fill(0);
      const x0 = tx * tileSize;
      const y0 = ty * tileSize;
      const x1 = Math.min(x0 + tileSize, width);
      const y1 = Math.min(y0 + tileSize, height);

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * width + x) * 4;
          const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
          hist[Math.min(gray, 255)]++;
        }
      }

      // 裁剪（Clip Limit）
      const pixelsPerTile = (x1 - x0) * (y1 - y0);
      const clipVal = (clipLimit * pixelsPerTile) / numBins;
      let clipped = 0;
      for (let b = 0; b < numBins; b++) {
        if (hist[b] > clipVal) {
          clipped += hist[b] - clipVal;
          hist[b] = clipVal;
        }
      }
      // 把裁剪的部分均分给所有 bin
      const addPerBin = clipped / numBins;
      for (let b = 0; b < numBins; b++) hist[b] += addPerBin;

      // 计算 CDF（累积分布函数）
      let sum = 0;
      const cdf = new Array(numBins);
      for (let b = 0; b < numBins; b++) {
        sum += hist[b];
        cdf[b] = sum;
      }

      // 归一化
      const cdfMin = cdf[0];
      const cdfMax = cdf[numBins - 1];
      const lo = cdfMin / pixelsPerTile;
      const hi = cdfMax / pixelsPerTile;

      histograms.push(hist);
      tileStats.push({ lo, hi });
    }
  }

  // 第二步：对每个像素做双线性插值变换
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // 找到当前像素所在的 tile 及浮点位置
      const txf = (x + 0.5) / tileSize - 0.5;
      const tyf = (y + 0.5) / tileSize - 0.5;

      const tx1 = Math.max(0, Math.floor(txf));
      const ty1 = Math.max(0, Math.floor(tyf));
      const tx2 = Math.min(tilesX - 1, tx1 + 1);
      const ty2 = Math.min(tilesY - 1, ty1 + 1);

      // 双线性权重
      const fx = txf - tx1;
      const fy = tyf - ty1;

      const i = (y * width + x) * 4;
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);

      // 从周围 4 个 tile 的 CDF 插值得到新灰度
      const idx1 = ty1 * tilesX + tx1;
      const idx2 = ty1 * tilesX + tx2;
      const idx3 = ty2 * tilesX + tx1;
      const idx4 = ty2 * tilesX + tx2;

      const s1 = tileStats[idx1];
      const s2 = tileStats[idx2];
      const s3 = tileStats[idx3];
      const s4 = tileStats[idx4];

      // 在各 tile 的 CDF 中找对应的映射值（简化：用线性插值代替查表）
      function mapGray(gray: number, s: { lo: number; hi: number }): number {
        const cdf = histograms[idx1 > 0 ? idx1 : 0]; // 简化：用周围 CDF 的平均值
        const total = s.hi - s.lo;
        if (total < 1e-6) return gray;
        // 线性映射
        return Math.round(((gray - s.lo) / total) * 255);
      }

      const g1 = mapGray(gray, s1);
      const g2 = mapGray(gray, s2);
      const g3 = mapGray(gray, s3);
      const g4 = mapGray(gray, s4);

      // 双线性插值
      const g =
        g1 * (1 - fx) * (1 - fy) +
        g2 * fx * (1 - fy) +
        g3 * (1 - fx) * fy +
        g4 * fx * fy;

      const clamped = Math.max(0, Math.min(255, Math.round(g)));
      data[i] = data[i + 1] = data[i + 2] = clamped;
    }
  }
}

/**
 * 简化版对比度增强 + 锐化 + 自适应二值化
 * 适用于手机拍照（光照不均、文字模糊）
 */
function enhancePhotoImageData(imageData: ImageData): void {
  const { data, width, height } = imageData;
  const copy = new Uint8ClampedArray(data); // 原始副本（用于锐化）

  // 第一步：强力对比度增强（gamma 校正 + 线性拉伸）
  // gamma = 0.8 表示提亮暗部（手机拍照通常暗处细节丢失）
  const gamma = 0.75;
  for (let i = 0; i < data.length; i += 4) {
    // 灰度值
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    // gamma 校正
    const corrected = 255 * Math.pow(gray / 255, gamma);
    data[i] = data[i + 1] = data[i + 2] = corrected;
  }

  // 第二步：Unsharp Mask 锐化（3×3 卷积核）
  // 核：[ 0, -1,  0]
  //     [-1,  5, -1]
  //     [ 0, -1,  0]
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      const center = copy[i];

      // 拉普拉斯锐化核
      const sharpened =
        5 * center -
        copy[(y - 1) * width * 4 + x * 4] -
        copy[(y + 1) * width * 4 + x * 4] -
        copy[y * width * 4 + (x - 1) * 4] -
        copy[y * width * 4 + (x + 1) * 4];

      const clamped = Math.max(0, Math.min(255, Math.round(sharpened)));
      data[i] = data[i + 1] = data[i + 2] = clamped;
    }
  }

  // 第三步：Otsu 自适应二值化（将灰度图转为纯黑白，文字更清晰）
  // 计算全局 Otsu 阈值
  const histogram = new Array(256).fill(0);
  let totalPixels = 0;
  for (let i = 0; i < data.length; i += 4) {
    histogram[Math.round(data[i])]++;
    totalPixels++;
  }

  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];

  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let maxVariance = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    wF = totalPixels - wB;
    if (wF === 0) break;
    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const variance = wB * wF * (mB - mF) * (mB - mF);
    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }

  // 应用二值化：文字变黑，背景变白
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i];
    const val = gray < threshold ? 0 : 255;
    data[i] = data[i + 1] = data[i + 2] = val;
  }
}

/**
 * 对 ProcessedImage 做拍照增强处理（返回一个新的 Blob）
 */
async function enhancePhotoImage(img: ProcessedImage): Promise<ProcessedImage> {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 不支持");

  // 把 blob 重新画到 canvas 上
  const blobUrl = URL.createObjectURL(img.blob);
  try {
    const tempImg = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = blobUrl;
    });
    ctx.drawImage(tempImg, 0, 0);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }

  // 获取像素数据
  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  enhancePhotoImageData(imageData);
  ctx.putImageData(imageData, 0, 0);

  // 导出为 JPEG（比 PNG 小很多）
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("导出失败"))),
      "image/jpeg",
      0.95
    );
  });

  return { blob, width: img.width, height: img.height };
}

/**
 * 生成适合拍照 OCR 的图片版本
 * 包含标准版 + 增强版（强力对比度 + 二值化）
 */
export async function generatePhotoVariants(
  file: File | Blob
): Promise<ProcessedImage[]> {
  // 先用标准预处理生成彩色 + 灰度两个基础版本
  const [colorImg, grayImg] = await Promise.all([
    processImage(file, {
      targetWidth: 2000,
      quality: 0.92,
      grayscale: false,
      contrast: 1.2,
    }),
    processImage(file, {
      targetWidth: 2000,
      quality: 0.9,
      grayscale: true,
      contrast: 1.3,
    }),
  ]);

  // 对灰度图做强力增强（二值化版本）
  // 注意：这是异步的，需要单独处理
  const enhancedImg = await enhancePhotoImage(grayImg);

  return [colorImg, grayImg, enhancedImg];
}

/**
 * 判断是否需要拍照增强模式
 * @returns true = 使用拍照增强流程
 */
export async function detectPhotoMode(file: File): Promise<boolean> {
  // 读取图片尺寸判断
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const result = looksLikeCameraPhoto(img.width, img.height);
      URL.revokeObjectURL(url);
      resolve(result);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      // 无法判断时默认走拍照增强（更安全）
      resolve(true);
    };
    img.src = url;
  });
}
