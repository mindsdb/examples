'use client';

import { Integration, IntegrationType, IntegrationConnectionParams, INTEGRATION_METADATA, TableInfo, IntegrationInstance } from '@/lib/types';
import { cn, formatRelativeTime } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { X, Check, AlertCircle, RefreshCw, ChevronRight, Plug, Plus, Trash2 } from 'lucide-react';
import { ConnectionForm } from '@/components/IntegrationForms';

interface IntegrationBadgeProps {
  instance: IntegrationInstance;
  integrationType: IntegrationType;
  onClick?: () => void;
}

export function IntegrationBadge({ instance, integrationType, onClick }: IntegrationBadgeProps) {
  const statusColors = {
    'not-connected': 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
    'connecting': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    'connected': 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    'error': 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  };

  const integrationIcon = INTEGRATION_METADATA[integrationType]?.icon || '📊';

  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all hover:ring-2 hover:ring-offset-1',
        statusColors[instance.status]
      )}
      title={`${instance.name} - ${instance.status}`}
    >
      <span className="text-sm">{integrationIcon}</span>
      <span>{instance.name}</span>
      {instance.status === 'connected' && (
        <Check className="h-3 w-3" />
      )}
      {instance.status === 'error' && (
        <AlertCircle className="h-3 w-3" />
      )}
      {instance.status === 'connecting' && (
        <RefreshCw className="h-3 w-3 animate-spin" />
      )}
    </button>
  );
}

interface IntegrationsModalProps {
  integrations: Integration[];
  onConnect: (type: IntegrationType, instanceName: string, params: IntegrationConnectionParams, selectedTables?: string[]) => void;
  onDisconnect: (databaseName: string) => Promise<void>;
  onSync?: (databaseName: string) => Promise<void>;
  onTest?: (type: IntegrationType, params: IntegrationConnectionParams) => Promise<boolean>;
  onGetTables?: (type: IntegrationType, params: IntegrationConnectionParams) => Promise<TableInfo[]>;
  onClose: () => void;
}

