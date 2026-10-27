import os
import sys
import subprocess

if sys.stdout:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr:
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

FFMPEG = os.path.abspath("bin/ffmpeg.exe")
OUTPUT_DIR = os.path.abspath("output/tiktok_campaign")
os.makedirs(OUTPUT_DIR, exist_ok=True)

def format_ass_time(sec):
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = sec % 60
    return f"{h:01d}:{m:02d}:{s:05.2f}"

VIDEOS = {
    "video_01_top_worst": {
        "title": "A 3 legrosszabb budi Jani szerint",
        "audio_path": "scratch/fenrir_campaign_master/video_01_top_worst_master.wav",
        "total_duration": 32.09,
        "slides": [
            ("scratch/campaign_slides/v1_seg1_intro.jpg", 5.08),
            ("scratch/campaign_slides/v1_seg2_beneath.jpg", 8.04),
            ("scratch/campaign_slides/v1_seg3_lobotomy.jpg", 5.70),
            ("scratch/campaign_slides/v1_seg4_backrooms.jpg", 6.18),
            ("scratch/campaign_slides/v1_seg5_outro.jpg", 7.09)
        ],
        "captions": [
            (0.00, 5.08, "Ez a 3 legrosszabb budi, amitől még\\nJani gyomra is felfordult!"),
            (5.08, 13.12, "Harmadik a Beneath The Quiet: Jani szerint\\nmég az F-kategóriát sem éri el, 0.8 pont!"),
            (13.12, 18.82, "Második a Lobotomy: mindössze fél pont,\\nmert ránézésre alig lehet megmondani, mi az!"),
            (18.82, 25.00, "Az abszolút mélypont a Backrooms Primal:\\n0.5 pont, vállalhatatlan katasztrófa!"),
            (25.00, 32.09, "A teljes katasztrófa-rangsort nézd meg itt:\\nbudicheck-vr.onrender.com")
        ],
        "sfx": [
            ("scratch/sfx/whoosh.wav", 0.05, 0.8),
            ("scratch/sfx/vine_boom.wav", 5.15, 0.9),
            ("scratch/sfx/vine_boom.wav", 13.18, 0.9),
            ("scratch/sfx/fail_buzzer.wav", 18.88, 0.85),
            ("scratch/sfx/chime.wav", 25.10, 0.8)
        ]
    },
    "video_02_interactive_quiz": {
        "title": "Budi Kvíz: Te vagy Jani pontoz jobban?",
        "audio_path": "scratch/fenrir_campaign_master/video_02_interactive_quiz_master.wav",
        "total_duration": 25.29,
        "slides": [
            ("scratch/campaign_slides/v2_seg1_question.jpg", 5.30),
            ("scratch/campaign_slides/v2_seg2_guess.jpg", 6.20),
            ("scratch/campaign_slides/v2_seg3_reveal.jpg", 6.50),
            ("scratch/campaign_slides/v2_seg4_outro.jpg", 7.29)
        ],
        "captions": [
            (0.00, 5.30, "Állítsd meg a videót! Szerinted ez a budi\\nhány pontot kapott Janitól 1-től 10-ig?"),
            (5.30, 11.50, "Te is adtál volna rá egy erős nyolcast?\\nNézzük a valóságot: 3... 2... 1..."),
            (11.50, 18.00, "Hatalmas bukta: mindössze 0.8 pont!\\nSzerinte az egyik legrosszabb budi valaha."),
            (18.00, 25.29, "Teszteld le az ízlésed a beépített kvízzel:\\nbudicheck-vr.onrender.com")
        ],
        "sfx": [
            ("scratch/sfx/whoosh.wav", 0.05, 0.8),
            ("scratch/sfx/tick.wav", 8.50, 0.75),
            ("scratch/sfx/tock.wav", 9.50, 0.75),
            ("scratch/sfx/tick.wav", 10.50, 0.75),
            ("scratch/sfx/fail_buzzer.wav", 11.55, 0.9),
            ("scratch/sfx/chime.wav", 18.05, 0.8)
        ]
    },
    "video_03_perfect_ten": {
        "title": "Létezik tökéletes, 10/10-es budi?",
        "audio_path": "scratch/fenrir_campaign_master/video_03_perfect_ten_master.wav",
        "total_duration": 30.64,
        "slides": [
            ("scratch/campaign_slides/v3_seg1_intro.jpg", 6.76),
            ("scratch/campaign_slides/v3_seg2_nightcleaner.jpg", 7.84),
            ("scratch/campaign_slides/v3_seg3_karma.jpg", 8.20),
            ("scratch/campaign_slides/v3_seg4_outro.jpg", 7.84)
        ],
        "captions": [
            (0.00, 6.76, "Létezik olyan budi horrorjátékban, amire\\nJani megadta a maximális 10-ből 10 pontot?"),
            (6.76, 14.60, "A Night Cleaner majdnem vitte a prímet 9.5-tel,\\nde a lefolyó miatt levont egy felet!"),
            (14.60, 22.80, "De igen, van tökéletes: a Karma The Dark World budijára\\nJani azonnal rávágta a 10/10-et!"),
            (22.80, 30.64, "Keresd meg az összes budit az oldalon:\\nbudicheck-vr.onrender.com")
        ],
        "sfx": [
            ("scratch/sfx/whoosh.wav", 0.05, 0.8),
            ("scratch/sfx/vine_boom.wav", 6.85, 0.85),
            ("scratch/sfx/fanfare.wav", 14.70, 0.95),
            ("scratch/sfx/chime.wav", 22.90, 0.8)
        ]
    }
}

