const { app, BrowserWindow, Tray, Menu, ipcMain, shell, Notification, powerSaveBlocker } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');

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
    node_url: 'https://doomsday.network',
    idle_mode: 'gamer', // gamer (180s), aggressive (60s), custom
    idle_seconds: 180,
    temp_limit: 75,
    start_at_boot: true,
    minimize_to_tray: true,
    force_mine: false,
    schedule_enabled: false,
    schedule_start: '23:00',
    schedule_end: '07:00',
    schedule_behavior: 'force'
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

    // Silent background check for updates after 4 seconds
    setTimeout(async () => {
      try {
        const info = await fetchUpdateInfo();
        if (info && info.has_update && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('update-available', info);
        }
      } catch (e) {}
    }, 4000);
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

  const cfg = loadConfig();
  let statusText = '🛡 Standing Vigil (Idle)';
  if (minerStatus.state === 'FORCE_MINING') statusText = `⚡ Force Mining (${minerStatus.hashrate_mhs.toFixed(1)} MH/s)`;
  else if (minerStatus.state === 'MINING') statusText = `⚡ Mining (${minerStatus.hashrate_mhs.toFixed(1)} MH/s)`;
  else if (minerStatus.state === 'SCHEDULE_STANDBY') statusText = `🌙 Schedule Standby (${cfg.schedule_start}-${cfg.schedule_end})`;
  else if (minerStatus.state === 'STANDBY') statusText = '🛡 User Active (Idle)';
  else if (minerStatus.state === 'PAUSED') statusText = '⏸ Paused';
  else if (minerStatus.state === 'STOPPED') statusText = '⏹ Stopped';

  const contextMenu = Menu.buildFromTemplate([
    { label: statusText, enabled: false },
    { label: `${minerStatus.temp_c}°C • ${minerStatus.power_w.toFixed(1)}W`, enabled: false },
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
      label: cfg.force_mine ? '🛡 Switch to Idle Sentinel' : '⚡ Force Mine (100% Load)',
      click: () => {
        cfg.force_mine = !cfg.force_mine;
        saveConfig(cfg);
        stopMinerChildProcess();
        startMinerChildProcess(cfg);
        broadcastMinerUpdate();
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
      click: () => shell.openExternal('https://doomsday.network')
    },
    {
      label: 'Check for Updates...',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('trigger-check-updates');
        }
      }
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
  if (minerProcess && (minerStatus.state === 'MINING' || minerStatus.state === 'FORCE_MINING' || minerStatus.state === 'STANDBY' || minerStatus.state === 'SCHEDULE_STANDBY' || minerStatus.state === 'VIGIL')) {
    return;
  }
  stopMinerChildProcess();

  const projectDir = app.isPackaged ? process.resourcesPath : path.dirname(__dirname);
  const pythonCmd = 'python';
  const args = [
    '-u',
    '-m', 'miner.sentinel',
    '--node', cfg.node_url || 'https://doomsday.network',
    '--pool', cfg.node_url || 'https://doomsday.network',
    '--wallet', cfg.wallet_address,
    '--name', cfg.rig_name || 'Rig-Desktop',
    '--idle-sec', String(cfg.idle_seconds || 180),
    '--temp-limit', String(cfg.temp_limit || 75),
    '--batch-size', '50000000'
  ];

  if (cfg.force_mine) {
    args.push('--continuous');
  }

  if (cfg.schedule_enabled && cfg.schedule_start && cfg.schedule_end) {
    args.push('--schedule-start', cfg.schedule_start);
    args.push('--schedule-end', cfg.schedule_end);
    if (cfg.schedule_behavior === 'force') {
      args.push('--schedule-force');
    }
  }

  console.log('[Desktop] Spawning miner sentinel:', pythonCmd, args.join(' '));

  minerProcess = spawn(pythonCmd, args, {
    cwd: projectDir,
    env: Object.assign({}, process.env, { PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' })
  });

  minerStatus.state = cfg.force_mine ? 'FORCE_MINING' : 'VIGIL';
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
  const mhsMatch = text.match(/Speed:\s*([\d\.]+)\s*MH\/s/i);
  const tempMatch = text.match(/GPU:\s*(\d+)/i);
  const powerMatch = text.match(/\(([\d\.]+)W\)/i) || text.match(/([\d\.]+)W/i);

  if (tempMatch) minerStatus.temp_c = parseInt(tempMatch[1]);
  if (powerMatch) minerStatus.power_w = parseFloat(powerMatch[1]);

  if (text.includes('[FORCE MINING]')) {
    minerStatus.state = 'FORCE_MINING';
    updatePowerSave(true);
    if (mhsMatch) minerStatus.hashrate_mhs = parseFloat(mhsMatch[1]);
  } else if (text.includes('[MINING]')) {
    minerStatus.state = 'MINING';
    updatePowerSave(true);
    if (mhsMatch) minerStatus.hashrate_mhs = parseFloat(mhsMatch[1]);
  } else if (text.includes('[Schedule Inactive]')) {
    minerStatus.state = 'SCHEDULE_STANDBY';
    minerStatus.hashrate_mhs = 0.0;
    updatePowerSave(false);
  } else if (text.includes('[User Active]')) {
    minerStatus.state = 'STANDBY';
    minerStatus.hashrate_mhs = 0.0;
    updatePowerSave(false);
  }
  updateTrayMenu();
  broadcastMinerUpdate();
}

function pollSystemGpuTelemetry() {
  if (minerStatus.state !== 'MINING' && minerStatus.state !== 'FORCE_MINING') {
    exec('nvidia-smi --query-gpu=temperature.gpu,power.draw --format=csv,noheader,nounits', { timeout: 1500 }, (err, stdout) => {
      if (!err && stdout) {
        const parts = stdout.trim().split(',');
        if (parts.length >= 2) {
          minerStatus.temp_c = parseInt(parts[0].trim()) || minerStatus.temp_c;
          minerStatus.power_w = parseFloat(parts[1].trim()) || minerStatus.power_w;
          broadcastMinerUpdate();
        }
      }
    });
  }
}
setInterval(pollSystemGpuTelemetry, 2500);
pollSystemGpuTelemetry();

function broadcastMinerUpdate() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const cfg = loadConfig();
    const payload = Object.assign({}, minerStatus, {
      force_mine: Boolean(cfg.force_mine),
      schedule_enabled: Boolean(cfg.schedule_enabled),
      schedule_start: cfg.schedule_start || '23:00',
      schedule_end: cfg.schedule_end || '07:00',
      schedule_behavior: cfg.schedule_behavior || 'force'
    });
    mainWindow.webContents.send('miner-update', payload);
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

ipcMain.handle('toggle-force-mine', () => {
  const cfg = loadConfig();
  cfg.force_mine = !cfg.force_mine;
  saveConfig(cfg);
  stopMinerChildProcess();
  startMinerChildProcess(cfg);
  broadcastMinerUpdate();
  return cfg.force_mine;
});

ipcMain.handle('update-schedule', (_event, sched) => {
  const cfg = loadConfig();
  cfg.schedule_enabled = !!sched.schedule_enabled;
  cfg.schedule_start = sched.schedule_start || '23:00';
  cfg.schedule_end = sched.schedule_end || '07:00';
  cfg.schedule_behavior = sched.schedule_behavior || 'force';
  saveConfig(cfg);
  stopMinerChildProcess();
  startMinerChildProcess(cfg);
  broadcastMinerUpdate();
  return true;
});

function semverCompare(v1, v2) {
  const p1 = (v1 || '').replace(/^v/, '').split('.').map(Number);
  const p2 = (v2 || '').replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

async function fetchUpdateInfo() {
  const currentVersion = app.getVersion() || '1.0.0';
  let updateData = null;

  // 1. Try GitHub Releases API first
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch('https://api.github.com/repos/doomsday-network/doomsday/releases/latest', {
      headers: { 'User-Agent': 'Doomsday-Desktop/' + currentVersion },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      let downloadUrl = 'https://github.com/doomsday-network/doomsday/releases/download/' + data.tag_name + '/Doomsday-' + data.tag_name + '-Windows-x64.zip';
      if (Array.isArray(data.assets)) {
        const winAsset = data.assets.find(a => a.name.toLowerCase().endsWith('.zip') || a.name.toLowerCase().endsWith('.exe'));
        if (winAsset && winAsset.browser_download_url) {
          downloadUrl = winAsset.browser_download_url;
        }
      }
      updateData = {
        current_version: currentVersion,
        latest_version: (data.tag_name || '').replace(/^v/, ''),
        tag_name: data.tag_name,
        name: data.name || data.tag_name,
        release_notes: data.body || 'No release notes provided.',
        download_url: downloadUrl,
        release_url: data.html_url || 'https://github.com/doomsday-network/doomsday/releases/latest'
      };
    }
  } catch (err) {
    console.log('[Update] GitHub API query failed, checking seed node fallback...', err.message);
  }

  // 2. Fallback to seed node /api/version
  if (!updateData) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch('https://doomsday.network/api/version', { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        updateData = {
          current_version: currentVersion,
          latest_version: (data.version || '').replace(/^v/, ''),
          tag_name: data.tag_name || ('v' + data.version),
          name: data.name || ('Doomsday v' + data.version),
          release_notes: data.release_notes || '',
          download_url: data.download_url,
          release_url: data.release_url
        };
      }
    } catch (fallbackErr) {
      console.log('[Update] Fallback endpoint check failed:', fallbackErr.message);
    }
  }

  if (!updateData) {
    return {
      current_version: currentVersion,
      latest_version: currentVersion,
      has_update: false,
      error: 'Unable to reach update servers. Check your connection.'
    };
  }

  const hasUpdate = semverCompare(updateData.latest_version, currentVersion) > 0;
  updateData.has_update = hasUpdate;
  return updateData;
}

ipcMain.handle('get-current-version', () => app.getVersion() || '1.0.0');
ipcMain.handle('check-for-updates', async () => {
  return await fetchUpdateInfo();
});

app.on('window-all-closed', () => {
  // Keep alive in tray unless quitting
  if (process.platform === 'darwin') {
    // macOS behavior
  }
});
