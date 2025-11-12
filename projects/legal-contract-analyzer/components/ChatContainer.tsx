'use client';

import { Message as MessageType } from '@/lib/types';
import { Message, TypingIndicator } from './Message';
import { RiskGauge, RiskBar, ClauseCard, ComparisonTable, ExpiryTimeline, EvaluationCard } from './Analytics';
import { useEffect, useRef } from 'react';

interface ChatContainerProps {
  messages: MessageType[];
  isStreaming?: boolean;
  onDeleteMessage?: (messageId: string) => void;
  onReactToMessage?: (messageId: string, emoji: string) => void;
  onSuggestedSearch?: (query: string) => void;
  onAnalyzeRisks?: () => void;
  onCompareClauses?: () => void;
  onMonitorExpirations?: () => void;
  onEmailActionComplete?: (messageId: string, actionLabel: string, actionType: string, result: any) => void;
}

export function ChatContainer({
  messages,
  isStreaming,
  onDeleteMessage,
  onReactToMessage,
  onSuggestedSearch,
  onAnalyzeRisks,
  onCompareClauses,
  onMonitorExpirations,
  onEmailActionComplete,
}: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0 && !isStreaming) {
    return <EmptyState
      onSuggestedSearch={onSuggestedSearch}
      onAnalyzeRisks={onAnalyzeRisks}
      onCompareClauses={onCompareClauses}
      onMonitorExpirations={onMonitorExpirations}
    />;
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-6 space-y-6 chat-container"
      role="log"
      aria-live="polite"
      aria-label="Chat messages"
    >
      {messages.map((message) => (
        <div key={message.id} className="space-y-4">
          <Message
            message={message}
            onDelete={() => onDeleteMessage?.(message.id)}
            onReact={(emoji) => onReactToMessage?.(message.id, emoji)}
            onEmailActionComplete={(actionLabel, actionType, result) => onEmailActionComplete?.(message.id, actionLabel, actionType, result)}
          />

          {/* Render embedded analytics */}
          {message.content.riskScore && (
            <RiskGauge
              score={message.content.riskScore.score}
              level={message.content.riskScore.level}
              breakdown={message.content.riskScore.breakdown}
            />
          )}

          {message.content.riskDistribution && (
            <RiskBar distribution={message.content.riskDistribution} />
          )}

          {message.content.clauses && message.content.clauses.length > 0 && (
            <div className="space-y-3">
              {message.content.clauses.map((clause) => (
                <ClauseCard
                  key={clause.id}
                  clause={clause}
                  onExplain={() => console.log('Explain', clause.id)}
                  onCompare={() => console.log('Compare', clause.id)}
                  onDraftFix={() => console.log('Draft fix', clause.id)}
                />
              ))}
            </div>
          )}

          {message.content.comparison && (
            <ComparisonTable rows={message.content.comparison} />
          )}

          {message.content.expiryTimeline && (
            <ExpiryTimeline items={message.content.expiryTimeline} />
          )}

          {message.content.evaluation && (
            <EvaluationCard metrics={message.content.evaluation} />
          )}
        </div>
      ))}

      {isStreaming && <TypingIndicator />}

      <div ref={messagesEndRef} />
    </div>
  );
}

function EmptyState({
  onSuggestedSearch,
  onAnalyzeRisks,
  onCompareClauses,
  onMonitorExpirations
}: {
  onSuggestedSearch?: (query: string) => void;
  onAnalyzeRisks?: () => void;
  onCompareClauses?: () => void;
  onMonitorExpirations?: () => void;
}) {
  const suggestions = [
    {
      icon: '🔍',
      title: 'Search Contracts',
      description: 'Find contracts with specific clauses or terms',
      example: 'Show me all contracts with force majeure clauses',
    },
    {
      icon: '📊',
      title: 'Analyze Risks',
      description: 'Get risk assessments and distribution analysis',
      example: 'Analyze risks in vendor agreements',
    },
    {
      icon: '⚖️',
      title: 'Compare Clauses',
      description: 'Compare terms across multiple contracts',
      example: 'Compare limitation of liability clauses',
    },
    {
      icon: '📅',
      title: 'Monitor Expirations',
      description: 'Track upcoming contract renewals',
      example: 'Show contracts expiring in Q1 2026',
    },
  ];

  return (
    <div className="flex h-full flex-col items-center justify-center p-8">
      <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-4xl text-white">
        ⚖️
      </div>

      <h2 className="mb-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
        Welcome to Legal Contract Intelligence
      </h2>

      <p className="mb-8 max-w-md text-center text-slate-600 dark:text-slate-400">
        Ask questions about your contracts, analyze clauses, compare terms, and get instant insights powered by AI.
      </p>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-4 md:grid-cols-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.title}
            onClick={() => {
              if (suggestion.title === 'Search Contracts') {
                onSuggestedSearch?.(suggestion.example);
              } else if (suggestion.title === 'Analyze Risks') {
                onAnalyzeRisks?.();
              } else if (suggestion.title === 'Compare Clauses') {
                onCompareClauses?.();
              } else if (suggestion.title === 'Monitor Expirations') {
                onMonitorExpirations?.();
              }
            }}
            className="group flex flex-col gap-2 rounded-xl bg-white dark:bg-slate-900 p-4 text-left ring-1 ring-slate-200 dark:ring-slate-700 transition-all hover:ring-2 hover:ring-blue-500 dark:hover:ring-blue-400"
          >
            <div className="text-3xl">{suggestion.icon}</div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                {suggestion.title}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {suggestion.description}
              </p>
              <p className="mt-2 text-xs text-blue-600 dark:text-blue-400 group-hover:underline">
                "{suggestion.example}"
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
