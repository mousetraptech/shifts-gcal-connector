#!/usr/bin/env node

import { config } from './config.js';
import { SyncService } from './services/syncService.js';

async function main(): Promise<void> {
  console.log('🗓️  Microsoft Teams Shifts → Google Calendar Sync');
  console.log('━'.repeat(50) + '\n');

  const args = process.argv.slice(2);

  // Parse command line arguments
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  try {
    const syncService = new SyncService(config);

    // Authenticate with both services
    await syncService.authenticate();

    // Run the sync
    const result = await syncService.sync();

    // Exit with error code if there were errors
    if (result.errors.length > 0) {
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);

    if (error.message.includes('AZURE_TENANT_ID') || error.message.includes('AZURE_CLIENT_ID')) {
      console.error('\nMake sure you have configured your .env file with Azure AD credentials.');
      console.error('See README.md for setup instructions.');
    }

    if (error.message.includes('credentials.json')) {
      console.error('\nMake sure you have downloaded Google OAuth credentials.');
      console.error('See README.md for setup instructions.');
    }

    process.exit(1);
  }
}

function printHelp(): void {
  console.log(`
Usage: npm run sync [options]

Options:
  -h, --help     Show this help message

Environment Variables:
  AZURE_TENANT_ID         Azure AD tenant ID (required)
  AZURE_CLIENT_ID         Azure AD application ID (required)
  GOOGLE_CALENDAR_ID      Target calendar ID (default: primary)
  GOOGLE_CREDENTIALS_PATH Path to Google OAuth credentials (default: ./credentials.json)
  SYNC_DAYS_AHEAD         Number of days to sync (default: 30)
  STATE_FILE_PATH         Path to sync state file (default: ./sync-state.json)

First-time setup:
  1. Create an Azure AD app registration with Schedule.Read.All permission
  2. Create a Google Cloud project with Calendar API enabled
  3. Download OAuth 2.0 credentials as credentials.json
  4. Create a .env file with required variables
  5. Run 'npm run sync' to authenticate and start syncing

For scheduled syncing, add a cron job:
  0 * * * * cd /path/to/project && npm run sync >> sync.log 2>&1
`);
}

main();
