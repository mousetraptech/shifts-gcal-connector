import { access, constants, readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { config as loadEnv } from 'dotenv';

// Load .env but don't import config.ts (which throws on missing vars)
loadEnv();

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function fileReadable(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function fileWritable(path: string): Promise<boolean> {
  try {
    await access(path, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

async function dirWritable(path: string): Promise<boolean> {
  try {
    const dir = dirname(path);
    await access(dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function getEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

async function checkEnvVars(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const required = [
    { name: 'AZURE_TENANT_ID', value: process.env.AZURE_TENANT_ID },
    { name: 'AZURE_CLIENT_ID', value: process.env.AZURE_CLIENT_ID },
    { name: 'AZURE_TEAM_ID', value: process.env.AZURE_TEAM_ID },
  ];

  const missing = required.filter((r) => !r.value);

  if (missing.length === 0) {
    results.push({
      name: 'Required env vars',
      status: 'pass',
      message: 'All required environment variables are set',
    });
  } else {
    results.push({
      name: 'Required env vars',
      status: 'fail',
      message: `Missing: ${missing.map((m) => m.name).join(', ')}`,
    });
  }

  return results;
}

async function checkGoogleCredentials(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const credPath = resolve(getEnv('GOOGLE_CREDENTIALS_PATH', './credentials.json'));

  if (!(await fileExists(credPath))) {
    results.push({
      name: 'Google credentials',
      status: 'fail',
      message: `File not found: ${credPath}`,
    });
    return results;
  }

  if (!(await fileReadable(credPath))) {
    results.push({
      name: 'Google credentials',
      status: 'fail',
      message: `File not readable: ${credPath}`,
    });
    return results;
  }

  // Validate JSON structure
  try {
    const content = await readFile(credPath, 'utf-8');
    const creds = JSON.parse(content);

    // Google OAuth credentials have either 'installed' or 'web' key
    const oauthConfig = creds.installed || creds.web;
    if (!oauthConfig) {
      results.push({
        name: 'Google credentials',
        status: 'fail',
        message: `Invalid format: missing 'installed' or 'web' key in ${credPath}`,
      });
      return results;
    }

    // Check required fields
    const missing: string[] = [];
    if (!oauthConfig.client_id) missing.push('client_id');
    if (!oauthConfig.client_secret) missing.push('client_secret');
    if (!oauthConfig.redirect_uris) missing.push('redirect_uris');

    if (missing.length > 0) {
      results.push({
        name: 'Google credentials',
        status: 'fail',
        message: `Invalid format: missing ${missing.join(', ')} in ${credPath}`,
      });
      return results;
    }

    results.push({
      name: 'Google credentials',
      status: 'pass',
      message: `Found: ${credPath}`,
    });
  } catch (error: any) {
    results.push({
      name: 'Google credentials',
      status: 'fail',
      message: `Invalid JSON in ${credPath}: ${error.message}`,
    });
  }

  return results;
}

async function checkGoogleToken(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const tokenPath = resolve(getEnv('GOOGLE_TOKEN_PATH', './google-token.json'));

  if (!(await fileExists(tokenPath))) {
    if (!(await dirWritable(tokenPath))) {
      results.push({
        name: 'Google token',
        status: 'fail',
        message: `Not found and parent directory not writable: ${tokenPath}`,
      });
    } else {
      results.push({
        name: 'Google token',
        status: 'warn',
        message: `Not found (will prompt on first sync): ${tokenPath}`,
      });
    }
  } else if (!(await fileReadable(tokenPath))) {
    results.push({
      name: 'Google token',
      status: 'fail',
      message: `File not readable: ${tokenPath}`,
    });
  } else if (!(await fileWritable(tokenPath))) {
    results.push({
      name: 'Google token',
      status: 'fail',
      message: `File not writable (token refresh will fail): ${tokenPath}`,
    });
  } else {
    results.push({
      name: 'Google token',
      status: 'pass',
      message: `Found: ${tokenPath}`,
    });
  }

  return results;
}

async function checkMicrosoftToken(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const tokenPath = resolve(getEnv('TOKEN_CACHE_PATH', './token-cache.json'));

  if (!(await fileExists(tokenPath))) {
    if (!(await dirWritable(tokenPath))) {
      results.push({
        name: 'Microsoft token',
        status: 'fail',
        message: `Not found and parent directory not writable: ${tokenPath}`,
      });
    } else {
      results.push({
        name: 'Microsoft token',
        status: 'warn',
        message: `Not found (will prompt on first sync): ${tokenPath}`,
      });
    }
  } else if (!(await fileReadable(tokenPath))) {
    results.push({
      name: 'Microsoft token',
      status: 'fail',
      message: `File not readable: ${tokenPath}`,
    });
  } else if (!(await fileWritable(tokenPath))) {
    results.push({
      name: 'Microsoft token',
      status: 'fail',
      message: `File not writable (token refresh will fail): ${tokenPath}`,
    });
  } else {
    results.push({
      name: 'Microsoft token',
      status: 'pass',
      message: `Found: ${tokenPath}`,
    });
  }

  return results;
}

async function checkStateFile(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const statePath = resolve(getEnv('STATE_FILE_PATH', './sync-state.json'));

  if (!(await fileExists(statePath))) {
    if (!(await dirWritable(statePath))) {
      results.push({
        name: 'State file',
        status: 'fail',
        message: `Not found and parent directory not writable: ${statePath}`,
      });
    } else {
      results.push({
        name: 'State file',
        status: 'warn',
        message: `Not found (will be created on first sync): ${statePath}`,
      });
    }
  } else if (!(await fileReadable(statePath))) {
    results.push({
      name: 'State file',
      status: 'fail',
      message: `File not readable: ${statePath}`,
    });
  } else if (!(await fileWritable(statePath))) {
    results.push({
      name: 'State file',
      status: 'fail',
      message: `File not writable: ${statePath}`,
    });
  } else {
    results.push({
      name: 'State file',
      status: 'pass',
      message: `Found: ${statePath}`,
    });
  }

  return results;
}

async function checkConfig(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Check SYNC_DAYS_AHEAD is reasonable
  const daysAheadRaw = getEnv('SYNC_DAYS_AHEAD', '30');
  const daysAhead = parseInt(daysAheadRaw, 10);

  if (isNaN(daysAhead) || daysAhead < 0) {
    results.push({
      name: 'SYNC_DAYS_AHEAD',
      status: 'fail',
      message: `Invalid value "${daysAheadRaw}" - must be a non-negative integer`,
    });
  } else if (daysAhead < 1) {
    results.push({
      name: 'SYNC_DAYS_AHEAD',
      status: 'warn',
      message: `Value is ${daysAhead} - no shifts will be synced`,
    });
  } else if (daysAhead > 365) {
    results.push({
      name: 'SYNC_DAYS_AHEAD',
      status: 'warn',
      message: `Value is ${daysAhead} - this may be slow`,
    });
  } else {
    results.push({
      name: 'SYNC_DAYS_AHEAD',
      status: 'pass',
      message: `${daysAhead} days`,
    });
  }

  // Check color is valid
  const colorRaw = getEnv('DEFAULT_EVENT_COLOR', '9');
  const colorNum = parseInt(colorRaw, 10);
  if (isNaN(colorNum) || colorNum < 1 || colorNum > 11) {
    results.push({
      name: 'DEFAULT_EVENT_COLOR',
      status: 'fail',
      message: `Invalid value "${colorRaw}" - must be 1-11`,
    });
  } else {
    results.push({
      name: 'DEFAULT_EVENT_COLOR',
      status: 'pass',
      message: `Color ID ${colorRaw}`,
    });
  }

  return results;
}

export async function runDoctor(): Promise<boolean> {
  console.log('🩺 Running diagnostics...\n');

  const allResults: CheckResult[] = [];

  // Run all checks
  allResults.push(...(await checkEnvVars()));
  allResults.push(...(await checkGoogleCredentials()));
  allResults.push(...(await checkGoogleToken()));
  allResults.push(...(await checkMicrosoftToken()));
  allResults.push(...(await checkStateFile()));
  allResults.push(...(await checkConfig()));

  // Print results
  const statusIcon = {
    pass: '✅',
    fail: '❌',
    warn: '⚠️ ',
  };

  for (const result of allResults) {
    console.log(`${statusIcon[result.status]} ${result.name}`);
    console.log(`   ${result.message}\n`);
  }

  // Summary
  const failures = allResults.filter((r) => r.status === 'fail');
  const warnings = allResults.filter((r) => r.status === 'warn');

  console.log('━'.repeat(50));
  if (failures.length === 0 && warnings.length === 0) {
    console.log('✅ All checks passed!');
    return true;
  } else if (failures.length === 0) {
    console.log(`⚠️  ${warnings.length} warning(s), but ready to sync`);
    return true;
  } else {
    console.log(`❌ ${failures.length} issue(s) must be fixed before syncing`);
    return false;
  }
}
