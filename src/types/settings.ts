export type LLMProvider = 'openai' | 'gemini' | 'claude' | 'custom';

export interface LLMSettings {
  provider: LLMProvider;
  apiKey: string;
  baseUrl?: string; // Optional for custom or proxy
  model: string;
}

export interface AppSettings {
  llm: LLMSettings;
  language: string;
  theme: 'light' | 'dark' | 'system';
}

export const DEFAULT_SETTINGS: AppSettings = {
  llm: {
    provider: 'openai',
    apiKey: '',
    model: 'gpt-3.5-turbo',
  },
  language: 'zh-CN',
  theme: 'system',
};
