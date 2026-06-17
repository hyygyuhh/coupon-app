# 🐑 羊毛管家 - 优惠券智能管理助手

> AI 驱动的优惠券管理应用，让每一分优惠都不被错过

[![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646cff?style=flat-square&logo=vite)](https://vitejs.dev/)
[![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088ff?style=flat-square&logo=github-actions)](https://github.com/features/actions)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

---

## ✨ 功能特色

### 📷 AI 拍照识别
- 基于 Tesseract.js v5 本地 OCR 引擎
- 支持中英文混合识别
- 自动提取优惠券名称、平台、金额、有效期
- Canvas 图像预处理（灰度化、对比度增强、自适应直方图均衡化）
- 所有处理在本地浏览器完成，保护隐私

### 🔔 智能过期提醒
- **飞书机器人推送**：通过飞书自定义机器人发送提醒
- **钉钉机器人推送**：通过钉钉自定义机器人发送提醒
- 自定义提前提醒天数
- 每张券每天最多提醒一次，避免骚扰

### ☁️ 云端同步
- 基于 GitHub Gist 自动同步数据
- 数据独立存储在你的个人 Gist 中
- 支持从云端恢复数据
- 增量更新，自动清理无效记录

### ⚡ GitHub Actions 自动检查
- 每日定时检查即将过期的优惠券
- 即使不打开网站也能收到提醒
- 完整的日志输出，方便排查问题

---

## 🚀 快速开始

### 在线体验

访问 [https://hyygyuhh.github.io/coupon-app/](https://hyygyuhh.github.io/coupon-app/)

### 本地开发

```bash
# 1. 克隆项目
git clone https://github.com/hyygyuhh/coupon-app.git

# 2. 安装依赖
cd coupon-app
npm install

# 3. 启动开发服务器
npm run dev

# 4. 构建生产版本
npm run build
```

---

## 📖 使用指南

### 1. 添加优惠券

**方式一：拍照/截图识别**
1. 点击首页的「📷 拍照识别」
2. 上传或拍摄优惠券图片
3. 确认自动提取的信息，点击保存

**方式二：手动输入**
1. 点击首页的「➕ 添加券」
2. 填写优惠券名称、平台、金额、有效期
3. 选择状态（未使用/已使用/已过期）
4. 点击保存

### 2. 配置过期提醒

1. 打开「设置」页面
2. 选择提醒渠道：飞书或钉钉
3. 配置 Webhook 和加签密钥（如需要）
4. 设置提前提醒天数
5. 点击「发送测试」验证配置

### 3. 启用云端同步

1. 打开「设置」页面
2. 找到「云端同步」区域
3. 填入你的 GitHub Personal Access Token（需要 `gist` 权限）
4. 填入 Gist ID（留空会自动创建）
5. 开启云同步开关

### 4. 获取 GitHub Token

1. 访问 [https://github.com/settings/tokens](https://github.com/settings/tokens)
2. 点击「Generate new token」
3. 勾选 `gist` 权限
4. 点击生成，复制 token 到应用中

### 5. 获取 Gist ID

- 如果留空，应用会自动创建一个 Gist
- 手动创建：访问 [https://gist.github.com/](https://gist.github.com/) 新建一个 Gist，ID 是 URL 中最后一部分

---

## 🏗️ 技术架构

### 前端技术栈

| 技术 | 用途 |
|------|------|
| **React 18** | UI 框架 |
| **TypeScript** | 类型安全 |
| **Vite** | 构建工具 |
| **Zustand** | 状态管理 |
| **Tesseract.js v5** | 本地 OCR 引擎 |
| **Canvas API** | 图像预处理 |
| **localStorage** | 本地数据存储 |

### 云端服务

| 服务 | 用途 |
|------|------|
| **GitHub Pages** | 静态网站部署 |
| **GitHub Gist** | 优惠券数据云存储 |
| **GitHub Actions** | 每日自动检查与提醒 |
| **飞书/Dingtalk Webhook** | 消息推送 |

### 目录结构

```
coupon-app/
├── src/
│   ├── components/          # React 组件
│   │   ├── NavBar.tsx       # 导航栏
│   │   ├── CouponCard.tsx   # 优惠券卡片
│   │   ├── CouponForm.tsx   # 优惠券表单
│   │   ├── ReminderSettings.tsx  # 提醒设置面板
│   │   ├── ToggleSwitch.tsx      # 开关组件
│   │   └── OCRScanner.tsx        # OCR 扫描器
│   ├── store/               # 状态管理
│   ├── utils/               # 工具函数
│   │   ├── ocrService.ts    # OCR 识别服务
│   │   ├── reminder.ts      # 提醒功能
│   │   ├── cloudSync.ts     # 云端同步
│   │   └── storage.ts       # 本地存储
│   ├── types/               # 类型定义
│   └── App.tsx              # 应用入口
├── scripts/
│   └── check-reminders.cjs  # GitHub Actions 提醒脚本
├── .github/
│   └── workflows/
│       └── daily-reminder.yml  # 每日提醒工作流
└── package.json
```

---

## 🔧 配置 GitHub Actions

### 1. 添加 Secrets

在你的 GitHub 仓库中，打开 **Settings → Secrets and variables → Actions**，添加以下 Secrets：

| Secret 名称 | 说明 | 必填 |
|------------|------|------|
| `GH_TOKEN` | 你的 GitHub Personal Access Token（需要 `gist` 权限） | ✅ |
| `GIST_ID` | 你的 Gist ID | ✅ |
| `FEISHU_WEBHOOK` | 飞书机器人 Webhook URL | 二选一 |
| `FEISHU_SECRET` | 飞书机器人加签密钥 | 可选 |
| `DINGTALK_WEBHOOK` | 钉钉机器人 Webhook URL | 二选一 |
| `DINGTALK_SECRET` | 钉钉机器人加签密钥 | 可选 |
| `REMINDER_DAYS` | 提前几天提醒，如 `3` | 可选 |
| `REMINDER_TYPE` | `feishu` 或 `dingtalk` | 可选 |

### 2. 工作流配置

`.github/workflows/daily-reminder.yml` 已配置：

- **触发时间**：每天 UTC 01:00（北京时间 09:00）
- **手动触发**：支持 workflow_dispatch，可在 Actions 页面手动运行
- **工作内容**：从 Gist 读取优惠券数据 → 筛选即将过期 → 发送飞书/钉钉消息 → 更新状态

### 3. 手动测试

1. 打开 GitHub 仓库的 **Actions** 页面
2. 点击「Daily Coupon Reminder」
3. 点击「Run workflow」
4. 查看运行结果和日志输出

---

## 📝 机器人配置指南

### 飞书机器人

1. 打开飞书 → 进入目标群聊 → 群设置 → 群机器人
2. 点击「添加机器人」→ 选择「自定义机器人」
3. 输入机器人名称（如「羊毛管家」）
4. 选择安全策略：推荐使用「加签」方式
5. 复制 Webhook URL 和加签密钥
6. 在应用设置中填入

### 钉钉机器人

1. 打开钉钉 → 进入目标群聊 → 群设置 → 机器人
2. 点击「添加机器人」→ 选择「自定义」
3. 输入机器人名称
4. 选择安全策略：推荐使用「加签」方式
5. 复制 Webhook URL 和加签密钥
6. 在应用设置中填入

---

## 🤝 参与贡献

欢迎提交 Issue 和 Pull Request！

### 开发指南

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 生产构建
npm run build

# 预览构建结果
npm run preview
```

### 贡献步骤

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的改动 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

---

## 📄 License

MIT License - 详见 [LICENSE](LICENSE) 文件

---

## ⭐ 支持

如果这个项目对你有帮助，欢迎 **Star** ⭐ 支持一下！

---

## 📮 联系

- **GitHub Issues**：功能建议、Bug 报告
- **Pull Requests**：代码贡献

---

## 📸 功能预览

<details>
<summary>点击展开功能预览</summary>

### 首页 - 优惠券列表
> 清晰展示所有优惠券，按过期时间排序

### OCR 识别
> 拍照或上传图片，自动提取信息

### 设置页面
> 配置提醒渠道、Webhook、云同步

### 飞书/钉钉提醒
> 每日自动推送即将过期的优惠券

</details>

---

## ❓ FAQ

**Q: 我的优惠券数据安全吗？**  
A: 安全。所有数据存储在你的本地浏览器和你自己的 GitHub Gist 中，我们不收集任何数据。

**Q: 没有 GitHub 账号可以用吗？**  
A: 可以。不配置云同步也能正常使用，只是数据只存储在本地浏览器。

**Q: OCR 识别准确吗？**  
A: 对于清晰的印刷体优惠券识别率较好。识别结果支持手动修改确认。

**Q: 能在手机上使用吗？**  
A: 可以。响应式布局，支持手机浏览器访问。

**Q: GitHub Actions 免费额度够吗？**  
A: 够的。每天只运行一次，每次运行约 30 秒，免费额度为每月 2000 分钟。

