# Luma Chrome Extension 开发指南

## 关键开发注意事项

### 1. CORS & 网络请求处理

**核心原则：所有外部API调用必须通过Background Service Worker**

#### 问题说明
- **Content Script限制**：内容脚本直接发起跨域请求会被浏览器CORS策略阻止
- **Background Script优势**：服务工作者有更高的网络权限，可以访问配置的host_permissions

#### 正确实现方式
```typescript
// ❌ 错误 - 在Content Script中直接调用API
fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer API_KEY' }
}) // 会被CORS阻止

// ✅ 正确 - 通过Background Service Worker中转
// Content Script
chrome.runtime.sendMessage({
  action: 'callLLMAPI',
  provider: 'openai',
  content: '需要总结的内容'
})

// Background Script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'callLLMAPI') {
    fetch(`https://api.${request.provider}.com/v1/chat/completions`, {
      method: 'POST',
      headers: getAuthHeaders(request.provider)
    })
    .then(response => response.json())
    .then(data => sendResponse({ success: true, data }))
    .catch(error => sendResponse({ success: false, error: error.message }))
    return true // 保持消息通道开放
  }
})
```

#### manifest.json配置
```json
{
  "host_permissions": [
    "https://api.openai.com/*",
    "https://generativelanguage.googleapis.com/*",
    "https://api.anthropic.com/*",
    "https://*/*" // 支持自定义Base URL
  ]
}
```

### 2. Content Security Policy (CSP) 配置

#### Vue 3 DevTools 兼容性问题
Vue的开发工具使用`eval()`和`new Function()`，与严格的CSP冲突

#### 开发环境CSP配置
```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'unsafe-eval'; object-src 'self'"
  }
}
```

#### 生产环境CSP配置
```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

#### Vite构建优化
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ['vue'],
          vendor: ['pinia', 'vueuse']
        }
      }
    }
  }
})
```

### 3. Service Worker 生命周期管理

#### 关键问题：Service Worker会被浏览器自动终止
- **终止条件**：30秒无活动、内存压力、浏览器重启
- **影响**：全局变量丢失、定时器停止、WebSocket连接断开

#### 状态持久化策略
```typescript
// ❌ 错误 - 使用全局变量存储状态
let apiKey = ''
let requestQueue = []

// ✅ 正确 - 使用chrome.storage存储状态
const saveState = async (state: any) => {
  await chrome.storage.local.set({ serviceWorkerState: state })
}

const loadState = async () => {
  const result = await chrome.storage.local.get('serviceWorkerState')
  return result.serviceWorkerState || {}
}

// 在Service Worker启动时恢复状态
chrome.runtime.onStartup.addListener(async () => {
  const state = await loadState()
  // 恢复未完成的请求等
})

// 定期保存状态
setInterval(async () => {
  await saveState({
    lastActivity: Date.now(),
    pendingRequests: getPendingRequests()
  })
}, 5000)
```

#### 长连接保持策略
```typescript
// 使用长连接保持Service Worker活跃
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'keepAlive') {
    // 每20秒发送一次心跳
    const heartbeat = setInterval(() => {
      port.postMessage({ type: 'heartbeat' })
    }, 20000)
    
    port.onDisconnect.addListener(() => {
      clearInterval(heartbeat)
    })
  }
})

// 在Side Panel中保持连接
const keepAlive = () => {
  const port = chrome.runtime.connect({ name: 'keepAlive' })
  port.onMessage.addListener((msg) => {
    if (msg.type === 'heartbeat') {
      console.log('Service Worker活跃中')
    }
  })
  
  // 每25秒重新连接（防止长时间断开）
  setTimeout(keepAlive, 25000)
}
```

### 4. 样式隔离（Shadow DOM）

#### 问题：扩展样式污染宿主页面
```css
/* 这会影响页面上所有的按钮 */
button {
  background: blue !important;
}
```

#### Shadow DOM解决方案
```typescript
// 创建隔离的Shadow DOM容器
class IsolatedContainer {
  private container: HTMLElement
  private shadowRoot: ShadowRoot
  
