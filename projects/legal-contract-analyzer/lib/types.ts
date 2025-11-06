// Core type definitions for Legal Contract Intelligence chatbot

export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageStatus = 'sending' | 'sent' | 'error' | 'streaming';
export type RiskLevel = 'low' | 'medium' | 'high';
export type RiskCategory = 'liability' | 'indemnity' | 'termination' | 'data-privacy' | 'ip' | 'renewal' | 'force-majeure' | 'payment';
export type IntegrationStatus = 'not-connected' | 'connecting' | 'connected' | 'error';
export type DataScope = 'internal' | 'external-vendor' | 'pii-present';
export type ThemeMode = 'light' | 'dark' | 'high-contrast';
export type DensityMode = 'comfortable' | 'compact';

export type IntegrationType = 
  | 'sharepoint' 
  | 'dropbox' 
  | 'snowflake' 
  | 'notion' 
  | 'email' 
  | 'elasticsearch' 
  | 'solr' 
  | 'github' 
  | 'gitlab' 
  | 'salesforce' 
  | 'postgresql';

export interface SourceChip {
  id: string;
  type: IntegrationType;
  name: string;
  url?: string;
  metadata?: Record<string, any>;
}

export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  pages?: number;
  uploadProgress?: number;
  status: 'pending' | 'uploading' | 'analyzing' | 'complete' | 'error';
  errorMessage?: string;
}

export interface ClauseData {
  id: string;
  title: string;
  content: string;
  severity: RiskLevel;
  category: RiskCategory;
  section: string;
  sources: SourceChip[];
  confidence?: number;
}

export interface RiskDistribution {
  category: RiskCategory;
  count: number;
  percentage: number;
}

export interface ComparisonRow {
  clauseType: string;
  contract1: string;
  contract2: string;
  contract3?: string;
  differences: string[];
}

export interface ExpiryItem {
  contractId: string;
  contractName: string;
  expiryDate: Date;
  daysRemaining: number;
  party: string;
  value?: string;
  autoRenew: boolean;
}

export interface EvaluationMetrics {
  mrr: number; // Mean Reciprocal Rank
  hitAt5: number;
  relevancy: number;
  explanation?: string;
}

export interface EmailAction {
  type: 'send' | 'schedule';
  label: string;
  recipients?: string[];
  subject: string;
  body: string;
  scheduledTime?: Date;
  status?: 'ready' | 'sending' | 'sent' | 'error';
}

export interface MessageContent {
  text?: string;
  metadata?: Record<string, any>; // Additional metadata like streaming info, context length, etc.
  riskScore?: {
    score: number;
    level: RiskLevel;
    breakdown: RiskDistribution[];
  };
  riskDistribution?: RiskDistribution[];
  clauses?: ClauseData[];
  comparison?: ComparisonRow[];
  expiryTimeline?: ExpiryItem[];
  sources?: SourceChip[];
  evaluation?: EvaluationMetrics;
  attachments?: FileAttachment[];
  emailActions?: EmailAction[];
}

export interface Message {
  id: string;
  role: MessageRole;
  content: MessageContent;
  timestamp: Date;
  status: MessageStatus;
  parentId?: string; // for threaded replies
  isPinned?: boolean;
  reactions?: Record<string, string[]>; // emoji -> userIds
  scope?: DataScope;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  isPinned?: boolean;
  hasUnread?: boolean;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface TableInfo {
  name: string;
  schema?: string;
  rowCount?: number;
  columns?: string[];
  description?: string;
}

export interface IntegrationConnectionParams {
  // SharePoint
  clientId?: string;
  clientSecret?: string;
  tenantId?: string;
  
  // Dropbox
  access_token?: string;
  
  // PostgreSQL
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  schema?: string;
  
  // Salesforce
  username?: string;
  client_id?: string;
  
  // ElasticSearch
  cloud_id?: string;
  hosts?: string;
  api_key?: string;
  
  // Solr
  server_path?: string;
  collection?: string;
  use_ssl?: boolean;
  
  // GitHub/GitLab
  repository?: string;
  
  // Notion
  api_token?: string;
  
  // Email
  email?: string;
  
  // Snowflake
  account?: string;
  warehouse?: string;
  