export function IntegrationsModal({
  integrations,
  onConnect,
  onDisconnect,
  onSync,
  onTest,
  onGetTables,
  onClose,
}: IntegrationsModalProps) {
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [showConnectionForm, setShowConnectionForm] = useState(false);
  const [instanceName, setInstanceName] = useState('');

  // Update selectedIntegration when integrations prop changes
  useEffect(() => {
    if (selectedIntegration) {
      const updatedIntegration = integrations.find(int => int.type === selectedIntegration.type);
      if (updatedIntegration) {
        setSelectedIntegration(updatedIntegration);
      }
    }
  }, [integrations, selectedIntegration]);

  const handleAddInstanceClick = (integration: Integration) => {
    setSelectedIntegration(integration);
    setInstanceName('');
    setShowConnectionForm(true);
  };

  const handleFormSave = (params: IntegrationConnectionParams, selectedTables?: string[]) => {
    if (!instanceName.trim()) {
      alert('Please provide an instance name');
      return;
    }
    onConnect(selectedIntegration!.type, instanceName.trim(), params, selectedTables);
    setShowConnectionForm(false);
    setSelectedIntegration(null);
    setInstanceName('');
  };

  const handleFormTest = async (params: IntegrationConnectionParams) => {
    if (onTest && selectedIntegration) {
      return await onTest(selectedIntegration.type, params);
    }
    return false;
  };

  const handleFormGetTables = async (params: IntegrationConnectionParams) => {
    if (onGetTables && selectedIntegration) {
      return await onGetTables(selectedIntegration.type, params);
    }
    return [];
  };

  const handleDisconnect = async (databaseName: string) => {

    await onDisconnect(databaseName);
  };

  const handleSync = async (databaseName: string) => {
    if (onSync) {
      await onSync(databaseName);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-xl bg-white dark:bg-slate-900 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="integrations-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-6 py-4">
          <div>
            <h2 id="integrations-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Manage Integrations
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Connect multiple instances of your data sources
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="grid grid-cols-2 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
          {/* Integration List */}
          <div className="border-r border-slate-200 dark:border-slate-700 p-4">
            <div className="space-y-2">
              {integrations.map((integration) => {
                const metadata = INTEGRATION_METADATA[integration.type];
                const isSelected = selectedIntegration?.type === integration.type;

                return (
                  <button
                    key={integration.type}
                    onClick={() => setSelectedIntegration(integration)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors',
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-800'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                    )}
                  >
                    <div className="text-2xl">{metadata.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {metadata.name}
                        </span>
                        {integration.instances.some(inst => inst.status === 'connected') && (
                          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                        )}
                        {integration.instances.some(inst => inst.status === 'error') && (
                          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {integration.instances.length === 0 && <span>No instances</span>}
                        {integration.instances.length === 1 && <span>1 instance</span>}
                        {integration.instances.length > 1 && <span>{integration.instances.length} instances</span>}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Integration Details */}
          <div className="p-6">
            {selectedIntegration ? (
              <IntegrationDetails
                integration={selectedIntegration}
                onAddInstance={() => handleAddInstanceClick(selectedIntegration)}
                onDisconnect={handleDisconnect}
                onSync={handleSync}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-slate-500 dark:text-slate-400">
                <div className="text-center">
                  <Plug className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
                  <p className="mt-4">Select an integration to manage instances</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Connection Form Modal */}
        {showConnectionForm && selectedIntegration && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl bg-white dark:bg-slate-900 shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{INTEGRATION_METADATA[selectedIntegration.type].icon}</span>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      Add {INTEGRATION_METADATA[selectedIntegration.type].name} Instance
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Configure a new data source connection
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowConnectionForm(false);
                    setInstanceName('');
                  }}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 88px)' }}>
                {/* Instance Name Field */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Instance Name *
                  </label>
                  <input
                    type="text"
                    value={instanceName}
                    onChange={(e) => setInstanceName(e.target.value)}
                    placeholder="e.g., Production Database, Dev Environment"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Choose a descriptive name to identify this connection
                  </p>
                </div>

                {/* Connection Form */}
                <ConnectionForm
                  integrationType={selectedIntegration.type}
                  integrationName={INTEGRATION_METADATA[selectedIntegration.type].name}
                  currentParams={{}}
                  availableTables={[]}
                  selectedTables={[]}
                  onSave={handleFormSave}
                  onCancel={() => {
                    setShowConnectionForm(false);
                    setInstanceName('');
                  }}
                  onTest={handleFormTest}
                  onGetTables={onGetTables ? handleFormGetTables : undefined}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function IntegrationDetails({
  integration,
  onAddInstance,
  onDisconnect,
  onSync,
}: {
  integration: Integration;
  onAddInstance: () => void;
  onDisconnect: (databaseName: string) => Promise<void>;
  onSync?: (databaseName: string) => Promise<void>;
}) {
  const metadata = INTEGRATION_METADATA[integration.type];
  const [syncingInstances, setSyncingInstances] = useState<Set<string>>(new Set());
  const [deletingInstances, setDeletingInstances] = useState<Set<string>>(new Set());

  const handleSync = async (instance: IntegrationInstance) => {
    if (onSync) {
      setSyncingInstances(prev => new Set(prev).add(instance.databaseName));
      try {
        await onSync(instance.databaseName);
      } catch (error) {
        console.error('Sync error:', error);
      } finally {
        setSyncingInstances(prev => {
          const next = new Set(prev);
          next.delete(instance.databaseName);
          return next;
        });
      }
    }
  };

  const handleDelete = async (instance: IntegrationInstance) => {
    if (onDisconnect) {
      setDeletingInstances(prev => new Set(prev).add(instance.databaseName));
      try {
        await onDisconnect(instance.databaseName);
      } catch (error) {
        console.error('Delete error:', error);
      } finally {
        setDeletingInstances(prev => {
          const next = new Set(prev);
          next.delete(instance.databaseName);
          return next;
        });
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-5xl">{metadata.icon}</div>
          <div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              {metadata.name}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {integration.instances.length} instances configured
            </p>
          </div>
        </div>
        <button
          onClick={onAddInstance}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
        >
          <Plus className="h-4 w-4" />
          Add Instance
        </button>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <h4 className="font-medium text-slate-900 dark:text-slate-100">About</h4>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {getIntegrationDescription(integration.type)}
        </p>
      </div>

      {/* Instances */}
      <div className="space-y-3">
        <h4 className="font-medium text-slate-900 dark:text-slate-100">Instances</h4>
        {integration.instances.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 p-6 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No instances configured. Click "Add Instance" to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {integration.instances.map((instance) => (
              <div
                key={instance.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 p-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {instance.name}
                    </span>
                    {instance.status === 'connected' && (
                      <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                    )}
                    {instance.status === 'error' && (
                      <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    )}
                    {instance.status === 'connecting' && (
                      <RefreshCw className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {instance.status === 'connected' && instance.lastSync && (
                      <span>Last synced {formatRelativeTime(instance.lastSync)}</span>
                    )}
                    {instance.status === 'connected' && instance.itemCount !== undefined && (
                      <span> • {instance.itemCount} items</span>
                    )}
                    {instance.status === 'error' && instance.errorMessage && (
                      <span className="text-red-600 dark:text-red-400">{instance.errorMessage}</span>
                    )}
                    {instance.status === 'not-connected' && <span>Not connected</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {instance.status === 'connected' && onSync && (
                    <button
                      onClick={() => handleSync(instance)}
                      disabled={syncingInstances.has(instance.databaseName)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                      title="Sync"
                    >
                      <RefreshCw className={cn(
                        "h-4 w-4",
                        syncingInstances.has(instance.databaseName) && "animate-spin"
                      )} />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(instance)}
                    disabled={deletingInstances.has(instance.databaseName)}
                    className="rounded p-1 text-slate-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete"
                  >
                    {deletingInstances.has(instance.databaseName) ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getIntegrationDescription(type: IntegrationType): string {
  const descriptions = {
    'sharepoint': 'Connect to Microsoft SharePoint to access documents, libraries, and contract files stored in your organization.',
    'dropbox': 'Access contract files and documents stored in your Dropbox cloud storage.',
    'postgresql': 'Connect to PostgreSQL databases containing contract metadata, client information, and legal data.',
    'salesforce': 'Integrate with Salesforce CRM to access contract records, opportunities, and client relationships.',
    'elasticsearch': 'Connect to Elasticsearch clusters for advanced full-text search and document analysis.',
    'solr': 'Access Apache Solr search platforms for indexed legal documents and contract search capabilities.',
    'github': 'Connect to GitHub repositories containing legal templates, contract versions, and documentation.',
    'gitlab': 'Access GitLab repositories with legal documents, contract templates, and compliance documentation.',
    'notion': 'Integrate with Notion workspaces containing legal knowledge bases, contract databases, and team documentation.',
    'email': 'Connect to email systems to analyze contract-related communications and agreement exchanges.',
    'snowflake': 'Connect to Snowflake data warehouse to query and analyze contract metadata at scale.',
  };

  return descriptions[type] || 'Connect this data source to enhance your contract analysis.';
}