  constructor() {
    // 创建宿主元素
    this.container = document.createElement('div')
    this.container.id = 'luma-extension-root'
    
    // 创建Shadow DOM
    this.shadowRoot = this.container.attachShadow({ mode: 'open' })
    
    // 注入样式
    const style = document.createElement('style')
    style.textContent = `
      /* 只在Shadow DOM内生效的样式 */
      .luma-button {
        background: #007bff;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
      }
    `
    this.shadowRoot.appendChild(style)
    
    // 创建Vue应用挂载点
    const app = document.createElement('div')
    app.id = 'luma-app'
    this.shadowRoot.appendChild(app)
  }
  
  mount() {
    document.body.appendChild(this.container)
    return this.shadowRoot.getElementById('luma-app')
  }
  
  unmount() {
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container)
    }
  }
}
```

#### Tailwind CSS隔离配置
```typescript
// tailwind.config.js
module.exports = {
  content: [
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  important: '#luma-extension-root', // 添加important前缀确保优先级
  corePlugins: {
    preflight: false, // 禁用Tailwind的基础样式，避免影响宿主页面
  },
  prefix: 'luma-', // 添加前缀避免样式冲突
}
```

### 5. 消息传递架构

#### 异步消息处理模式
```typescript
// 消息类型定义
interface ExtensionMessage {
  action: string
  payload?: any
  timestamp?: number
}

interface MessageResponse {
  success: boolean
  data?: any
  error?: string
}

// 统一的消息发送工具
class MessageBus {
  static async send(action: string, payload?: any): Promise<MessageResponse> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action, payload, timestamp: Date.now() },
        (response: MessageResponse) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else if (response?.success) {
            resolve(response)
          } else {
            reject(new Error(response?.error || 'Unknown error'))
          }
        }
      )
    })
  }
  
  // 长连接消息
  static createPort(name: string) {
    return chrome.runtime.connect({ name })
  }
}

// 在Vue组件中使用
const generateSummary = async (content: string) => {
  try {
    const response = await MessageBus.send('generateSummary', { content })
    return response.data
  } catch (error) {
    console.error('生成总结失败:', error)
    throw error
  }
}
```

#### 消息处理最佳实践
```typescript
// Background Script中的消息处理
class MessageHandler {
  private handlers: Map<string, Function> = new Map()
  
  constructor() {
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this))
  }
  
  register(action: string, handler: Function) {
    this.handlers.set(action, handler)
  }
  
  private async handleMessage(
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ) {
    const { action, payload } = message
    
    try {
      const handler = this.handlers.get(action)
      if (!handler) {
        throw new Error(`未找到处理程序: ${action}`)
      }
      
      const data = await handler(payload, sender)
      sendResponse({ success: true, data })
    } catch (error) {
      console.error(`处理 ${action} 失败:`, error)
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
    
    return true // 保持消息通道开放
  }
}

// 注册消息处理器
const messageHandler = new MessageHandler()
messageHandler.register('generateSummary', async (payload) => {
  return await llmService.generateSummary(payload.content)
})
messageHandler.register('verifyApiKey', async (payload) => {
  return await apiService.verifyConnection(payload.provider, payload.apiKey)
})
```

### 6. 构建配置与热重载

#### Vite多入口配置
```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

export default defineConfig({
  plugins: [
    crx({ manifest }),
    vue()
  ],
  build: {
    rollupOptions: {
      input: {
        // 多入口配置
        background: 'src/background/index.ts',
        content: 'src/content/index.ts',
        sidepanel: 'src/sidepanel/index.html',
        popup: 'src/popup/index.html'
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // 根据入口类型输出到不同目录
          if (chunkInfo.name === 'background') {
            return 'background.js'
          }
          if (chunkInfo.name === 'content') {
            return 'content-script.js'
          }
          return '[name].js'
        }
      }
    }
  },
  server: {
    port: 3000,
    hmr: {
      port: 3001,
      host: 'localhost'
    }
  }
})
```

#### 热重载限制与解决方案
```typescript
// 开发环境下的热重载处理
if (import.meta.hot) {
  // Vue组件热重载
  import.meta.hot.accept(() => {
    console.log('组件热更新')
  })
  
  // Background Script热重载需要重新初始化
  import.meta.hot.dispose(() => {
    // 清理旧的监听器
    chrome.runtime.onMessage.removeListener(messageHandler)
    chrome.runtime.onConnect.removeListener(connectHandler)
  })
  
  import.meta.hot.accept(() => {
    // 重新初始化
    initializeExtension()
  })
}
```

### 7. Streamed Responses处理

#### Server-Sent Events在Service Worker中的处理
```typescript
// Background Script中的SSE处理
class SSEManager {
  private connections: Map<string, EventSource> = new Map()
  
