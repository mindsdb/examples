// Default configuration for the application

import { UserPreferences, Integration } from './types';

// Default user preferences
export const defaultPreferences: UserPreferences = {
  theme: 'dark',
  density: 'comfortable',
  reducedMotion: false,
  largeText: false,
  autoSave: true,
  notificationsEnabled: true,
  defaultView: 'all',
};

// Available integrations (templates for users to connect)
// These are NOT connected by default - users must configure them
export const availableIntegrations: Integration[] = [
  {
    type: 'sharepoint',
    name: 'SharePoint',
    icon: '📊',
    instances: [],
  },
  {
    type: 'dropbox',
    name: 'Dropbox',
    icon: '📦',
    instances: [],
  },
  {
    type: 'postgresql',
    name: 'PostgreSQL',
    icon: '🐘',
    instances: [],
  },
  {
    type: 'salesforce',
    name: 'Salesforce',
    icon: '☁️',
    instances: [],
  },
  {
    type: 'elasticsearch',
    name: 'ElasticSearch',
    icon: '🔍',
    instances: [],
  },
  {
    type: 'github',
    name: 'GitHub',
    icon: '🐙',
    instances: [],
  },
  {
    type: 'gitlab',
    name: 'GitLab',
    icon: '🦊',
    instances: [],
  },
  {
    type: 'notion',
    name: 'Notion',
    icon: '📝',
    instances: [],
  },
  {
    type: 'snowflake',
    name: 'Snowflake',
    icon: '❄️',
    instances: [],
  },
  {
    type: 'email',
    name: 'Email',
    icon: '✉️',
    instances: [],
  },
  {
    type: 'solr',
    name: 'Solr',
    icon: '🔎',
    instances: [],
  },
];
