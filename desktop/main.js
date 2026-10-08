const { app, BrowserWindow, Tray, Menu, ipcMain, shell, Notification, powerSaveBlocker } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execSync } = require('child_process');

let mainWindow = null;
let tray = null;
let minerProcess = null;
let minerStatus = {
  state: 'STOPPED',
  hashrate_mhs: 0.0,
  temp_c: 0,
  power_w: 0.0,
  balance: 0.0
};
let isQuitting = false;
let pauseTimeout = null;
let powerBlockerId = null;

function updatePowerSave(isMining) {
  if (isMining && powerBlockerId === null) {
    // 'prevent-app-suspension' prevents system sleep while allowing displays/monitors to sleep normally!
    powerBlockerId = powerSaveBlocker.start('prevent-app-suspension');
    console.log('[Power] Activated sleep blocker (PC stays awake, screens free to turn off)');
  } else if (!isMining && powerBlockerId !== null) {
    if (powerSaveBlocker.isStarted(powerBlockerId)) {
      powerSaveBlocker.stop(powerBlockerId);
    }
    powerBlockerId = null;
    console.log('[Power] Released sleep blocker (normal power state restored)');
  }
}

// Config file path in OS userData
const configPath = path.join(app.getPath('userData'), 'doomsday-config.json');

function loadConfig() {
  const defaults = {
    first_run: true,
    wallet_address: '',
    rig_name: 'Rig-' + (process.env.COMPUTERNAME || 'PC'),
    node_url: 'http://127.0.0.1:8334',
    idle_mode: 'gamer', // gamer (180s), aggressive (60s), custom
    idle_seconds: 180,
    temp_limit: 75,
    start_at_boot: true,
    minimize_to_tray: true
  };
  try {
    if (fs.existsSync(configPath)) {
      return Object.assign(defaults, JSON.parse(fs.readFileSync(configPath, 'utf8')));
    }
  } catch (e) {
    console.error('Failed to load config, using defaults', e);
  }
  return defaults;
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf8');
    // Update startup setting
    app.setLoginItemSettings({
      openAtLogin: !!cfg.start_at_boot,
      openAsHidden: true
    });
    return true;
  } catch (e) {
    console.error('Failed to save config', e);
    return false;
  }
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    const config = loadConfig();

    createWindow();
    createTray();

    if (config.start_at_boot) {
      app.setLoginItemSettings({
        openAtLogin: true,
        openAsHidden: true
      });
    }

    // If already onboarded, start background sentinel immediately
    if (!config.first_run && config.wallet_address) {
      startMinerChildProcess(config);
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 460,
    height: 720,
    resizable: false,
    frame: false,
    backgroundColor: '#09090b',
    icon: path.join(__dirname, 'ui', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'ui', 'index.html'));

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();

      const config = loadConfig();
      if (config.minimize_to_tray && Notification.isSupported()) {
        new Notification({
          title: 'Doomsday Network',
          body: 'Doomsday is standing vigil in the background. It will mine only when you are idle.'
        }).show();
      }
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'ui', 'tray.png');
  tray = new Tray(iconPath);
  tray.setToolTip('Doomsday Network');

  updateTrayMenu();

  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function updateTrayMenu() {
  if (!tray) return;

  const stateStr = minerStatus.state === 'MINING' 
    ? `⚡ Mining (${minerStatus.hashrate_mhs.toFixed(1)} MH/s)`
    : minerStatus.state === 'PAUSED' ? '⏸ Paused' : '🛡 Standing Vigil (Idle)';

  const contextMenu = Menu.buildFromTemplate([
    { label: stateStr, enabled: false },
    { type: 'separator' },
    {
      label: 'Open Dashboard',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Pause for 30 Minutes',
      click: () => pauseMining(30)
    },
    {
      label: 'Pause for 1 Hour',
      click: () => pauseMining(60)
    },
    {
      label: 'Resume Mining',
      click: () => resumeMining()
    },
    { type: 'separator' },
    {
      label: 'Open Web Explorer',
      click: () => shell.openExternal('http://localhost:8334')
    },
    {
      label: 'Quit Completely',
      click: () => {
        isQuitting = true;
        stopMinerChildProcess();
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

function startMinerChildProcess(cfg) {
  stopMinerChildProcess();

  const projectDir = app.isPackaged ? process.resourcesPath : path.dirname(__dirname);
  const pythonCmd = 'python';
  const args = [
    '-u',
    '-m', 'miner.sentinel',
    '--node', cfg.node_url || 'http://127.0.0.1:8334',
    '--wallet', cfg.wallet_address,
    '--name', cfg.rig_name || 'Rig-Desktop',
    '--idle-sec', String(cfg.idle_seconds || 180),
    '--temp-limit', String(cfg.temp_limit || 75)
  ];

  console.log('[Desktop] Spawning miner sentinel:', pythonCmd, args.join(' '));

  minerProcess = spawn(pythonCmd, args, {
    cwd: projectDir,
    env: Object.assign({}, process.env, { PYTHONUNBUFFERED: '1' })
  });

  minerStatus.state = 'VIGIL';
  updateTrayMenu();

  minerProcess.stdout.on('data', (data) => {
    const text = data.toString();
    parseMinerOutput(text);
  });

  minerProcess.stderr.on('data', (data) => {
    console.error('[Miner STDERR]', data.toString());
  });

  minerProcess.on('close', (code) => {
    console.log('[Desktop] Miner process exited with code', code);
    minerStatus.state = 'STOPPED';
    updateTrayMenu();
    broadcastMinerUpdate();
  });
}

function parseMinerOutput(text) {
  if (text.includes('[MINING]')) {
    minerStatus.state = 'MINING';
    updatePowerSave(true);
    const mhsMatch = text.match(/Speed:\s*([\d\.]+)\s*MH\/s/i);
    const tempMatch = text.match(/GPU:\s*(\d+)°C/i);
    const powerMatch = text.match(/\(([\d\.]+)W\)/i);
    if (mhsMatch) minerStatus.hashrate_mhs = parseFloat(mhsMatch[1]);
    if (tempMatch) minerStatus.temp_c = parseInt(tempMatch[1]);
    if (powerMatch) minerStatus.power_w = parseFloat(powerMatch[1]);
  } else if (text.includes('[User Active]')) {
    minerStatus.state = 'STANDBY';
    minerStatus.hashrate_mhs = 0.0;
    updatePowerSave(false);
  }
  updateTrayMenu();
  broadcastMinerUpdate();
}

function broadcastMinerUpdate() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('miner-update', minerStatus);
  }
}

function stopMinerChildProcess() {
  updatePowerSave(false);
  if (minerProcess) {
    try {
      minerProcess.kill('SIGINT');
      minerProcess.kill('SIGTERM');
    } catch (e) {}
    minerProcess = null;
  }
  minerStatus.state = 'STOPPED';
  minerStatus.hashrate_mhs = 0.0;
  updateTrayMenu();
  broadcastMinerUpdate();
}

function pauseMining(minutes) {
  stopMinerChildProcess();
  minerStatus.state = 'PAUSED';
  updateTrayMenu();
  broadcastMinerUpdate();

  if (pauseTimeout) clearTimeout(pauseTimeout);
  pauseTimeout = setTimeout(() => {
    const cfg = loadConfig();
    startMinerChildProcess(cfg);
  }, minutes * 60 * 1000);
}

function resumeMining() {
  if (pauseTimeout) clearTimeout(pauseTimeout);
  const cfg = loadConfig();
  startMinerChildProcess(cfg);
}

// IPC Handlers
ipcMain.handle('detect-hardware', () => {
  try {
    const out = execSync('nvidia-smi --query-gpu=gpu_name,memory.total --format=csv,noheader', { encoding: 'utf8' });
    const parts = out.trim().split(',');
    return {
      type: 'NVIDIA_GPU',
      name: parts[0].trim(),
      memory: parts[1] ? parts[1].trim() : ''
    };
  } catch (e) {
    return {
      type: 'CPU',
      name: 'System Processor',
      memory: ''
    };
  }
});

ipcMain.handle('generate-wallet', () => {
  try {
    const projectDir = path.dirname(__dirname);
    const out = execSync('python -c "from core.crypto import generate_keypair, public_key_to_address, private_key_to_wif; priv, pub = generate_keypair(); print(public_key_to_address(pub) + \'|\' + private_key_to_wif(priv))"', {
      cwd: projectDir,
      encoding: 'utf8'
    });
    const parts = out.trim().split('|');
    return {
      address: parts[0],
      private_key: parts[1]
    };
  } catch (e) {
    console.error('Wallet generation error:', e);
    return null;
  }
});

ipcMain.handle('load-config', () => loadConfig());
ipcMain.handle('save-config', (_event, cfg) => saveConfig(cfg));
ipcMain.handle('start-miner', (_event, cfg) => {
  saveConfig(cfg);
  startMinerChildProcess(cfg);
  return true;
});
ipcMain.handle('stop-miner', () => {
  stopMinerChildProcess();
  return true;
});
ipcMain.handle('pause-mining', (_event, min) => {
  pauseMining(min);
  return true;
});
ipcMain.handle('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
});
ipcMain.handle('close-window', () => {
  if (mainWindow) mainWindow.close();
});
ipcMain.handle('open-external', (_event, url) => {
  shell.openExternal(url);
});

app.on('window-all-closed', () => {
  // Keep alive in tray unless quitting
  if (process.platform === 'darwin') {
    // macOS behavior
  }
});