  // Generic fields
  [key: string]: string | number | boolean | string[] | undefined;
}

export interface IntegrationInstance {
  id: string; // Unique identifier for this instance
  name: string; // User-defined name for this instance (e.g., "Production DB", "Staging GitHub")
  databaseName: string; // MindsDB database name
  status: IntegrationStatus;
  lastSync?: Date;
  itemCount?: number;
  scopedPath?: string;
  errorMessage?: string;
  connectionParams?: IntegrationConnectionParams;
  enabled?: boolean;
  description?: string;
  tags?: string[];
  availableTables?: TableInfo[];
  selectedTables?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Integration {
  type: IntegrationType;
  name: string;
  icon: string;
  instances: IntegrationInstance[]; // Array of instances for this integration type
}

export interface SavedView {
  id: string;
  name: string;
  description?: string;
  messageIds: string[];
  conversationId: string;
  createdAt: Date;
  tags?: string[];
}

export interface ContractMetadata {
  id: string;
  name: string;
  type: string;
  parties: string[];
  jurisdiction: string;
  effectiveDate?: Date;
  expiryDate?: Date;
  value?: string;
  source: SourceChip;
  riskScore?: number;
  status: 'active' | 'expired' | 'draft' | 'terminated';
}

export interface Filter {
  id: string;
  type: 'contract-type' | 'party' | 'jurisdiction' | 'date-range' | 'value' | 'source' | 'risk-level';
  label: string;
  value: any;
  active: boolean;
}

export interface UserPreferences {
  theme: ThemeMode;
  density: DensityMode;
  reducedMotion: boolean;
  largeText: boolean;
  autoSave: boolean;
  notificationsEnabled: boolean;
  defaultView: 'all' | 'pinned' | 'recent';
  customLogo?: string;
  primaryColor?: string;
}

export interface AppState {
  conversations: Conversation[];
  activeConversationId?: string;
  integrations: Integration[];
  savedViews: SavedView[];
  filters: Filter[];
  preferences: UserPreferences;
  activeTenant?: string;
  selectedContract?: ContractMetadata;
  selectedClause?: ClauseData;
}

export interface QuickPrompt {
  id: string;
  label: string;
  prompt: string;
  icon?: string;
  category?: 'search' | 'analysis' | 'compliance' | 'monitoring';
  action?: 'sendMessage' | 'analyzeRisks' | 'getTimeline' | 'getMetrics';  // New action type
}
export const QUICK_PROMPTS: QuickPrompt[] = [
  {
    id: '1',
    label: 'Analyze contract risks',
    prompt: 'Analyze the risk levels and categories across all contracts',
    category: 'analysis',
    action: 'analyzeRisks',
  },
  {
    id: '2',
    label: 'Contract timeline & renewals',
    prompt: 'Show upcoming contract renewals and important deadlines',
    category: 'monitoring', 
    action: 'getTimeline',
  },
  {
    id: '3',
    label: 'Portfolio metrics',
    prompt: 'Display contract portfolio statistics and key metrics',
    category: 'analysis',
    action: 'getMetrics',
  },
  {
    id: '4',
    label: 'Contracts with force majeure?',
    prompt: 'Find all contracts that contain force majeure clauses',
    category: 'search',
    action: 'sendMessage',
  },
  {
    id: '5',
    label: 'Data-sharing clauses?',
    prompt: 'Show me NDAs and trial agreements with data-sharing provisions',
    category: 'compliance',
    action: 'sendMessage',
  },
  {
    id: '6',
    label: 'High-risk liability clauses',
    prompt: 'Identify contracts with concerning liability or indemnification terms',
    category: 'analysis',
    action: 'analyzeRisks',
  },
  {
    id: '7',
    label: 'Contracts expiring Q1 2026?',
    prompt: 'Show all contracts expiring in Q1 2026',
    category: 'monitoring',
    action: 'getTimeline',
  },
];

// Slash commands removed: composer uses explicit UI controls for uploads and quick prompts

// Knowledge Base Management Types
export interface KBRow {
  id?: string;
  chunk_id?: string;
  chunk_content: string;
  metadata?: Record<string, any>;
  created_at?: string;
  distance?: number;
  relevance?: number;
}

export interface KBQueryResponse {
  rows: KBRow[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_more: boolean;
}

export const INTEGRATION_METADATA: Record<IntegrationType, { name: string; icon: string; color: string }> = {
  'sharepoint': { name: 'SharePoint', icon: '📊', color: '#0078D4' },
  'dropbox': { name: 'Dropbox', icon: '📦', color: '#0061FF' },
  'snowflake': { name: 'Snowflake', icon: '❄️', color: '#29B5E8' },
  'notion': { name: 'Notion', icon: '📝', color: '#000000' },
  'email': { name: 'Email', icon: '✉️', color: '#EA4335' },
  'elasticsearch': { name: 'ElasticSearch', icon: '🔍', color: '#005571' },
  'solr': { name: 'Solr', icon: '🔎', color: '#D9411E' },
  'github': { name: 'GitHub', icon: '🐙', color: '#181717' },
  'gitlab': { name: 'GitLab', icon: '🦊', color: '#FC6D26' },
  'salesforce': { name: 'Salesforce', icon: '☁️', color: '#00A1E0' },
  'postgresql': { name: 'PostgreSQL', icon: '🐘', color: '#4169E1' },
};