  async createConnection(requestId: string, url: string, headers: HeadersInit) {
    const eventSource = new EventSource(url)
    
    eventSource.onmessage = (event) => {
      // 将SSE数据转发到Side Panel
      chrome.runtime.sendMessage({
        action: 'streamData',
        requestId,
        data: JSON.parse(event.data)
      })
    }
    
    eventSource.onerror = (error) => {
      chrome.runtime.sendMessage({
        action: 'streamError',
        requestId,
        error: error.message
      })
      this.connections.delete(requestId)
    }
    
    eventSource.onopen = () => {
      chrome.runtime.sendMessage({
        action: 'streamOpen',
        requestId
      })
    }
    
    this.connections.set(requestId, eventSource)
  }
  
  closeConnection(requestId: string) {
    const eventSource = this.connections.get(requestId)
    if (eventSource) {
      eventSource.close()
      this.connections.delete(requestId)
    }
  }
}
```

### 8. 错误处理与用户反馈

#### 统一的错误处理机制
```typescript
// 错误类型定义
enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}

class ErrorHandler {
  static handle(error: any, context: string): MessageResponse {
    console.error(`[${context}]`, error)
    
    let errorType = ErrorType.NETWORK_ERROR
    let userMessage = '网络连接失败，请检查网络设置'
    
    if (error.message?.includes('401')) {
      errorType = ErrorType.AUTH_ERROR
      userMessage = 'API密钥无效，请检查密钥配置'
    } else if (error.message?.includes('429')) {
      errorType = ErrorType.RATE_LIMIT_ERROR
      userMessage = 'API调用频率超限，请稍后再试'
    } else if (error.message?.includes('API key')) {
      errorType = ErrorType.AUTH_ERROR
      userMessage = 'API密钥配置错误，请重新配置'
    }
    
    return {
      success: false,
      error: userMessage,
      errorType
    }
  }
}
```

### 9. 性能优化建议

#### 资源加载优化
```typescript
// 按需加载大型库
const loadHeavyLibrary = async () => {
  const { default: HeavyLibrary } = await import(
    /* webpackChunkName: "heavy-library" */
    './HeavyLibrary'
  )
  return HeavyLibrary
}

// 预加载关键资源
const preloadCriticalResources = () => {
  const link = document.createElement('link')
  link.rel = 'preload'
  link.href = '/critical-resource.js'
  link.as = 'script'
  document.head.appendChild(link)
}
```

#### 内存管理
```typescript
// 及时清理大对象
class MemoryManager {
  private largeDataCache: Map<string, any> = new Map()
  
  cacheLargeData(key: string, data: any) {
    // 限制缓存大小
    if (this.largeDataCache.size > 50) {
      const firstKey = this.largeDataCache.keys().next().value
      this.largeDataCache.delete(firstKey)
    }
    
    this.largeDataCache.set(key, data)
    
    // 设置自动清理
    setTimeout(() => {
      this.largeDataCache.delete(key)
    }, 5 * 60 * 1000) // 5分钟后清理
  }
  
  clearCache() {
    this.largeDataCache.clear()
    // 触发垃圾回收
    if (global.gc) {
      global.gc()
    }
  }
}
```

## 测试建议

### 1. 单元测试
- 使用Vitest测试Vue组件和工具函数
- 模拟Chrome API进行隔离测试

### 2. 集成测试
- 测试消息传递流程
- 验证多模型API集成

### 3. 端到端测试
- 使用Puppeteer测试完整的用户流程
- 验证不同网页的内容提取效果

## 发布注意事项

### 1. Chrome Web Store审核
- 确保隐私政策完整
- 权限申请合理且必要
- 提供清晰的安装和使用说明

### 2. 版本管理
- 遵循语义化版本规范
- 详细的更新日志
- 向后兼容性考虑

### 3. 监控和分析
- 集成错误监控（可选）
- 性能指标收集（匿名化）
- 用户反馈收集机制