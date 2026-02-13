# Luma - 智能网页助手 (Smart Web Assistant)

Luma 是一款基于浏览器侧边栏的智能助手插件，利用大语言模型（LLM）的能力，为您提供网页内容的深度总结、思维导图生成以及智能问答服务。

## 📚 功能亮点

- **智能总结**: 一键生成网页内容的深度摘要。
- **思维导图**: 自动生成可视化的思维导图，帮助梳理知识结构。
- **智能问答**: 基于当前网页内容进行对话问答。
- **BYOK (Bring Your Own Key)**: 支持接入 OpenAI, Google Gemini, Claude 或自定义模型 API，保护您的隐私。
- **本地优先**: 所有数据和密钥存储在本地，安全无忧。

## 🛠️ 技术栈

- **前端框架**: Vue 3 + TypeScript
- **构建工具**: Vite + CRXJS (专为 Chrome 插件打造)
- **状态管理**: Pinia
- **UI 组件**: TailwindCSS + Shadcn-Vue
- **图标库**: Lucide Vue

---

## 🚀 开发与部署指南

### 1. 环境准备

确保您的电脑已安装以下环境：
- **Node.js**: 推荐 v20+ (本项目使用 v22.13.0)
- **pnpm**: 推荐使用 pnpm 管理依赖 (`npm install -g pnpm`)

### 2. 安装依赖

在项目根目录下运行：

```bash
pnpm install
```

### 3. 开发模式 (Development)

如果您想修改代码并实时查看效果：

1. 启动开发服务器：
   ```bash
   pnpm dev
   ```
   *此时 `dist` 文件夹会被监听并实时更新。*

2. 在 Chrome 中加载插件：
   - 打开 Chrome 浏览器，访问 `chrome://extensions/`
   - 打开右上角的 **"开发者模式" (Developer mode)** 开关。
   - 点击左上角的 **"加载已解压的扩展程序" (Load unpacked)**。
   - 选择本项目下的 `dist` 文件夹。

3. 开始开发：
   - 修改代码后，Vite 会自动热更新 (HMR)，大部分修改无需刷新页面即可生效。
   - 如果修改了 `manifest.json` 或 `background` 脚本，可能需要在扩展管理页点击刷新按钮。

### 4. 打包部署 (Production Build)

当您开发完成，准备正式使用或发布时：

1. 执行构建命令：
   ```bash
   pnpm build
   ```
   *这将生成经过压缩和优化的生产环境代码，输出到 `dist` 目录。*

2. 在 Chrome 中安装 (正式版)：
   - 同样访问 `chrome://extensions/`。
   - 如果之前加载过开发版，建议先移除。
   - 点击 **"加载已解压的扩展程序" (Load unpacked)**。
   - 选择本项目下的 `dist` 文件夹。

3. (可选) 打包成 `.zip` 发布：
   - 如果您需要发送给别人安装，或者发布到 Chrome Web Store。
   - 手动将 `dist` 文件夹内的所有内容压缩为一个 `luma-extension.zip` 文件。
   - 别人可以直接解压该 zip 并通过 "加载已解压的扩展程序" 安装。

## 📂 项目结构

```text
Luma/
├── src/
│   ├── background/    # 后台服务 (Service Worker)
│   ├── content/       # 注入网页的脚本
│   ├── sidepanel/     # 侧边栏主页面 (Vue App)
│   ├── popup/         # 插件图标弹窗
│   ├── options/       # 设置页面
│   ├── composables/   # 共享逻辑 (VueUse)
│   └── manifest.json  # 插件配置文件
├── dist/              # 构建产物 (直接加载此文件夹)
└── docs/              # 详细设计文档
```

## 📖 详细文档

- [产品需求文档 (PRD)](docs/luma-prd.md)
- [技术架构文档](docs/luma-tech-arch.md)
- [插件开发指南](docs/extension-development-guide.md)
