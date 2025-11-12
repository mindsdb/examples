'use client';

import { Message as MessageType, SourceChip } from '@/lib/types';
import { cn, formatTime } from '@/lib/utils';
import { useState } from 'react';
import {
  Copy,
  Trash2,
  ThumbsUp,
  ExternalLink
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { Chart, RiskGauge, Timeline, MetricCard } from './MarkdownCharts';
import { EmailActions } from './EmailActions';

interface MessageProps {
  message: MessageType;
  onDelete?: () => void;
  onReact?: (emoji: string) => void;
  onEmailActionComplete?: (actionLabel: string, actionType: string, result: any) => void;
}

export function Message({ message, onDelete, onReact, onEmailActionComplete }: MessageProps) {
  const [showActions, setShowActions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);

  const handleCopy = async () => {
    if (message.content.text) {
      await navigator.clipboard.writeText(message.content.text);
    }
  };

  const reactions = ['👍', '❤️', '🎯', '⚠️', '📌'];

  if (message.role === 'system') {
    return (
      <div className="flex items-center justify-center py-3">
        <div className="flex items-center gap-2 rounded-full bg-slate-100 dark:bg-slate-800 px-4 py-2 text-xs text-slate-600 dark:text-slate-400">
          <div className="h-1.5 w-1.5 rounded-full bg-blue-500"></div>
          <span>{message.content.text}</span>
          <span className="text-slate-400 dark:text-slate-500">{formatTime(message.timestamp)}</span>
        </div>
      </div>
    );
  }

  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'group relative mb-6 flex gap-3',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar */}
      <div className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium',
        isUser
          ? 'bg-blue-600 text-white'
          : 'bg-gradient-to-br from-purple-500 to-blue-500 text-white'
      )}>
        {isUser ? 'You' : 'AI'}
      </div>

      {/* Message Content */}
      <div className={cn('flex-1 space-y-3', isUser ? 'items-end' : 'items-start')}>
        {/* Header */}
        <div className={cn('flex items-center gap-2 text-xs', isUser ? 'flex-row-reverse' : 'flex-row')}>
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {isUser ? 'You' : 'Legal AI Assistant'}
          </span>
          <span className="text-slate-500 dark:text-slate-400">{formatTime(message.timestamp)}</span>
          {message.scope && (
            <span className={cn(
              'rounded px-1.5 py-0.5 text-xs',
              message.scope === 'internal' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
              message.scope === 'external-vendor' && 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
              message.scope === 'pii-present' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            )}>
              {message.scope.replace('-', ' ')}
            </span>
          )}
        </div>

        {/* Text Content */}
        {message.content.text && (
          <div className={cn(
            'rounded-2xl px-4 py-3',
            isUser
              ? 'bg-blue-500 text-white shadow-md'
              : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-700'
          )}>
            <div className={cn(
              'message-content text-sm leading-relaxed prose prose-sm max-w-none',
              isUser
                ? 'prose-invert prose-headings:text-white prose-p:text-white prose-strong:text-white prose-em:text-blue-100 prose-code:text-blue-50 prose-code:bg-blue-600/40 prose-pre:bg-blue-600/30 prose-pre:text-white prose-a:text-blue-100 prose-a:underline hover:prose-a:text-blue-50 prose-blockquote:text-blue-100 prose-blockquote:border-blue-300'
                : 'prose-slate dark:prose-invert prose-headings:text-slate-800 dark:prose-headings:text-slate-100 prose-p:text-slate-700 dark:prose-p:text-slate-200 prose-strong:text-slate-900 dark:prose-strong:text-slate-100 prose-em:text-slate-600 dark:prose-em:text-slate-300 prose-code:bg-slate-100 dark:prose-code:bg-slate-700 prose-code:text-slate-800 dark:prose-code:text-slate-200 prose-pre:bg-slate-50 dark:prose-pre:bg-slate-900 prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-blockquote:text-slate-600 dark:prose-blockquote:text-slate-400 prose-blockquote:border-slate-300 dark:prose-blockquote:border-slate-600'
            )}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight, rehypeRaw]}
                components={{
                  // Handle special code blocks for charts and email actions
                  code: ({ className, children, ...props }) => {
                    const match = /language-(\w+)/.exec(className || '');
                    const lang = match ? match[1] : '';

                    // Handle chart code blocks
                    if (lang === 'chart' || lang === 'riskgauge' || lang === 'timeline' || lang === 'metric') {
                      try {
                        const data = JSON.parse(children?.toString() || '{}');
                        switch (lang) {
                          case 'chart':
                            return <Chart {...data} />;
                          case 'riskgauge':
                            return <RiskGauge {...data} />;
                          case 'timeline':
                            return <Timeline {...data} />;
                          case 'metric':
                            return <MetricCard {...data} />;
                          default:
                            break;
                        }
                      } catch (e) {
                        console.warn('Failed to parse chart data:', e);
                      }
                    }

                    // Handle email actions code blocks
                    if (lang === 'emailactions') {
                      try {
                        const actions = JSON.parse(children?.toString() || '[]');
                        return (
                          <EmailActions
                            actions={actions}
                            messageId={message.id}
                            onActionComplete={onEmailActionComplete || (() => { })}
                          />
                        );
                      } catch (e) {
                        console.warn('Failed to parse email actions data:', e);
                      }
                    }

                    // Handle email actions code blocks
                    if (lang === 'emailactions') {
                      try {
                        const actions = JSON.parse(children?.toString() || '[]');
                        return (
                          <EmailActions
                            actions={actions}
                            messageId={message.id}
                            onActionComplete={onEmailActionComplete || (() => { })}
                          />
                        );
                      } catch (e) {
                        console.warn('Failed to parse email actions data:', e);
                      }
                    }

                    // Default code rendering
                    return (
                      <code
                        className={cn(
                          'rounded px-1 py-0.5 text-xs font-mono',
                          isUser
                            ? 'bg-blue-600/40 text-blue-50'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                        )}
                        {...props}
                      >
                        {children}
                      </code>
                    );

                    // Default pre formatting for code blocks  
                    return (
                      <pre className={cn(
                        'rounded-lg p-3 text-sm overflow-x-auto my-2',
                        isUser
                          ? 'bg-blue-600/30 text-white'
                          : 'bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100'
                      )}>
                        <code className={className} {...props}>
                          {children}
                        </code>
                      </pre>
                    );
                  },
                  // Customize how different elements are rendered
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  blockquote: ({ children }) => (
                    <blockquote className={cn(
                      'border-l-4 pl-4 py-2 my-3 italic rounded-r',
                      isUser
                        ? 'border-blue-300 bg-blue-600/20 text-blue-50'
                        : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    )}>
                      {children}
                    </blockquote>
                  ),
                  ul: ({ children }) => (
                    <ul className={cn(
                      'list-disc list-outside ml-4 space-y-1 my-2',
                      isUser
                        ? 'marker:text-blue-200'
                        : 'marker:text-slate-600 dark:marker:text-slate-400'
                    )}>
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className={cn(
                      'list-decimal list-outside ml-4 space-y-1 my-2',
                      isUser
                        ? 'marker:text-blue-200'
                        : 'marker:text-slate-600 dark:marker:text-slate-400'
                    )}>
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className={cn(
                      'ml-1 pl-1',
                      isUser
                        ? 'text-white'
                        : 'text-slate-700 dark:text-slate-200'
                    )}>
                      {children}
                    </li>
                  ),
                  h1: ({ children }) => (
                    <h1 className={cn(
                      'text-lg font-bold mb-2 mt-3',
                      isUser
                        ? 'text-white'
                        : 'text-slate-900 dark:text-slate-100'
                    )}>
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className={cn(
                      'text-base font-bold mb-2 mt-3',
                      isUser
                        ? 'text-white'
                        : 'text-slate-900 dark:text-slate-100'
                    )}>
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className={cn(
                      'text-sm font-bold mb-1 mt-2',
                      isUser
                        ? 'text-white'
                        : 'text-slate-900 dark:text-slate-100'
                    )}>
                      {children}
                    </h3>
                  ),
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        'underline hover:no-underline',
                        isUser ? 'text-blue-200' : 'text-blue-600 dark:text-blue-400'
                      )}
                    >
                      {children}
                    </a>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-3 rounded-lg border border-slate-200 dark:border-slate-700">
                      <table className="min-w-full border-collapse text-sm">
                        {children}
                      </table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className={cn(
                      'border-b border-r px-3 py-2 text-left font-semibold last:border-r-0',
                      isUser
                        ? 'border-blue-300 bg-blue-600/20 text-white'
                        : 'border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                    )}>
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className={cn(
                      'border-b border-r px-3 py-2 last:border-r-0',
                      isUser
                        ? 'border-blue-300 text-blue-50'
                        : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'
                    )}>
                      {children}
                    </td>
                  ),
                }}
              >
                {message.content.text}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* Metadata Info - Only show for assistant messages with metadata */}
        {!isUser && message.content.metadata && message.content.metadata.streaming && (
          <div className="text-xs text-slate-500 dark:text-slate-400 space-x-2">
            <span className="inline-flex items-center gap-1">
              🔄 Streamed response
            </span>
          </div>
        )}

        {/* Sources */}
        {message.content.sources && message.content.sources.length > 0 && (
          <SourceChips sources={message.content.sources} />
        )}

        {/* Email Actions */}
        {!isUser && message.content.emailActions && (
          <EmailActions
            actions={message.content.emailActions}
            messageId={message.id}
            onActionComplete={onEmailActionComplete || (() => { })}
          />
        )}

        {/* Reactions */}
        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {Object.entries(message.reactions).map(([emoji, users]) =>
              users.length > 0 ? (
                <button
                  key={emoji}
                  onClick={() => onReact?.(emoji)}
                  className="flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-1 text-xs hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  <span>{emoji}</span>
                  <span className="text-slate-600 dark:text-slate-400">{users.length}</span>
                </button>
              ) : null
            )}
          </div>
        )}

        {/* Action Buttons */}
        {showActions && (
          <div className={cn(
            'flex items-center gap-1',
            isUser ? 'justify-end' : 'justify-start'
          )}>
            <button
              onClick={handleCopy}
              className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              title="Copy"
              aria-label="Copy message"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowReactions(!showReactions)}
                className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                title="React"
                aria-label="Add reaction"
              >
                <ThumbsUp className="h-3.5 w-3.5" />
              </button>
              {showReactions && (
                <div className="absolute bottom-full mb-1 flex gap-1 rounded-lg bg-white dark:bg-slate-900 p-1 shadow-lg ring-1 ring-slate-200 dark:ring-slate-700">
                  {reactions.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => {
                        onReact?.(emoji);
                        setShowReactions(false);
                      }}
                      className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={onDelete}
              className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800 dark:hover:text-red-400"
              title="Delete"
              aria-label="Delete message"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SourceChips({ sources }: { sources: SourceChip[] }) {
  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'dropbox': return '📦';
      case 'sharepoint': return '📊';
      case 'postgresql': return '🐘';
      case 'github': return '🐙';
      case 'notion': return '📝';
      case 'salesforce': return '☁️';
      default: return '📁';
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {sources.map((source) => (
        <button
          key={source.id}
          className="group flex items-center gap-1.5 rounded-lg bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs ring-1 ring-slate-200 dark:ring-slate-700 hover:ring-blue-500 dark:hover:ring-blue-400 transition-all"
        >
          <span className="text-base">{getSourceIcon(source.type)}</span>
          <span className="font-medium text-slate-700 dark:text-slate-300">{source.name}</span>
          <ExternalLink className="h-3 w-3 text-slate-400 group-hover:text-blue-500" />
        </button>
      ))}
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex gap-3 mb-6">
      {/* Spacer to align with message content, no duplicate AI avatar */}
      <div className="h-8 w-8 shrink-0"></div>
      <div className="flex items-center gap-1 rounded-2xl bg-slate-100 dark:bg-slate-800 px-4 py-3">
        <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]"></div>
        <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]"></div>
        <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400"></div>
      </div>
    </div>
  );
}

