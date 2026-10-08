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

      config.first_run = false;
      config.wallet_address = addr;
      config.idle_mode = idleMode;
      config.idle_seconds = idleSec;
      config.start_at_boot = startAtBoot;
      config.minimize_to_tray = minToTray;

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
      window.doomsdayAPI.openExternal('http://localhost:8334');
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

    if (status.state === 'MINING') {
      orb.classList.add('mining');
      orbIcon.innerText = '⚡';
      stateText.innerText = 'MINING BLOCKS';
      stateText.style.color = 'var(--primary)';
      subText.innerText = 'SILICON AWAKE';
      subText.style.color = 'var(--primary)';
      speedVal.innerText = `${status.hashrate_mhs.toLocaleString()} MH/s`;
      thermVal.innerText = `${status.temp_c}°C • ${status.power_w}W`;
    } else if (status.state === 'STANDBY') {
      orb.classList.add('standby');
      orbIcon.innerText = '🛡';
      stateText.innerText = 'USER ACTIVE';
      stateText.style.color = 'var(--accent)';
      subText.innerText = 'IDLE SENTINEL';
      subText.style.color = 'var(--accent)';
      speedVal.innerText = '0.0 MH/s';
      thermVal.innerText = `${status.temp_c}°C • ${status.power_w}W`;
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
    }
  });

  async function fetchBalance() {
    if (!config.wallet_address) return;
    try {
      const res = await fetch(`http://localhost:8334/wallet/${config.wallet_address}`);
      if (res.ok) {
        const data = await res.json();
        document.getElementById('val-balance').innerText = `${data.balance_doom.toLocaleString()} DOOM`;
      }
    } catch (e) {}
  }
  setInterval(fetchBalance, 5000);
});
