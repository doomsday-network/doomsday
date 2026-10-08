import ctypes
import os
import torch

def test_nvrtc():
    torch_lib = os.path.join(os.path.dirname(torch.__file__), 'lib')
    os.add_dll_directory(torch_lib)
    nvrtc = ctypes.CDLL(os.path.join(torch_lib, 'nvrtc64_120_0.dll'))
    cuda = ctypes.WinDLL('nvcuda.dll')

    assert cuda.cuInit(0) == 0
    dev = ctypes.c_int()
    assert cuda.cuDeviceGet(ctypes.byref(dev), 0) == 0
    ctx = ctypes.c_void_p()
    assert cuda.cuCtxCreate_v2(ctypes.byref(ctx), 0, dev) == 0

    code = b"""
    extern "C" __global__ void add_one(int* out, int val) {
        *out = val + 1;
    }
    """

    prog = ctypes.c_void_p()
    res = nvrtc.nvrtcCreateProgram(ctypes.byref(prog), code, b'kernel.cu', 0, None, None)
    assert res == 0

    opts = (ctypes.c_char_p * 1)(b'--gpu-architecture=compute_75')
    res = nvrtc.nvrtcCompileProgram(prog, 1, opts)
    if res != 0:
        log_size = ctypes.c_size_t()
        nvrtc.nvrtcGetProgramLogSize(prog, ctypes.byref(log_size))
        log = ctypes.create_string_buffer(log_size.value)
        nvrtc.nvrtcGetProgramLog(prog, log)
        print('Compilation failed:', log.value.decode())
        return False
    
    ptx_size = ctypes.c_size_t()
    nvrtc.nvrtcGetPTXSize(prog, ctypes.byref(ptx_size))
    ptx = ctypes.create_string_buffer(ptx_size.value)
    nvrtc.nvrtcGetPTX(prog, ptx)

    module = ctypes.c_void_p()
    assert cuda.cuModuleLoadData(ctypes.byref(module), ptx.value) == 0
    func = ctypes.c_void_p()
    assert cuda.cuModuleGetFunction(ctypes.byref(func), module, b'add_one') == 0

    d_out = ctypes.c_void_p()
    cuda.cuMemAlloc_v2(ctypes.byref(d_out), 4)
    val = ctypes.c_int(99)
    
    args = (ctypes.c_void_p * 2)(
        ctypes.cast(ctypes.byref(d_out), ctypes.c_void_p),
        ctypes.cast(ctypes.byref(val), ctypes.c_void_p)
    )
    cuda.cuLaunchKernel(func, 1, 1, 1, 1, 1, 1, 0, None, args, None)
    cuda.cuCtxSynchronize()

    res_val = ctypes.c_int(0)
    cuda.cuMemcpyDtoH_v2(ctypes.byref(res_val), d_out, 4)
    print('Kernel executed successfully! Result (expected 100):', res_val.value)

    cuda.cuMemFree_v2(d_out)
    cuda.cuCtxDestroy_v2(ctx)
    return res_val.value == 100

if __name__ == '__main__':
    test_nvrtc()
