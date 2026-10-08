const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('doomsdayAPI', {
  detectHardware: () => ipcRenderer.invoke('detect-hardware'),
  generateWallet: () => ipcRenderer.invoke('generate-wallet'),
  loadConfig: () => ipcRenderer.invoke('load-config'),
  saveConfig: (cfg) => ipcRenderer.invoke('save-config', cfg),
  startMiner: (cfg) => ipcRenderer.invoke('start-miner', cfg),
  stopMiner: () => ipcRenderer.invoke('stop-miner'),
  pauseMining: (durationMinutes) => ipcRenderer.invoke('pause-mining', durationMinutes),
  onMinerUpdate: (callback) => ipcRenderer.on('miner-update', (_event, value) => callback(value)),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  toggleForceMine: () => ipcRenderer.invoke('toggle-force-mine'),
  updateSchedule: (scheduleCfg) => ipcRenderer.invoke('update-schedule', scheduleCfg),
  getCurrentVersion: () => ipcRenderer.invoke('get-current-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getWalletBackup: () => ipcRenderer.invoke('get-wallet-backup'),
  saveWalletBackup: (data) => ipcRenderer.invoke('save-wallet-backup', data),
  onMinerError: (callback) => ipcRenderer.on('miner-error', (_event, err) => callback(err)),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_event, updateInfo) => callback(updateInfo)),
  onTriggerCheckUpdates: (callback) => ipcRenderer.on('trigger-check-updates', () => callback()),
  onTriggerOpenSchedule: (callback) => ipcRenderer.on('trigger-open-schedule', () => callback()),
  onConfigUpdated: (callback) => ipcRenderer.on('config-updated', (_event, cfg) => callback(cfg))
});
