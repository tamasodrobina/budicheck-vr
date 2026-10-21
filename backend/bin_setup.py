import os
import shutil
import imageio_ffmpeg

BIN_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "bin"))
os.makedirs(BIN_DIR, exist_ok=True)

is_windows = os.name == 'nt'
target_name = "ffmpeg.exe" if is_windows else "ffmpeg"
target_ffmpeg = os.path.join(BIN_DIR, target_name)

src_ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
if not os.path.exists(target_ffmpeg):
    print(f"Copying {src_ffmpeg} -> {target_ffmpeg}")
    shutil.copy2(src_ffmpeg, target_ffmpeg)
    if not is_windows:
        try:
            os.chmod(target_ffmpeg, 0o755)
        except Exception:
            pass
else:
    print(f"FFmpeg binary exists at: {target_ffmpeg}")

# Add BIN_DIR to PATH dynamically
if BIN_DIR not in os.environ.get("PATH", ""):
    os.environ["PATH"] = BIN_DIR + os.pathsep + os.environ.get("PATH", "")
    print(f"Added {BIN_DIR} to PATH environment variable.")

# Automatically discover and register installed NVIDIA CUDA/cuBLAS/cuDNN DLLs in venv
venv_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "venv"))
site_packages = os.path.join(venv_dir, "Lib", "site-packages")
nvidia_dir = os.path.join(site_packages, "nvidia")

if os.path.exists(nvidia_dir):
    for root, dirs, files in os.walk(nvidia_dir):
        if any(f.lower().endswith(".dll") for f in files):
            if hasattr(os, "add_dll_directory"):
                try:
                    os.add_dll_directory(root)
                except Exception:
                    pass
            if root not in os.environ.get("PATH", ""):
                os.environ["PATH"] = root + os.pathsep + os.environ.get("PATH", "")
                print(f"Added NVIDIA library path: {root}")