def render_fenrir_video(vid_key, vid_info):
    print(f"\n=======================================================")
    print(f"🎬 RENDERING FENRIR CAMPAIGN VIDEO: {vid_info['title']} ({vid_key})")
    print(f"=======================================================")
    
    total_dur = vid_info["total_duration"]
    
    # 1. Slide concat demuxer
    concat_file = os.path.join(OUTPUT_DIR, f"{vid_key}_concat.txt")
    with open(concat_file, "w", encoding="utf-8") as f:
        for slide_path, s_dur in vid_info["slides"]:
            sp = os.path.abspath(slide_path).replace("\\", "/")
            f.write(f"file '{sp}'\n")
            f.write(f"duration {s_dur:.3f}\n")
        last_sp = os.path.abspath(vid_info["slides"][-1][0]).replace("\\", "/")
        f.write(f"file '{last_sp}'\n")

    # 2. ASS Subtitles
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
        "Style: TikTokCaption,Arial,38,&H0000FFFF,&H000000FF,&H00000000,&H90000000,-1,0,0,0,100,100,0,0,1,5,2,2,70,70,210,1",
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    for st, et, ctxt in vid_info["captions"]:
        st_str = format_ass_time(st)
        et_str = format_ass_time(et)
        formatted_txt = ctxt.replace("\n", "\\N").replace("\\n", "\\N")
        ass_lines.append(f"Dialogue: 1,{st_str},{et_str},TikTokCaption,,0,0,0,,{{\\b1}}{formatted_txt}")
        
    with open(ass_file, "w", encoding="utf-8") as f:
        f.write("\n".join(ass_lines) + "\n")

    # 3. Audio Inputs & Mixing
    # Input 0: video concat
    # Input 1: Fenrir master speech audio
    # Inputs 2..N: SFX
    audio_inputs = ["-i", os.path.abspath(vid_info["audio_path"])]
    delays = ["[1:a]volume=1.35[a_spk]"]
    mix_labels = ["[a_spk]"]
    
    sfx_idx = 2
    for sfx_path, sfx_time, sfx_vol in vid_info["sfx"]:
        if os.path.exists(sfx_path):
            audio_inputs.extend(["-i", os.path.abspath(sfx_path)])
            delay_ms = int(sfx_time * 1000)
            delays.append(f"[{sfx_idx}:a]adelay={delay_ms}|{delay_ms},volume={sfx_vol}[a_sfx_{sfx_idx}]")
            mix_labels.append(f"[a_sfx_{sfx_idx}]")
            sfx_idx += 1
            
    total_audio_tracks = len(mix_labels)
    filter_complex_audio = f"{';'.join(delays)};{''.join(mix_labels)}amix=inputs={total_audio_tracks}:normalize=0:dropout_transition=0[aout]"

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

    print("Running ffmpeg render...")
    res = subprocess.run(cmd, stderr=subprocess.PIPE, stdout=subprocess.PIPE, text=True, encoding="utf-8", errors="ignore")
    if res.returncode != 0:
        print("FFMPEG ERROR:")
        print(res.stderr[-2000:])
        raise RuntimeError("FFmpeg rendering failed")
        
    size_mb = os.path.getsize(output_video_path) / (1024 * 1024)
    print(f"Finished {vid_key}.mp4 ({size_mb:.2f} MB, {total_dur:.2f}s) -> {output_video_path}")
    return output_video_path, size_mb, total_dur

