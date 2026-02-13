import OpenAI from 'openai';
import { type AppSettings } from '@/types/settings';

console.log('Luma background service worker started');

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Initialize OpenAI client
const getOpenAIClient = (settings: AppSettings) => {
  const config: any = {
    apiKey: settings.llm.apiKey,
    dangerouslyAllowBrowser: true // We are in a service worker, but technically a browser env
  };

  if (settings.llm.provider === 'custom' && settings.llm.baseUrl) {
    config.baseURL = settings.llm.baseUrl;
  } else if (settings.llm.provider === 'gemini') {
      config.baseURL = "https://generativelanguage.googleapis.com/v1beta/openai/";
  }

  return new OpenAI(config);
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Use IIFE to handle async logic and keep the message channel open
  (async () => {
    try {
      if (request.action === 'SUMMARIZE') {
        await handleSummarize(request.payload, sendResponse);
      } else if (request.action === 'MINDMAP') {
        await handleMindMap(request.payload, sendResponse);
      } else if (request.action === 'CHAT') {
        await handleChat(request.payload, sendResponse);
      }
    } catch (error) {
       console.error('Handler error:', error);
       sendResponse({ success: false, error: (error as Error).message });
    }
  })();
  
  return true; // Keep the message channel open for async response
});

async function handleSummarize(payload: { content: string, settings: AppSettings }, sendResponse: (response: any) => void) {
  const openai = getOpenAIClient(payload.settings);
  
  // Context-Aware Prompt: Identify website purpose first, then summarize page content
  const prompt = `
    请按以下步骤对提供的网页内容进行分析，并输出 Markdown 格式的中文报告：

    1. **网站定位与功能**：
       - 根据页面内容（如导航、页脚、元数据等），简要总结这个网站是做什么的（例如：技术博客、电商平台、SaaS工具文档等）。
    
    2. **当前页面概要**：
       - 结合网站定位，详细总结当前页面的核心内容。
       - 提取关键观点、数据、步骤或结论。
       - 如果是长文，请分点列出；如果是工具页，请说明如何使用。

    **要求**：
    - 必须使用中文。
    - 输出格式为 Markdown（使用标题、列表、粗体等）。
    - 保持简洁，直击要点，去除广告或无关干扰信息。
    
    网页内容片段：
    ${payload.content.substring(0, 15000)}
  `;

  const completion = await openai.chat.completions.create({
    messages: [
      { role: "system", content: "你是一个专业的网页内容分析师。请用中文输出高质量的Markdown总结报告。" },
      { role: "user", content: prompt }
    ],
    model: payload.settings.llm.model || "gpt-3.5-turbo",
    stream: false // Future: switch to stream: true for faster UX
  });

  sendResponse({ success: true, data: completion.choices[0].message.content });
}

async function handleMindMap(payload: { content: string, settings: AppSettings }, sendResponse: (response: any) => void) {
  const openai = getOpenAIClient(payload.settings);
  
  const prompt = `
    请根据以下网页内容生成思维导图数据。
    
    **要求**：
    1. 必须返回纯 JSON 格式。
    2. 节点结构需要体现层级关系，适合用树形图展示。
    3. 节点内容必须是中文，精简有力（短语为主）。
    4. 根节点应为页面核心主题。
    5. 使用颜色属性来区分不同层级或模块（例如：根节点红色，一级节点橙色，二级节点蓝色等）。
    
    **JSON 格式定义**：
    {
      "nodes": [
        { "id": "1", "label": "核心主题", "type": "root", "color": "#ef4444" },
        { "id": "2", "label": "子模块A", "type": "default", "color": "#f97316" }
      ],
      "edges": [
        { "source": "1", "target": "2", "animated": true }
      ]
    }

    网页内容：
    ${payload.content.substring(0, 15000)}
  `;

  const completion = await openai.chat.completions.create({
    messages: [
      { role: "system", content: "你是一个思维导图生成专家。只返回 JSON 数据，不要包含 Markdown 标记。" },
      { role: "user", content: prompt }
    ],
    model: payload.settings.llm.model || "gpt-3.5-turbo",
    response_format: { type: "json_object" }
  });

  const content = completion.choices[0].message.content;
  let mindMapData;
  try {
      mindMapData = JSON.parse(content || "{}");
  } catch (e) {
      const cleanContent = content?.replace(/```json/g, '').replace(/```/g, '').trim();
      mindMapData = JSON.parse(cleanContent || "{}");
  }

  sendResponse({ success: true, data: mindMapData });
}

async function handleChat(payload: { messages: any[], settings: AppSettings }, sendResponse: (response: any) => void) {
  const openai = getOpenAIClient(payload.settings);
  
  const messages = [
      { role: "system", content: "你是一个智能助手。请始终使用中文回答用户的问题。如果用户询问网页内容，请基于上下文回答。" },
      ...payload.messages
  ];
  
  const completion = await openai.chat.completions.create({
    messages: messages,
    model: payload.settings.llm.model || "gpt-3.5-turbo",
  });

  sendResponse({ success: true, data: completion.choices[0].message.content });
}
