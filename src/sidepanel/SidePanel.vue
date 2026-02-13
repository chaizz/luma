<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue';
import { useSettings } from '@/composables/useSettings';
import { Settings, MessageSquare, FileText, BrainCircuit, Loader2, Send, RefreshCw } from 'lucide-vue-next';
import { VueFlow, useVueFlow, Position, type Node, type Edge } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import MarkdownIt from 'markdown-it';
import dagre from '@dagrejs/dagre';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/controls/dist/style.css';

const { settings, loadSettings, isLoaded } = useSettings();
const activeTab = ref<'summary' | 'chat' | 'mindmap'>('summary');
const md = new MarkdownIt();

// Summary State
const summaryContent = ref('');
const summaryLoading = ref(false);

// Mind Map State
const mindMapNodes = ref<Node[]>([]);
const mindMapEdges = ref<Edge[]>([]);
const mindMapLoading = ref(false);
const { fitView } = useVueFlow();

// Chat State
const chatMessages = ref<{ role: string; content: string }[]>([]);
const chatInput = ref('');
const chatLoading = ref(false);
const chatContainer = ref<HTMLDivElement | null>(null);

onMounted(async () => {
  await loadSettings();
  if (hasApiKey()) {
    generateAll();
  }
});

const openOptions = () => {
  if (chrome.runtime && chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open('/src/options/index.html', '_blank');
  }
};

const hasApiKey = () => {
  return !!settings.value.llm.apiKey;
};

// --- Layout Logic for Mind Map (Dagre) ---
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    // Estimate width/height based on label length or fixed
    dagreGraph.setNode(node.id, { width: 150, height: 50 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  return {
    nodes: nodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      return {
        ...node,
        position: { x: nodeWithPosition.x, y: nodeWithPosition.y },
        style: {
             background: node.data?.color || '#fff',
             color: node.data?.type === 'root' ? '#fff' : '#333',
             border: '1px solid #ddd',
             borderRadius: '8px', // Rounded nodes
             padding: '10px',
             width: '150px',
             fontSize: '12px',
             textAlign: 'center' as const,
             boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }
      };
    }) as Node[],
    edges,
  };
};

// --- Core Logic ---

const getCurrentTab = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
};

const extractContent = async () => {
  const tab = await getCurrentTab();
  if (!tab?.id) throw new Error('No active tab');

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_CONTENT' });
    if (response && response.success) {
      return response.data;
    } else {
      throw new Error(response?.error || 'Failed to extract content');
    }
  } catch (e) {
    console.error('Extraction failed:', e);
    return { content: 'Could not extract content. Please refresh the page and try again.' };
  }
};

const generateAll = async () => {
    const articlePromise = extractContent();
    
    summaryLoading.value = true;
    mindMapLoading.value = true;
    summaryContent.value = '';
    mindMapNodes.value = [];
    mindMapEdges.value = [];

    try {
        const article = await articlePromise;
        if (!article || !article.content) {
             const errMsg = 'Failed to extract page content.';
             summaryContent.value = errMsg;
             summaryLoading.value = false;
             mindMapLoading.value = false;
             return;
        }

        // Parallel Execution
        Promise.all([
            generateSummary(article.content),
            generateMindMap(article.content)
        ]);

    } catch (e) {
        const errMsg = `Error: ${(e as Error).message}`;
        summaryContent.value = errMsg;
        summaryLoading.value = false;
        mindMapLoading.value = false;
    }
};

const generateSummary = async (content: string) => {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'SUMMARIZE',
      payload: {
        content: content,
        settings: settings.value
      }
    });

    if (response && response.success) {
      summaryContent.value = response.data; // Markdown content
    } else {
      summaryContent.value = `Error: ${response?.error || 'Unknown error'}`;
    }
  } catch (e) {
    summaryContent.value = `Error: ${(e as Error).message}`;
  } finally {
    summaryLoading.value = false;
  }
};

const generateMindMap = async (content: string) => {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'MINDMAP',
      payload: {
        content: content,
        settings: settings.value
      }
    });

    if (response && response.success && response.data) {
        const { nodes, edges } = response.data;
        
        const rawNodes = nodes.map((n: any) => ({
            id: n.id,
            label: n.label,
            position: { x: 0, y: 0 }, // Initial pos, will be layouted
            data: { color: n.color, type: n.type }
        }));
        
        const rawEdges = edges.map((e: any, index: number) => ({
            id: `e${index}`,
            source: e.source,
            target: e.target,
            animated: true,
            style: { stroke: '#999' }
        }));
        
        // Apply Dagre Layout
        const layouted = getLayoutedElements(rawNodes, rawEdges, 'LR');
        
        mindMapNodes.value = [...layouted.nodes];
        mindMapEdges.value = [...layouted.edges];
        
        await nextTick();
        setTimeout(() => fitView(), 100);

    } else {
      console.error('MindMap generation failed', response?.error);
    }
  } catch (e) {
    console.error('MindMap error:', e);
  } finally {
    mindMapLoading.value = false;
  }
};

