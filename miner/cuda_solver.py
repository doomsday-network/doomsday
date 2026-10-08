import ctypes
import os
import struct
import time
import hashlib
import glob
from typing import Optional, Tuple
from core.crypto import doom_hash

CUDA_SOURCE = r"""
typedef unsigned char uint8_t;
typedef unsigned int uint32_t;
typedef unsigned long long uint64_t;

extern "C" {

__device__ __forceinline__ uint32_t rotr32(uint32_t x, int n) {
    return (x >> n) | (x << (32 - n));
}

__device__ __forceinline__ uint64_t rotl64(uint64_t x, int n) {
    return (x << n) | (x >> (64 - n));
}

__constant__ uint32_t K[64] = {
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
};

__device__ void sha256_transform(uint32_t state[8], const uint32_t data[16]) {
    uint32_t W[64];
    #pragma unroll
    for (int i = 0; i < 16; i++) {
        W[i] = data[i];
    }
    #pragma unroll
    for (int i = 16; i < 64; i++) {
        uint32_t s0 = rotr32(W[i-15], 7) ^ rotr32(W[i-15], 18) ^ (W[i-15] >> 3);
        uint32_t s1 = rotr32(W[i-2], 17) ^ rotr32(W[i-2], 19) ^ (W[i-2] >> 10);
        W[i] = W[i-16] + s0 + W[i-7] + s1;
    }

    uint32_t a = state[0], b = state[1], c = state[2], d = state[3];
    uint32_t e = state[4], f = state[5], g = state[6], h = state[7];

    #pragma unroll
    for (int i = 0; i < 64; i++) {
        uint32_t S1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
        uint32_t ch = (e & f) ^ ((~e) & g);
        uint32_t temp1 = h + S1 + ch + K[i] + W[i];
        uint32_t S0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
        uint32_t maj = (a & b) ^ (a & c) ^ (b & c);
        uint32_t temp2 = S0 + maj;

        h = g;
        g = f;
        f = e;
        e = d + temp1;
        d = c;
        c = b;
        b = a;
        a = temp1 + temp2;
    }

    state[0] += a; state[1] += b; state[2] += c; state[3] += d;
    state[4] += e; state[5] += f; state[6] += g; state[7] += h;
}

__device__ void sha256_64bytes(const uint8_t* in, uint8_t* out) {
    uint32_t state[8] = {
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    };
    uint32_t chunk1[16];
    #pragma unroll
    for (int i = 0; i < 16; i++) {
        int idx = i * 4;
        chunk1[i] = ((uint32_t)in[idx] << 24) | ((uint32_t)in[idx+1] << 16) | ((uint32_t)in[idx+2] << 8) | ((uint32_t)in[idx+3]);
    }
    sha256_transform(state, chunk1);

    uint32_t chunk2[16];
    #pragma unroll
    for (int i = 0; i < 16; i++) chunk2[i] = 0;
    chunk2[0] = 0x80000000;
    chunk2[15] = 512;
    sha256_transform(state, chunk2);

    #pragma unroll
    for (int i = 0; i < 8; i++) {
        out[i*4]   = (uint8_t)(state[i] >> 24);
        out[i*4+1] = (uint8_t)(state[i] >> 16);
        out[i*4+2] = (uint8_t)(state[i] >> 8);
        out[i*4+3] = (uint8_t)(state[i]);
    }
}

__global__ void doom_mine_kernel(
    uint64_t seed0, uint64_t seed1, uint64_t seed2, uint64_t seed3,
    uint64_t start_nonce,
    uint32_t total_nonces,
    uint64_t target_high,
    uint32_t* d_found,
    uint64_t* d_winning_nonce
) {
    uint64_t tid = (uint64_t)blockDim.x * blockIdx.x + threadIdx.x;
    if (tid >= total_nonces) return;
    if (*d_found != 0) return;

    uint64_t nonce = start_nonce + tid;

    uint64_t w[8];
    w[0] = seed0;
    w[1] = seed1;
    w[2] = seed2;
    w[3] = seed3;
    w[4] = nonce;
    w[5] = nonce ^ 0x5555555555555555ULL;
    w[6] = nonce ^ 0xAAAAAAAAAAAAAAAAULL;
    w[7] = 0x9E3779B97F4A7C15ULL;

    #pragma unroll
    for (int r = 0; r < 8; r++) {
        #pragma unroll
        for (int i = 0; i < 8; i++) {
            int next_idx = (i + 1) & 7;
            int prev_idx = (i + 7) & 7;
            uint64_t val = w[i] ^ w[next_idx];
            uint64_t rot = rotl64(val, 17);
            w[i] = rot * 0x9E3779B97F4A7C15ULL + w[prev_idx] + (uint64_t)r;
        }
    }

    uint8_t hash_out[32];
    sha256_64bytes((const uint8_t*)w, hash_out);

    uint64_t hash_high = 0;
    #pragma unroll
    for (int k = 0; k < 8; k++) {
        hash_high = (hash_high << 8) | hash_out[k];
    }

    if (hash_high < target_high) {
        atomicExch(d_found, 1);
        atomicExch((unsigned long long*)d_winning_nonce, (unsigned long long)nonce);
    }
}

}
"""


