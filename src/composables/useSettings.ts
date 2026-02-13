import { ref, watch } from 'vue';
import { useStorage } from '@vueuse/core';
import { type AppSettings, DEFAULT_SETTINGS } from '@/types/settings';

// Use a shared state if needed, but for extension, chrome.storage is the source of truth.
// However, useStorage from vueuse usually syncs with localStorage.
// For Chrome extension, we should use chrome.storage.local.
// We can create a custom storage adaptor for useStorage or just wrap chrome.storage.

const settings = ref<AppSettings>(DEFAULT_SETTINGS);
const isLoaded = ref(false);

export function useSettings() {
  
  const loadSettings = async () => {
    try {
      const result = await chrome.storage.local.get('settings');
      if (result.settings) {
        settings.value = { ...DEFAULT_SETTINGS, ...(result.settings as Partial<AppSettings>) };
      }
      isLoaded.value = true;
    } catch (e) {
      console.error('Failed to load settings', e);
      // Fallback for dev environment where chrome.storage might not exist
      if (typeof chrome === 'undefined' || !chrome.storage) {
         console.warn('chrome.storage not available, using defaults');
         isLoaded.value = true;
      }
    }
  };

  const saveSettings = async (newSettings: AppSettings) => {
    settings.value = newSettings;
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({ settings: newSettings });
    }
  };

  // Watch for changes if we want auto-save, but explicit save is safer for API keys.
  
  return {
    settings,
    isLoaded,
    loadSettings,
    saveSettings
  };
}
