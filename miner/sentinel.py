import argparse
import ctypes
import datetime
import os
import subprocess
import sys
import time
import requests
from typing import Optional, Dict, Any, Tuple, List
from miner.cuda_solver import CUDASolver, MultiCUDASolver
from core.crypto import doom_hash


def is_within_schedule(start_str: Optional[str], end_str: Optional[str]) -> bool:
    """Return True if current time is within HH:MM - HH:MM window (handles midnight crossing)."""
    if not start_str or not end_str:
        return True
    try:
        sh, sm = [int(p) for p in start_str.strip().split(':')]
        eh, em = [int(p) for p in end_str.strip().split(':')]
        now = datetime.datetime.now().time()
        start_t = datetime.time(sh, sm)
        end_t = datetime.time(eh, em)
        if start_t <= end_t:
            return start_t <= now <= end_t
        else:
            return now >= start_t or now <= end_t
    except Exception:
        return True


class LASTINPUTINFO(ctypes.Structure):
    _fields_ = [('cbSize', ctypes.c_uint), ('dwTime', ctypes.c_uint)]


ES_CONTINUOUS = 0x80000000
ES_SYSTEM_REQUIRED = 0x00000001


def set_prevent_sleep(enable: bool):
    """
    Prevent OS from sleeping the PC while actively mining,
    while explicitly allowing monitors/displays to sleep normally.
    """
    if os.name == 'nt':
        flags = ES_CONTINUOUS
        if enable:
            flags |= ES_SYSTEM_REQUIRED
        ctypes.windll.kernel32.SetThreadExecutionState(flags)


def get_user_idle_seconds() -> float:
    """Return number of seconds since last mouse or keyboard input on Windows."""
    if os.name != 'nt':
        return 999.0  # Headless Linux fallback: assume idle

    lii = LASTINPUTINFO()
    lii.cbSize = ctypes.sizeof(LASTINPUTINFO)
    ctypes.windll.user32.GetLastInputInfo(ctypes.byref(lii))
    tick = ctypes.windll.kernel32.GetTickCount()
    elapsed_ms = tick - lii.dwTime
    return max(0.0, elapsed_ms / 1000.0)


_nvml_handle = None
_nvml_checked = False


def get_gpu_telemetry() -> Dict[str, Any]:
    """Query temperature, power usage, and utilization with microsecond direct NVML calls."""
    global _nvml_handle, _nvml_checked
    if not _nvml_checked:
        try:
            dll_name = 'nvml.dll' if os.name == 'nt' else 'libnvidia-ml.so.1'
            nvml = ctypes.CDLL(dll_name)
            if nvml.nvmlInit_v2() == 0:
                h = ctypes.c_void_p()
                if nvml.nvmlDeviceGetHandleByIndex_v2(0, ctypes.byref(h)) == 0:
                    _nvml_handle = (nvml, h)
        except Exception:
            pass
        _nvml_checked = True

    if _nvml_handle is not None:
        try:
            nvml, h = _nvml_handle
            temp = ctypes.c_uint()
            power = ctypes.c_uint()
            nvml.nvmlDeviceGetTemperature(h, 0, ctypes.byref(temp))
            nvml.nvmlDeviceGetPowerUsage(h, ctypes.byref(power))

            class nvmlUtil(ctypes.Structure):
                _fields_ = [('gpu', ctypes.c_uint), ('mem', ctypes.c_uint)]

            u = nvmlUtil()
            nvml.nvmlDeviceGetUtilizationRates(h, ctypes.byref(u))
            return {
                "temp_c": int(temp.value),
                "power_w": round(power.value / 1000.0, 1),
                "util_pct": int(u.gpu)
            }
        except Exception:
            pass

    # Fallback to nvidia-smi if NVML C-library fails
    try:
        res = subprocess.run(
            ["nvidia-smi", "--query-gpu=temperature.gpu,power.draw,utilization.gpu", "--format=csv,noheader,nounits"],
            capture_output=True,
            text=True,
            timeout=2
        )
        if res.returncode == 0:
            parts = res.stdout.strip().split(',')
            return {
                "temp_c": int(parts[0].strip()),
                "power_w": float(parts[1].strip()),
                "util_pct": int(parts[2].strip())
            }
    except Exception:
        pass
    return {"temp_c": 0, "power_w": 0.0, "util_pct": 0}


