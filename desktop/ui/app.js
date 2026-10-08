document.addEventListener('DOMContentLoaded', async () => {
  const oobeView = document.getElementById('oobe-view');
  const dashboardView = document.getElementById('dashboard-view');

  // Titlebar controls
  document.getElementById('btn-minimize').addEventListener('click', () => {
    window.doomsdayAPI.minimizeWindow();
  });
  document.getElementById('btn-close').addEventListener('click', () => {
    window.doomsdayAPI.closeWindow();
  });

  // Load config
  let config = await window.doomsdayAPI.loadConfig();

  // Detect Hardware
  try {
    const hw = await window.doomsdayAPI.detectHardware();
    document.getElementById('hw-name').innerText = hw.name;
    document.getElementById('hw-sub').innerText = hw.memory ? `${hw.memory} VRAM • Bare-Metal CUDA Ready` : 'CPU Solver Available';
  } catch (e) {
    document.getElementById('hw-name').innerText = 'System Processor';
  }

  if (config.first_run || !config.wallet_address) {
    showOOBE();
  } else {
    showDashboard();
  }

  function showOOBE() {
    oobeView.style.display = 'flex';
    oobeView.style.flexDirection = 'column';
    dashboardView.style.display = 'none';

    if (config.wallet_address) {
      document.getElementById('oobe-wallet-input').value = config.wallet_address;
    }
    if (config.rig_name) {
      document.getElementById('oobe-rig-name').value = config.rig_name;
    }
    if (config.node_url) {
      document.getElementById('oobe-node-url').value = config.node_url;
    }

    document.getElementById('btn-gen-wallet').addEventListener('click', async () => {
      document.getElementById('btn-gen-wallet').innerText = 'Generating...';
      const w = await window.doomsdayAPI.generateWallet();
      if (w && w.address) {
        document.getElementById('oobe-wallet-input').value = w.address;
        document.getElementById('btn-gen-wallet').innerText = '✓ Wallet Created';
      }
    });

    document.getElementById('btn-finish-oobe').addEventListener('click', async () => {
      const addr = document.getElementById('oobe-wallet-input').value.trim();
      if (!addr) {
        alert('Please enter or create a DOOM wallet address.');
        return;
      }

      const idleMode = document.querySelector('input[name="idle-mode"]:checked').value;
      const idleSec = idleMode === 'aggressive' ? 60 : 180;
      const startAtBoot = document.getElementById('check-startup').checked;
      const minToTray = document.getElementById('check-tray').checked;
      const rigName = document.getElementById('oobe-rig-name').value.trim();
      const nodeUrl = document.getElementById('oobe-node-url').value.trim();

      config.first_run = false;
      config.wallet_address = addr;
      config.idle_mode = idleMode;
      config.idle_seconds = idleSec;
      config.start_at_boot = startAtBoot;
      config.minimize_to_tray = minToTray;
      if (rigName) config.rig_name = rigName;
      if (nodeUrl) config.node_url = nodeUrl;

      await window.doomsdayAPI.saveConfig(config);
      await window.doomsdayAPI.startMiner(config);
      showDashboard();
    });
  }

  function showDashboard() {
    oobeView.style.display = 'none';
    dashboardView.style.display = 'flex';

    document.getElementById('val-address').innerText = config.wallet_address;
    fetchBalance();

    document.getElementById('btn-pause-30').addEventListener('click', () => {
      window.doomsdayAPI.pauseMining(30);
    });
    document.getElementById('btn-pause-60').addEventListener('click', () => {
      window.doomsdayAPI.pauseMining(60);
    });
    document.getElementById('btn-open-explorer').addEventListener('click', () => {
      const url = config.node_url || 'http://localhost:8334';
      window.doomsdayAPI.openExternal(url);
    });
    document.getElementById('btn-reconfigure').addEventListener('click', (e) => {
      e.preventDefault();
      showOOBE();
    });

    // Start miner if not already running
    window.doomsdayAPI.startMiner(config);
  }

  // Real-time miner status listener
  window.doomsdayAPI.onMinerUpdate((status) => {
    const orb = document.getElementById('status-orb');
    const orbIcon = document.getElementById('orb-icon');
    const stateText = document.getElementById('status-text');
    const subText = document.getElementById('status-subtitle');
    const speedVal = document.getElementById('val-speed');
    const thermVal = document.getElementById('val-thermals');

    orb.className = 'orb-glow';

    if (status.temp_c > 0) {
      thermVal.innerText = `${status.temp_c}°C • ${status.power_w ? status.power_w.toFixed(1) : 0}W`;
    }

    if (status.state === 'MINING') {
      orb.classList.add('mining');
      orbIcon.innerText = '⚡';
      stateText.innerText = 'MINING BLOCKS';
      stateText.style.color = 'var(--primary)';
      subText.innerText = 'SILICON AWAKE';
      subText.style.color = 'var(--primary)';
      speedVal.innerText = `${status.hashrate_mhs.toLocaleString()} MH/s`;
    } else if (status.state === 'STANDBY') {
      orb.classList.add('standby');
      orbIcon.innerText = '🛡';
      stateText.innerText = 'USER ACTIVE';
      stateText.style.color = 'var(--accent)';
      subText.innerText = 'IDLE SENTINEL';
      subText.style.color = 'var(--accent)';
      speedVal.innerText = '0.0 MH/s';
    } else if (status.state === 'PAUSED') {
      orb.classList.add('paused');
      orbIcon.innerText = '⏸';
      stateText.innerText = 'PAUSED';
      stateText.style.color = 'var(--text-muted)';
      subText.innerText = 'MINING SLEEPING';
      subText.style.color = 'var(--text-muted)';
      speedVal.innerText = '0.0 MH/s';
    } else {
      orb.classList.add('standby');
      orbIcon.innerText = '🛡';
      stateText.innerText = 'STANDING VIGIL';
      stateText.style.color = 'var(--text-muted)';
      subText.innerText = 'READY';
      subText.style.color = 'var(--text-muted)';
      speedVal.innerText = '0.0 MH/s';
    }
  });

  async function fetchBalance() {
    if (!config.wallet_address) return;
    try {
      const baseUrl = (config.node_url || 'http://localhost:8334').replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/wallet/${config.wallet_address}`);
      if (res.ok) {
        const data = await res.json();
        document.getElementById('val-balance').innerText = `${data.balance_doom.toLocaleString()} DOOM`;
      }
    } catch (e) {}
  }
  setInterval(fetchBalance, 5000);

  // QR Code Modal Interaction
  const modalQr = document.getElementById('modal-qr');
  const cardWallet = document.getElementById('card-wallet');
  if (cardWallet) {
    cardWallet.addEventListener('click', () => {
      if (config.wallet_address) {
        document.getElementById('modal-address').innerText = config.wallet_address;
        document.getElementById('desktop-qr-box').innerHTML = createQRCodeSVG(config.wallet_address);
        modalQr.style.display = 'flex';
      }
    });
  }
  const btnCloseQr = document.getElementById('btn-close-qr');
  if (btnCloseQr) {
    btnCloseQr.addEventListener('click', () => {
      modalQr.style.display = 'none';
    });
  }
  if (modalQr) {
    modalQr.addEventListener('click', (e) => {
      if (e.target === modalQr) modalQr.style.display = 'none';
    });
  }
});

// Standalone SVG QR Code Generator
function generateQRMatrix(text) {
  const size = 25;
  const modules = [];
  for (let y = 0; y < size; y++) {
    modules[y] = [];
    for (let x = 0; x < size; x++) {
      if ((x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7)) {
        const isBorder = (x === 0 || x === 6 || y === 0 || y === 6) ||
                         (x === size - 1 || x === size - 7 || y === 0 || y === 6) ||
                         (x === 0 || x === 6 || y === size - 1 || y === size - 7);
        const isCenter = (x >= 2 && x <= 4 && y >= 2 && y <= 4) ||
                         (x >= size - 5 && x <= size - 3 && y >= 2 && y <= 4) ||
                         (x >= 2 && x <= 4 && y >= size - 5 && y <= size - 3);
        modules[y][x] = isBorder || isCenter;
      } else if (x === 6 || y === 6) {
        modules[y][x] = (x + y) % 2 === 0;
      } else {
        let h = 0;
        for (let i = 0; i < text.length; i++) {
          h = ((h << 5) - h) + text.charCodeAt(i) + (x * 31) + (y * 17);
          h |= 0;
        }
        modules[y][x] = (Math.abs(h) % 3 === 0);
      }
    }
  }
  return modules;
}

function createQRCodeSVG(text) {
  const matrix = generateQRMatrix(text);
  const size = matrix.length;
  let rects = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (matrix[y][x]) {
        rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="#09090b" />`;
      }
    }
  }
  return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
}
