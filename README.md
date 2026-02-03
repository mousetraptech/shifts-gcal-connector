# Microsoft Teams Shifts → Google Calendar Sync

Syncs your Microsoft Teams Shifts schedule to Google Calendar automatically.

## Features

- Syncs your personal shifts from a configured Team
- Creates, updates, and deletes calendar events to match your shift schedule
- Preserves shift colors (mapped to Google Calendar colors)
- Includes shift notes and activities in event descriptions
- Tracks sync state to avoid duplicate processing
- Caches authentication tokens for unattended scheduled runs

## Prerequisites

- Node.js 18 or later
- A Microsoft 365 account with Teams Shifts access
- A Google account

## Setup

### 1. Azure AD App Registration

1. Go to [Azure Portal](https://portal.azure.com) → Azure Active Directory → App registrations
2. Click **New registration**
3. Enter a name (e.g., "Shifts Calendar Sync")
4. Select **Accounts in this organizational directory only**
5. Set redirect URI to `http://localhost` (type: Public client/native)
6. Click **Register**
7. Note the **Application (client) ID** and **Directory (tenant) ID**
8. Go to **Authentication** → scroll to "Advanced settings" → set **"Allow public client flows"** to **Yes** → Save
9. Go to **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions**
10. Add `Schedule.Read.All`
11. Click **Grant admin consent** (or have your admin do this)

### 2. Find Your Team ID

1. Open Microsoft Teams
2. Right-click on the team that has your Shifts schedule
3. Click **"Get link to team"**
4. The URL will look like: `https://teams.microsoft.com/l/team/...?groupId=<TEAM-ID>&tenantId=...`
5. Copy the `groupId` value - this is your Team ID

### 3. Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Enable the **Google Calendar API**
4. Go to **APIs & Services** → **Credentials**
5. Click **Create Credentials** → **OAuth client ID**
6. Select **Desktop app** as application type
7. Download the credentials JSON file
8. Rename it to `credentials.json` and place it in the project root

### 4. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_TEAM_ID=your-team-id
```

### 5. Install & Build

```bash
npm install
npm run build
```

## Usage

### First Run

On first run, you'll be prompted to authenticate with both Microsoft and Google:

```bash
npm run sync
```

1. A device code will be displayed for Microsoft - visit the URL and enter the code
2. A URL will be displayed for Google - visit it, authorize, and paste the code back

Tokens are saved locally for future runs (no re-authentication needed).

### Scheduled Sync

Add a cron job to sync automatically. First, find your npm path:

```bash
which npm
```

Then edit crontab:

```bash
crontab -e
```

Add one of these (adjust the npm path as needed):

```bash
# Every hour
0 * * * * cd /path/to/shifts-gcal-connector && /usr/local/bin/npm run sync >> sync.log 2>&1

# Every 15 minutes
*/15 * * * * cd /path/to/shifts-gcal-connector && /usr/local/bin/npm run sync >> sync.log 2>&1

# Twice daily (8am and 6pm)
0 8,18 * * * cd /path/to/shifts-gcal-connector && /usr/local/bin/npm run sync >> sync.log 2>&1
```

Verify with:

```bash
crontab -l
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `AZURE_TENANT_ID` | (required) | Azure AD tenant ID |
| `AZURE_CLIENT_ID` | (required) | Azure AD application ID |
| `AZURE_TEAM_ID` | (required) | Team ID containing your Shifts schedule |
| `GOOGLE_CALENDAR_ID` | `primary` | Target Google Calendar |
| `GOOGLE_CREDENTIALS_PATH` | `./credentials.json` | Path to Google OAuth credentials |
| `GOOGLE_TOKEN_PATH` | `./google-token.json` | Path to Google token cache |
| `TOKEN_CACHE_PATH` | `./token-cache.json` | Path to Microsoft token cache |
| `SYNC_DAYS_AHEAD` | `30` | Number of days to sync |
| `STATE_FILE_PATH` | `./sync-state.json` | Path to sync state file |

## How It Works

1. Fetches your shifts from the configured Team
2. Compares with previously synced shifts (stored in `sync-state.json`)
3. Creates new calendar events for new shifts
4. Updates events for modified shifts
5. Deletes events for removed shifts

## Troubleshooting

**"Team not found or Shifts not enabled for this team"**
- Verify your `AZURE_TEAM_ID` is correct
- Check that Shifts is enabled for your team

**"Could not load Google credentials"**
- Ensure `credentials.json` is in the project root
- Verify it's a valid OAuth 2.0 client credentials file

**Microsoft authentication errors**
- Delete `token-cache.json` and re-authenticate
- Verify your Azure AD app has "Allow public client flows" enabled
- Check that `Schedule.Read.All` permission has admin consent

**Google authentication errors**
- Delete `google-token.json` and re-authenticate

**Shifts not syncing after deletion in Google Calendar**
- Delete `sync-state.json` and run sync again to recreate all events

## License

MIT
