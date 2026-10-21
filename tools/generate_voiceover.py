"""
BudiCheck - Természetes Magyar Hangalámondás Generáló Eszköz (Edge Neural TTS + FFmpeg)

Készítette: Antigravity
Jellemzők:
  - Természetes, emberi hangzású magyar neurális TTS (hu-HU-TamasNeural)
  - Fonetikus magyar kiejtés ("Budi Csekk", nem angolosan / akadozva)
  - Milliszekundumos időzítés és szinkron a videó képi váltásaihoz
  - Veszteségmentes videósáv másolás (-c:v copy), kristálytiszta AAC hang
"""

import asyncio
import edge_tts
import subprocess
import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FFMPEG = os.path.join(BASE_DIR, "bin", "ffmpeg.exe" if sys.platform == "win32" else "ffmpeg")

# Természetes, jól hangzó magyar mondatok, pontosan a 20.4 mp-es videóhoz igazítva
SCRIPTS = [
    {
        "id": "1_intro",
        # Fonetikus kiejtés: Budi Csekk
        "text": "Kíváncsi vagy Jani budi értékeléseire? Itt a Budi Csekk!",
        "rate": "+20%",
        "preferred_start": 0.30
    },
    {
        "id": "2_tierlist",
        # Képi váltás: Közösségi Tier List / szavazás
        "text": "Böngészd a hivatalos rangsort, vagy szavazz te is a listán!",
        "rate": "+18%",
        "preferred_start": 4.80
    },
    {
        "id": "3_cards",
        # Képi váltás: Kártya galéria & YouTube időkódok
        "text": "Minden budihoz pontos pontszám és vágott videó tartozik.",
        "rate": "+18%",
        "preferred_start": 8.80
    },
    {
        "id": "4_quiz",
        # Képi váltás: Budi Kvíz minijáték felhívás
        "text": "Tedd próbára magad a kvízben: vajon eltalálod a pontokat?",
        "rate": "+18%",
        "preferred_start": 12.80
    },
    {
        "id": "5_outro",
        # Képi váltás: Lábjegyzet & archívum statisztikák
        "text": "Csekkold az oldalt, és szavazz te is a Budi Csekken!",
        "rate": "+15%",
        "preferred_start": 16.80
    }
]

def get_duration(filepath):
    cmd = [FFMPEG, "-i", filepath]
    res = subprocess.run(cmd, stderr=subprocess.PIPE, stdout=subprocess.PIPE, text=True, encoding="utf-8", errors="ignore")
    for line in res.stderr.splitlines():
        if "Duration:" in line:
            parts = line.split("Duration:")[1].split(",")[0].strip().split(":")
            return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
    return 0.0

async def build_voiceover_for_video(video_in, video_out, voice="hu-HU-TamasNeural", voice_label="tamas"):
    video_in_path = os.path.join(BASE_DIR, video_in)
    video_out_path = os.path.join(BASE_DIR, video_out)
    
    if not os.path.exists(video_in_path):
        print(f"[!] Hiba: Forrás videó nem található: {video_in_path}")
        return

    target_duration = get_duration(video_in_path)
    voice_dir = os.path.join(BASE_DIR, "scratch", voice_label)
    os.makedirs(voice_dir, exist_ok=True)
    
    inputs = []
    delays = []
    current_time = 0.0
    
    sys.stdout.reconfigure(encoding="utf-8")
    print(f"\n=======================================================")
    print(f"Hangalamondas generalasa: {voice} ({voice_label})")
    print(f"Forras video: {video_in} ({target_duration:.2f}s) -> Cel: {video_out}")
    print(f"=======================================================")
    
    for i, item in enumerate(SCRIPTS):
        fpath = os.path.join(voice_dir, f"{item['id']}.mp3")
        comm = edge_tts.Communicate(item["text"], voice, rate=item["rate"])
        await comm.save(fpath)
        dur = get_duration(fpath)
        
        if i == 0:
            actual_start = item["preferred_start"]
        else:
            actual_start = max(item["preferred_start"], current_time + 0.35)
            
        end = actual_start + dur
        current_time = end
        print(f"  [{item['id']}] {actual_start:.2f}s - {end:.2f}s (hossz: {dur:.2f}s): {item['text']}")
        
        inputs.extend(["-i", fpath])
        delay_ms = int(actual_start * 1000)
        delays.append(f"[{i}:a]adelay={delay_ms}|{delay_ms}[a{i}]")
        
    audio_wav = os.path.join(voice_dir, "master_voiceover.wav")
    inputs_mix = "".join(f"[a{i}]" for i in range(len(SCRIPTS)))
    filter_complex = f"{';'.join(delays)};{inputs_mix}amix=inputs={len(SCRIPTS)}:normalize=0,volume=1.4[outa]"
    
    cmd_audio = [
        FFMPEG, "-y",
        *inputs,
        "-filter_complex", filter_complex,
        "-map", "[outa]",
        "-t", str(target_duration),
        audio_wav
    ]
    subprocess.run(cmd_audio, check=True)
    
    # Videó és audió összefűzése: videó érintetlen (copy), audió kitöltve a videó végéig
    cmd_mux = [
        FFMPEG, "-y",
        "-i", video_in_path,
        "-i", audio_wav,
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        "-af", f"apad=whole_dur={target_duration:.2f}",
        "-t", str(target_duration),
        video_out_path
    ]
    subprocess.run(cmd_mux, check=True)
    print(f"[OK] Sikerult! Elkeszult a narralt video: {video_out}")

async def main():
    # 1. Shorts videó (9:16) Tamás természetes férfihanggal
    await build_voiceover_for_video("budicheck_shorts.mp4", "budicheck_shorts_voiced.mp4", "hu-HU-TamasNeural", "tamas")
    # 2. Fekvő videó (16:9) Tamás természetes férfihanggal
    await build_voiceover_for_video("budicheck_demo.mp4", "budicheck_demo_voiced.mp4", "hu-HU-TamasNeural", "tamas")

if __name__ == "__main__":
    asyncio.run(main())
