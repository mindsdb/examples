// IndexedDB persistence layer for local-first data storage

import { 
  Conversation, 
  SavedView, 
  Integration, 
  UserPreferences, 
  Filter
} from './types';

const DB_NAME = 'legal-contract-intelligence';
const DB_VERSION = 1;

interface DBSchema {
  conversations: Conversation;
  savedViews: SavedView;
  integrations: Integration;
  preferences: UserPreferences;
  filters: Filter;
  emailRecipients: { id: string; emails: string[] };
}

class StorageManager {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains('conversations')) {
          const conversationStore = db.createObjectStore('conversations', { keyPath: 'id' });
          conversationStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          conversationStore.createIndex('isPinned', 'isPinned', { unique: false });
        }

        if (!db.objectStoreNames.contains('savedViews')) {
          const viewStore = db.createObjectStore('savedViews', { keyPath: 'id' });
          viewStore.createIndex('conversationId', 'conversationId', { unique: false });
        }

        if (!db.objectStoreNames.contains('integrations')) {
          db.createObjectStore('integrations', { keyPath: 'type' });
        }

        if (!db.objectStoreNames.contains('preferences')) {
          db.createObjectStore('preferences', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('filters')) {
          db.createObjectStore('filters', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('emailRecipients')) {
          db.createObjectStore('emailRecipients', { keyPath: 'id' });
        }
      };
    });
  }

  private getStore(storeName: keyof DBSchema, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
    if (!this.db) throw new Error('Database not initialized');
    const transaction = this.db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  // Conversations
  async saveConversation(conversation: Conversation): Promise<void> {
    const store = this.getStore('conversations', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(conversation);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getConversation(id: string): Promise<Conversation | null> {
    const store = this.getStore('conversations');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllConversations(): Promise<Conversation[]> {
    const store = this.getStore('conversations');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteConversation(id: string): Promise<void> {
    const store = this.getStore('conversations', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Saved Views
  async saveSavedView(view: SavedView): Promise<void> {
    const store = this.getStore('savedViews', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(view);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Integrations
  async saveIntegration(integration: Integration): Promise<void> {
    const store = this.getStore('integrations', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(integration);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllIntegrations(): Promise<Integration[]> {
    const store = this.getStore('integrations');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Preferences
  async savePreferences(preferences: UserPreferences): Promise<void> {
    const store = this.getStore('preferences', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put({ ...preferences, id: 'user-preferences' });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getPreferences(): Promise<UserPreferences | null> {
    const store = this.getStore('preferences');
    return new Promise((resolve, reject) => {
      const request = store.get('user-preferences');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  // Filters
  async saveFilter(filter: Filter): Promise<void> {
    const store = this.getStore('filters', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(filter);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllFilters(): Promise<Filter[]> {
    const store = this.getStore('filters');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Email Recipients
  async saveEmailRecipients(emails: string[]): Promise<void> {
    const store = this.getStore('emailRecipients', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put({ id: 'default', emails });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getEmailRecipients(): Promise<string[]> {
    const store = this.getStore('emailRecipients');
    return new Promise((resolve, reject) => {
      const request = store.get('default');
      request.onsuccess = () => resolve(request.result?.emails || []);
      request.onerror = () => reject(request.error);
    });
  }

  // Export/Import
  async exportData(): Promise<string> {
    const [conversations, integrations, preferences, filters] = await Promise.all([
      this.getAllConversations(),
      this.getAllIntegrations(),
      this.getPreferences(),
      this.getAllFilters(),
    ]);

    const exportData = {
      version: DB_VERSION,
      exportedAt: new Date().toISOString(),
      data: { conversations, integrations, preferences, filters },
    };

    return JSON.stringify(exportData, null, 2);
  }

  async importData(jsonString: string): Promise<void> {
    try {
      const imported = JSON.parse(jsonString);
      const { data } = imported;

      // Import all data
      if (data.conversations) {
        for (const conv of data.conversations) {
          await this.saveConversation(conv);
        }
      }

      if (data.savedViews) {
        for (const view of data.savedViews) {
          await this.saveSavedView(view);
        }
      }

      if (data.integrations) {
        for (const integration of data.integrations) {
          await this.saveIntegration(integration);
        }
      }

      if (data.preferences) {
        await this.savePreferences(data.preferences);
      }

      if (data.filters) {
        for (const filter of data.filters) {
          await this.saveFilter(filter);
        }
      }
    } catch (error) {
      throw new Error(`Failed to import data: ${error}`);
    }
  }
}

export const storage = new StorageManager();

// Auto-save utility - to be used in React components with useEffect
export function createAutoSave<T>(
  data: T,
  saveFunction: (data: T) => Promise<void>,
  delay: number = 1000
): () => void {
  if (typeof window === 'undefined') return () => {};

  const timeoutRef = { current: null as NodeJS.Timeout | null };

  const save = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      saveFunction(data).catch(console.error);
    }, delay);
  };

  save();

  return () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };
}

// Export conversation as Markdown
export function exportConversationAsMarkdown(conversation: Conversation): string {
  let markdown = `# ${conversation.title}\n\n`;
  markdown += `**Created:** ${new Date(conversation.createdAt).toLocaleString()}\n`;
  markdown += `**Updated:** ${new Date(conversation.updatedAt).toLocaleString()}\n\n`;
  markdown += `---\n\n`;

  for (const message of conversation.messages) {
    const role = message.role.charAt(0).toUpperCase() + message.role.slice(1);
    const time = new Date(message.timestamp).toLocaleTimeString();
    
    markdown += `### ${role} (${time})\n\n`;
    
    if (message.content.text) {
      markdown += `${message.content.text}\n\n`;
    }

    if (message.content.clauses && message.content.clauses.length > 0) {
      markdown += `**Clauses:**\n\n`;
      message.content.clauses.forEach((clause, idx) => {
        markdown += `${idx + 1}. **${clause.title}** (${clause.severity})\n`;
        markdown += `   - Section: ${clause.section}\n`;
        markdown += `   - Category: ${clause.category}\n\n`;
      });
    }

    if (message.content.sources && message.content.sources.length > 0) {
      markdown += `**Sources:** ${message.content.sources.map(s => s.name).join(', ')}\n\n`;
    }

    markdown += `---\n\n`;
  }

  return markdown;
}

// Download helper
export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
