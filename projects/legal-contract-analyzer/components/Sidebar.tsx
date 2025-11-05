'use client';

import { Conversation } from '@/lib/types';
import { cn, formatRelativeTime } from '@/lib/utils';
import {
  MessageSquare,
  Trash2,
  Plus,
  Search,
  Plug,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import { useState } from 'react';

interface ConversationsSidebarProps {
  conversations: Conversation[];
  activeConversationId?: string;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onIntegrationsClick: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export function ConversationsSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
  onIntegrationsClick,
  isOpen = true,
}: ConversationsSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'recent'>('all');

  const filteredConversations = conversations
    .filter(conv => {
      // Apply time-based filter for "recent"
      if (filter === 'recent') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return conv.updatedAt >= sevenDaysAgo;
      }
      return true; // "all" shows everything
    })
    .filter(conv =>
      conv.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()); // Most recent first

  return (
    <div
      className={cn(
        'flex h-full w-80 flex-col border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900',
        'lg:relative',
        isOpen ? 'fixed inset-y-0 left-0 z-40 lg:static' : 'hidden lg:flex'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 p-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Conversations
        </h2>
        <button
          onClick={onNewConversation}
          className="rounded-lg bg-blue-600 p-2 text-white hover:bg-blue-700"
          title="New conversation"
          aria-label="New conversation"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Search */}
      <div className="border-b border-slate-200 dark:border-slate-700 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 px-4 py-2">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'rounded-lg px-3 py-1 text-xs font-medium transition-colors',
            filter === 'all'
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          )}
        >
          All
        </button>
        <button
          onClick={() => setFilter('recent')}
          className={cn(
            'rounded-lg px-3 py-1 text-xs font-medium transition-colors',
            filter === 'recent'
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          )}
        >
          Recent
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-2 conversation-list">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <MessageSquare className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {searchQuery ? 'No conversations found' : 'No conversations yet'}
            </p>
            {!searchQuery && (
              <button
                onClick={onNewConversation}
                className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Start a new conversation
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredConversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={conversation.id === activeConversationId}
                onClick={() => onSelectConversation(conversation.id)}
                onDelete={() => onDeleteConversation(conversation.id)}
                onRename={(newTitle) => onRenameConversation(conversation.id, newTitle)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Integrations Button */}
      <div className="border-t border-slate-200 dark:border-slate-700 p-4">
        <button
          onClick={onIntegrationsClick}
          className="flex w-full items-center gap-3 rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-3 text-left hover:bg-slate-200 dark:hover:bg-slate-700"
        >
          <Plug className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          <div className="flex-1">
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Manage Integrations
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Connect data sources
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
  onRename: (newTitle: string) => void;
}

function ConversationItem({ conversation, isActive, onClick, onDelete, onRename }: ConversationItemProps) {
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conversation.title);

  const lastMessage = conversation.messages[conversation.messages.length - 1];
  const preview = lastMessage?.content.text || 'No messages yet';

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditTitle(conversation.title);
    setShowActions(false);
  };

  const handleSaveEdit = () => {
    if (editTitle.trim() && editTitle.trim() !== conversation.title) {
      onRename(editTitle.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditTitle(conversation.title);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <div
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      className="relative group"
    >
      {isEditing ? (
        <div className={cn(
          'flex w-full flex-col gap-1 rounded-lg p-3 transition-colors',
          isActive
            ? 'bg-blue-100 dark:bg-blue-900/30 ring-1 ring-blue-200 dark:ring-blue-800'
            : 'bg-slate-100 dark:bg-slate-800'
        )}>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent text-sm font-medium text-slate-900 dark:text-slate-100 border-none outline-none focus:ring-0"
              autoFocus
            />
            <div className="flex gap-1">
              <button
                onClick={handleSaveEdit}
                className="rounded p-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50"
                title="Save"
                aria-label="Save rename"
              >
                <Check className="h-3 w-3" />
              </button>
              <button
                onClick={handleCancelEdit}
                className="rounded p-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600"
                title="Cancel"
                aria-label="Cancel rename"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {preview}
          </p>
        </div>
      ) : (
        <button
          onClick={onClick}
          className={cn(
            'flex w-full flex-col gap-1 rounded-lg p-3 text-left transition-colors',
            isActive
              ? 'bg-blue-100 dark:bg-blue-900/30 ring-1 ring-blue-200 dark:ring-blue-800'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800'
          )}
        >
          <div className="flex items-center gap-2">
            <span className="flex-1 truncate font-medium text-slate-900 dark:text-slate-100">
              {conversation.title}
            </span>
            {conversation.hasUnread && (
              <div className="h-2 w-2 rounded-full bg-blue-600"></div>
            )}
          </div>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {preview}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {formatRelativeTime(conversation.updatedAt)}
            </span>
            {conversation.tags && conversation.tags.length > 0 && (
              <span className="rounded bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 text-xs text-slate-600 dark:text-slate-400">
                {conversation.tags[0]}
              </span>
            )}
          </div>
        </button>
      )}

      {showActions && !isEditing && (
        <div className="absolute right-2 top-2 flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleStartEdit();
            }}
            className="rounded p-1 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700"
            title="Rename conversation"
            aria-label="Rename conversation"
          >
            <Edit2 className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="rounded p-1 bg-white dark:bg-slate-900 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 ring-1 ring-slate-200 dark:ring-slate-700"
            title="Delete conversation"
            aria-label="Delete conversation"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
