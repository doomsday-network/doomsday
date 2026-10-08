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
  updateSchedule: (scheduleCfg) => ipcRenderer.invoke('update-schedule', scheduleCfg)
});
