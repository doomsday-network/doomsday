import argparse
import ctypes
import os
import subprocess
import sys
import time
import requests
from typing import Optional, Dict, Any, Tuple
from miner.cuda_solver import CUDASolver
from core.crypto import doom_hash


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


def get_gpu_telemetry() -> Dict[str, Any]:
    """Query temperature, power usage, and utilization from nvidia-smi."""
    try:
        res = subprocess.run(
            ["nvidia-smi", "--query-gpu=temperature.gpu,power.draw,utilization.gpu", "--format=csv,noheader,nounits"],
            capture_output=True,
            text=True,
            timeout=1
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
        temp_limit_c: int = 75
    ):
        if not node_url.startswith("http://") and not node_url.startswith("https://"):
            node_url = "https://" + node_url
        self.node_url = node_url.rstrip('/')
        self.fallback_url = "http://35.254.109.168:8334"
        self.active_node_url = self.node_url
        self.wallet_address = wallet_address
        self.miner_name = miner_name
        self.idle_threshold_sec = idle_threshold_sec
        self.batch_size = batch_size
        self.temp_limit_c = temp_limit_c

        print(f"Initializing Mining Engine for [{self.miner_name}]...")
        try:
            self.solver = CUDASolver()
            print(f"Engine Ready: {self.solver.device_name}")
        except Exception as e:
            print(f"[!] CUDA GPU Initialization failed ({e}). Falling back to CPU Solver...")
            from miner.cpu_solver import CPUSolver
            self.solver = CPUSolver()
            print(f"Engine Ready: CPU Reference Solver")

    def fetch_job(self) -> Optional[Dict[str, Any]]:
        """Request the latest block mining job from the Doomsday Node."""
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
        print(f"Thermal Cutoff: {self.temp_limit_c}°C\n")

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

            # Check if user is active
            if idle_sec < self.idle_threshold_sec:
                set_prevent_sleep(False)  # Allow normal power states while user active
                if time.time() - last_heartbeat > 3:
                    sys.stdout.write(f"\r[User Active] Standing by... (Idle: {idle_sec:.1f}s / {self.idle_threshold_sec:.0f}s)   ")
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
                if fresh_job and fresh_job.get("header_prefix_hex") != current_job.get("header_prefix_hex"):
                    current_job = fresh_job
                    current_nonce = 0
                    print(f"\n[Sentinel] Job updated (mempool/tip change) | Block #{current_job['height']}")
                last_job_check = time.time()

            # Execute batch on GPU
            seed_u64 = tuple(current_job["seed_u64"])
            target_high = current_job["target_high"]

            found, winning_nonce, hashrate = self.solver.mine_batch(
                seed_u64=seed_u64,
                start_nonce=current_nonce,
                batch_size=self.batch_size,
                target_high=target_high
            )

            current_nonce += self.batch_size
            mhs = hashrate / 1_000_000.0

            sys.stdout.write(
                f"\r[MINING] Block #{current_job['height']} | "
                f"Speed: {mhs:.2f} MH/s | "
                f"GPU: {gpu_stats['temp_c']}°C ({gpu_stats['power_w']}W) | "
                f"Nonces: {current_nonce:,}   "
            )
            sys.stdout.flush()

            if time.time() - last_heartbeat > 2:
                self.send_telemetry("MINING", mhs, gpu_stats)
                last_heartbeat = time.time()

            if found:
                print(f"\n[Sentinel] Solution found! Nonce: {winning_nonce}")
                # Verify and submit
                prefix = bytes.fromhex(current_job["header_prefix_hex"])
                digest = doom_hash(prefix, winning_nonce).hex()
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
    parser.add_argument("--wallet", required=True, help="DOOM payout address")
    parser.add_argument("--name", default="Rig-5080", help="Miner identifier name")
    parser.add_argument("--idle-sec", type=float, default=60.0, help="Idle seconds required before mining")
    parser.add_argument("--batch-size", type=int, default=10_000_000, help="Nonces per GPU batch")
    parser.add_argument("--temp-limit", type=int, default=75, help="Thermal cutoff in Celsius")

    args = parser.parse_args()
    sentinel = IdleSentinelMiner(
        node_url=args.node,
        wallet_address=args.wallet,
        miner_name=args.name,
        idle_threshold_sec=args.idle_sec,
        batch_size=args.batch_size,
        temp_limit_c=args.temp_limit
    )
    sentinel.run()
