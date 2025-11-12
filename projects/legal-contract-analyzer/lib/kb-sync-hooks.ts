/**
 * Hook for managing knowledge base sync functionality
 */

import { useState, useCallback } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface KbSyncResult {
  status: string;
  sync_time: string;
  total_sources: number;
  new_sources: number;
  updated_sources: number;
  removed_sources: number;
  new_source_names: string[];
  removed_source_names: string[];
}

interface KbStatus {
  kb_name: string;
  kb_status: string;
  last_sync: string | null;
  sync_count: number;
  current_sources_found: number;
  processed_sources_count: number;
  active_sources: any[];
  removed_sources: any[];
  sync_job_name: string;
}

export function useKbSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<KbSyncResult | null>(null);
  const [kbStatus, setKbStatus] = useState<KbStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getKbStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/agent/kb-status`);
      
      if (!response.ok) {
        throw new Error(`Failed to get KB status: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setKbStatus(data.kb_status);
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get KB status';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const triggerSync = useCallback(async () => {
    try {
      setIsSyncing(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/agent/sync-now`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setLastSyncResult(data.sync_result);
        // Optionally refresh KB status after sync
        await getKbStatus();
      } else {
        throw new Error(data.message || 'Sync failed');
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [getKbStatus]);

  return {
    isSyncing,
    lastSyncResult,
    kbStatus,
    error,
    triggerSync,
    getKbStatus,
  };
}