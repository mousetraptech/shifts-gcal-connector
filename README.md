# Microsoft Teams Shifts → Google Calendar Sync

Syncs your Microsoft Teams Shifts schedule to Google Calendar automatically.

## Features

- Syncs your personal shifts from all Teams you're a member of
- Creates, updates, and deletes calendar events to match your shift schedule
- Preserves shift colors (mapped to Google Calendar colors)
- Includes shift notes and activities in event descriptions
- Tracks sync state to avoid duplicate processing

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
8. Go to **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions**
9. Add `Schedule.Read.All`
10. Click **Grant admin consent** (or have your admin do this)

### 2. Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Enable the **Google Calendar API**
4. Go to **APIs & Services** → **Credentials**
5. Click **Create Credentials** → **OAuth client ID**
6. Select **Desktop app** as application type
7. Download the credentials JSON file
8. Rename it to `credentials.json` and place it in the project root

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your Azure AD credentials:

```
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Build

```bash
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

Tokens are saved locally for future runs.

### Scheduled Sync

Add a cron job to sync automatically (e.g., every hour):

```bash
crontab -e
```

Add:

```
0 * * * * cd /path/to/shifts-gcal-connector && npm run sync >> sync.log 2>&1
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `AZURE_TENANT_ID` | (required) | Azure AD tenant ID |
| `AZURE_CLIENT_ID` | (required) | Azure AD application ID |
| `GOOGLE_CALENDAR_ID` | `primary` | Target Google Calendar |
| `GOOGLE_CREDENTIALS_PATH` | `./credentials.json` | Path to Google OAuth credentials |
| `SYNC_DAYS_AHEAD` | `30` | Number of days to sync |
| `STATE_FILE_PATH` | `./sync-state.json` | Path to sync state file |

## How It Works

1. Fetches your shifts from all Teams you're a member of
2. Compares with previously synced shifts (stored in `sync-state.json`)
3. Creates new calendar events for new shifts
4. Updates events for modified shifts
5. Deletes events for removed shifts

## Troubleshooting

**"You are not a member of any Teams with Shifts enabled"**
- Verify you have access to Teams Shifts in your organization
- Check that Shifts is enabled for your team

**"Could not load Google credentials"**
- Ensure `credentials.json` is in the project root
- Verify it's a valid OAuth 2.0 client credentials file

**Authentication errors**
- Delete `google-token.json` and re-authenticate
- Verify your Azure AD app has the correct permissions

## License

MIT
