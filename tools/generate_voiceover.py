"""
BudiCheck - Végleges Természetes Magyar Videó & Hangalámondás Generáló Eszköz

Készítette: Antigravity
Jellemzők:
  - 100% autentikus TheVR élmény: Jani valódi hangklipjei a videókból (Me Side & Reanimal)
  - Szóról szóra megegyező, pontos szinkron a hang és a felirat között
  - Természetes, barátságos magyar narráció (nem robotikus reklámszöveg)
  - Beégetett TikTok / Shorts stílusú vastag sárga-fehér dinamikus feliratok (.ass)
"""

import os
import sys
import subprocess
import asyncio
import edge_tts

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FFMPEG = os.path.join(BASE_DIR, "bin", "ffmpeg.exe" if sys.platform == "win32" else "ffmpeg")

def get_duration(filepath):
    cmd = [FFMPEG, "-i", filepath]
    res = subprocess.run(cmd, stderr=subprocess.PIPE, stdout=subprocess.PIPE, text=True, encoding="utf-8", errors="ignore")
    for line in res.stderr.splitlines():
        if "Duration:" in line:
            parts = line.split("Duration:")[1].split(",")[0].strip().split(":")
            return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
    return 0.0

async def main():
    sys.stdout.reconfigure(encoding="utf-8")
    print("BudiCheck Jani szinkronizált videók gyártása...")
    from scratch.build_perfect_hybrid import build_perfect
    await build_perfect()
    print("[OK] Mindkét videó (Shorts és Demo) sikeresen elkészült!")

if __name__ == "__main__":
    asyncio.run(main())
