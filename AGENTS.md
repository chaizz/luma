# Luma Agent Context

此文件包含 Luma 项目的核心设计文档索引，供 AI Agent 参考。

## 核心文档

### 1. 产品定义
请参考 [docs/luma-prd.md](docs/luma-prd.md) 获取完整的产品需求。
**核心功能**:
- 网页内容提取 (Readability, YouTube Transcript)
- 智能总结 (多维度摘要)
- 思维导图 (Vue Flow 可视化)
- 侧边栏交互 (Side Panel)
- BYOK (用户自定义 API Key)

### 2. 技术架构
请参考 [docs/luma-tech-arch.md](docs/luma-tech-arch.md) 获取完整的架构设计。
**架构特点**:
- Serverless / Local-first
- Background Service Worker 处理所有 API 请求
- Chrome Storage Local 存储敏感数据
- Vue 3 + Vite + CRXJS

### 3. 开发规范
请参考 [docs/extension-development-guide.md](docs/extension-development-guide.md) 获取开发注意事项。
**关键点**:
- CORS 处理
- CSP 限制
- 样式隔离 (Shadow DOM)
