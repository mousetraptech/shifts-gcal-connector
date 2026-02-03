import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import type { Config } from './types/index.js';

loadEnv();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

export function loadConfig(): Config {
  return {
    azure: {
      tenantId: requireEnv('AZURE_TENANT_ID'),
      clientId: requireEnv('AZURE_CLIENT_ID'),
      teamId: requireEnv('AZURE_TEAM_ID'),
    },
    google: {
      calendarId: optionalEnv('GOOGLE_CALENDAR_ID', 'primary'),
      credentialsPath: resolve(optionalEnv('GOOGLE_CREDENTIALS_PATH', './credentials.json')),
      tokenPath: resolve(optionalEnv('GOOGLE_TOKEN_PATH', './google-token.json')),
    },
    sync: {
      daysAhead: parseInt(optionalEnv('SYNC_DAYS_AHEAD', '30'), 10),
      stateFilePath: resolve(optionalEnv('STATE_FILE_PATH', './sync-state.json')),
    },
    tokenCachePath: resolve(optionalEnv('TOKEN_CACHE_PATH', './token-cache.json')),
  };
}

export const config = loadConfig();