class CUDASolver:
    """
    High-performance, bare-metal GPU mining engine for DoomHash.
    Compiles CUDA C kernels in-memory via NVRTC and executes via nvcuda.dll.
    """
    def __init__(self, device_index: int = 0):
        self.device_index = device_index

        # Locate NVRTC library across multiple common locations
        nvrtc_path = None

        # 1. Local miner directory
        local_dir = os.path.dirname(os.path.abspath(__file__))
        local_dlls = [f for f in glob.glob(os.path.join(local_dir, "nvrtc64_*.dll")) if "alt" not in os.path.basename(f).lower()]
        if local_dlls:
            nvrtc_path = local_dlls[0]
            try:
                os.add_dll_directory(local_dir)
            except (AttributeError, OSError):
                pass

        # 2. PyTorch bundled runtime
        if not nvrtc_path:
            try:
                import torch
                torch_lib = os.path.join(os.path.dirname(torch.__file__), 'lib')
                if os.path.exists(torch_lib):
                    try:
                        os.add_dll_directory(torch_lib)
                    except (AttributeError, OSError):
                        pass
                    torch_dlls = [f for f in glob.glob(os.path.join(torch_lib, "nvrtc64_*.dll")) if "alt" not in os.path.basename(f).lower()]
                    if torch_dlls:
                        nvrtc_path = torch_dlls[0]
            except (ImportError, Exception):
                pass

        # 3. CUDA_PATH / Toolkit
        if not nvrtc_path:
            cuda_path = os.environ.get("CUDA_PATH")
            if cuda_path:
                bin_dir = os.path.join(cuda_path, "bin")
                cuda_dlls = [f for f in glob.glob(os.path.join(bin_dir, "nvrtc64_*.dll")) if "alt" not in os.path.basename(f).lower()]
                if cuda_dlls:
                    nvrtc_path = cuda_dlls[0]
                    try:
                        os.add_dll_directory(bin_dir)
                    except (AttributeError, OSError):
                        pass

        # 4. Load NVRTC
        if nvrtc_path:
            dll_folder = os.path.dirname(nvrtc_path)
            try:
                ctypes.windll.kernel32.SetDllDirectoryW(dll_folder)
            except Exception:
                pass
            os.environ["PATH"] = dll_folder + os.pathsep + os.environ.get("PATH", "")
            self.nvrtc = ctypes.CDLL(nvrtc_path)
        else:
            try:
                self.nvrtc = ctypes.CDLL('nvrtc64_120_0.dll')
            except OSError:
                self.nvrtc = ctypes.CDLL('nvrtc.dll')

        self.cuda = ctypes.WinDLL('nvcuda.dll')

        assert self.cuda.cuInit(0) == 0, "Failed to initialize CUDA driver"
        self.device = ctypes.c_int()
        assert self.cuda.cuDeviceGet(ctypes.byref(self.device), device_index) == 0
        self.ctx = ctypes.c_void_p()
        assert self.cuda.cuCtxCreate_v2(ctypes.byref(self.ctx), 0, self.device) == 0

        # Query GPU Name
        name_buf = ctypes.create_string_buffer(256)
        self.cuda.cuDeviceGetName(name_buf, 256, self.device)
        self.device_name = name_buf.value.decode('utf-8')

        # Compile Kernel
        self._compile_kernel()

        # Allocate reusable device buffers
        self.d_found = ctypes.c_void_p()
        self.d_nonce = ctypes.c_void_p()
        self.cuda.cuMemAlloc_v2(ctypes.byref(self.d_found), 4)
        self.cuda.cuMemAlloc_v2(ctypes.byref(self.d_nonce), 8)

    def _compile_kernel(self):
        prog = ctypes.c_void_p()
        c_src = CUDA_SOURCE.encode('utf-8')
        assert self.nvrtc.nvrtcCreateProgram(ctypes.byref(prog), c_src, b'doom_miner.cu', 0, None, None) == 0

        opts = (ctypes.c_char_p * 2)(b'--gpu-architecture=compute_75', b'--use_fast_math')
        res = self.nvrtc.nvrtcCompileProgram(prog, 2, opts)
        if res != 0:
            log_size = ctypes.c_size_t()
            self.nvrtc.nvrtcGetProgramLogSize(prog, ctypes.byref(log_size))
            log = ctypes.create_string_buffer(log_size.value)
            self.nvrtc.nvrtcGetProgramLog(prog, log)
            raise RuntimeError(f"NVRTC compilation failed:\n{log.value.decode()}")

        ptx_size = ctypes.c_size_t()
        self.nvrtc.nvrtcGetPTXSize(prog, ctypes.byref(ptx_size))
        ptx = ctypes.create_string_buffer(ptx_size.value)
        self.nvrtc.nvrtcGetPTX(prog, ptx)

        self.module = ctypes.c_void_p()
        assert self.cuda.cuModuleLoadData(ctypes.byref(self.module), ptx.value) == 0
        self.kernel = ctypes.c_void_p()
        assert self.cuda.cuModuleGetFunction(ctypes.byref(self.kernel), self.module, b'doom_mine_kernel') == 0

    def mine_batch(
        self,
        seed_u64: Tuple[int, int, int, int],
        start_nonce: int,
        batch_size: int,
        target_high: int
    ) -> Tuple[bool, int, float]:
        """
        Executes a batch of nonces on the GPU.
        Returns: (found: bool, winning_nonce: int, hashes_per_second: float)
        """
        # Clear found flag
        zero32 = ctypes.c_uint32(0)
        zero64 = ctypes.c_uint64(0)
        self.cuda.cuMemcpyHtoD_v2(self.d_found, ctypes.byref(zero32), 4)
        self.cuda.cuMemcpyHtoD_v2(self.d_nonce, ctypes.byref(zero64), 8)

        threads_per_block = 256
        blocks = (batch_size + threads_per_block - 1) // threads_per_block

        c_seed0 = ctypes.c_uint64(seed_u64[0])
        c_seed1 = ctypes.c_uint64(seed_u64[1])
        c_seed2 = ctypes.c_uint64(seed_u64[2])
        c_seed3 = ctypes.c_uint64(seed_u64[3])
        c_start_nonce = ctypes.c_uint64(start_nonce)
        c_total = ctypes.c_uint32(batch_size)
        c_target_high = ctypes.c_uint64(target_high)

        args = (ctypes.c_void_p * 9)(
            ctypes.cast(ctypes.byref(c_seed0), ctypes.c_void_p),
            ctypes.cast(ctypes.byref(c_seed1), ctypes.c_void_p),
            ctypes.cast(ctypes.byref(c_seed2), ctypes.c_void_p),
            ctypes.cast(ctypes.byref(c_seed3), ctypes.c_void_p),
            ctypes.cast(ctypes.byref(c_start_nonce), ctypes.c_void_p),
            ctypes.cast(ctypes.byref(c_total), ctypes.c_void_p),
            ctypes.cast(ctypes.byref(c_target_high), ctypes.c_void_p),
            ctypes.cast(ctypes.byref(self.d_found), ctypes.c_void_p),
            ctypes.cast(ctypes.byref(self.d_nonce), ctypes.c_void_p),
        )

        t0 = time.perf_counter()
        self.cuda.cuLaunchKernel(self.kernel, blocks, 1, 1, threads_per_block, 1, 1, 0, None, args, None)
        self.cuda.cuCtxSynchronize()
        t1 = time.perf_counter()

        elapsed = max(1e-6, t1 - t0)
        hashrate = batch_size / elapsed

        found_val = ctypes.c_uint32(0)
        winning_nonce = ctypes.c_uint64(0)
        self.cuda.cuMemcpyDtoH_v2(ctypes.byref(found_val), self.d_found, 4)
        self.cuda.cuMemcpyDtoH_v2(ctypes.byref(winning_nonce), self.d_nonce, 8)

        is_found = (found_val.value != 0)
        return is_found, winning_nonce.value, hashrate

    def close(self):
        if hasattr(self, 'd_found') and self.d_found:
            self.cuda.cuMemFree_v2(self.d_found)
            self.d_found = None
        if hasattr(self, 'd_nonce') and self.d_nonce:
            self.cuda.cuMemFree_v2(self.d_nonce)
            self.d_nonce = None
        if hasattr(self, 'ctx') and self.ctx:
            self.cuda.cuCtxDestroy_v2(self.ctx)
            self.ctx = None
