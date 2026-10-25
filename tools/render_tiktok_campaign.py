import os
import sys
import json
import subprocess

if sys.stdout:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr:
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

FFMPEG = os.path.abspath("bin/ffmpeg.exe")
OUTPUT_DIR = os.path.abspath("output/tiktok_campaign")
os.makedirs(OUTPUT_DIR, exist_ok=True)

with open("scratch/campaign_timings.json", "r", encoding="utf-8") as f:
    campaign_data = json.load(f)

def format_ass_time(sec):
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = sec % 60
    return f"{h:01d}:{m:02d}:{s:05.2f}"

def render_video(vid_key, vid_info):
    print(f"\n=======================================================")
    print(f"RENDERING CAMPAIGN VIDEO: {vid_info['title']} ({vid_key})")
    print(f"=======================================================")
    
    total_dur = vid_info["total_duration"]
    segments = vid_info["segments"]
    
    # 1. Create Concat Demuxer for Slides
    concat_file = os.path.join(OUTPUT_DIR, f"{vid_key}_concat.txt")
    with open(concat_file, "w", encoding="utf-8") as f:
        for seg in segments:
            slide_path = os.path.abspath(f"scratch/campaign_slides/{seg['id']}.jpg")
            f.write(f"file '{slide_path.replace(chr(92), '/')}'\n")
            f.write(f"duration {seg['seg_dur']:.3f}\n")
        # Repeat last slide without duration to prevent abrupt EOF
        last_slide = os.path.abspath(f"scratch/campaign_slides/{segments[-1]['id']}.jpg")
        f.write(f"file '{last_slide.replace(chr(92), '/')}'\n")

    # 2. Generate ASS Subtitles (Clean, dynamic captions placed right above bottom banner)
    ass_file = os.path.join(OUTPUT_DIR, f"{vid_key}.ass")
    ass_lines = [
        "[Script Info]",
        f"Title: {vid_info['title']}",
        "ScriptType: v4.00+",
        "PlayResX: 1080",
        "PlayResY: 1920",
        "ScaledBorderAndShadow: yes",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        # TikTok Viral Style Caption: Bold yellow text, heavy black border, centered in safe channel
        "Style: TikTokCaption,Arial,40,&H0000FFFF,&H000000FF,&H00000000,&H90000000,-1,0,0,0,100,100,0,0,1,5,2,2,70,70,200,1",
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    
    for seg in segments:
        st = format_ass_time(seg["start_time"])
        et = format_ass_time(seg["end_time"])
        caption_txt = seg["text"].replace("\n", " ")
        # Break into two lines if long
        words = caption_txt.split()
        if len(words) > 7:
            mid = len(words) // 2
            caption_txt = " ".join(words[:mid]) + "\\N" + " ".join(words[mid:])
        ass_lines.append(f"Dialogue: 1,{st},{et},TikTokCaption,,0,0,0,,{{\\b1}}{caption_txt}")
        
    with open(ass_file, "w", encoding="utf-8") as f:
        f.write("\n".join(ass_lines) + "\n")

    # 3. Build Audio Inputs & Filter Complex
    audio_inputs = []
    delays = []
    mix_labels = []
    
    # Add speech segments
    in_idx = 1
    for seg in segments:
        audio_inputs.extend(["-i", os.path.abspath(seg["audio_path"])])
        delay_ms = int(seg["start_time"] * 1000)
        delays.append(f"[{in_idx}:a]adelay={delay_ms}|{delay_ms},volume=1.35[a_spk_{in_idx}]")
        mix_labels.append(f"[a_spk_{in_idx}]")
        in_idx += 1
        
    # Add SFX per video
    sfx_cues = []
    if vid_key == "video_01_top_worst":
        sfx_cues = [
            ("scratch/sfx/whoosh.wav", 0.05, 0.8),
            ("scratch/sfx/vine_boom.wav", segments[1]["start_time"] + 0.1, 0.9),
            ("scratch/sfx/vine_boom.wav", segments[2]["start_time"] + 0.1, 0.9),
            ("scratch/sfx/fail_buzzer.wav", segments[3]["start_time"] + 0.1, 0.85),
            ("scratch/sfx/chime.wav", segments[4]["start_time"] + 0.2, 0.8)
        ]
    elif vid_key == "video_02_interactive_quiz":
        sfx_cues = [
            ("scratch/sfx/whoosh.wav", 0.05, 0.8),
            ("scratch/sfx/tick.wav", segments[1]["start_time"] + 1.2, 0.75),
            ("scratch/sfx/tock.wav", segments[1]["start_time"] + 2.2, 0.75),
            ("scratch/sfx/tick.wav", segments[1]["start_time"] + 3.2, 0.75),
            ("scratch/sfx/fail_buzzer.wav", segments[2]["start_time"] + 0.1, 0.9),
            ("scratch/sfx/chime.wav", segments[3]["start_time"] + 0.2, 0.8)
        ]
    elif vid_key == "video_03_perfect_ten":
        sfx_cues = [
            ("scratch/sfx/whoosh.wav", 0.05, 0.8),
            ("scratch/sfx/vine_boom.wav", segments[1]["start_time"] + 0.1, 0.85),
            ("scratch/sfx/fanfare.wav", segments[2]["start_time"] + 0.1, 0.95),
            ("scratch/sfx/chime.wav", segments[3]["start_time"] + 0.2, 0.8)
        ]
        
    sfx_idx = in_idx
    for sfx_path, sfx_time, sfx_vol in sfx_cues:
        if os.path.exists(sfx_path):
            audio_inputs.extend(["-i", os.path.abspath(sfx_path)])
            delay_ms = int(sfx_time * 1000)
            delays.append(f"[{sfx_idx}:a]adelay={delay_ms}|{delay_ms},volume={sfx_vol}[a_sfx_{sfx_idx}]")
            mix_labels.append(f"[a_sfx_{sfx_idx}]")
            sfx_idx += 1

    total_audio_tracks = len(mix_labels)
    filter_complex_audio = f"{';'.join(delays)};{''.join(mix_labels)}amix=inputs={total_audio_tracks}:normalize=0:dropout_transition=0[aout]"

    # Video subtitle filter: format path for libass in Windows
    ass_filter_path = ass_file.replace("\\", "/").replace(":", "\\:")
    video_filter = f"subtitles='{ass_filter_path}'"

    output_video_path = os.path.join(OUTPUT_DIR, f"{vid_key}.mp4")

    cmd = [
        FFMPEG, "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", concat_file,
        *audio_inputs,
        "-filter_complex", f"{filter_complex_audio};[0:v]{video_filter}[vout]",
        "-map", "[vout]",
        "-map", "[aout]",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-r", "30",
        "-c:a", "aac",
        "-b:a", "192k",
        "-t", f"{total_dur:.2f}",
        output_video_path
    ]

    print("Running ffmpeg command...")
    res = subprocess.run(cmd, stderr=subprocess.PIPE, stdout=subprocess.PIPE, text=True, encoding="utf-8", errors="ignore")
    if res.returncode != 0:
        print("FFMPEG ERROR:")
        print(res.stderr[-2000:])
        raise RuntimeError("FFmpeg rendering failed")
        
    size_mb = os.path.getsize(output_video_path) / (1024 * 1024)
    print(f"Finished {vid_key}.mp4 ({size_mb:.2f} MB, {total_dur:.2f}s) -> {output_video_path}")
    return output_video_path, size_mb, total_dur

def main():
    rendered_results = {}
    for vid_key, vid_info in campaign_data.items():
        vpath, size_mb, dur = render_video(vid_key, vid_info)
        rendered_results[vid_key] = {
            "title": vid_info["title"],
            "path": vpath,
            "size_mb": round(size_mb, 2),
            "duration": round(dur, 2)
        }
        
    summary_md = f"""# TheVR Jani BudiCheck TikTok / Shorts Kampány - Elkészült Videók

A kampányterv alapján mindhárom vertikális (9:16, 1080x1920) TikTok / Instagram Reels / YouTube Shorts videó sikeresen legenerálásra került!

---

## 1. Videó: A 3 legrosszabb budi Jani szerint
* **Fájl:** `output/tiktok_campaign/video_01_top_worst.mp4`
* **Időtartam:** {rendered_results['video_01_top_worst']['duration']} mp
* **Méret:** {rendered_results['video_01_top_worst']['size_mb']} MB
* **Tartalom:** Beneath The Quiet (0.8 pont), Lobotomy (0.5 pont), Backrooms Primal (0.5 pont).
* **Poszt Leírás (TikTok / Shorts):**
  > A legrosszabb budik, amikkel Jani valaha találkozott! 💀🚽 0.5 és 0.8 pontok a mélyben. A teljes rangsorért és a többi katasztrófáért keresd fel az oldalt: 👉 budicheck-vr.onrender.com
* **Hashtagek:** `#thevr #thevrjani #budicheck #thevrhungary #horrorpentek #gaminghungary #tierlist #fyp`

---

## 2. Videó: Budi Kvíz: Te vagy Jani pontoz jobban?
* **Fájl:** `output/tiktok_campaign/video_02_interactive_quiz.mp4`
* **Időtartam:** {rendered_results['video_02_interactive_quiz']['duration']} mp
* **Méret:** {rendered_results['video_02_interactive_quiz']['size_mb']} MB
* **Tartalom:** Interaktív kvíz, visszaszámlálás, majd a 0.8 pontos leleplezés.
* **Poszt Leírás (TikTok / Shorts):**
  > Te hány pontot adtál volna erre a budira? 🚽 Jani nem kegyelmezett: 0.8 pont! 😂 Teszteld le az ízlésed a beépített kvízzel: 👉 budicheck-vr.onrender.com
* **Hashtagek:** `#thevr #thevrjani #budicheck #thevrhungary #kviz #gaminghungary #tierlist #nekedbe #fyp`

---

## 3. Videó: Létezik tökéletes, 10/10-es budi?
* **Fájl:** `output/tiktok_campaign/video_03_perfect_ten.mp4`
* **Időtartam:** {rendered_results['video_03_perfect_ten']['duration']} mp
* **Méret:** {rendered_results['video_03_perfect_ten']['size_mb']} MB
* **Tartalom:** The Night Cleaner (9.5 pont), Reanimal (10.0 pont – a győztes, le lehet húzni!).
* **Poszt Leírás (TikTok / Shorts):**
  > Létezik 10/10-es budi horrorjátékban? Jani szerint igen! 👑🚽 Nézd meg az összes S-tier és győztes értékelést az oldalon: 👉 budicheck-vr.onrender.com
* **Hashtagek:** `#thevr #thevrjani #budicheck #thevrhungary #reanimal #gaminghungary #tierlist #nekedbe #fyp`

---

Generated by Antigravity Automation Runner.
"""
    with open(os.path.join(OUTPUT_DIR, "CAMPAIGN_SUMMARY.md"), "w", encoding="utf-8") as f:
        f.write(summary_md)
        
    print("\nALL VIDEOS GENERATED AND READY FOR PUBLISHING!")
    print(f"Summary written to {os.path.join(OUTPUT_DIR, 'CAMPAIGN_SUMMARY.md')}")

if __name__ == "__main__":
    main()
