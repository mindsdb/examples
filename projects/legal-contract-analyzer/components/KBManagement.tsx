'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { KBRow, KBQueryResponse } from '@/lib/types';
import {
  Search,
  Trash2,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  Database,
  Settings,
  Eye,
  AlertTriangle,
  Loader2,
  RefreshCw
} from 'lucide-react';

interface KBStats {
  success: boolean;
  kb_name: string;
  total_rows: number;
  content_sources?: string[];
  last_updated: string;
}

interface KBManagementProps {
  isOpen: boolean;
  onClose: () => void;
}

const SEARCH_TYPES = [
  { value: 'semantic', label: 'Semantic Search', description: 'AI-powered meaning-based search' }
];

export function KBManagement({ isOpen, onClose }: KBManagementProps) {
  // State management
  const [rows, setRows] = useState<KBRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<KBStats | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('semantic');
  const [isSearchMode, setIsSearchMode] = useState(false);

  // Selection state
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // UI state
  const [showSearchSettings, setShowSearchSettings] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedRowForDetails, setSelectedRowForDetails] = useState<KBRow | null>(null);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // Load KB data
  const loadKBData = useCallback(async (page = 1, search = '') => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
      });

      if (search.trim()) {
        params.append('search', search.trim());
      }

      const response = await fetch(`${API_BASE_URL}/api/kb/rows?${params}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const data: KBQueryResponse = await response.json();

      setRows(data.rows);
      setCurrentPage(data.page);
      setTotalPages(data.total_pages);
      setTotalCount(data.total_count);

      // Reset selection when data changes
      setSelectedRows(new Set());
      setSelectAll(false);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load KB data';
      setError(errorMsg);
      console.error('Error loading KB data:', err);
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, pageSize]);

  // Load KB stats
  const loadKBStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/kb/stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error loading KB stats:', err);
    }
  }, [API_BASE_URL]);

  // Advanced search
  const performAdvancedSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);
    setIsSearchMode(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/kb/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery.trim(),
          search_type: searchType,
          limit: pageSize
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const data: KBRow[] = await response.json();

      setRows(data);
      setCurrentPage(1);
      setTotalPages(1);
      setTotalCount(data.length);

      // Reset selection
      setSelectedRows(new Set());
      setSelectAll(false);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Search failed';
      setError(errorMsg);
      console.error('Error performing advanced search:', err);
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, searchQuery, searchType, pageSize]);

  // Delete selected rows
  const deleteSelectedRows = useCallback(async () => {
    if (selectedRows.size === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedRows.size} selected row(s)? This action cannot be undone.`
    );

    if (!confirmed) return;

    setDeleteLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/kb/rows`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          row_ids: Array.from(selectedRows)
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // Reload data after successful deletion
        await loadKBData(currentPage, isSearchMode ? searchQuery : '');
        await loadKBStats(); // Update stats

        // Show success message
        alert(`Successfully deleted ${result.deleted_count} row(s)${result.failed_count > 0 ? ` (${result.failed_count} failed)` : ''}`);
      } else {
        throw new Error(result.message || 'Deletion failed');
      }

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Deletion failed';
      setError(errorMsg);
      console.error('Error deleting rows:', err);
    } finally {
      setDeleteLoading(false);
    }
  }, [API_BASE_URL, selectedRows, currentPage, isSearchMode, searchQuery, loadKBData, loadKBStats]);

  // Selection handlers
  const toggleRowSelection = (rowId: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(rowId)) {
      newSelected.delete(rowId);
    } else {
      newSelected.add(rowId);
    }
    setSelectedRows(newSelected);
    setSelectAll(newSelected.size === rows.length);
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedRows(new Set());
      setSelectAll(false);
    } else {
      const allIds = rows.filter(row => row.id).map(row => row.id!);
      setSelectedRows(new Set(allIds));
      setSelectAll(true);
    }
  };

  // Pagination handlers
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      if (isSearchMode) {
        performAdvancedSearch();
      } else {
        loadKBData(page, searchQuery);
      }
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setIsSearchMode(false);
    loadKBData(1, '');
  };

  // Load data on mount and when modal opens
  useEffect(() => {
    if (isOpen) {
      loadKBData();
      loadKBStats();
    }
  }, [isOpen, loadKBData, loadKBStats]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 h-[90vh] w-full max-w-7xl rounded-lg bg-white dark:bg-slate-900 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <Database className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Knowledge Base Management
              </h2>
              {stats && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {stats.total_rows.toLocaleString()} total rows
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Search and Actions Bar */}
        <div className="border-b border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-3 mb-3">
            {/* Search Input */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search knowledge base content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && performAdvancedSearch()}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Search Button */}
            <button
              onClick={performAdvancedSearch}
              disabled={!searchQuery.trim() || loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              Search
            </button>

            {/* Search Settings */}
            <button
              onClick={() => setShowSearchSettings(!showSearchSettings)}
              className="p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-lg"
              title="Search settings"
            >
              <Settings className="h-4 w-4" />
            </button>

            {/* Clear Search */}
            {isSearchMode && (
              <button
                onClick={clearSearch}
                className="px-3 py-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-lg text-sm"
              >
                Clear
              </button>
            )}
          </div>

          {/* Advanced Search Settings */}
          {showSearchSettings && (
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Search Type */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Search Type
                  </label>
                  <select
                    value={searchType}
                    onChange={(e) => setSearchType(e.target.value)}
                    className="w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-xs"
                  >
                    {SEARCH_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Search Type Description */}
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {SEARCH_TYPES.find(t => t.value === searchType)?.description}
              </p>
            </div>
          )}
        </div>

        {/* Actions Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-4 py-2">
          <div className="flex items-center gap-3">
            {/* Select All */}
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            >
              {selectAll ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              Select All
            </button>

            {/* Selection Count */}
            {selectedRows.size > 0 && (
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {selectedRows.size} selected
              </span>
            )}

            {/* Delete Selected */}
            {selectedRows.size > 0 && (
              <button
                onClick={deleteSelectedRows}
                disabled={deleteLoading}
                className="flex items-center gap-2 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-sm"
              >
                {deleteLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete Selected
              </button>
            )}
          </div>

          {/* Refresh */}
          <button
            onClick={() => loadKBData(currentPage, isSearchMode ? searchQuery : '')}
            disabled={loading}
            className="p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {/* Error Message */}
          {error && (
            <div className="mx-4 mt-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="flex items-center gap-3 text-slate-500">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Loading knowledge base data...</span>
              </div>
            </div>
          )}

          {/* KB Rows Table */}
          {!loading && rows.length > 0 && (
            <div className="overflow-auto h-[calc(100vh-320px)]">
              <table className="w-full">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="w-12 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300"
                      />
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider w-48">
                      Row ID
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Source
                    </th>
                    <th className="w-12 px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {rows.map((row, index) => (
                    <tr
                      key={row.id || index}
                      className={cn(
                        "hover:bg-slate-50 dark:hover:bg-slate-800",
                        selectedRows.has(row.id || '') && "bg-blue-50 dark:bg-blue-900/20"
                      )}
                    >
                      <td className="px-3 py-2">
                        {row.id && (
                          <input
                            type="checkbox"
                            checked={selectedRows.has(row.id)}
                            onChange={() => toggleRowSelection(row.id!)}
                            className="rounded border-slate-300"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs text-slate-600 dark:text-slate-400 font-mono break-all">
                          {row.id || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-sm text-slate-900 dark:text-slate-100">
                          {row.metadata?.filename || row.metadata?.document_name || row.metadata?.source || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => setSelectedRowForDetails(row)}
                          title="View details"
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Empty State */}
          {!loading && rows.length === 0 && (
            <div className="flex items-center justify-center h-64 text-slate-500">
              <div className="text-center">
                <Database className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p className="text-lg font-medium mb-1">No data found</p>
                <p className="text-sm">
                  {isSearchMode ? 'Try adjusting your search query' : 'The knowledge base appears to be empty'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Pagination Footer */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 px-4 py-3">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount.toLocaleString()} results
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <span className="text-sm text-slate-600 dark:text-slate-400">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Row Details Modal */}
      {selectedRowForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-4xl rounded-lg bg-white dark:bg-slate-900 shadow-xl max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 p-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Knowledge Base Row Details
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {selectedRowForDetails.chunk_id ? `Chunk ID: ${selectedRowForDetails.chunk_id}` : 'Row details'}
                </p>
              </div>
              <button
                onClick={() => setSelectedRowForDetails(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto overflow-x-hidden max-h-[calc(80vh-180px)] p-4 space-y-4">
              {/* Content Section */}
              <div>
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Chunk Content
                </h4>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-4">
                  <p className="text-sm text-slate-900 dark:text-slate-100 whitespace-pre-wrap leading-relaxed break-words max-w-full">
                    {selectedRowForDetails.chunk_content}
                  </p>
                </div>
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-1 gap-4">
                {selectedRowForDetails.id && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Row ID
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-mono bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded break-all">
                      {selectedRowForDetails.id}
                    </p>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Source
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded">
                    {selectedRowForDetails.metadata?.filename || selectedRowForDetails.metadata?.document_name || selectedRowForDetails.metadata?.source || 'Unknown'}
                  </p>
                </div>
              </div>

              {/* Search Scores (when available) */}
              {(selectedRowForDetails.distance !== undefined || selectedRowForDetails.relevance !== undefined) && (
                <div>
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Search Scores
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedRowForDetails.distance !== undefined && (
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                        <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                          {selectedRowForDetails.distance?.toFixed(4)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Distance</div>
                      </div>
                    )}
                    {selectedRowForDetails.relevance !== undefined && (
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                        <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                          {selectedRowForDetails.relevance?.toFixed(4)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Relevance</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Metadata Section */}
              {selectedRowForDetails.metadata && Object.keys(selectedRowForDetails.metadata).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Metadata
                  </h4>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-4">
                    <div className="grid grid-cols-1 gap-2">
                      {Object.entries(selectedRowForDetails.metadata).map(([key, value]) => (
                        <div key={key} className="flex items-start gap-3">
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 min-w-0 flex-shrink-0 capitalize">
                            {key.replace(/_/g, ' ')}:
                          </span>
                          <pre className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words m-0">
                            {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Content Stats */}
              <div>
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Content Statistics
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                    <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {selectedRowForDetails.chunk_content.length.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Characters</div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                    <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {selectedRowForDetails.chunk_content.split(/\s+/).length.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Words</div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                    <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {selectedRowForDetails.chunk_content.split('\n').length.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Lines</div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                    <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {Math.ceil(selectedRowForDetails.chunk_content.length / 4).toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Est. Tokens</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-200 dark:border-slate-700 p-4">
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setSelectedRowForDetails(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Close
                </button>
                {selectedRowForDetails.id && (
                  <button
                    onClick={() => {
                      if (selectedRowForDetails.id) {
                        setSelectedRows(new Set([selectedRowForDetails.id]));
                        setSelectedRowForDetails(null);
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
                  >
                    Delete This Row
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}