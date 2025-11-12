'use client';

import { cn } from '@/lib/utils';
import Image from 'next/image';
import {
  Moon,
  Sun,
  Building2,
  Menu,
  Download,
  Upload,
  RefreshCw,
  Database,
} from 'lucide-react';
import { IntegrationBadge } from './Integrations';
import { Integration, UserPreferences } from '@/lib/types';
import { useState } from 'react';

interface HeaderProps {
  activeTenant?: string;
  theme: UserPreferences['theme'];
  integrations: Integration[];
  onThemeToggle: () => void;
  onIntegrationsClick: () => void;
  onExportClick: () => void;
  onImportClick: () => void;
  onSyncNowClick: () => void;
  onKBManagementClick: () => void;
  onMenuToggle?: () => void;
  isSyncing?: boolean;
}

export function Header({
  activeTenant,
  theme,
  integrations,
  onThemeToggle,
  onIntegrationsClick,
  onExportClick,
  onImportClick,
  onSyncNowClick,
  onKBManagementClick,
  onMenuToggle,
  isSyncing = false,
}: HeaderProps) {
  const [showIntegrations, setShowIntegrations] = useState(false);

  // Count total connected instances across all integrations
  const connectedCount = integrations.reduce((total, integration) => {
    return total + integration.instances.filter(instance => instance.status === 'connected').length;
  }, 0);

  // Get all connected instances for display with their integration types
  const connectedInstancesWithTypes = integrations.flatMap(integration =>
    integration.instances
      .filter(instance => instance.status === 'connected')
      .map(instance => ({ instance, integrationType: integration.type }))
  );

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white dark:bg-slate-800 p-1">
            <Image
              src="/logo.png"
              alt="Legal Contract Analyzer Logo"
              width={32}
              height={32}
              className="object-contain"
            />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Legal Contract Intelligence
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Demo Environment
            </p>
          </div>
        </div>
      </div>

      {/* Center Section - Tenant */}
      <div className="hidden md:flex items-center gap-3">
        {activeTenant && (
          <div className="flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5">
            <Building2 className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {activeTenant}
            </span>
          </div>
        )}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {/* Integrations Status */}
        <div className="relative hidden md:block">
          <button
            onClick={() => setShowIntegrations(!showIntegrations)}
            className="flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            <span>{connectedCount} Sources</span>
          </button>

          {showIntegrations && (
            <div className="absolute right-0 top-full mt-2 w-64 rounded-lg bg-white dark:bg-slate-900 p-3 shadow-xl ring-1 ring-slate-200 dark:ring-slate-700 z-50">
              <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                Connected Sources
              </div>
              <div className="space-y-2">
                {connectedInstancesWithTypes.map(({ instance, integrationType }) => (
                  <IntegrationBadge
                    key={instance.id}
                    instance={instance}
                    integrationType={integrationType}
                    onClick={onIntegrationsClick}
                  />
                ))}
              </div>
              <button
                onClick={onIntegrationsClick}
                className="mt-3 w-full rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Manage All
              </button>
            </div>
          )}
        </div>

        {/* Export */}
        <button
          onClick={onExportClick}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          title="Export data"
          aria-label="Export data"
        >
          <Download className="h-5 w-5" />
        </button>

        {/* Import */}
        <button
          onClick={onImportClick}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          title="Import data"
          aria-label="Import data"
        >
          <Upload className="h-5 w-5" />
        </button>

        {/* KB Management */}
        <button
          onClick={onKBManagementClick}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          title="Manage knowledge base"
          aria-label="Manage knowledge base"
        >
          <Database className="h-4 w-4" />
          <span className="hidden md:inline">KB Manager</span>
        </button>

        {/* Sync Now */}
        <button
          onClick={onSyncNowClick}
          disabled={isSyncing}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            isSyncing
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
          )}
          title={isSyncing ? "Syncing knowledge base..." : "Sync knowledge base now"}
          aria-label={isSyncing ? "Syncing knowledge base..." : "Sync knowledge base now"}
        >
          <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
          <span className="hidden md:inline">
            {isSyncing ? "Syncing..." : "Sync Now"}
          </span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={onThemeToggle}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          title="Toggle theme"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </button>
      </div>
    </header>
  );
}
