#!/usr/bin/env node

// Parse args early, before importing config (which throws on missing env vars)
const args = process.argv.slice(2);

async function main(): Promise<void> {
  console.log('🗓️  Microsoft Teams Shifts → Google Calendar Sync');
  console.log('━'.repeat(50) + '\n');

  // Handle --help before anything else
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  // Handle --doctor before importing config (doctor loads env vars itself)
  if (args.includes('--doctor')) {
    const { runDoctor } = await import('./doctor.js');
    const success = await runDoctor();
    process.exit(success ? 0 : 1);
  }

  // Now safe to import config (will throw if env vars missing)
  const { config } = await import('./config.js');
  const { SyncService } = await import('./services/syncService.js');

  const dryRun = args.includes('--dry-run') || args.includes('-n');

  try {
    const syncService = new SyncService(config);

    // Authenticate with both services
    await syncService.authenticate();

    // Run the sync
    const result = await syncService.sync({ dryRun });

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

    console.error('\nRun "npm run doctor" to diagnose issues.');
    process.exit(1);
  }
}

function printHelp(): void {
  console.log(`
Usage: npm run sync [options]

Options:
  -h, --help     Show this help message
  -n, --dry-run  Show what would be synced without making changes
  --doctor       Run diagnostics to check configuration

Commands:
  npm run sync      Run the sync
  npm run doctor    Check configuration and diagnose issues

Environment Variables:
  AZURE_TENANT_ID         Azure AD tenant ID (required)
  AZURE_CLIENT_ID         Azure AD application ID (required)
  AZURE_TEAM_ID           Team ID for Shifts (required)
  GOOGLE_CALENDAR_ID      Target calendar ID (default: primary)
  GOOGLE_CREDENTIALS_PATH Path to Google OAuth credentials (default: ./credentials.json)
  SYNC_DAYS_AHEAD         Number of days to sync (default: 30)
  DEFAULT_EVENT_TITLE     Fallback event title (default: Work Shift)
  DEFAULT_EVENT_COLOR     Google Calendar color ID 1-11 (default: 9)
  USE_TEAMS_COLORS        Use Teams shift colors (default: false)
  STATE_FILE_PATH         Path to sync state file (default: ./sync-state.json)

First-time setup:
  1. Create an Azure AD app registration with Schedule.Read.All permission
  2. Find your Team ID from the team link in Microsoft Teams
  3. Create a Google Cloud project with Calendar API enabled
  4. Download OAuth 2.0 credentials as credentials.json
  5. Create a .env file with required variables
  6. Run 'npm run doctor' to verify configuration
  7. Run 'npm run sync' to authenticate and start syncing

For scheduled syncing, add a cron job:
  0 * * * * cd /path/to/project && npm run sync >> sync.log 2>&1
`);
}

main();