def main():
    rendered = {}
    for k, v in VIDEOS.items():
        vp, smb, dur = render_fenrir_video(k, v)
        rendered[k] = {"title": v["title"], "size": smb, "dur": dur, "path": vp}
        
    summary_md = f"""# TheVR Jani BudiCheck TikTok / Shorts Kampány - Végleges Fenrir Szinkronnal

A videók a legújabb Gemini **Fenrir** hanggal (ugyanazzal, mint a `budicheck_tiktok_final`), tiszta magyar **„BudiCsekk”** kiejtéssel és Whisperrel illesztett kép- és felirat-időzítéssel készültek el!

---

## 1. Videó: A 3 legrosszabb budi Jani szerint
* **Fájl:** `output/tiktok_campaign/video_01_top_worst.mp4`
* **Hang:** Gemini Fenrir (mély, magabiztos, dinamikus)
* **Időtartam:** {rendered['video_01_top_worst']['dur']:.1f} mp | **Méret:** {rendered['video_01_top_worst']['size']:.2f} MB
* **Tartalom:** Beneath The Quiet (0.8 pont), Lobotomy (0.5 pont), Backrooms Primal (0.5 pont).
* **Poszt Leírás (TikTok / Shorts):**
  > A legrosszabb budik, amikkel Jani valaha találkozott! 💀🚽 0.5 és 0.8 pontok a mélyben. A teljes rangsorért és a többi katasztrófáért keresd fel az oldalt: 👉 budicheck-vr.onrender.com
* **Hashtagek:** `#thevr #thevrjani #budicheck #thevrhungary #horrorpentek #gaminghungary #tierlist #fyp`

---

## 2. Videó: Budi Kvíz: Te vagy Jani pontoz jobban?
* **Fájl:** `output/tiktok_campaign/video_02_interactive_quiz.mp4`
* **Hang:** Gemini Fenrir
* **Időtartam:** {rendered['video_02_interactive_quiz']['dur']:.1f} mp | **Méret:** {rendered['video_02_interactive_quiz']['size']:.2f} MB
* **Tartalom:** Interaktív kvíz, visszaszámlálás, tick-tock effektek és 0.8 pontos leleplezés.
* **Poszt Leírás (TikTok / Shorts):**
  > Te hány pontot adtál volna erre a budira? 🚽 Jani nem kegyelmezett: 0.8 pont! 😂 Teszteld le az ízlésed a beépített kvízzel: 👉 budicheck-vr.onrender.com
* **Hashtagek:** `#thevr #thevrjani #budicheck #thevrhungary #kviz #gaminghungary #tierlist #nekedbe #fyp`

---

## 3. Videó: Létezik tökéletes, 10/10-es budi?
* **Fájl:** `output/tiktok_campaign/video_03_perfect_ten.mp4`
* **Hang:** Gemini Fenrir
* **Időtartam:** {rendered['video_03_perfect_ten']['dur']:.1f} mp | **Méret:** {rendered['video_03_perfect_ten']['size']:.2f} MB
* **Tartalom:** The Night Cleaner (9.5 pont), Karma: The Dark World 10/10-es győztes jelenet (10.0 pont).
* **Poszt Leírás (TikTok / Shorts):**
  > Létezik 10/10-es budi horrorjátékban? Jani szerint igen! 👑🚽 Nézd meg az összes S-tier és győztes értékelést az oldalon: 👉 budicheck-vr.onrender.com
* **Hashtagek:** `#thevr #thevrjani #budicheck #thevrhungary #karmathedarkworld #gaminghungary #tierlist #nekedbe #fyp`

---

Generated by Antigravity Automation Runner.
"""
    with open(os.path.join(OUTPUT_DIR, "CAMPAIGN_SUMMARY.md"), "w", encoding="utf-8") as f:
        f.write(summary_md)
        
    print("\n🎉 ALL FENRIR VIDEOS GENERATED AND READY FOR PUBLISHING!")

if __name__ == "__main__":
    main()