class IdleSentinelMiner:
    def __init__(
        self,
        node_url: str,
        wallet_address: str,
        miner_name: str = "Rig-Default",
        idle_threshold_sec: float = 120.0,
        batch_size: int = 5_000_000,
        temp_limit_c: int = 75,
        device_index: int = 0,
        devices: Optional[List[int]] = None,
        pool_url: Optional[str] = None,
        schedule_start: Optional[str] = None,
        schedule_end: Optional[str] = None,
        schedule_force: bool = False
    ):
        if not node_url.startswith("http://") and not node_url.startswith("https://"):
            node_url = "https://" + node_url
        self.node_url = node_url.rstrip('/')
        self.fallback_url = "http://35.254.109.168:8334"
        self.active_node_url = self.node_url
        self.pool_url = pool_url.rstrip('/') if pool_url else None
        self.is_pool = bool(self.pool_url)
        self.wallet_address = wallet_address
        self.miner_name = miner_name
        self.idle_threshold_sec = idle_threshold_sec
        self.batch_size = batch_size
        self.temp_limit_c = temp_limit_c
        self.device_index = device_index
        self.devices = devices
        self.schedule_start = schedule_start
        self.schedule_end = schedule_end
        self.schedule_force = schedule_force

        print(f"Initializing Mining Engine for [{self.miner_name}]...")
        try:
            if self.devices and len(self.devices) > 1:
                self.solver = MultiCUDASolver(device_indices=self.devices)
            else:
                target_dev = self.devices[0] if (self.devices and len(self.devices) == 1) else self.device_index
                self.solver = CUDASolver(device_index=target_dev)
            print(f"Engine Ready: {self.solver.device_name}")
        except Exception as e:
            print(f"[!] CUDA GPU Initialization failed ({e}). Falling back to CPU Solver...")
            from miner.cpu_solver import CPUSolver
            self.solver = CPUSolver()
            print(f"Engine Ready: CPU Reference Solver")

    def fetch_job(self) -> Optional[Dict[str, Any]]:
        """Request the latest block mining job from the Doomsday Node or Pool."""
        if self.is_pool:
            try:
                resp = requests.get(
                    f"{self.pool_url}/pool/job",
                    params={"worker_address": self.wallet_address, "worker_name": self.miner_name},
                    timeout=3
                )
                if resp.status_code == 200:
                    return resp.json()
            except Exception as e:
                print(f"[Sentinel] Error fetching pool job: {e}")
            return None

        targets = [self.node_url]
        if self.fallback_url and self.fallback_url != self.node_url:
            targets.append(self.fallback_url)
        for url in targets:
            try:
                resp = requests.get(
                    f"{url}/job",
                    params={"miner_address": self.wallet_address},
                    timeout=2
                )
                if resp.status_code == 200:
                    self.active_node_url = url
                    return resp.json()
            except Exception:
                pass
        return None

    def submit_share(self, height: int, nonce: int, hash_hex: str, timestamp: Optional[int] = None) -> Dict[str, Any]:
        """Submit a mined share to the Doomsday Mining Pool."""
        payload = {
            "height": height,
            "nonce": nonce,
            "worker_address": self.wallet_address,
            "worker_name": self.miner_name,
            "timestamp": timestamp
        }
        try:
            resp = requests.post(f"{self.pool_url}/pool/submit", json=payload, timeout=3)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("accepted"):
                    if data.get("block_solved"):
                        print(f"\n=======================================================")
                        print(f"[★ POOL BLOCK SOLVED! ★] Height: #{height} | Nonce: {nonce}")
                        print(f"Block Hash: {data.get('block_hash')}")
                        print(f"50 DOOM reward credited to pool & split with round contributors!")
                        print(f"=======================================================\n")
                    else:
                        sys.stdout.write(f"\n[Pool Share Accepted] Worker: {self.miner_name} (Round Shares: {data.get('worker_shares')})\n")
                        sys.stdout.flush()
                    return data
            print(f"[Pool] Share rejected: {resp.text}")
        except Exception as e:
            print(f"[Pool] Error submitting share: {e}")
        return {"accepted": False}

    def submit_solution(self, height: int, nonce: int, hash_hex: str, timestamp: Optional[int] = None) -> bool:
        """Submit a newly mined block candidate to the network."""
        payload = {
            "height": height,
            "nonce": nonce,
            "hash": hash_hex,
            "miner_name": self.miner_name,
            "miner_address": self.wallet_address,
            "timestamp": timestamp
        }
        target_url = getattr(self, "active_node_url", self.node_url)
        try:
            resp = requests.post(f"{target_url}/submit", json=payload, timeout=3)
            if resp.status_code == 200 and resp.json().get("accepted"):
                print(f"\n=======================================================")
                print(f"[+] BLOCK #{height} ACCEPTED BY NETWORK! NONCE: {nonce}")
                print(f"Reward credited to: {self.wallet_address}")
                print(f"=======================================================\n")
                return True
            else:
                print(f"[Sentinel] Block rejected: {resp.text}")
        except Exception as e:
            print(f"[Sentinel] Error submitting solution: {e}")
        return False

    def send_telemetry(self, state: str, hashrate_mhs: float, gpu_stats: Dict[str, Any]):
        """Publish real-time worker metrics to the node for the explorer dashboard."""
        payload = {
            "name": self.miner_name,
            "device": self.solver.device_name,
            "state": state,
            "hashrate_mhs": round(hashrate_mhs, 2),
            "temp_c": gpu_stats.get("temp_c", 0),
            "power_w": gpu_stats.get("power_w", 0.0),
            "util_pct": gpu_stats.get("util_pct", 0),
            "address": self.wallet_address
        }
        target_url = getattr(self, "active_node_url", self.node_url)
        try:
            requests.post(f"{target_url}/miner/telemetry", json=payload, timeout=1)
        except Exception:
            pass

    def run(self):
        """Main sentinel loop with zero-lag user input interception."""
        print(f"\n[+] Doomsday Sentinel Active")
        print(f"Node: {self.node_url}")
        print(f"Wallet: {self.wallet_address}")
        print(f"Idle Activation Threshold: {self.idle_threshold_sec}s")
        print(f"Thermal Cutoff: {self.temp_limit_c}°C")
        if self.schedule_start and self.schedule_end:
            print(f"Automated Schedule: {self.schedule_start} -> {self.schedule_end} (Force: {self.schedule_force})\n")
        else:
            print()

        current_job = None
        current_nonce = 0
        last_heartbeat = 0
        last_job_check = 0

        while True:
            idle_sec = get_user_idle_seconds()
            gpu_stats = get_gpu_telemetry()

            # Thermal Protection
            if gpu_stats["temp_c"] >= self.temp_limit_c:
                print(f"[Sentinel] High Temp Warning ({gpu_stats['temp_c']}°C). Throttling...")
                self.send_telemetry("THROTTLED (TEMP)", 0.0, gpu_stats)
                time.sleep(5)
                continue

            # Check schedule window
            if self.schedule_start and self.schedule_end:
                if not is_within_schedule(self.schedule_start, self.schedule_end):
                    set_prevent_sleep(False)
                    if time.time() - last_heartbeat > 2:
                        sys.stdout.write(f"\r[Schedule Inactive] Standing by... (Active Window: {self.schedule_start} - {self.schedule_end}) | GPU: {gpu_stats['temp_c']}°C ({gpu_stats['power_w']}W)\n")
                        sys.stdout.flush()
                        self.send_telemetry("SUSPENDED (SCHEDULE)", 0.0, gpu_stats)
                        last_heartbeat = time.time()
                    time.sleep(1.0)
                    continue
                elif self.schedule_force:
                    # Inside active schedule window with Force Continuous mode: bypass user input check!
                    pass
                elif self.idle_threshold_sec > 0 and idle_sec < self.idle_threshold_sec:
                    set_prevent_sleep(False)
                    if time.time() - last_heartbeat > 2:
                        sys.stdout.write(f"\r[User Active] Standing by... (Idle: {idle_sec:.1f}s / {self.idle_threshold_sec:.0f}s) | GPU: {gpu_stats['temp_c']}°C ({gpu_stats['power_w']}W)\n")
                        sys.stdout.flush()
                        self.send_telemetry("SUSPENDED (ACTIVE)", 0.0, gpu_stats)
                        last_heartbeat = time.time()
                    time.sleep(0.5)
                    continue
            else:
                # No schedule window configured: standard idle sentinel check
                if self.idle_threshold_sec > 0 and idle_sec < self.idle_threshold_sec:
                    set_prevent_sleep(False)  # Allow normal power states while user active
                    if time.time() - last_heartbeat > 2:
                        sys.stdout.write(f"\r[User Active] Standing by... (Idle: {idle_sec:.1f}s / {self.idle_threshold_sec:.0f}s) | GPU: {gpu_stats['temp_c']}°C ({gpu_stats['power_w']}W)\n")
                        sys.stdout.flush()
                        self.send_telemetry("SUSPENDED (ACTIVE)", 0.0, gpu_stats)
                        last_heartbeat = time.time()
                    time.sleep(0.5)
                    continue

            # PC IS IDLE - PROCEED TO MINE!
            set_prevent_sleep(True)  # Keep PC and GPU awake, while displays sleep normally
            if current_job is None:
                current_job = self.fetch_job()
                if not current_job:
                    time.sleep(2)
                    continue
                current_nonce = 0
                last_job_check = time.time()
                print(f"\n[Sentinel] Mining Block #{current_job['height']} | Target: {hex(current_job['target_high'])}")
            elif time.time() - last_job_check > 5:
                fresh_job = self.fetch_job()
                if fresh_job and (fresh_job.get("height") != current_job.get("height") or len(fresh_job.get("transactions", [])) != len(current_job.get("transactions", []))):
                    current_job = fresh_job
                    current_nonce = 0
                    print(f"\n[Sentinel] Job updated (mempool/tip change) | Block #{current_job['height']}")
                last_job_check = time.time()

            # Execute batch on GPU
            seed_u64 = tuple(current_job["seed_u64"])
            target_high = current_job["target_high"]

            t_batch_start = time.perf_counter()
            found, winning_nonce, hashrate = self.solver.mine_batch(
                seed_u64=seed_u64,
                start_nonce=current_nonce,
                batch_size=self.batch_size,
                target_high=target_high
            )
            t_batch_elapsed = max(1e-5, time.perf_counter() - t_batch_start)

            # Auto-scale batch size to maintain continuous 150-250ms GPU saturation
            if t_batch_elapsed < 0.10 and self.batch_size < 200_000_000:
                self.batch_size = min(200_000_000, self.batch_size * 2)
            elif t_batch_elapsed > 0.35 and self.batch_size > 10_000_000:
                self.batch_size = max(10_000_000, self.batch_size // 2)

            current_nonce += self.batch_size
            mhs = hashrate / 1_000_000.0

            # Sample GPU telemetry immediately after active compute so power reflects full load!
            gpu_stats = get_gpu_telemetry()

            mode_tag = "[FORCE MINING]" if (self.idle_threshold_sec <= 0 or (self.schedule_start and self.schedule_force)) else "[MINING]"
            sys.stdout.write(
                f"\r{mode_tag} Block #{current_job['height']} | "
                f"Speed: {mhs:.2f} MH/s | "
                f"GPU: {gpu_stats['temp_c']}°C ({gpu_stats['power_w']}W) | "
                f"Nonces: {current_nonce:,}\n"
            )
            sys.stdout.flush()

            if time.time() - last_heartbeat > 2:
                self.send_telemetry("MINING", mhs, gpu_stats)
                last_heartbeat = time.time()

            if found:
                prefix = bytes.fromhex(current_job["header_prefix_hex"])
                digest = doom_hash(prefix, winning_nonce).hex()
                if self.is_pool:
                    res = self.submit_share(
                        height=current_job["height"],
                        nonce=winning_nonce,
                        hash_hex=digest,
                        timestamp=current_job.get("timestamp")
                    )
                    if res.get("block_solved"):
                        current_job = None
                    else:
                        current_nonce = winning_nonce + 1
                else:
                    print(f"\n[Sentinel] Solution found! Nonce: {winning_nonce}")
                    self.submit_solution(
                        height=current_job["height"],
                        nonce=winning_nonce,
                        hash_hex=digest,
                        timestamp=current_job.get("timestamp")
                    )
                    current_job = None  # Reset job to fetch new tip


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Doomsday Idle Sentinel GPU Miner")
    parser.add_argument("--node", default="http://127.0.0.1:8334", help="Doomsday Node URL")
    parser.add_argument("--pool", default=None, help="Doomsday Mining Pool URL (e.g. https://doomsday.network)")
    parser.add_argument("--wallet", required=True, help="DOOM payout address")
    parser.add_argument("--name", default="Rig-GPU", help="Miner identifier name")
    parser.add_argument("--idle-sec", type=float, default=60.0, help="Idle seconds required before mining")
    parser.add_argument("--continuous", action="store_true", help="Run continuously (for headless Linux/HiveOS rigs)")
    parser.add_argument("--device", type=int, default=0, help="Primary CUDA device index (default: 0)")
    parser.add_argument("--devices", default=None, help="Comma-separated GPU indices (e.g. 0,1) or 'all' for all available GPUs")
    parser.add_argument("--batch-size", type=int, default=10_000_000, help="Nonces per GPU batch")
    parser.add_argument("--temp-limit", type=int, default=75, help="Thermal cutoff in Celsius")
    parser.add_argument("--schedule-start", default=None, help="Scheduled mining window start (HH:MM 24h format, e.g. 23:00)")
    parser.add_argument("--schedule-end", default=None, help="Scheduled mining window end (HH:MM 24h format, e.g. 07:00)")
    parser.add_argument("--schedule-force", action="store_true", help="Force continuous 100%% mining during scheduled window")

    args = parser.parse_args()
    effective_idle = 0.0 if args.continuous else args.idle_sec

    target_devices = None
    if args.devices:
        if args.devices.strip().lower() == 'all':
            total_devs = CUDASolver.get_device_count()
            target_devices = list(range(max(1, total_devs)))
        else:
            target_devices = [int(x.strip()) for x in args.devices.split(',') if x.strip().isdigit()]

    sentinel = IdleSentinelMiner(
        node_url=args.node,
        wallet_address=args.wallet,
        miner_name=args.name,
        idle_threshold_sec=effective_idle,
        batch_size=args.batch_size,
        temp_limit_c=args.temp_limit,
        device_index=args.device,
        devices=target_devices,
        pool_url=args.pool,
        schedule_start=args.schedule_start,
        schedule_end=args.schedule_end,
        schedule_force=args.schedule_force
    )
    sentinel.run()
