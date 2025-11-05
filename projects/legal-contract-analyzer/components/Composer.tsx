'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Send, Paperclip, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QUICK_PROMPTS } from '@/lib/types';

interface ComposerProps {
  onSend: (message: string) => void;
  onUpload?: (files: File[]) => void;
  onUploadPdfUrl?: (url: string) => void;
  onAnalyzeRisks?: (query: string) => void;
  onGetTimeline?: (query: string) => void;
  onGetMetrics?: (query: string) => void;
  isStreaming?: boolean;
  disabled?: boolean;
}

export function Composer({ onSend, onUpload, onUploadPdfUrl, onAnalyzeRisks, onGetTimeline, onGetMetrics, isStreaming, disabled }: ComposerProps) {
  const [value, setValue] = useState('');
  const [showQuickPrompts, setShowQuickPrompts] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  // Global keyboard listener for quick prompts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Toggle quick prompts with Ctrl/Cmd + K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowQuickPrompts(prev => !prev);
      }
      // Close quick prompts with Escape
      else if (e.key === 'Escape' && showQuickPrompts) {
        setShowQuickPrompts(false);
        textareaRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown as any);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown as any);
  }, [showQuickPrompts]);

  // Click outside to close quick prompts
  useEffect(() => {
    if (!showQuickPrompts) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest('[data-quick-prompts]')) {
        setShowQuickPrompts(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showQuickPrompts]);

  // no-op: removed slash command parsing; keep composer focused on text and uploads

  const handleSubmit = () => {
    if (!value.trim() || isStreaming || disabled) return;

    onSend(value.trim());
    setValue('');
    setShowQuickPrompts(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
      return;
    }
    // Command palette (Cmd/Ctrl + K) - Toggle quick prompts
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setShowQuickPrompts(prev => !prev);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0 && onUpload) {
      onUpload(files);
    }
    // Reset input
    e.target.value = '';
  };

  const handleQuickPrompt = (prompt: any) => {
    const { prompt: message, action } = prompt;

    // Execute different actions based on prompt type
    switch (action) {
      case 'analyzeRisks':
        if (onAnalyzeRisks) {
          onAnalyzeRisks(message);
        } else {
          onSend(message);
        }
        break;
      case 'getTimeline':
        if (onGetTimeline) {
          onGetTimeline(message);
        } else {
          onSend(message);
        }
        break;
      case 'getMetrics':
        if (onGetMetrics) {
          onGetMetrics(message);
        } else {
          onSend(message);
        }
        break;
      default:
        onSend(message);
        break;
    }

    setShowQuickPrompts(false);
    textareaRef.current?.focus();
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isStreaming) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragOver to false if we're actually leaving the composer area
    if (!composerRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled || isStreaming || !onUpload) return;

    const files = Array.from(e.dataTransfer.files);
    const pdfFiles = files.filter(file =>
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    );

    if (pdfFiles.length > 0) {
      onUpload(pdfFiles);
    }

    // Handle text/URLs that might be dropped
    const text = e.dataTransfer.getData('text/plain');
    if (text && isValidPdfUrl(text)) {
      // Handle PDF URL drop
      handlePdfUrl(text);
    }
  };

  // Check if a URL looks like a PDF
  const isValidPdfUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return (
        (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') &&
        (url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('pdf'))
      );
    } catch {
      return false;
    }
  };

  // Handle PDF URL input
  const handlePdfUrl = async (url: string) => {
    if (!onUploadPdfUrl) return;

    try {
      await onUploadPdfUrl(url);
    } catch (error) {
      console.error('Error handling PDF URL:', error);
    }
  };

  // Handle paste events
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData('text');

    // Check if the pasted text is a PDF URL
    if (isValidPdfUrl(pastedText)) {
      e.preventDefault();
      // Handle the PDF URL instead of pasting it as text
      handlePdfUrl(pastedText);
      // Optionally, show a message that the PDF URL is being processed
      setValue(prev => prev + (prev ? '\n\n' : '') + `Processing PDF from: ${pastedText}`);
    }
  };

  return (
    <div
      ref={composerRef}
      className={cn(
        "relative border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900",
        isDragOver && "bg-blue-50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-600"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-50/90 dark:bg-blue-950/40 backdrop-blur-sm">
          <div className="rounded-lg bg-white dark:bg-slate-800 px-6 py-4 shadow-lg ring-1 ring-blue-200 dark:ring-blue-700">
            <div className="flex items-center gap-3">
              <Paperclip className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Drop PDF files here
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  or paste PDF URLs
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Prompts */}
      {showQuickPrompts && (
        <div
          data-quick-prompts
          className="absolute bottom-full left-0 right-0 mb-2 max-h-96 overflow-y-auto rounded-lg bg-white dark:bg-slate-900 p-2 shadow-xl ring-1 ring-slate-200 dark:ring-slate-700"
        >
          <div className="mb-2 px-2 py-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            Quick Prompts
          </div>
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt.id}
              onClick={() => handleQuickPrompt(prompt)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {prompt.label}
                </div>
                {prompt.category && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                    {prompt.category}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Slash commands removed - composer focuses on text input, quick prompts and attachments */}

      {/* Composer */}
      <div className="flex items-end gap-2 p-4">
        {/* File Upload */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isStreaming}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 disabled:opacity-50"
          title="Attach file"
          aria-label="Attach file"
        >
          <Paperclip className="h-5 w-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Text Input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            disabled={disabled || isStreaming}
            placeholder="Ask about contracts, clauses, or paste PDF URLs..."
            rows={1}
            className="w-full resize-none rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 pr-12 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
            style={{ maxHeight: '200px' }}
          />

        </div>

        {/* Send Button */}
        <button
          onClick={handleSubmit}
          disabled={!value.trim() || disabled || isStreaming}
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors',
            value.trim() && !disabled && !isStreaming
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'
          )}
          title="Send message"
          aria-label="Send message"
        >
          {isStreaming ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Keyboard Shortcuts Hint */}
      <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-4">
          <span>
            <kbd className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono">
              Enter
            </kbd>{' '}
            to send
          </span>
          <span>
            <kbd className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono">
              Shift + Enter
            </kbd>{' '}
            for new line
          </span>
          <span>
            <kbd className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono">
              {navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'} + K
            </kbd>{' '}
            for quick prompts
          </span>
        </div>
        <div className="text-xs text-slate-400">
          Drag & drop PDFs or paste PDF URLs • AI can make mistakes
        </div>
      </div>
    </div>
  );
}
