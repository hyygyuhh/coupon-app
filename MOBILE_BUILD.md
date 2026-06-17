# 优惠券管家 - 手机 APP 构建指南

本项目已配置 Capacitor，可将网页打包成 Android 和 iOS 原生应用。

## 快速开始

### 在本地构建 APK

```bash
# 1. 安装依赖
npm install

# 2. 构建 Web 项目并生成 APK
npm run build:android
```

APK 文件将生成在 `android/app/build/outputs/apk/debug/app-debug.apk`

### 实时预览（网页）
```bash
npm run dev
```

### 同步更新到 Android
```bash
npm run cap:sync
```

### 在 Android Studio 中打开项目
```bash
npm run cap:open
```

## 前置要求

### Android 构建
- Android SDK (API 21+)
- Java JDK 17+
- Node.js 18+

### iOS 构建（仅 macOS）
- Xcode 15+
- CocoaPods
- Node.js 18+

## 项目结构

```
├── android/          # Android 原生项目
├── capacitor.config.ts  # Capacitor 配置
├── dist/             # 构建后的 Web 文件
└── src/              # React 源代码
```

## 自定义 APP 配置

修改 `capacitor.config.ts` 可更改：
- 应用 ID (appId)
- 应用名称 (appName)
- 启动画面样式

修改 `android/app/src/main/res/values/strings.xml` 可更改应用显示名称。

## 安装到手机

1. 用数据线连接手机到电脑
2. 启用手机的 USB 调试模式
3. 传输 `app-debug.apk` 到手机并安装

或使用以下方式：
- 上传到蒲公英 / Fir.im 等平台扫码安装
- 上传到应用商店
