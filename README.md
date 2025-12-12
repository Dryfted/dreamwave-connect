# DreamWave Connect

Beautiful, simple desktop app to connect your Claude and Codex subscriptions to DreamWave.

## Features

- **One-click setup** - Works whether CLIs are installed or not
- **Auto-installation** - Automatically installs Claude/Codex CLIs if missing
- **Seamless OAuth** - Opens browser for authentication, handles everything automatically
- **Secure sync** - Credentials are encrypted and synced to your DreamWave account
- **Cross-platform** - Works on macOS, Windows, and Linux

## User Flow

1. Download and open DreamWave Connect
2. Enter your DreamWave User ID
3. Click "Connect" on Claude and/or Codex
4. Browser opens → Sign in with your subscription
5. Done! Credentials are synced to DreamWave

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
cd desktop-app
npm install
```

### Run in development

```bash
npm start
```

### Build for production

```bash
# Build for current platform
npm run build

# Build for specific platforms
npm run build:mac
npm run build:win
npm run build:linux
```

### Output

Built apps will be in the `dist/` folder:

- **macOS**: `DreamWave Connect-1.0.0.dmg`, `DreamWave Connect-1.0.0-mac.zip`
- **Windows**: `DreamWave Connect Setup 1.0.0.exe`, `DreamWave Connect 1.0.0.exe` (portable)
- **Linux**: `DreamWave Connect-1.0.0.AppImage`, `dreamwave-connect_1.0.0_amd64.deb`

## Configuration

Set the `DREAMWAVE_API` environment variable to point to your DreamWave server:

```bash
DREAMWAVE_API=https://your-dreamwave.app npm start
```

Default: `https://dreamwave.app`

## Security

- Credentials are stored locally in the standard CLI locations:
  - Claude: `~/.claude/.credentials.json`
  - Codex: `~/.codex/auth.json`
- When syncing to DreamWave, credentials are encrypted with AES-256-GCM
- The app never stores credentials itself - it reads from CLI locations

## How It Works

1. **CLI Detection**: Checks if `claude` and `codex` commands are available
2. **Auto-install**: If not installed, runs `npm install -g @anthropic-ai/claude-code` or `@openai/codex`
3. **OAuth Flow**: Spawns `claude /login` or `codex login` which opens browser
4. **Credential Capture**: Monitors credential files for successful authentication
5. **Sync**: Reads credentials and POSTs to DreamWave API with user ID

## License

MIT
