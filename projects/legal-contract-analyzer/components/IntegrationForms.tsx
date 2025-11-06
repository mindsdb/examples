'use client';

import { Integration, IntegrationType, IntegrationConnectionParams, TableInfo } from '@/lib/types';
import { useState, FormEvent } from 'react';
import { X, RefreshCw, Lock, Eye, EyeOff, CheckSquare, Square } from 'lucide-react';

// Connection parameter form configurations
const CONNECTION_FORMS: Record<IntegrationType, Array<{
  name: keyof IntegrationConnectionParams;
  label: string;
  type: 'text' | 'password' | 'number' | 'email';
  required: boolean;
  placeholder?: string;
  helpText?: string;
}>> = {
  'sharepoint': [
    { name: 'clientId', label: 'Client ID', type: 'text', required: true, placeholder: 'Your Azure AD Client ID' },
    { name: 'clientSecret', label: 'Client Secret', type: 'password', required: true, placeholder: 'Your Azure AD Client Secret' },
    { name: 'tenantId', label: 'Tenant ID', type: 'text', required: true, placeholder: 'Your Azure AD Tenant ID' },
  ],
  'dropbox': [
    { name: 'access_token', label: 'Access Token', type: 'password', required: true, placeholder: 'Your Dropbox Access Token', helpText: 'Generate from Dropbox App Console' },
  ],
  'postgresql': [
    { name: 'host', label: 'Host', type: 'text', required: true, placeholder: '127.0.0.1' },
    { name: 'port', label: 'Port', type: 'number', required: true, placeholder: '5432' },
    { name: 'database', label: 'Database', type: 'text', required: true, placeholder: 'postgres' },
    { name: 'user', label: 'User', type: 'text', required: true, placeholder: 'postgres' },
    { name: 'password', label: 'Password', type: 'password', required: true },
    { name: 'schema', label: 'Schema', type: 'text', required: false, placeholder: 'public' },
  ],
  'salesforce': [
    { name: 'username', label: 'Username', type: 'text', required: true, placeholder: 'demo@example.com' },
    { name: 'password', label: 'Password', type: 'password', required: true },
    { name: 'client_id', label: 'Client ID', type: 'text', required: true, placeholder: 'Connected App Client ID' },
    { name: 'client_secret', label: 'Client Secret', type: 'password', required: true },
  ],
  'elasticsearch': [
    { name: 'cloud_id', label: 'Cloud ID (optional)', type: 'text', required: false, placeholder: 'deployment:dXMtZWFzdC0xLmF3cy5mb3VuZC5pbyQ...' },
    { name: 'hosts', label: 'Hosts (optional)', type: 'text', required: false, placeholder: 'https://xyz.es.io:9200' },
    { name: 'api_key', label: 'API Key (optional)', type: 'password', required: false, helpText: 'Use API key OR username/password' },
    { name: 'user', label: 'Username (optional)', type: 'text', required: false, placeholder: 'elastic' },
    { name: 'password', label: 'Password (optional)', type: 'password', required: false },
  ],
  'solr': [
    { name: 'host', label: 'Host', type: 'text', required: true, placeholder: '127.0.0.1' },
    { name: 'port', label: 'Port', type: 'text', required: true, placeholder: '8983' },
    { name: 'collection', label: 'Collection', type: 'text', required: true, placeholder: 'gettingstarted' },
    { name: 'server_path', label: 'Server Path', type: 'text', required: false, placeholder: 'solr' },
    { name: 'username', label: 'Username (optional)', type: 'text', required: false },
    { name: 'password', label: 'Password (optional)', type: 'password', required: false },
    { name: 'use_ssl', label: 'Use SSL', type: 'text', required: false, placeholder: 'false' },
  ],
  'github': [
    { name: 'repository', label: 'Repository', type: 'text', required: true, placeholder: 'owner/repo-name' },
    { name: 'api_key', label: 'API Key (optional)', type: 'password', required: false, helpText: 'For private repos or higher rate limits' },
  ],
  'gitlab': [
    { name: 'repository', label: 'Repository', type: 'text', required: true, placeholder: 'owner/repo-name' },
    { name: 'api_key', label: 'API Key (optional)', type: 'password', required: false, helpText: 'For private repos or higher rate limits' },
  ],
  'notion': [
    { name: 'api_token', label: 'API Token', type: 'password', required: true, placeholder: 'secret_...', helpText: 'Create from Notion Integration settings' },
  ],
  'email': [
    {
      name: 'email',
      label: 'Gmail Address',
      type: 'email',
      required: true,
      placeholder: 'your-email@gmail.com',
      helpText: 'Enter your Gmail email address'
    },
    {
      name: 'password',
      label: 'Password',
      type: 'password',
      required: true,
      placeholder: 'Enter your password',
      helpText: 'Enter your Gmail password or app-specific password (recommended for 2FA accounts)'
    },
  ],
  'snowflake': [
    { name: 'account', label: 'Account', type: 'text', required: true, placeholder: 'xy12345.us-east-1' },
    { name: 'user', label: 'User', type: 'text', required: false, placeholder: 'username' },
    { name: 'password', label: 'Password', type: 'password', required: true },
    { name: 'database', label: 'Database', type: 'text', required: true, placeholder: 'test_db' },
    { name: 'warehouse', label: 'Warehouse (optional)', type: 'text', required: false },
    { name: 'schema', label: 'Schema (optional)', type: 'text', required: false },
  ],
};