const sendChatMessage = async () => {
  if (!chatInput.value.trim() || chatLoading.value) return;

  const userMsg = chatInput.value;
  chatMessages.value.push({ role: 'user', content: userMsg });
  chatInput.value = '';
  chatLoading.value = true;
  scrollToBottom();

  try {
    const messagesToSend = chatMessages.value.map(m => ({ role: m.role, content: m.content }));

    const response = await chrome.runtime.sendMessage({
      action: 'CHAT',
      payload: {
        messages: messagesToSend,
        settings: settings.value
      }
    });

    if (response && response.success) {
      chatMessages.value.push({ role: 'assistant', content: response.data });
    } else {
      chatMessages.value.push({ role: 'assistant', content: `Error: ${response?.error || 'Unknown error'}` });
    }
  } catch (e) {
    chatMessages.value.push({ role: 'assistant', content: `Error: ${(e as Error).message}` });
  } finally {
    chatLoading.value = false;
    scrollToBottom();
  }
};

const scrollToBottom = async () => {
  await nextTick();
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
};

// Render Markdown helper
const renderMarkdown = (text: string) => {
  return md.render(text);
};

</script>

<template>
  <div class="h-screen flex flex-col bg-background text-foreground overflow-hidden">
    <!-- Header -->
    <header class="border-b border-border p-3 flex justify-between items-center bg-card shadow-sm z-10">
      <div class="flex items-center gap-2 font-semibold text-lg text-primary">
        <img src="/src/assets/vue.svg" alt="Logo" class="w-6 h-6" />
        Luma
      </div>
      <button @click="openOptions" class="p-2 rounded-md hover:bg-muted transition-colors" title="Settings">
        <Settings class="w-5 h-5" />
      </button>
    </header>

    <!-- Main Content -->
    <main class="flex-1 overflow-auto p-4 relative flex flex-col bg-slate-50 dark:bg-zinc-900">
      <div v-if="!isLoaded" class="flex items-center justify-center h-full">
        <Loader2 class="animate-spin w-8 h-8 text-primary" />
      </div>

      <div v-else-if="!hasApiKey()" class="flex flex-col items-center justify-center h-full text-center space-y-4">
        <div class="bg-muted p-4 rounded-full">
          <Settings class="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 class="text-lg font-medium">Configuration Required</h3>
        <p class="text-sm text-muted-foreground max-w-xs">
          Please configure your API key in the settings to start using Luma.
        </p>
        <button 
          @click="openOptions"
          class="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium transition-colors"
        >
          Open Settings
        </button>
      </div>

      <div v-else class="h-full flex flex-col">
        <!-- Summary Tab -->
        <div v-if="activeTab === 'summary'" class="h-full flex flex-col">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-lg font-bold">Page Summary</h2>
            <button 
              @click="generateAll" 
              :disabled="summaryLoading || mindMapLoading"
              class="text-xs flex items-center gap-1 bg-white dark:bg-zinc-800 border border-border hover:bg-accent text-foreground px-3 py-1.5 rounded-md transition-colors shadow-sm"
            >
              <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': summaryLoading }" />
              {{ summaryLoading ? 'Analyzing...' : 'Refresh' }}
            </button>
          </div>
          
          <div class="flex-1 overflow-auto rounded-lg border border-border p-5 bg-card shadow-sm prose dark:prose-invert max-w-none text-sm">
            <div v-if="summaryLoading" class="flex flex-col items-center justify-center h-full space-y-3 text-muted-foreground">
              <Loader2 class="animate-spin w-8 h-8 text-primary/80" />
              <span class="text-xs">Analyzing website content & purpose...</span>
            </div>
            <div v-else-if="summaryContent" v-html="renderMarkdown(summaryContent)"></div>
            <div v-else class="flex items-center justify-center h-full text-muted-foreground text-xs">
              No summary available.
            </div>
          </div>
        </div>
        
        <!-- Mind Map Tab -->
        <div v-if="activeTab === 'mindmap'" class="h-full flex flex-col">
          <div class="flex justify-between items-center mb-4">
             <h2 class="text-lg font-bold">Mind Map</h2>
             <span v-if="mindMapLoading" class="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 class="animate-spin w-3 h-3" /> Generating...
             </span>
          </div>
          
           <div class="flex-1 border border-border rounded-lg bg-card shadow-sm overflow-hidden relative">
             <div v-if="mindMapLoading && mindMapNodes.length === 0" class="absolute inset-0 flex items-center justify-center z-10 bg-background/80 backdrop-blur-sm">
                <div class="flex flex-col items-center gap-2">
                    <Loader2 class="animate-spin w-8 h-8 text-primary" />
                    <span class="text-xs text-muted-foreground">Constructing mind map...</span>
                </div>
             </div>
             <div v-else-if="mindMapNodes.length > 0" class="h-full w-full">
                <VueFlow 
                  v-model:nodes="mindMapNodes" 
                  v-model:edges="mindMapEdges" 
                  :default-zoom="1.0"
                  :min-zoom="0.2"
                  :max-zoom="4"
                  fit-view-on-init
                  class="bg-slate-50 dark:bg-zinc-900"
                >
                  <Background pattern-color="#aaa" :gap="16" />
                  <Controls />
                </VueFlow>
             </div>
             <div v-else class="h-full flex items-center justify-center text-muted-foreground text-xs">
                No mind map generated yet.
             </div>
          </div>
        </div>

        <!-- Chat Tab -->
        <div v-if="activeTab === 'chat'" class="h-full flex flex-col">
          <div ref="chatContainer" class="flex-1 border border-border rounded-lg mb-4 p-4 overflow-y-auto space-y-4 bg-card shadow-sm">
            <div v-if="chatMessages.length === 0" class="text-center text-muted-foreground py-12">
              <MessageSquare class="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p class="text-sm">Ask any question about this page...</p>
            </div>
            <div 
              v-for="(msg, index) in chatMessages" 
              :key="index" 
              :class="['flex', msg.role === 'user' ? 'justify-end' : 'justify-start']"
            >
              <div 
                :class="['max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm', msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-muted text-foreground rounded-bl-none']"
              >
                 <div v-if="msg.role === 'assistant'" v-html="renderMarkdown(msg.content)" class="prose dark:prose-invert max-w-none text-sm"></div>
                 <div v-else>{{ msg.content }}</div>
              </div>
            </div>
            <div v-if="chatLoading" class="flex justify-start">
              <div class="bg-muted px-4 py-2.5 rounded-2xl rounded-bl-none">
                <Loader2 class="animate-spin w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </div>
          
          <div class="flex gap-2">
            <input 
              v-model="chatInput"
              @keydown.enter="sendChatMessage"
              type="text" 
              placeholder="Ask a question..." 
              class="flex-1 border border-input rounded-md px-4 py-2.5 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-sm" 
              :disabled="chatLoading"
            />
            <button 
              @click="sendChatMessage"
              :disabled="chatLoading || !chatInput.trim()"
              class="bg-primary text-primary-foreground px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Send class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </main>

    <!-- Tab Navigation -->
    <nav v-if="hasApiKey()" class="border-t border-border bg-card flex justify-around p-2 shadow-[0_-2px_10px_rgba(0,0,0,0.02)] z-10">
      <button 
        @click="activeTab = 'summary'"
        :class="['flex flex-col items-center gap-1 p-2 rounded-lg text-xs font-medium transition-all w-full', activeTab === 'summary' ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:bg-muted hover:text-foreground']"
      >
        <FileText class="w-5 h-5" />
        Summary
      </button>
      <button 
        @click="activeTab = 'mindmap'"
        :class="['flex flex-col items-center gap-1 p-2 rounded-lg text-xs font-medium transition-all w-full', activeTab === 'mindmap' ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:bg-muted hover:text-foreground']"
      >
        <BrainCircuit class="w-5 h-5" />
        Mind Map
      </button>
      <button 
        @click="activeTab = 'chat'"
        :class="['flex flex-col items-center gap-1 p-2 rounded-lg text-xs font-medium transition-all w-full', activeTab === 'chat' ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:bg-muted hover:text-foreground']"
      >
        <MessageSquare class="w-5 h-5" />
        Chat
      </button>
    </nav>
  </div>
</template>

<style>
/* Markdown Styles */
.prose h1, .prose h2, .prose h3 {
  font-weight: 600;
  line-height: 1.25;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  color: hsl(var(--foreground));
}
.prose h1 { font-size: 1.5em; }
.prose h2 { font-size: 1.25em; }
.prose h3 { font-size: 1.1em; }
.prose p { margin-bottom: 0.75em; }
.prose ul { list-style-type: disc; padding-left: 1.5em; margin-bottom: 0.75em; }
.prose ol { list-style-type: decimal; padding-left: 1.5em; margin-bottom: 0.75em; }
.prose li { margin-bottom: 0.25em; }
.prose strong { font-weight: 600; color: hsl(var(--foreground)); }
.prose code { 
  background-color: hsl(var(--muted)); 
  padding: 0.2em 0.4em;
  border-radius: 4px;
  font-size: 0.9em;
  font-family: monospace;
}
.prose pre {
  background-color: hsl(var(--muted));
  padding: 1em;
  border-radius: 8px;
  overflow-x: auto;
  margin-bottom: 1em;
}
.prose blockquote {
  border-left: 4px solid hsl(var(--border));
  padding-left: 1em;
  font-style: italic;
  color: hsl(var(--muted-foreground));
}
</style>