'use client';

import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/lib/hooks';
import { Header } from './Header';
import { ConversationsSidebar } from './Sidebar';
import { ChatContainer } from './ChatContainer';
import { Composer } from './Composer';
import { IntegrationsModal } from './Integrations';
import { KBManagement } from './KBManagement';
import { useKbSync } from '@/lib/kb-sync-hooks';

export default function LegalContractChat() {
  const {
    conversations,
    activeConversationId,
    integrations,
    preferences,
    activeTenant,
    isStreaming,
    setActiveConversation,
    createConversation,
    deleteConversation,
    renameConversation,
    sendMessage,
    deleteMessage,
    addReaction,
    updatePreferences,
    exportAllData,
    importData,
    connectIntegration,
    disconnectIntegration,
    syncIntegration,
    testIntegrationConnection: testConnection,
    getIntegrationTables,
    uploadFiles,
    uploadPdfFromUrl,
  } = useApp();
  // KB sync hook - exposes a trigger to start a knowledge-base sync and a syncing state
  const { triggerSync, isSyncing: kbIsSyncing } = useKbSync();

  const handleSyncNowClick = async () => {
    try {
      await triggerSync();
    } catch (err) {
      console.error('KB sync failed', err);
    }
  };

  const [showIntegrationsModal, setShowIntegrationsModal] = useState(false);
  const [showKBManagement, setShowKBManagement] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeConversation = conversations.find(c => c.id === activeConversationId);

  const handleNewConversation = () => {
    const title = `New Conversation`;
    createConversation(title);
  };

  const handleThemeToggle = () => {
    updatePreferences({
      theme: preferences.theme === 'dark' ? 'light' : 'dark',
    });
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importData(file);
    }
  };

  // Apply theme to document
  const isDark = preferences.theme === 'dark';

  useEffect(() => {
    // Toggle dark class on document root
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const handleEmailActionComplete = (messageId: string, actionLabel: string, actionType: string, result: any) => {
    // Add a system message to show email action was completed
    const confirmationText = actionType === 'send'
      ? `✅ Email sent to ${result.recipients?.join(', ') || 'recipients'}`
      : `🕐 Email scheduled for ${result.scheduled_datetime || 'later'}`;

    // Log the completion with the confirmation text
    console.log('Email action completed:', { messageId, actionLabel, actionType, result, confirmationText });

    // Store completed email actions in localStorage for persistence
    try {
      const completedKey = `completed_email_actions_${messageId}`;
      const existingCompleted = JSON.parse(localStorage.getItem(completedKey) || '[]');
      if (!existingCompleted.includes(actionLabel)) {
        existingCompleted.push(actionLabel);
        localStorage.setItem(completedKey, JSON.stringify(existingCompleted));
      }
    } catch (error) {
      console.error('Failed to store completed email action:', error);
    }
  };

  return (
    <div className="flex h-screen flex-col">
      {/* Hidden file input for imports */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileImport}
        className="hidden"
      />

      {/* Header */}
      <Header
        activeTenant={activeTenant}
        theme={preferences.theme}
        integrations={integrations}
        onThemeToggle={handleThemeToggle}
        onIntegrationsClick={() => setShowIntegrationsModal(true)}
        onKBManagementClick={() => setShowKBManagement(true)}
        onSyncNowClick={handleSyncNowClick}
        isSyncing={kbIsSyncing}
        onExportClick={exportAllData}
        onImportClick={handleImport}
        onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Conversations */}
        <ConversationsSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={setActiveConversation}
          onNewConversation={handleNewConversation}
          onDeleteConversation={deleteConversation}
          onRenameConversation={renameConversation}
          onIntegrationsClick={() => setShowIntegrationsModal(true)}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main Chat Area */}
        <div className="flex flex-1 flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
          {activeConversation ? (
            <>
              <ChatContainer
                messages={activeConversation.messages}
                isStreaming={isStreaming}
                onDeleteMessage={deleteMessage}
                onReactToMessage={addReaction}
                onSuggestedSearch={(query) => sendMessage(query)}
                onAnalyzeRisks={() => sendMessage("Analyze risks in vendor agreements")}
                onCompareClauses={() => sendMessage("Compare limitation of liability clauses")}
                onMonitorExpirations={() => sendMessage("Show contracts expiring in Q1 2026")}
                onEmailActionComplete={handleEmailActionComplete}
              />
              <Composer
                onSend={sendMessage}
                onUpload={uploadFiles}
                onUploadPdfUrl={uploadPdfFromUrl}
                onAnalyzeRisks={(query) => sendMessage(query || "Analyze risk levels across all contracts")}
                onGetTimeline={(query) => sendMessage(query || "Show upcoming contract renewals and important deadlines")}
                onGetMetrics={(query) => sendMessage(query || "Provide contract portfolio metrics and KPIs")}
                isStreaming={isStreaming}
              />
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                  No conversation selected
                </h2>
                <button
                  onClick={handleNewConversation}
                  className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
                >
                  Start New Conversation
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Integrations Modal */}
      {showIntegrationsModal && (
        <IntegrationsModal
          integrations={integrations}
          onConnect={connectIntegration}
          onDisconnect={disconnectIntegration}
          onSync={syncIntegration}
          onTest={testConnection}
          onGetTables={getIntegrationTables}
          onClose={() => setShowIntegrationsModal(false)}
        />
      )}

      {/* KB Management Modal */}
      {showKBManagement && (
        <KBManagement
          isOpen={showKBManagement}
          onClose={() => setShowKBManagement(false)}
        />
      )}
    </div>
  );
}
