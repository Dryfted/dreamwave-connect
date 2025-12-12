/**
 * DreamWave Connect - Desktop App
 *
 * Beautiful, simple app to connect Claude and Codex subscriptions to DreamWave.
 * Works whether CLIs are installed or not - handles everything automatically.
 */

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const os = require('os');

let mainWindow;

const DREAMWAVE_API = process.env.DREAMWAVE_API || 'https://dreamwave.app';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 680,
    resizable: false,
    frame: false,
    transparent: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ============ CLI Detection ============

function getClaudeCredentialsPath() {
  const home = os.homedir();
  const paths = [
    path.join(home, '.claude', '.credentials.json'),
    path.join(home, '.claude', 'credentials.json'),
    path.join(home, '.config', 'claude-code', 'auth.json')
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return path.join(home, '.claude', '.credentials.json');
}

function getCodexCredentialsPath() {
  const home = os.homedir();
  return process.platform === 'win32'
    ? path.join(home, '.codex', 'auth.json')
    : path.join(home, '.codex', 'auth.json');
}

async function checkCLIInstalled(cli) {
  return new Promise((resolve) => {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    exec(`${cmd} ${cli}`, (error) => {
      resolve(!error);
    });
  });
}

async function checkCredentialsExist(provider) {
  const credPath = provider === 'claude' ? getClaudeCredentialsPath() : getCodexCredentialsPath();
  return fs.existsSync(credPath);
}

async function readCredentials(provider) {
  const credPath = provider === 'claude' ? getClaudeCredentialsPath() : getCodexCredentialsPath();
  if (!fs.existsSync(credPath)) return null;

  try {
    const content = fs.readFileSync(credPath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    console.error(`Failed to read ${provider} credentials:`, e);
    return null;
  }
}

// ============ CLI Installation ============

async function installCLI(cli) {
  return new Promise((resolve, reject) => {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const pkg = cli === 'claude' ? '@anthropic-ai/claude-code' : '@openai/codex';

    const install = spawn(npm, ['install', '-g', pkg], {
      shell: true,
      stdio: 'pipe'
    });

    let output = '';
    install.stdout.on('data', (data) => { output += data.toString(); });
    install.stderr.on('data', (data) => { output += data.toString(); });

    install.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        reject(new Error(`Installation failed: ${output}`));
      }
    });

    install.on('error', (err) => {
      reject(err);
    });
  });
}

// ============ OAuth Flow ============

async function runOAuthFlow(provider) {
  return new Promise((resolve, reject) => {
    const cli = provider === 'claude' ? 'claude' : 'codex';
    const args = provider === 'claude' ? ['/login'] : ['login'];

    const child = spawn(cli, args, {
      shell: true,
      stdio: 'pipe'
    });

    let output = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
      // Send progress to renderer
      mainWindow.webContents.send('oauth-progress', {
        provider,
        message: data.toString()
      });
    });

    child.stderr.on('data', (data) => {
      output += data.toString();
    });

    child.on('close', async (code) => {
      // Check if credentials were created
      const hasCredentials = await checkCredentialsExist(provider);
      if (hasCredentials) {
        const credentials = await readCredentials(provider);
        resolve({ success: true, credentials });
      } else {
        reject(new Error('OAuth completed but credentials not found'));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

// ============ Sync to DreamWave ============

async function syncToDreamWave(userId, provider, credentials) {
  const fetch = require('node-fetch');

  try {
    const response = await fetch(`${DREAMWAVE_API}/api/user-tokens/${provider}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId
      },
      body: JSON.stringify(credentials)
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to sync to DreamWave:', error);
    throw error;
  }
}

// ============ IPC Handlers ============

ipcMain.handle('get-status', async () => {
  const [claudeInstalled, codexInstalled, claudeCredentials, codexCredentials] = await Promise.all([
    checkCLIInstalled('claude'),
    checkCLIInstalled('codex'),
    checkCredentialsExist('claude'),
    checkCredentialsExist('codex')
  ]);

  return {
    claude: {
      installed: claudeInstalled,
      authenticated: claudeCredentials
    },
    codex: {
      installed: codexInstalled,
      authenticated: codexCredentials
    }
  };
});

ipcMain.handle('install-cli', async (event, provider) => {
  try {
    await installCLI(provider);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('start-oauth', async (event, provider) => {
  try {
    const result = await runOAuthFlow(provider);
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sync-credentials', async (event, { userId, provider }) => {
  try {
    const credentials = await readCredentials(provider);
    if (!credentials) {
      return { success: false, error: 'No credentials found' };
    }

    const result = await syncToDreamWave(userId, provider, credentials);
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-credentials', async (event, provider) => {
  return await readCredentials(provider);
});

ipcMain.handle('minimize-window', () => {
  mainWindow.minimize();
});

ipcMain.handle('close-window', () => {
  app.quit();
});

ipcMain.handle('open-external', (event, url) => {
  shell.openExternal(url);
});