interface ConnectionFormProps {
  integrationType: IntegrationType;
  integrationName: string;
  currentParams?: IntegrationConnectionParams;
  availableTables?: TableInfo[];
  selectedTables?: string[];
  onSave: (params: IntegrationConnectionParams, selectedTables?: string[]) => void;
  onCancel: () => void;
  onTest?: (params: IntegrationConnectionParams) => Promise<boolean>;
  onGetTables?: (params: IntegrationConnectionParams) => Promise<TableInfo[]>;
}

export function ConnectionForm({
  integrationType,
  integrationName,
  currentParams = {},
  availableTables = [],
  selectedTables = [],
  onSave,
  onCancel,
  onTest,
  onGetTables,
}: ConnectionFormProps) {
  const [formData, setFormData] = useState<IntegrationConnectionParams>(currentParams);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [currentSelectedTables, setCurrentSelectedTables] = useState<string[]>(selectedTables);
  const [loadingTables, setLoadingTables] = useState(false);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [currentAvailableTables, setCurrentAvailableTables] = useState<TableInfo[]>(availableTables);

  const formFields = CONNECTION_FORMS[integrationType] || [];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave(formData, currentSelectedTables);
  };

  const handleGetTables = async () => {
    if (!onGetTables) return;

    setLoadingTables(true);
    setTablesError(null);

    try {
      const tables = await onGetTables(formData);
      setCurrentAvailableTables(tables);
    } catch (error) {
      setTablesError(error instanceof Error ? error.message : 'Failed to load tables');
    } finally {
      setLoadingTables(false);
    }
  };

  const handleTableToggle = (tableName: string) => {
    setCurrentSelectedTables(prev =>
      prev.includes(tableName)
        ? prev.filter(name => name !== tableName)
        : [...prev, tableName]
    );
  };

  const handleSelectAllTables = () => {
    if (currentSelectedTables.length === currentAvailableTables.length) {
      setCurrentSelectedTables([]);
    } else {
      setCurrentSelectedTables(currentAvailableTables.map(table => table.name));
    }
  };

  const handleTest = async () => {
    if (onTest) {
      setIsTesting(true);
      setTestResult(null);
      try {
        const success = await onTest(formData);
        setTestResult({
          success,
          message: success
            ? 'Connection successful! You can now save and connect.'
            : 'Connection failed. Please check your credentials and try again.'
        });
      } catch (error) {
        setTestResult({
          success: false,
          message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      } finally {
        setIsTesting(false);
      }
    }
  };

  const handleInputChange = (name: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const togglePasswordVisibility = (fieldName: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [fieldName]: !prev[fieldName],
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Configure {integrationName}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Enter connection parameters to connect to your data source
        </p>
      </div>

      {formFields.map((field) => (
        <div key={field.name as string} className="space-y-1">
          <label
            htmlFor={field.name as string}
            className="block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>

          <div className="relative">
            <input
              type={
                field.type === 'password' && !showPasswords[field.name as string]
                  ? 'password'
                  : field.type === 'number'
                    ? 'number'
                    : 'text'
              }
              id={field.name as string}
              name={field.name as string}
              value={(formData[field.name] as string | number) || ''}
              onChange={(e) => handleInputChange(
                field.name as string,
                field.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value
              )}
              required={field.required}
              placeholder={field.placeholder}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />

            {field.type === 'password' && (
              <button
                type="button"
                onClick={() => togglePasswordVisibility(field.name as string)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                aria-label={showPasswords[field.name as string] ? 'Hide password' : 'Show password'}
              >
                {showPasswords[field.name as string] ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            )}
          </div>

          {field.helpText && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {field.helpText}
            </p>
          )}
        </div>
      ))}

      {/* Security Notice */}
      <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3">
        <div className="flex items-start gap-2">
          <Lock className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Your credentials are stored securely and encrypted. They are only used to establish connections to your data sources.
          </p>
        </div>
      </div>

      {/* Table Selection Section */}
      {onGetTables && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Select Tables (Optional)
            </h4>
            <button
              type="button"
              onClick={handleGetTables}
              disabled={loadingTables}
              className="px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors disabled:opacity-50"
            >
              {loadingTables ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin inline mr-1" />
                  Loading...
                </>
              ) : (
                'Load Tables'
              )}
            </button>
          </div>

          {tablesError && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
              <p className="text-xs text-red-700 dark:text-red-300">
                {tablesError}
              </p>
            </div>
          )}

          {currentAvailableTables.length > 0 && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {currentSelectedTables.length} of {currentAvailableTables.length} tables selected
                </span>
                <button
                  type="button"
                  onClick={handleSelectAllTables}
                  className="text-xs text-blue-700 dark:text-blue-300 hover:underline"
                >
                  {currentSelectedTables.length === currentAvailableTables.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="max-h-32 overflow-y-auto space-y-1">
                {currentAvailableTables.map((table) => (
                  <label
                    key={table.name}
                    className="flex items-center gap-2 p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <div className="relative">
                      {currentSelectedTables.includes(table.name) ? (
                        <CheckSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Square className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                    <input
                      type="checkbox"
                      checked={currentSelectedTables.includes(table.name)}
                      onChange={() => handleTableToggle(table.name)}
                      className="sr-only"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {table.name}
                      </div>
                      {table.description && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {table.description}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-slate-500 dark:text-slate-400">
            If no tables are selected, all available tables will be used for contract analysis.
          </p>
        </div>
      )}

      {/* Test Result Display */}
      {testResult && (
        <div className={`rounded-lg border p-3 ${testResult.success
          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          }`}>
          <p className={`text-sm ${testResult.success
            ? 'text-green-700 dark:text-green-300'
            : 'text-red-700 dark:text-red-300'
            }`}>
            {testResult.message}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          Cancel
        </button>

        {onTest && (
          <button
            type="button"
            onClick={handleTest}
            disabled={isTesting}
            className="px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
          >
            {isTesting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin inline mr-2" />
                Testing...
              </>
            ) : (
              'Test Connection'
            )}
          </button>
        )}

        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition-colors"
        >
          Save & Connect
        </button>
      </div>
    </form>
  );
}

interface IntegrationFormModalProps {
  integration: Integration;
  onSave: (type: IntegrationType, params: IntegrationConnectionParams, selectedTables?: string[]) => void;
  onTest?: (type: IntegrationType, params: IntegrationConnectionParams) => Promise<boolean>;
  onGetTables?: (type: IntegrationType, params: IntegrationConnectionParams) => Promise<TableInfo[]>;
  onClose: () => void;
}

export function IntegrationFormModal({
  integration,
  onSave,
  onTest,
  onGetTables,
  onClose,
}: IntegrationFormModalProps) {
  const handleSave = (params: IntegrationConnectionParams, selectedTables?: string[]) => {
    onSave(integration.type, params, selectedTables);
  };

  const handleTest = async (params: IntegrationConnectionParams): Promise<boolean> => {
    if (onTest) {
      return await onTest(integration.type, params);
    }
    return false;
  };

  const handleGetTables = async (params: IntegrationConnectionParams): Promise<TableInfo[]> => {
    if (onGetTables) {
      return await onGetTables(integration.type, params);
    }
    return [];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl bg-white dark:bg-slate-900 shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{integration.icon}</span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {integration.name}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Data Source Connection
              </p>
            </div>
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
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 88px)' }}>
          <ConnectionForm
            integrationType={integration.type}
            integrationName={integration.name}
            currentParams={{}}
            availableTables={[]}
            selectedTables={[]}
            onSave={handleSave}
            onCancel={onClose}
            onTest={handleTest}
            onGetTables={onGetTables ? handleGetTables : undefined}
          />
        </div>
      </div>
    </div>
  );
}
