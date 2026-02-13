<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useSettings } from '@/composables/useSettings';
import { type LLMProvider } from '@/types/settings';
import { Loader2, Check, Save } from 'lucide-vue-next';

const { settings, loadSettings, saveSettings, isLoaded } = useSettings();
const saving = ref(false);
const message = ref('');

const providers: { label: string; value: LLMProvider }[] = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Google Gemini', value: 'gemini' },
  { label: 'Anthropic Claude', value: 'claude' },
  { label: 'Custom (OpenAI Compatible)', value: 'custom' },
];

onMounted(async () => {
  await loadSettings();
});

const handleSave = async () => {
  saving.value = true;
  try {
    await saveSettings(settings.value);
    message.value = 'Settings saved successfully!';
    setTimeout(() => message.value = '', 3000);
  } catch (e) {
    message.value = 'Failed to save settings.';
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
    <div class="w-full max-w-md space-y-8 p-8 bg-card rounded-lg shadow-lg border border-border">
      <div class="space-y-2">
        <h1 class="text-3xl font-bold tracking-tight">Luma Settings</h1>
        <p class="text-muted-foreground">Configure your AI model provider and API keys.</p>
      </div>

      <div v-if="!isLoaded" class="flex justify-center py-8">
        <Loader2 class="h-8 w-8 animate-spin text-primary" />
      </div>

      <form v-else @submit.prevent="handleSave" class="space-y-6">
        
        <!-- Provider Selection -->
        <div class="space-y-2">
          <label class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            AI Provider
          </label>
          <select 
            v-model="settings.llm.provider"
            class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option v-for="p in providers" :key="p.value" :value="p.value">
              {{ p.label }}
            </option>
          </select>
        </div>

        <!-- API Key Input -->
        <div class="space-y-2">
          <label class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            API Key
          </label>
          <input 
            v-model="settings.llm.apiKey"
            type="password"
            placeholder="sk-..."
            class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <p class="text-[0.8rem] text-muted-foreground">
            Your key is stored locally in your browser and never sent to our servers.
          </p>
        </div>

        <!-- Base URL (Optional) -->
        <div v-if="settings.llm.provider === 'custom'" class="space-y-2">
          <label class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Base URL
          </label>
          <input 
            v-model="settings.llm.baseUrl"
            type="text"
            placeholder="https://api.example.com/v1"
            class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <!-- Model Name -->
        <div class="space-y-2">
          <label class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Model Name
          </label>
          <input 
            v-model="settings.llm.model"
            type="text"
            placeholder="gpt-4o"
            class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <div class="pt-4">
          <button 
            type="submit" 
            :disabled="saving"
            class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full"
          >
            <Loader2 v-if="saving" class="mr-2 h-4 w-4 animate-spin" />
            <Save v-else class="mr-2 h-4 w-4" />
            Save Settings
          </button>
        </div>

        <div v-if="message" :class="['text-sm text-center', message.includes('Failed') ? 'text-destructive' : 'text-green-500']">
          {{ message }}
        </div>
      </form>
    </div>
  </div>
</template>
