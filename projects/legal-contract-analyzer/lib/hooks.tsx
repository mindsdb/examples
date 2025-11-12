'use client';

// React hooks for chat state management and persistence

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import {
  AppState,
  Conversation,
  Message,
  IntegrationConnectionParams,
  IntegrationType,
  UserPreferences,
  TableInfo,
} from './types';
import { storage, createAutoSave, exportConversationAsMarkdown, downloadFile } from './storage';
import { defaultPreferences, availableIntegrations } from './mockData';
import { generateId } from './utils';
import { detectEmailActions } from './email-actions';

interface AppContextType extends AppState {
  // Conversation actions
  createConversation: (title: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, newTitle: string) => void;
  setActiveConversation: (id: string | undefined) => void;
  sendMessage: (content: string) => void;
  deleteMessage: (messageId: string) => void;
  addReaction: (messageId: string, emoji: string) => void;

  // Integration actions
  connectIntegration: (type: IntegrationType, instanceName: string, params: IntegrationConnectionParams, selectedTables?: string[]) => Promise<void>;
  disconnectIntegration: (databaseName: string) => Promise<void>;
  syncIntegration: (databaseName: string) => Promise<void>;
  testIntegrationConnection: (type: IntegrationType, params: IntegrationConnectionParams) => Promise<boolean>;
  getIntegrationTables: (type: IntegrationType, params?: IntegrationConnectionParams) => Promise<TableInfo[]>;

  // File upload actions
  uploadFiles: (files: File[]) => Promise<void>;
  uploadPdfFromUrl: (url: string) => Promise<void>;

  // Preferences
  updatePreferences: (preferences: Partial<UserPreferences>) => void;

  // Export/Import
  exportConversation: (conversationId: string, format: 'json' | 'markdown') => void;
  exportAllData: () => void;
  importData: (file: File) => void;