export function StreamingMessage({ text }: { text: string }) {
  return (
    <div className="flex gap-3 mb-6">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-xs font-medium text-white">
        AI
      </div>
      <div className="flex-1">
        <div className="rounded-2xl bg-white dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className={cn(
            'message-content text-sm leading-relaxed prose prose-sm max-w-none',
            'prose-slate dark:prose-invert prose-headings:text-slate-800 dark:prose-headings:text-slate-100 prose-p:text-slate-700 dark:prose-p:text-slate-200 prose-strong:text-slate-900 dark:prose-strong:text-slate-100 prose-code:bg-slate-100 dark:prose-code:bg-slate-700 prose-code:text-slate-800 dark:prose-code:text-slate-200 prose-pre:bg-slate-50 dark:prose-pre:bg-slate-900'
          )}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight, rehypeRaw]}
              components={{
                // Handle special code blocks for charts and email actions
                code: ({ className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || '');
                  const lang = match ? match[1] : '';

                  // Handle chart code blocks
                  if (lang === 'chart' || lang === 'riskgauge' || lang === 'timeline' || lang === 'metric') {
                    try {
                      const data = JSON.parse(children?.toString() || '{}');
                      switch (lang) {
                        case 'chart':
                          return <Chart {...data} />;
                        case 'riskgauge':
                          return <RiskGauge {...data} />;
                        case 'timeline':
                          return <Timeline {...data} />;
                        case 'metric':
                          return <MetricCard {...data} />;
                        default:
                          break;
                      }
                    } catch (e) {
                      console.warn('Failed to parse chart data:', e);
                    }
                  }

                  // Handle email actions code blocks
                  if (lang === 'emailactions') {
                    try {
                      const actions = JSON.parse(children?.toString() || '[]');
                      return (
                        <EmailActions
                          actions={actions}
                          onActionComplete={(_actionLabel, _actionType, _result) => { }}
                        />
                      );
                    } catch (e) {
                      console.warn('Failed to parse email actions data:', e);
                    }
                  }

                  // Default code rendering
                  return (
                    <code
                      className="rounded px-1 py-0.5 text-xs font-mono bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              }}
            >
              {text}
            </ReactMarkdown>
            <span className="inline-block h-4 w-0.5 animate-pulse bg-blue-500 ml-0.5"></span>
          </div>
        </div>
      </div>
    </div>
  );
}
