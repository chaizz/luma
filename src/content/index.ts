import { Readability } from '@mozilla/readability';

console.log('Luma content script loaded');

// Listen for messages from sidepanel or background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'EXTRACT_CONTENT') {
    try {
      const documentClone = document.cloneNode(true) as Document;
      const reader = new Readability(documentClone);
      const article = reader.parse();

      if (article) {
        sendResponse({ 
          success: true, 
          data: {
            title: article.title,
            content: article.textContent,
            length: article.length,
            excerpt: article.excerpt,
            siteName: article.siteName
          }
        });
      } else {
        sendResponse({ success: false, error: 'Failed to parse content' });
      }
    } catch (error) {
      console.error('Content extraction failed:', error);
      sendResponse({ success: false, error: (error as Error).message });
    }
  }
  // Return true to indicate we wish to send a response asynchronously
  return true;
});
