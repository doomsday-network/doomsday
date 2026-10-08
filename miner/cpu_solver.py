import time
from typing import Tuple
from core.crypto import doom_hash, bits_to_target


class CPUSolver:
    """Fallback multi-threaded/single-threaded CPU miner for testing or non-GPU machines."""
    def __init__(self):
        self.device_name = "CPU Reference Solver"

    def mine_batch(
        self,
        header_prefix: bytes,
        start_nonce: int,
        batch_size: int,
        target: int
    ) -> Tuple[bool, int, float]:
        t0 = time.perf_counter()
        end_nonce = start_nonce + batch_size

        for nonce in range(start_nonce, end_nonce):
            digest = doom_hash(header_prefix, nonce)
            if int.from_bytes(digest, byteorder='big') < target:
                t1 = time.perf_counter()
                elapsed = max(1e-6, t1 - t0)
                return True, nonce, (nonce - start_nonce + 1) / elapsed

        t1 = time.perf_counter()
        elapsed = max(1e-6, t1 - t0)
        return False, 0, batch_size / elapsed