  // Utility
  isStreaming: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    conversations: [],
    integrations: [],
    savedViews: [],
    filters: [],
    preferences: defaultPreferences,
    activeTenant: 'Acme Legal Inc.'
  });

  const [isStreaming, setIsStreaming] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize from storage
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await storage.init();

        const [conversations, integrations, preferences] = await Promise.all([
          storage.getAllConversations(),
          storage.getAllIntegrations(),
          storage.getPreferences(),
        ]);

        // Merge available integrations with connected ones from storage
        // This ensures all integration types are shown, even if not connected yet
        const mergedIntegrations = availableIntegrations.map(availableIntegration => {
          const connectedIntegration = integrations?.find(
            i => i.type === availableIntegration.type
          );

          // If user has connected this integration, use their data
          // Otherwise, use the available template
          return connectedIntegration || availableIntegration;
        });

        setState(prev => ({
          ...prev,
          conversations: conversations || [],
          integrations: mergedIntegrations,
          preferences: preferences || defaultPreferences,
        }));

        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize app:', error);
        // Initialize with available integrations (not connected)
        setState(prev => ({
          ...prev,
          conversations: [],
          savedViews: [],
          integrations: availableIntegrations,
        }));
        setIsInitialized(true);
      }
    };

    initializeApp();
  }, []);

  // Auto-save conversations
  useEffect(() => {
    if (!isInitialized || state.conversations.length === 0) return;

    const cleanup = createAutoSave(
      state.conversations,
      async (conversations) => {
        for (const conv of conversations) {
          await storage.saveConversation(conv);
        }
      },
      1000
    );

    return cleanup;
  }, [state.conversations, isInitialized]);

  // Auto-save preferences
  useEffect(() => {
    if (!isInitialized) return;

    const cleanup = createAutoSave(
      state.preferences,
      async (prefs) => {
        await storage.savePreferences(prefs);
      },
      1000
    );

    return cleanup;
  }, [state.preferences, isInitialized]);

  // Conversation actions
  const createConversation = useCallback((title: string) => {
    const newConversation: Conversation = {
      id: generateId(),
      title,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setState(prev => ({
      ...prev,
      conversations: [newConversation, ...prev.conversations],
      activeConversationId: newConversation.id,
    }));
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      conversations: prev.conversations.filter(c => c.id !== id),
      activeConversationId: prev.activeConversationId === id ? undefined : prev.activeConversationId,
    }));
    storage.deleteConversation(id).catch(console.error);
  }, []);

  const renameConversation = useCallback((id: string, newTitle: string) => {
    if (!newTitle.trim()) return;

    setState(prev => ({
      ...prev,
      conversations: prev.conversations.map(conv =>
        conv.id === id
          ? { ...conv, title: newTitle.trim(), updatedAt: new Date() }
          : conv
      ),
    }));
  }, []);

  const setActiveConversation = useCallback((id: string | undefined) => {
    setState(prev => ({ ...prev, activeConversationId: id }));
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    const activeId = state.activeConversationId;
    if (!activeId) return;

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: { text: content },
      timestamp: new Date(),
      status: 'sent',
    };

    // Check if this is the first user message to update conversation title
    const activeConversation = state.conversations.find(c => c.id === activeId);
    const isFirstMessage = activeConversation && activeConversation.messages.length === 0;

    // Generate a title from the first user message (max 50 chars)
    const newTitle = isFirstMessage
      ? content.length > 50
        ? content.substring(0, 47) + '...'
        : content
      : undefined;

    // Add user message and update title if it's the first message
    setState(prev => ({
      ...prev,
      conversations: prev.conversations.map(conv =>
        conv.id === activeId
          ? {
            ...conv,
            messages: [...conv.messages, userMessage],
            updatedAt: new Date(),
            ...(newTitle && { title: newTitle })
          }
          : conv
      ),
    }));

    // Create initial AI message placeholder
    const aiMessageId = generateId();
    const initialAiMessage: Message = {
      id: aiMessageId,
      role: 'assistant',
      content: { text: '' },
      timestamp: new Date(),
      status: 'streaming',
    };

    // Add AI message placeholder
    setState(prev => ({
      ...prev,
      conversations: prev.conversations.map(conv =>
        conv.id === activeId
          ? { ...conv, messages: [...conv.messages, initialAiMessage], updatedAt: new Date() }
          : conv
      ),
    }));

    // Send to MindsDB Agent API
    setIsStreaming(true);

    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

      // Get conversation history for context (include the user message we just added)
      const activeConversation = state.conversations.find(c => c.id === activeId);
      const allMessages = activeConversation ? [...activeConversation.messages, userMessage] : [userMessage];
      const conversationHistory = allMessages
        .filter(msg => msg.id !== aiMessageId) // Exclude the placeholder AI message
        .map(msg => ({
          role: msg.role,
          content: msg.content.text || '',
          timestamp: msg.timestamp.toISOString()
        }));

      const response = await fetch(`${API_BASE_URL}/api/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          conversation_id: activeId,
          conversation_history: conversationHistory,
          stream: false // For now, we'll use non-streaming. Can be enhanced later for real streaming
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();

      // Detect email actions from response if not provided by API
      let emailActions = data.email_actions;
      if (!emailActions) {
        emailActions = detectEmailActions(data.response || '');
        if (emailActions.length > 0) {
          console.log('Frontend detected email actions:', emailActions.length);
        }
      }

      // Update AI message with final response
      const finalAiMessage: Message = {
        id: aiMessageId,
        role: 'assistant',
        content: {
          text: data.response || 'I received your message.',
          metadata: {
            streaming: data.streaming,
            context_length: data.context_length
          },
          // Add email actions from API or frontend detection
          ...(emailActions && emailActions.length > 0 && { emailActions })
        },
        timestamp: new Date(),
        status: 'sent',
      };

      setState(prev => ({
        ...prev,
        conversations: prev.conversations.map(conv =>
          conv.id === activeId
            ? {
              ...conv,
              messages: conv.messages.map(msg =>
                msg.id === aiMessageId ? finalAiMessage : msg
              ),
              updatedAt: new Date()
            }
            : conv
        ),
      }));
    } catch (error) {
      console.error('Error sending message:', error);

      // Update AI message with error
      const errorMessage: Message = {
        id: aiMessageId,
        role: 'assistant',
        content: { text: 'Sorry, I encountered an error connecting to the AI agent. Please try again.' },
        timestamp: new Date(),
        status: 'error',
      };

      setState(prev => ({
        ...prev,
        conversations: prev.conversations.map(conv =>
          conv.id === activeId
            ? {
              ...conv,
              messages: conv.messages.map(msg =>
                msg.id === aiMessageId ? errorMessage : msg
              ),
              updatedAt: new Date()
            }
            : conv
        ),
      }));
    } finally {
      setIsStreaming(false);
    }
  }, [state.activeConversationId, state.conversations]);



  const deleteMessage = useCallback((messageId: string) => {
    const activeId = state.activeConversationId;
    if (!activeId) return;

    setState(prev => ({
      ...prev,
      conversations: prev.conversations.map(conv =>
        conv.id === activeId
          ? { ...conv, messages: conv.messages.filter(msg => msg.id !== messageId) }
          : conv
      ),
    }));
  }, [state.activeConversationId]);

  const addReaction = useCallback((messageId: string, emoji: string) => {
    const activeId = state.activeConversationId;
    if (!activeId) return;

    setState(prev => ({
      ...prev,
      conversations: prev.conversations.map(conv =>
        conv.id === activeId
          ? {
            ...conv,
            messages: conv.messages.map(msg => {
              if (msg.id === messageId) {
                const reactions = msg.reactions || {};
                const users = reactions[emoji] || [];
                const hasReacted = users.includes('current-user');

                return {
                  ...msg,
                  reactions: {
                    ...reactions,
                    [emoji]: hasReacted
                      ? users.filter(u => u !== 'current-user')
                      : [...users, 'current-user'],
                  },
                };
              }
              return msg;
            }),
          }
          : conv
      ),
    }));
  }, [state.activeConversationId]);

  // Integration actions
  const connectIntegration = useCallback(async (type: IntegrationType, instanceName: string, params: IntegrationConnectionParams, selectedTables?: string[]) => {
    // Generate a unique database name for this instance
    const databaseName = `${type}_${instanceName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;

    // Create a temporary instance in connecting state
    const connectingInstance = {
      id: `temp_${Date.now()}`,
      name: instanceName,
      databaseName: databaseName,
      status: 'connecting' as const,
      lastSync: undefined,
      itemCount: undefined,
      connectionParams: params,
      selectedTables: selectedTables || [],
      availableTables: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Add the instance in connecting state immediately
    setState(prev => ({
      ...prev,
      integrations: prev.integrations.map(int =>
        int.type === type
          ? {
            ...int,
            instances: [...int.instances.filter(inst => inst.name !== instanceName), connectingInstance]
          }
          : int
      ),
    }));

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

      // Call backend API to create integration
      const response = await fetch(`${apiUrl}/api/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integration_type: type,
          database_name: databaseName,
          instance_name: instanceName,
          connection_params: params,
          selected_tables: selectedTables,
          enabled: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Create the new instance object
        const newInstance = {
          id: data.id,
          name: instanceName,
          databaseName: data.database_name,
          status: 'connected' as const,
          lastSync: new Date(),
          itemCount: data.item_count || 0,
          connectionParams: params,
          description: data.description,
          availableTables: data.available_tables || [],
          selectedTables: data.selected_tables || selectedTables || [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Update state to add the new instance
        setState(prev => ({
          ...prev,
          integrations: prev.integrations.map(int =>
            int.type === type
              ? {
                ...int,
                instances: [...int.instances.filter(inst => inst.name !== instanceName), newInstance]
              }
              : int
          ),
        }));

        // Save to storage
        const updatedIntegration = state.integrations.find(i => i.type === type);
        if (updatedIntegration) {
          await storage.saveIntegration({
            ...updatedIntegration,
            instances: [...updatedIntegration.instances.filter(inst => inst.name !== instanceName), newInstance]
          });
        }
      } else {
        throw new Error('Failed to connect integration');
      }
    } catch (error) {
      console.error('Integration connection error:', error);

      // Set to error state
      setState(prev => ({
        ...prev,
        integrations: prev.integrations.map(int =>
          int.type === type
            ? {
              ...int,
              instances: int.instances.map(inst =>
                inst.name === instanceName
                  ? {
                    ...inst,
                    status: 'error',
                    errorMessage: error instanceof Error ? error.message : 'Connection failed',
                  }
                  : inst
              )
            }
            : int
        ),
      }));
    }
  }, [state.integrations]);

  const disconnectIntegration = useCallback(async (databaseName: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

      // Delete from backend
      const response = await fetch(`${apiUrl}/api/integrations/${databaseName}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to disconnect from backend:', error);
        throw new Error(error.detail || 'Failed to disconnect');
      }

      // Find and remove the instance from state
      setState(prev => {
        const updatedIntegrations = prev.integrations.map(int => {
          const filteredInstances = int.instances.filter(inst => inst.databaseName !== databaseName);

          return {
            ...int,
            instances: filteredInstances
          };
        });

        // Update storage with the new state
        updatedIntegrations.forEach(integration => {
          storage.saveIntegration(integration);
        });

        return {
          ...prev,
          integrations: updatedIntegrations,
        };
      });

    } catch (error) {
      console.error('Failed to disconnect integration:', error);

      // Show error state in UI
      setState(prev => ({
        ...prev,
        integrations: prev.integrations.map(int => ({
          ...int,
          instances: int.instances.map(inst =>
            inst.databaseName === databaseName
              ? {
                ...inst,
                status: 'error',
                errorMessage: error instanceof Error ? error.message : 'Failed to disconnect',
              }
              : inst
          )
        })),
      }));
    }
  }, []);

  const testIntegrationConnection = useCallback(async (
    type: IntegrationType,
    params: IntegrationConnectionParams
  ): Promise<boolean> => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

      // Call backend API to test connection
      const response = await fetch(`${apiUrl}/api/integrations/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integration_type: type,
          database_name: `test_${type}_datasource_for_legal_contracts`,
          instance_name: `test_${type}_instance_${Date.now()}`,
          connection_params: params,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.test_passed;
      }

      return false;
    } catch (error) {
      console.error('Connection test error:', error);
      return false;
    }
  }, []);

  const syncIntegration = useCallback(async (databaseName: string): Promise<void> => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/integrations/${databaseName}/sync`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        const errorMessage = error.detail || 'Failed to sync integration';
        console.error('Sync failed:', errorMessage);
        throw new Error(errorMessage);
      }

      await response.json();

      // Update lastSync time for the instance
      setState(prev => ({
        ...prev,
        integrations: prev.integrations.map(int => ({
          ...int,
          instances: int.instances.map(inst =>
            inst.databaseName === databaseName
              ? { ...inst, lastSync: new Date(), updatedAt: new Date() }
              : inst
          )
        })),
      }));
    } catch (error) {
      console.error('Sync integration error:', error);
      throw error;
    }
  }, []);

  const getIntegrationTables = useCallback(async (type: IntegrationType, params?: IntegrationConnectionParams): Promise<TableInfo[]> => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

      // If params are provided, it's a test connection to get tables before saving
      if (params) {
        // Create a temporary connection to get tables
        const createResponse = await fetch(`${apiUrl}/api/integrations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            integration_type: type,
            database_name: `temp_${type}_tables_${Date.now()}`,
            instance_name: `temp_${type}_instance_${Date.now()}`,
            connection_params: params,
          }),
        });

        if (!createResponse.ok) {
          throw new Error('Failed to create temporary connection');
        }

        const createData = await createResponse.json();
        const tempDbName = createData.database_name;

        try {
          // Get tables from the temporary connection
          const tablesResponse = await fetch(`${apiUrl}/api/integrations/${tempDbName}/tables`);

          if (tablesResponse.ok) {
            const tablesData = await tablesResponse.json();
            return tablesData.tables || [];
          }
          return [];
        } finally {
          // Always clean up the temporary connection
          try {
            await fetch(`${apiUrl}/api/integrations/${tempDbName}`, {
              method: 'DELETE',
            });
          } catch (cleanupError) {
            console.warn('Failed to cleanup temporary connection:', cleanupError);
          }
        }
      } else {
        // Use existing connection to get tables
        const databaseName = `${type}_datasource_for_legal_contracts`;

        const response = await fetch(`${apiUrl}/api/integrations/${databaseName}/tables`);

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.detail || 'Failed to get tables');
        }

        const data = await response.json();
        return data.tables || [];
      }
    } catch (error) {
      console.error('Get tables error:', error);
      throw error;
    }
  }, []);

  // File upload actions
  const uploadFiles = useCallback(async (files: File[]): Promise<void> => {
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

      if (files.length === 0) return;

      // Add initial loading message
      const activeId = state.activeConversationId;
      if (activeId) {
        const loadingMessage: Message = {
          id: generateId(),
          role: 'assistant',
          content: {
            text: `📄 Uploading ${files.length} file(s)... Please wait while we process and add them to the knowledge base.`,
            attachments: files.map(file => ({
              id: generateId(),
              name: file.name,
              type: file.type,
              size: file.size,
              status: 'uploading' as const,
              uploadProgress: 0
            }))
          },
          timestamp: new Date(),
          status: 'streaming',
        };

        setState(prev => ({
          ...prev,
          conversations: prev.conversations.map(conv =>
            conv.id === activeId
              ? { ...conv, messages: [...conv.messages, loadingMessage], updatedAt: new Date() }
              : conv
          ),
        }));
      }

      // Create FormData for each file and upload
      const uploadPromises = files.map(async (file, index) => {
        const formData = new FormData();
        formData.append('file', file);

        // Update progress for this file
        if (activeId) {
          setState(prev => ({
            ...prev,
            conversations: prev.conversations.map(conv =>
              conv.id === activeId
                ? {
                  ...conv,
                  messages: conv.messages.map(msg =>
                    msg.status === 'streaming' && msg.content.attachments
                      ? {
                        ...msg,
                        content: {
                          ...msg.content,
                          text: `📄 Processing ${file.name}... Converting to knowledge base format.`,
                          attachments: msg.content.attachments?.map((att, i) =>
                            i === index ? { ...att, status: 'analyzing' as const, uploadProgress: 50 } : att
                          )
                        }
                      }
                      : msg
                  )
                }
                : conv
            ),
          }));
        }

        const response = await fetch(`${API_BASE_URL}/api/upload/pdf`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `Failed to upload ${file.name}`);
        }

        return await response.json();
      });

      // Wait for all uploads to complete
      const results = await Promise.all(uploadPromises);

      // Send final success message
      const uploadedFileNames = results.map(r => r.filename).join(', ');
      const confirmationMessage = `✅ Successfully uploaded and processed ${files.length} file(s): ${uploadedFileNames}. 

📚 The documents have been added to the knowledge base and are now available for analysis. You can ask questions about the contract content, terms, clauses, and any other details from the uploaded documents.`;

      // Replace loading message with success
      if (activeId) {
        setState(prev => ({
          ...prev,
          conversations: prev.conversations.map(conv =>
            conv.id === activeId
              ? {
                ...conv,
                messages: conv.messages.map(msg =>
                  msg.status === 'streaming'
                    ? {
                      ...msg,
                      content: {
                        text: confirmationMessage,
                        attachments: results.map(r => ({
                          id: generateId(),
                          name: r.original_filename,
                          type: 'application/pdf',
                          size: r.size,
                          status: 'complete' as const,
                          uploadProgress: 100
                        }))
                      },
                      status: 'sent',
                    }
                    : msg
                ),
                updatedAt: new Date()
              }
              : conv
          ),
        }));
      }

    } catch (error) {
      console.error('File upload failed:', error);

      // Show error message in chat
      const activeId = state.activeConversationId;
      if (activeId) {
        setState(prev => ({
          ...prev,
          conversations: prev.conversations.map(conv =>
            conv.id === activeId
              ? {
                ...conv,
                messages: conv.messages.map(msg =>
                  msg.status === 'streaming'
                    ? {
                      ...msg,
                      content: { text: `❌ File upload failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
                      status: 'error',
                    }
                    : msg
                ),
                updatedAt: new Date()
              }
              : conv
          ),
        }));
      }

      throw error;
    }
  }, [state.activeConversationId]);

  // PDF URL upload actions
  const uploadPdfFromUrl = useCallback(async (url: string): Promise<void> => {
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

      if (!url.trim()) return;

      // Add initial loading message
      const activeId = state.activeConversationId;
      if (activeId) {
        const loadingMessage: Message = {
          id: generateId(),
          role: 'assistant',
          content: {
            text: `📥 Downloading PDF from URL: ${url}\nPlease wait while we download and process the document...`,
          },
          timestamp: new Date(),
          status: 'streaming',
        };

        setState(prev => ({
          ...prev,
          conversations: prev.conversations.map(conv =>
            conv.id === activeId
              ? { ...conv, messages: [...conv.messages, loadingMessage], updatedAt: new Date() }
              : conv
          ),
        }));
      }

      // Call backend API to download and process URL
      const response = await fetch(`${API_BASE_URL}/api/upload/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to download PDF from URL');
      }

      const result = await response.json();

      // Send final success message
      const confirmationMessage = `✅ Successfully downloaded and processed PDF from URL!

📄 **File**: ${result.original_filename}
📊 **Size**: ${(result.size / 1024).toFixed(1)} KB
🗂️ **Table**: ${result.table_name}

📚 The document has been added to the knowledge base and is now available for analysis. You can ask questions about the contract content, terms, clauses, and any other details from the document.`;

      // Replace loading message with success
      if (activeId) {
        setState(prev => ({
          ...prev,
          conversations: prev.conversations.map(conv =>
            conv.id === activeId
              ? {
                ...conv,
                messages: conv.messages.map(msg =>
                  msg.status === 'streaming'
                    ? {
                      ...msg,
                      content: {
                        text: confirmationMessage,
                        attachments: [{
                          id: generateId(),
                          name: result.original_filename,
                          type: 'application/pdf',
                          size: result.size,
                          status: 'complete' as const,
                          uploadProgress: 100
                        }]
                      },
                      status: 'sent',
                    }
                    : msg
                ),
                updatedAt: new Date()
              }
              : conv
          ),
        }));
      }

    } catch (error) {
      console.error('PDF URL upload failed:', error);

      // Show error message in chat
      const activeId = state.activeConversationId;
      if (activeId) {
        setState(prev => ({
          ...prev,
          conversations: prev.conversations.map(conv =>
            conv.id === activeId
              ? {
                ...conv,
                messages: conv.messages.map(msg =>
                  msg.status === 'streaming'
                    ? {
                      ...msg,
                      content: { text: `❌ PDF URL upload failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
                      status: 'error',
                    }
                    : msg
                ),
                updatedAt: new Date()
              }
              : conv
          ),
        }));
      }

      throw error;
    }
  }, [state.activeConversationId]);

  // Preferences
  const updatePreferences = useCallback((updates: Partial<UserPreferences>) => {
    setState(prev => ({
      ...prev,
      preferences: { ...prev.preferences, ...updates },
    }));
  }, []);

  // Export/Import
  const exportConversation = useCallback((conversationId: string, format: 'json' | 'markdown') => {
    const conversation = state.conversations.find(c => c.id === conversationId);
    if (!conversation) return;

    if (format === 'json') {
      const json = JSON.stringify(conversation, null, 2);
      downloadFile(json, `${conversation.title}.json`, 'application/json');
    } else {
      const markdown = exportConversationAsMarkdown(conversation);
      downloadFile(markdown, `${conversation.title}.md`, 'text/markdown');
    }
  }, [state.conversations]);

  const exportAllData = useCallback(async () => {
    const json = await storage.exportData();
    downloadFile(json, `legal-contract-intelligence-export-${Date.now()}.json`, 'application/json');
  }, []);

  const importData = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        await storage.importData(content);

        // Reload data
        const [conversations, integrations, preferences] = await Promise.all([
          storage.getAllConversations(),
          storage.getAllIntegrations(),
          storage.getPreferences(),
        ]);

        setState(prev => ({
          ...prev,
          conversations,
          integrations,
          preferences: preferences || defaultPreferences,
        }));
      } catch (error) {
        console.error('Failed to import data:', error);
      }
    };
    reader.readAsText(file);
  }, []);

  const value: AppContextType = {
    ...state,
    createConversation,
    deleteConversation,
    renameConversation,
    setActiveConversation,
    sendMessage,
    deleteMessage,
    addReaction,
    connectIntegration,
    disconnectIntegration,
    syncIntegration,
    testIntegrationConnection,
    getIntegrationTables,
    uploadFiles,
    uploadPdfFromUrl,
    updatePreferences,
    exportConversation,
    exportAllData,
    importData,
    isStreaming,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
