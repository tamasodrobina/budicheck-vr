import os
import sys
import re
import time
import json
import math
import random
import glob
import traceback
import subprocess
import threading
import shutil
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

import yt_dlp
import backend.bin_setup
from youtube_transcript_api import YouTubeTranscriptApi

from .database import db, SCREENSHOTS_DIR
from .config import has_gemini_api_key, load_config
from .gemini_analyzer import (
    analyze_transcript_with_gemini, 
    analyze_audio_with_gemini, 
    extract_game_title, 
    select_best_toilet_frame,
    parse_scene_timestamp,
    audit_budi_check_with_ai
)

def get_ffmpeg_path() -> str:
    try:
        import imageio_ffmpeg
        exe = imageio_ffmpeg.get_ffmpeg_exe()
        if exe and os.path.exists(exe):
            return exe
    except Exception:
        pass
    bin_name = "ffmpeg.exe" if os.name == 'nt' else "ffmpeg"
    local_bin = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "bin", bin_name))
    if os.path.exists(local_bin):
        return local_bin
    return shutil.which("ffmpeg") or "ffmpeg"

FFMPEG_EXE = get_ffmpeg_path()

_whisper_model = None
_whisper_init_lock = threading.Lock()
_whisper_exec_lock = threading.Lock()

def get_whisper_model():
    global _whisper_model
    cfg = load_config()
    if not cfg.get("enable_whisper_fallback", False):
        return None
    with _whisper_init_lock:
        if _whisper_model is None:
            try:
                from faster_whisper import WhisperModel
                import ctranslate2
                use_cuda = ctranslate2.get_cuda_device_count() > 0
                device = "cuda" if use_cuda else "cpu"
                compute_type = "float16" if use_cuda else "int8"
                model_size = "base" if use_cuda else "tiny"
                db.add_log(f"🤖 Faster-Whisper AI betöltése ({model_size} modell, {device.upper()})...", "info")
                if use_cuda:
                    _whisper_model = WhisperModel(model_size, device="cuda", compute_type="float16")
                else:
                    cpu_threads = max(1, min(8, os.cpu_count() or 4))
                    _whisper_model = WhisperModel(model_size, device="cpu", compute_type="int8", cpu_threads=cpu_threads)
                db.add_log(f"✅ AI beszéd-felismerő modell betöltve ({device.upper()} gyorsítással)!", "success")
            except Exception as e:
                db.add_log(f"⚠️ Whisper AI modell betöltési hiba: {e}", "warning")
                _whisper_model = False
    return _whisper_model if _whisper_model else None

PRIMARY_PATTERNS = [
    r'\bbudi\s*check\b',
    r'\bwc\s*check\b',
    r'\bvécé\s*check\b',
    r'\bmosdó\s*check\b',
    r'\btoalett\s*check\b',
    r'\bklotyó\s*check\b',
    r'\bpiszoár\s*check\b',
    r'\bpisszui\s*check\b',
    r'\bpottyantós\s*check\b',
    
    r'\bbudi\s*csekk\b',
    r'\bwc\s*csekk\b',
    r'\bvécé\s*csekk\b',
    r'\bmosdó\s*csekk\b',
    r'\btoalett\s*csekk\b',
    r'\bklotyó\s*csekk\b',
    
    r'\bbudi\s*teszt\b',
    r'\bwc\s*teszt\b',
    r'\bvécé\s*teszt\b',
    r'\bmosdó\s*teszt\b',
    r'\btoalett\s*teszt\b',
    r'\bklotyó\s*teszt\b',
    r'\bbudiszemle\b',
    r'\bwc\s*szemle\b',
    r'\bmosdószemle\b',
    
    r'\bpisszui\b',
    r'\bbudi-check\b',
    r'\bwc-check\b',
    r'\bmosdó-check\b',
    r'\bklotyó-check\b',
    r'\bbudicheck\b',
    r'\bwccheck\b',
    r'\bmosdócheck\b',
]

TOILET_NOUN_PATTERNS = [
    r'\b(?:budi|budit|budiban|budira|budik)\b',
    r'\b(?:wc|wct|wc-t|wc-ben|wc-re|vécé|vécét|vécében)\b',
    r'\b(?:mosdó|mosdót|mosdóban|mosdóba|mosdók)\b',
    r'\b(?:toalett|toalettet|toalettben)\b',
    r'\b(?:klotyó|klotyót|klotyóban|klotyóra)\b',
    r'\b(?:piszoár|piszoárt|piszoárban|pisszui)\b',
    r'\b(?:retyó|retyót|retyóban)\b',
    r'\b(?:pottyantós|latrina|árnyékszék|mellékhelyiség)\b',
]

REVIEW_CONTEXT_KEYWORDS = [
    'check', 'csekk', 'teszt', 'szemle', 'értékel', 'pont', 'skálá', 'tiszta',
    'koszos', 'tízből', '10-ből', 'csillag', 'minőség', 'fülke', 'papír', 'állapot',
    'szép', 'undorító', 'élmény', 'világítás', 'csempe', 'lehúzó', 'tartály', 'szappan'
]

HUNGARIAN_NUMBERS = {
    'egy': 1, 'kettő': 2, 'két': 2, 'három': 3, 'négy': 4, 'öt': 5,
    'hat': 6, 'hét': 7, 'nyolc': 8, 'kilenc': 9, 'tíz': 10, 'nulla': 0
}

def format_timestamp(seconds: float) -> str:
    secs = int(seconds)
    hours = secs // 3600
    minutes = (secs % 3600) // 60
    rem_secs = secs % 60
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{rem_secs:02d}"
    return f"{minutes:02d}:{rem_secs:02d}"

def extract_rating_from_text(text: str) -> float:
    text_lower = text.lower()
    
    # 1. Spoken Hungarian half-ratings (e.g. "négy és fél", "4 és fél", "négyes fél", "4 es fel")
    half_words = {
        'nulla': 0.5, 'egy': 1.5, 'két': 2.5, 'kettő': 2.5, 'ketto': 2.5,
        'három': 3.5, 'harom': 3.5, 'négy': 4.5, 'negy': 4.5, 'négyes': 4.5, 'negyes': 4.5,
        'öt': 5.5, 'ot': 5.5, 'ötös': 5.5, 'otos': 5.5, 'hat': 6.5, 'hatos': 6.5,
        'hét': 7.5, 'het': 7.5, 'hetes': 7.5, 'nyolc': 8.5, 'nyolcas': 8.5,
        'kilenc': 9.5, 'kilences': 9.5
    }
    for word, val in half_words.items():
        if re.search(rf'\b{word}\s*(?:és|es)?\s*(?:fél|fel)\b', text_lower):
            return val
            
    m_digit_half = re.search(r'\b([0-9])\s*(?:és|es)?\s*(?:fél|fel)\b', text_lower)
    if m_digit_half:
        val = float(m_digit_half.group(1)) + 0.5
        if 0 <= val <= 10:
            return val

    # 2. Decimal ratings: e.g. 4.5/10, 4,5 / 10, 10-ből 4,5, 4.5 pont, 4,5-ös
    m_frac = re.search(r'\b((?:10|[0-9])[\.,][0-9])\s*(?:/|ből\s*|bol\s*)10\b', text_lower)
    if m_frac:
        val = float(m_frac.group(1).replace(',', '.'))
        if 0 <= val <= 10:
            return val

    m_frac_rev = re.search(r'\b10-(?:ből|bol)\s*((?:10|[0-9])[\.,][0-9])\b', text_lower)
    if m_frac_rev:
        val = float(m_frac_rev.group(1).replace(',', '.'))
        if 0 <= val <= 10:
            return val

    m_frac_pt = re.search(r'\b((?:10|[0-9])[\.,][0-9])\s*(?:pont|-es|-os|-ös|-as|\b)', text_lower)
    if m_frac_pt:
        val = float(m_frac_pt.group(1).replace(',', '.'))
        if 0 <= val <= 10:
            return val

    # 3. Whole number ratings: X/10, 10-ből X, X pont, X-es
    m1 = re.search(r'\b((?:10|[0-9]))\s*(?:/|ből\s*|bol\s*)10\b', text_lower)
    if m1:
        val = float(m1.group(1))
        if 0 <= val <= 10:
            return val

    m2 = re.search(r'\b10-(?:ből|bol)\s*((?:10|[0-9]))\b', text_lower)
    if m2:
        val = float(m2.group(1))
        if 0 <= val <= 10:
            return val

    m3 = re.search(r'\b((?:10|[0-9]))\s*pont\b', text_lower)
    if m3:
        val = float(m3.group(1))
        if 0 <= val <= 10:
            return val

    m4 = re.search(r'\b((?:10|[0-9]))\s*-(?:es|os|ös|as)\b', text_lower)
    if m4:
        val = float(m4.group(1))
        if 0 <= val <= 10:
            return val

    # 4. Spoken whole numbers (e.g. adok egy négyest, legyen négyes budi)
    spoken_map = {
        'egyes': 1, 'kettes': 2, 'hármas': 3, 'harmas': 3, 'négyes': 4, 'negyes': 4,
        'ötös': 5, 'otos': 5, 'hatos': 6, 'hetes': 7, 'nyolcas': 8, 'kilences': 9, 'tízes': 10, 'tizes': 10
    }
    for word_num, val in spoken_map.items():
        if re.search(rf'\b(?:adok\s*(?:rá|neki)?\s*egy\s*{word_num}|legyen\s*{word_num}|egy\s*{word_num}\s*budi)\b', text_lower):
            return float(val)

    # 5. Whole Hungarian number words
    for word_num, val in HUNGARIAN_NUMBERS.items():
        if re.search(rf'\b(?:tízből\s*{word_num}|{word_num}\s*pont)\b', text_lower):
            return float(val)

    # 6. Strict sentiment fallback (only when no explicit score was uttered)
    if re.search(r'\b(?:tiszta|patyolat|tökéletes|kiváló|pazar|szuper|csodás)\b', text_lower):
        return 8.5
    if re.search(r'\b(?:szép)\b', text_lower) and not re.search(r'\bköszönöm\b', text_lower):
        return 8.5
    if re.search(r'\b(?:undorító|büdös|förtelmes|szörnyű|katasztrófa|mocsok)\b', text_lower):
        return 2.0

    return 7.0

def capture_screenshot(video_id: str, timestamp_sec: float, force: bool = False) -> Optional[str]:
    filename = f"{video_id}_{int(timestamp_sec)}.jpg"
    filepath = os.path.join(SCREENSHOTS_DIR, filename)
    rel_url = f"/screenshots/{filename}"
    
    if not force and os.path.exists(filepath) and os.path.getsize(filepath) > 1000:
        return rel_url
        
    video_url = f"https://www.youtube.com/watch?v={video_id}"
    ydl_opts = get_ydl_opts({
        'format': 'bestvideo[height<=720]/best[height<=720]/best',
        'quiet': True
    })
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)
            stream_url = info.get('url') if info else None
            duration = float(info.get('duration') or 0.0) if info else 0.0
            http_headers = info.get('http_headers', {}) if info else {}
            header_str = "".join([f"{k}: {v}\r\n" for k, v in http_headers.items()])
            
        if stream_url:
            # Handle potential MMSS overflow or seeking past end of video
            if duration > 5.0 and timestamp_sec > duration:
                mm = int(timestamp_sec // 100)
                ss = timestamp_sec % 100
                if ss < 60 and (mm * 60.0 + ss) <= duration:
                    timestamp_sec = mm * 60.0 + ss
                else:
                    timestamp_sec = max(0.0, duration - 10.0)
            elif duration > 5.0:
                timestamp_sec = min(timestamp_sec, max(0.0, duration - 2.0))

            # Multi-frame toilet vision: candidate frames around timestamp
            # We sample from -2s up through 12s as players approach or interact with the toilet
            raw_candidates = [
                max(0.0, timestamp_sec - 2.0),
                max(0.0, timestamp_sec),
                max(0.0, timestamp_sec + 2.5),
                max(0.0, timestamp_sec + 5.0),
                max(0.0, timestamp_sec + 8.0),
                max(0.0, timestamp_sec + 12.0)
            ]
            if duration > 5.0:
                candidate_times = [min(c, max(0.0, duration - 1.0)) for c in raw_candidates]
            else:
                candidate_times = raw_candidates

            temp_files = []
            for i, c_sec in enumerate(candidate_times):
                c_path = os.path.join(SCREENSHOTS_DIR, f"cand_{video_id}_{int(timestamp_sec)}_{i}.jpg")
                cmd = [
                    FFMPEG_EXE,
                    '-reconnect', '1',
                    '-reconnect_at_eof', '1',
                    '-reconnect_streamed', '1',
                    '-reconnect_delay_max', '5',
                ]
                if header_str:
                    cmd.extend(['-headers', header_str])
                cmd.extend([
                    '-ss', str(c_sec),
                    '-i', stream_url,
                    '-vframes', '1',
                    '-q:v', '2',
                    '-y',
                    c_path
                ])
                res = subprocess.run(cmd, capture_output=True, text=True, timeout=25)
                if res.returncode == 0 and os.path.exists(c_path) and os.path.getsize(c_path) > 1000:
                    temp_files.append((i, c_path))

            best_file = None
            if temp_files:
                if len(temp_files) == 1 or not has_gemini_api_key():
                    best_file = temp_files[min(1, len(temp_files) - 1)][1]
                else:
                    paths = [tf[1] for tf in temp_files]
                    best_idx = select_best_toilet_frame(paths)
                    best_file = paths[min(best_idx, len(paths) - 1)]

            if best_file and os.path.exists(best_file):
                if os.path.exists(filepath):
                    try:
                        os.remove(filepath)
                    except Exception:
                        pass
                os.replace(best_file, filepath)

            # Cleanup candidate temp files
            for _, c_path in temp_files:
                if os.path.exists(c_path):
                    try:
                        os.remove(c_path)
                    except Exception:
                        pass

            if os.path.exists(filepath):
                return rel_url
    except Exception as e:
        db.add_log(f"⚠️ Hiba a videókép kinyerésekor ({video_id}): {e}", "warning")

    # Fallback to high quality YouTube video thumbnail if direct stream capture is blocked
    try:
        thumb_url = f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"
        import urllib.request
        urllib.request.urlretrieve(thumb_url, filepath)
        if os.path.exists(filepath):
            return rel_url
    except Exception:
        pass

    return None

def parse_timestamp_str(ts_str: str) -> float:
    if not ts_str:
        return 0.0
    ts_str = str(ts_str).strip().lower()
    ts_str = ts_str.replace("másodperc", "").replace("perc", ":").replace("óra", ":")
    ts_str = ts_str.replace("mp", "").replace("sec", "").replace("s", "").replace("p", ":").replace("m", ":").replace("ó", ":").replace("h", ":")
    ts_str = ts_str.replace(" ", "")
    parts = [p for p in ts_str.split(":") if p != ""]
    try:
        if len(parts) == 3:
            return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
        elif len(parts) == 2:
            return float(parts[0]) * 60 + float(parts[1])
        elif len(parts) == 1:
            return float(parts[0])
        else:
            return 0.0
    except (ValueError, TypeError):
        return 0.0

def find_quote_timestamp_in_subtitles(video_id: str, quote: str) -> Optional[float]:
    """Search YouTube Hungarian auto-generated subtitles for exact moment a quote was spoken."""
    try:
        import urllib.request
        ydl_opts = get_ydl_opts({
            'skip_download': True,
            'writeautomaticsub': True,
            'subtitleslangs': ['hu'],
            'quiet': True
        })
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f'https://www.youtube.com/watch?v={video_id}', download=False)
            subs = info.get('automatic_captions', {}).get('hu', [])
            json3_sub = next((s['url'] for s in subs if s.get('ext') == 'json3'), None)

        if not json3_sub:
            return None

        req = urllib.request.Request(json3_sub, headers={'User-Agent': 'Mozilla/5.0'})
        data = json.loads(urllib.request.urlopen(req, timeout=15).read().decode('utf-8'))
        events = data.get('events', [])

        clean_words = [w.lower() for w in re.findall(r'\b[a-záéíóöőúüű]{4,}\b', quote.lower())]
        if not clean_words:
            return None

        best_score = 0
        best_time = None

        # Check windows of 8 subtitle events
        for i in range(len(events)):
            window = events[i:i+8]
            window_text = ' '.join(''.join(s.get('utf8', '') for s in ev.get('segs', [])).lower() for ev in window)
            score = sum(1 for w in clean_words if w in window_text)
            if score > best_score and score >= max(2, len(clean_words) // 4):
                best_score = score
                best_time = events[i].get('tStartMs', 0) / 1000.0

        return best_time
    except Exception as e:
        print(f"Error searching subtitles for quote: {e}")
        return None

CHUNK_DURATION_SEC = 90  # 1.5 minutes per chunk window for full speech context
OVERLAP_SEC = 15         # 15 seconds overlap to ensure ratings and sentences are never cut mid-speech
STEP_SEC = CHUNK_DURATION_SEC - OVERLAP_SEC  # 75 seconds step size

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))

def get_ydl_opts(base_opts: dict) -> dict:
    opts = base_opts.copy()
    opts['remote_components'] = ['ejs:github']
    opts['extractor_args'] = {'youtube': {'player_client': ['android', 'ios', 'mweb', 'web']}}
    
    candidate_cookies = [
        os.path.join(DATA_DIR, "www.youtube.com_cookies.txt"),
        os.path.join(DATA_DIR, "cookies.txt")
    ]
    for extra in glob.glob(os.path.join(DATA_DIR, "*cookie*.txt")):
        if extra not in candidate_cookies:
            candidate_cookies.append(extra)
    
    best_cookie = None
    for cpath in candidate_cookies:
        if os.path.exists(cpath) and os.path.getsize(cpath) > 0:
            try:
                with open(cpath, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    if "LOGIN_INFO" in content or "HSID" in content or "SAPISID" in content:
                        best_cookie = cpath
                        break
            except Exception:
                pass
            if not best_cookie and not cpath.endswith("cookies.txt"):
                best_cookie = cpath

    if not best_cookie:
        for cpath in candidate_cookies:
            if os.path.exists(cpath) and os.path.getsize(cpath) > 0:
                best_cookie = cpath
                break
                
    deno_exe = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "bin", "deno.exe"))
    node_exe = shutil.which("node") or r"C:\Program Files\nodejs\node.exe"
    if os.path.exists(deno_exe):
        opts['js_runtimes'] = {'deno': {'path': deno_exe}}
    elif node_exe and os.path.exists(node_exe):
        opts['js_runtimes'] = {'node': {'path': node_exe}}
        
    if best_cookie:
        # Biztonsági másolat készítése: a yt-dlp alapból felülírja a megadott cookiefile-t,
        # ezért egy munkamásolatot (worker_cookies.txt) használunk, hogy a felhasználó eredeti
        # cookie fájlja soha ne sérüljön vagy törlődjön!
        worker_cookie = os.path.join(DATA_DIR, "worker_cookies.txt")
        try:
            shutil.copyfile(best_cookie, worker_cookie)
            opts['cookiefile'] = worker_cookie
        except Exception:
            opts['cookiefile'] = best_cookie
            
        # Sütikkel a 'web', 'mweb' és 'tv' kliensek működnek hivatalosan
        opts['extractor_args'] = {'youtube': {'player_client': ['web', 'mweb', 'tv']}}
    else:
        opts['extractor_args'] = {'youtube': {'player_client': ['android', 'ios', 'mweb', 'web']}}
        
    return opts

def transcribe_audio_fallback(video_id: str) -> List[Dict[str, Any]]:
    """Tier 3: Download audio locally ONCE, then transcribe overlapping chunks from disk for 100% zero-drop reliability and complete context."""
    model = get_whisper_model()
    if not model:
        return []

    data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
    temp_pattern = os.path.join(data_dir, f"temp_{video_id}.%(ext)s")
    
    duration = 0
    dl_error_msg = ""
    try:
        db.add_log(f"📥 [Tier 3 AI] Hangfájl letöltése helyi tárolóba a 100%-os adatbiztonságért...", "info")
        
        base_opts = {
            'format': 'bestaudio/best',
            'outtmpl': temp_pattern,
            'file_access_retries': 10,
            'updatetime': False,
            'overwrites': True,
            'quiet': True,
            'no_warnings': True
        }
        ydl_opts = get_ydl_opts(base_opts)
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=True)
            duration = info.get('duration', 0) if info else 0
    except Exception as e_dl:
        dl_error_msg = str(e_dl)

    found_files = glob.glob(os.path.join(data_dir, f"temp_{video_id}*"))
    valid_files = [f for f in found_files if os.path.exists(f) and os.path.getsize(f) > 50000]

    if not valid_files:
        if "bot" in dl_error_msg.lower() or "sign in" in dl_error_msg.lower():
            db.add_log(f"⚠️ YouTube Bot-védelem lépett életbe ({video_id}). Helyezd el a 'cookies.txt' fájlt a 'data' mappában az automatikus feloldáshoz!", "warning")
        else:
            db.add_log(f"⚠️ Nem sikerült a hangfájlt letölteni helyben ({video_id}): {dl_error_msg[:120] if dl_error_msg else 'Fájl nem található'}", "warning")
        return []

    temp_file = valid_files[0]
    
    try:
        if duration <= 0:
            duration = 1800

        total_chunks = math.ceil(duration / STEP_SEC)
        db.add_log(f"🎙️ [Tier 3 AI] {format_timestamp(duration)} audió feldolgozása helyi fájlból ({total_chunks} szelet)...", "info")

        all_segments = []

        max_chunks = min(total_chunks, 120)  # Cap at 2 hours per video for massive streams
        if total_chunks > 120:
            db.add_log(f"⚡ [Optimailzálás] Kiemelkedően hosszú videó ({format_timestamp(duration)}). Az első 2 óra kerül beszédelemzésre.", "info")

        for chunk_idx in range(max_chunks):
            # Allow user to interrupt/pause scan mid-transcription
            if scanner.stop_event.is_set():
                db.add_log("⏹ Beszéd-felismerés megszakítva a felhasználó által.", "warning")
                break
            while scanner.pause_event.is_set():
                time.sleep(0.5)
                if scanner.stop_event.is_set():
                    break

            start_sec = chunk_idx * STEP_SEC
            current_dur = min(CHUNK_DURATION_SEC, duration - start_sec)
            if current_dur <= 0:
                break

            chunk_start_fmt = format_timestamp(start_sec)
            chunk_end_fmt = format_timestamp(start_sec + current_dur)
            pct = min(100, int(((chunk_idx + 1) / max_chunks) * 100))

            db.add_log(f"⏳ [Whisper AI Szelet {chunk_idx+1}/{max_chunks}] {chunk_start_fmt} ➔ {chunk_end_fmt} feldolgozása ({pct}%)...", "info")

            cmd = [
                FFMPEG_EXE,
                '-ss', str(start_sec),
                '-t', str(current_dur),
                '-i', temp_file,
                '-f', 's16le',
                '-ac', '1',
                '-ar', '16000',
                '-acodec', 'pcm_s16le',
                '-'
            ]

            try:
                res = subprocess.run(cmd, capture_output=True, timeout=35)
                if res.returncode == 0 and res.stdout and len(res.stdout) >= 1600:
                    pcm_data = np.frombuffer(res.stdout, dtype=np.int16).astype(np.float32) / 32768.0
                    chunk_segs = 0
                    with _whisper_exec_lock:
                        segments, _ = model.transcribe(pcm_data, language="hu", beam_size=1, vad_filter=True, vad_parameters=dict(min_silence_duration_ms=500))
                        for seg in segments:
                            real_start = start_sec + seg.start
                            
                            # Avoid duplicate segments in overlap region across adjacent chunks
                            if chunk_idx < max_chunks - 1 and real_start >= (start_sec + STEP_SEC):
                                continue

                            chunk_segs += 1
                            all_segments.append({
                                'text': seg.text,
                                'start': real_start,
                                'duration': seg.end - seg.start
                            })
                            # Stream live log when a toilet/review related sentence is recognized
                            txt_low = seg.text.lower()
                            if any(k in txt_low for k in ['budi', 'wc', 'mosdó', 'toalett', 'klotyó', 'check', 'csekk', 'teszt', 'értékel', 'pont']):
                                t_fmt = format_timestamp(real_start)
                                db.add_log(f"🎙️ [{t_fmt}] \"{seg.text.strip()}\"", "info")

                    db.add_log(f"✅ [Szelet {chunk_idx+1}/{max_chunks}] {chunk_start_fmt} ➔ {chunk_end_fmt} kész ({chunk_segs} mondat kinyerve)", "success")
            except Exception as e_c:
                err_text = str(e_c)
                if "cublas" in err_text.lower() or "cuda" in err_text.lower() or "dll" in err_text.lower():
                    db.add_log(f"⚠️ CUDA hiba -> Automatikus azonnali átváltás CPU Whisper modellre...", "warning")
                    try:
                        from faster_whisper import WhisperModel
                        cpu_threads = max(1, min(8, os.cpu_count() or 4))
                        model = WhisperModel("base", device="cpu", compute_type="int8", cpu_threads=cpu_threads)
                        global _whisper_model
                        _whisper_model = model
                        with _whisper_exec_lock:
                            segments, _ = model.transcribe(pcm_data, language="hu", beam_size=1, vad_filter=True, vad_parameters=dict(min_silence_duration_ms=500))
                            chunk_segs = 0
                            for seg in segments:
                                real_start = start_sec + seg.start
                                if chunk_idx < max_chunks - 1 and real_start >= (start_sec + STEP_SEC):
                                    continue
                                chunk_segs += 1
                                all_segments.append({
                                    'text': seg.text,
                                    'start': real_start,
                                    'duration': seg.end - seg.start
                                })
                            db.add_log(f"✅ [CPU Szelet {chunk_idx+1}/{max_chunks}] kész ({chunk_segs} mondat)", "success")
                    except Exception as e_cpu:
                        db.add_log(f"⚠️ Szelet hiba ({chunk_start_fmt}): {e_cpu}", "warning")
                else:
                    db.add_log(f"⚠️ Szelet hiba ({chunk_start_fmt}): {e_c}", "warning")

        db.add_log(f"✅ [Whisper AI] Beszéd-felismerés kész! ({len(all_segments)} mondat kinyerve)", "success")
        return all_segments

    except Exception as e:
        db.add_log(f"⚠️ Beszéd-felismerési hiba: {e}", "warning")
        return []
    finally:
        # Re-scan for all temp files created for this video ID and delete 100% of them
        all_temp = glob.glob(os.path.join(data_dir, f"temp_{video_id}*"))
        for f in all_temp:
            if os.path.exists(f):
                try:
                    os.remove(f)
                except Exception:
                    pass

def download_audio_for_gemini(video_id: str) -> Optional[str]:
    data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
    temp_pattern = os.path.join(data_dir, f"gemini_{video_id}.%(ext)s")
    base_opts = {
        'format': 'worstaudio[ext=m4a]/worstaudio/bestaudio[abr<=96]/bestaudio/best',
        'outtmpl': temp_pattern,
        'overwrites': True,
        'quiet': True,
        'no_warnings': True
    }
    ydl_opts = get_ydl_opts(base_opts)
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([f"https://www.youtube.com/watch?v={video_id}"])
    except Exception as e:
        db.add_log(f"⚠️ Audió letöltési hiba ({video_id}): {e}", "warning")
        return None

    found = glob.glob(os.path.join(data_dir, f"gemini_{video_id}*"))
    valid = [f for f in found if os.path.exists(f) and os.path.getsize(f) > 5000]
    return valid[0] if valid else None

def wait_for_gemini_quota(stop_event: threading.Event, pause_event: threading.Event, wait_sec: int = 900) -> bool:
    until = datetime.now() + timedelta(seconds=wait_sec)
    m = wait_sec // 60
    h = m // 60
    rem_m = m % 60
    time_str = f"{h}ó {rem_m}p" if h > 0 else f"{rem_m} perc"
    db.add_log(f"⏳ [Kvótára Várakozás] A napi Gemini AI limit elérve. Várakozás a folytatásig (~{time_str})...", "warning")
    
    while datetime.now() < until:
        if stop_event.is_set():
            return False
        while pause_event.is_set():
            time.sleep(0.5)
            if stop_event.is_set():
                return False
        time.sleep(2)
    
    db.add_log("✨ [Kvóta Feloldva] A várakozási idő lejárt, a videó feldolgozása automatikusan folytatódik!", "success")
    return True

DEFAULT_PLAYLIST_URL = "https://youtube.com/playlist?list=PL-0aMuV87MLWOwH9PLKO1EBYStLmIKScV"

class VideoScanner:
    def __init__(self):
        self.worker_thread: Optional[threading.Thread] = None
        self.stop_event = threading.Event()
        self.pause_event = threading.Event()

    def start_scan(self, max_videos: int = 226, channel_url: Optional[str] = None, incremental: bool = False):
        target_url = (channel_url or "").strip() or DEFAULT_PLAYLIST_URL
        if self.worker_thread and self.worker_thread.is_alive():
            if self.pause_event.is_set():
                self.pause_event.clear()
                db.scan_state["status"] = "running"
                db.add_log("▶ Keresési folyamat folytatása...", "info")
                return
            if db.scan_state["status"] == "running":
                db.add_log("ℹ️ A keresés már folyamatban van.", "info")
                return

        self.stop_event.clear()
        self.pause_event.clear()
        db.scan_state["status"] = "running"
        db.scan_state["source_url"] = target_url
        if incremental:
            db.add_log(f"⚡ Inkrementális heti frissítés indítása: új videók keresése...", "info")
        else:
            db.add_log(f"🚀 Keresési folyamat elindítva: {target_url}", "info")

        self.worker_thread = threading.Thread(
            target=self._run_scan_loop,
            args=(target_url, max_videos, incremental),
            daemon=True
        )
        self.worker_thread.start()

    def pause_scan(self):
        if db.scan_state["status"] == "running":
            self.pause_event.set()
            db.scan_state["status"] = "paused"
            db.add_log("⏸ Keresési folyamat szüneteltetve.", "warning")

    def stop_scan(self):
        self.stop_event.set()
        self.pause_event.clear()
        db.scan_state["status"] = "idle"
        db.add_log("⏹ Keresés leállítva a felhasználó által.", "warning")

    def scan_single_video_by_url(self, video_url_or_id: str) -> bool:
        video_url_or_id = video_url_or_id.strip()
        if not video_url_or_id:
            return False

        v_id = video_url_or_id
        if "watch?v=" in video_url_or_id:
            v_id = video_url_or_id.split("watch?v=")[-1].split("&")[0]
        elif "youtu.be/" in video_url_or_id:
            v_id = video_url_or_id.split("youtu.be/")[-1].split("?")[0]

        if not v_id or len(v_id) < 5:
            return False

        def _runner():
            self.stop_event.clear()
            self.pause_event.clear()
            db.scan_state["status"] = "running"
            db.add_log(f"🎬 Egyedi videó újraelemzése & kártya frissítése: https://www.youtube.com/watch?v={v_id}", "info")

            v_title = f"Videó ({v_id})"
            v_dur = 0.0
            try:
                ydl_opts = get_ydl_opts({'quiet': True})
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(f"https://www.youtube.com/watch?v={v_id}", download=False)
                    if info:
                        v_title = info.get('title', v_title)
                        v_dur = float(info.get('duration') or 0.0)
            except Exception as e_info:
                db.add_log(f"ℹ️ Videó cím: '{v_title}'", "info")

            api = YouTubeTranscriptApi()
            # force=True ensures the video is re-scanned and cards are updated without duplicates
            self._process_single_video({'id': v_id, 'title': v_title, 'duration': v_dur}, 0, 1, api, force=True)
            db.scan_state["status"] = "idle"
            db.add_log(f"🎉 Egyedi videó vizsgálata befejeződött, a kártyák duplikáció nélkül frissítve lettek: '{v_title}'", "success")

        t = threading.Thread(target=_runner, daemon=True)
        t.start()
        return True

    def _normalize_transcript(self, raw_subs: Any) -> List[Dict[str, Any]]:
        if not raw_subs:
            return []
        items = []
        for s in raw_subs:
            if isinstance(s, dict):
                items.append({
                    'text': str(s.get('text', '')),
                    'start': float(s.get('start', 0.0)),
                    'duration': float(s.get('duration', 0.0))
                })
            else:
                items.append({
                    'text': str(getattr(s, 'text', '')),
                    'start': float(getattr(s, 'start', 0.0)),
                    'duration': float(getattr(s, 'duration', 0.0))
                })
        return items

    def _save_budi_check_entry(self, video_id: str, video_title: str, start_sec: float, rating: float, quote: str, kw: str, game_title: str = ""):
        from .game_detector import detect_game_title_from_video
        timestamp_fmt = format_timestamp(start_sec)
        
        # 1. Identify exact game title for start_sec via YouTube chapters & description
        chapter_game = detect_game_title_from_video(video_id, start_sec, video_title)
        if chapter_game:
            display_game = chapter_game
        elif game_title and game_title.strip():
            display_game = game_title.strip()
        else:
            display_game = video_title

        db.add_log(f"🚽 TALÁLAT! Budi Check: [{display_game}] @ {timestamp_fmt}! ({rating}/10 pont, '{kw}')", "match")
        db.add_log(f"📸 Képernyőkép kinyerése és budi-felismerés ({timestamp_fmt})...", "snapshot")
        
        screenshot_url = capture_screenshot(video_id, start_sec)

        check_entry = {
            "id": f"{video_id}_{int(start_sec)}",
            "video_id": video_id,
            "video_title": video_title,
            "game_title": display_game,
            "video_url": f"https://www.youtube.com/watch?v={video_id}",
            "timestamp_sec": start_sec,
            "timestamp_formatted": timestamp_fmt,
            "yt_timestamp_url": f"https://www.youtube.com/watch?v={video_id}&t={int(start_sec)}s",
            "quote": quote,
            "rating": rating,
            "matched_keyword": kw,
            "screenshot_url": screenshot_url or "/static/placeholder.jpg",
            "created_at": datetime.now().isoformat(),
            "is_verified": False,
            "audit_status": "pending",
            "audit_notes": ""
        }

        # Real-time automated verification with Gemini AI
        if has_gemini_api_key():
            try:
                db.add_log(f"🤖 [Automata Visszaellenőrzés]: '{display_game}' felülvizsgálata Gemini AI-val...", "info")
                audit_res = audit_budi_check_with_ai(check_entry)
                if audit_res:
                    # Strict Budi Gate: If it's not a toilet check (e.g. tap-only or false hit), skip completely!
                    if audit_res.get("is_valid_budicheck") is False or audit_res.get("audit_status") == "rejected":
                        db.add_log(f"🚫 [KIHAGYVA]: '{quote[:40]}...' nem valódi budi értékelés (csap/kád vagy nem budi), kihagyva.", "warning")
                        return

                    st = audit_res.get("audit_status", "pending")
                    check_entry["audit_status"] = st
                    check_entry["audit_notes"] = audit_res.get("audit_notes", "")
                    has_fix = audit_res.get("has_toilet_fixture", True)
                    check_entry["is_verified"] = (st == "verified" and has_fix)
                    if audit_res.get("corrected_game_title"):
                        display_game = audit_res["corrected_game_title"].strip()
                        check_entry["game_title"] = display_game
                    if audit_res.get("corrected_rating") is not None:
                        check_entry["rating"] = round(float(audit_res["corrected_rating"]), 1)
            except Exception as e_aud:
                db.add_log(f"⚠️ Automata visszaellenőrzési hiba: {e_aud}", "warning")

        check_entry, is_updated = db.add_budi_check(check_entry)
        db.scan_state["matches_found"] = len(db.get_checks())
        ver_tag = "✅ [IGAZOLT]" if check_entry.get("is_verified") else ("❌ [FALS]" if check_entry.get("audit_status") == "rejected" else "⏳ [ELLENŐRIZENDŐ]")
        if is_updated:
            db.add_log(f"🔄 Kártya frissítve (nincs duplikáció): {check_entry['rating']}/10 pont ➔ [{display_game}] ({check_entry['timestamp_formatted']}) {ver_tag}", "success")
        else:
            db.add_log(f"💾 Új értékelés elmentve: {check_entry['rating']}/10 pont ➔ [{display_game}] {ver_tag}", "success")

    def _process_single_video(self, video: Dict[str, Any], idx: int, total_videos: int, api: Any, force: bool = False):
        if self.stop_event.is_set():
            return

        v_id = video.get('id')
        v_title = video.get('title', 'Névtelen videó')
        
        if not v_id:
            return

        db.scan_state["current_video_id"] = v_id
        db.scan_state["current_video_title"] = v_title

        # If not force and already fully scanned, skip it!
        if not force and db.is_video_scanned(v_id):
            db.add_log(f"⏭️ [{idx+1}/{total_videos}] Már korábban teljesen átnézve: '{v_title}'", "skip")
            with db.lock:
                db.scan_state["processed_count"] += 1
            return

        db.add_log(f"🔍 [{idx+1}/{total_videos}] Ellenőrzés: '{v_title}' (ID: {v_id})", "info")

        transcript = None
        try:
            tl = api.list(v_id)
            try:
                raw_subs = tl.find_transcript(['hu']).fetch()
                transcript = self._normalize_transcript(raw_subs)
                db.add_log(f"📜 [Tier 1] Magyar felirat beolvasva: '{v_title}' ({len(transcript)} sor)", "info")
            except Exception:
                try:
                    raw_subs = tl.find_transcript(['en']).translate('hu').fetch()
                    transcript = self._normalize_transcript(raw_subs)
                    db.add_log(f"🌐 [Tier 1] Angol felirat magyarítva: '{v_title}' ({len(transcript)} sor)", "info")
                except Exception:
                    pass
        except Exception as e_tl:
            err_msg = str(e_tl)
            if "blocked" in err_msg.lower() or "too many" in err_msg.lower() or "ip" in err_msg.lower():
                db.add_log(f"⚠️ YouTube felirat-lekérési IP korlátozás észlelve ({v_id}).", "warning")

        # Identify game title automatically from video intro speech / title
        game_title = v_title
        if has_gemini_api_key():
            intro_text = " ".join([item.get('text', '') for item in (transcript or [])[:30]])
            try:
                game_title = extract_game_title(v_id, v_title, "", intro_text)
            except Exception:
                game_title = v_title

        v_dur = float(video.get('duration') or 0.0)
        processed_with_gemini = False
        is_fully_processed = False

        if transcript and has_gemini_api_key() and not self.stop_event.is_set():
            db.add_log(f"🧠 [Gemini Flash AI] Videószöveg intelligens magyar értelmezése...", "info")
            try:
                g_matches = analyze_transcript_with_gemini(v_id, v_title, transcript, video_duration=v_dur)
                if g_matches is not None:
                    for m in g_matches:
                        s_sec = parse_scene_timestamp(m, v_dur)
                        r_val = float(m.get("rating", 7.0))
                        q_txt = str(m.get("quote", ""))
                        kw_val = str(m.get("matched_keyword", "budi check"))
                        self._save_budi_check_entry(v_id, v_title, s_sec, r_val, q_txt, kw_val, game_title=game_title)
                    processed_with_gemini = True
                    is_fully_processed = True
            except Exception as e_gem:
                db.add_log(f"⚠️ Gemini szövegelemzési hiba: {e_gem}", "warning")

        if not transcript and has_gemini_api_key() and not self.stop_event.is_set():
            db.add_log(f"🎧 [Gemini Multimodális AI] Nincs felirat -> Audió letöltése közvetlen felhős meghallgatáshoz...", "info")
            temp_audio = download_audio_for_gemini(v_id)
            if temp_audio:
                try:
                    for retry_attempt in range(5):
                        if self.stop_event.is_set():
                            break
                        g_matches = analyze_audio_with_gemini(v_id, v_title, temp_audio, video_duration=v_dur)
                        if g_matches is not None:
                            for m in g_matches:
                                s_sec = parse_scene_timestamp(m, v_dur)
                                r_val = float(m.get("rating", 7.0))
                                q_txt = str(m.get("quote", ""))
                                kw_val = str(m.get("matched_keyword", "budi check"))
                                self._save_budi_check_entry(v_id, v_title, s_sec, r_val, q_txt, kw_val, game_title=game_title)
                            processed_with_gemini = True
                            is_fully_processed = True
                            break
                        
                        if self.stop_event.is_set():
                            break

                        # Wait for Gemini quota reset instead of skipping!
                        can_continue = wait_for_gemini_quota(self.stop_event, self.pause_event, wait_sec=900)
                        if not can_continue:
                            break

                except Exception as e_a:
                    db.add_log(f"⚠️ Gemini audió elemzési hiba: {e_a}", "warning")
                finally:
                    if os.path.exists(temp_audio):
                        try:
                            os.remove(temp_audio)
                        except Exception:
                            pass

        if not processed_with_gemini and not self.stop_event.is_set():
            if transcript:
                self._process_transcript(v_id, v_title, transcript, game_title=game_title)
                is_fully_processed = True
            else:
                cfg = load_config()
                if cfg.get("enable_whisper_fallback", False):
                    db.add_log(f"ℹ️ Nincs felirat -> Áttérés Faster-Whisper beszéd-felismerésre ('{v_title}')...", "info")
                    try:
                        transcript = transcribe_audio_fallback(v_id)
                        if transcript:
                            self._process_transcript(v_id, v_title, transcript, game_title=game_title)
                            is_fully_processed = True
                        else:
                            db.add_log(f"⚠️ Nem sikerült a videót feldolgozni: '{v_title}'", "warning")
                    except Exception as e_w:
                        db.add_log(f"⚠️ Beszéd-felismerési hiba ({v_title}): {e_w}", "warning")
                else:
                    db.add_log(f"⏩ [Videó Félbemaradt] Nincs elérhető felirat vagy AI hangfeldolgozás ('{v_title}'). A videó nem zárult le, később újra átnézhető.", "info")

        # Never mark as scanned if user aborted or if processing failed/was incomplete!
        if self.stop_event.is_set():
            db.add_log(f"⏹ [{idx+1}/{total_videos}] Videó vizsgálata félbeszakadt (megállítva): '{v_title}'. A videó nyitva maradt, legközelebb újravizsgálható.", "warning")
            return

        if is_fully_processed:
            db.mark_video_scanned(v_id)
            with db.lock:
                db.scan_state["processed_count"] += 1
                db.scan_state["last_scanned_at"] = datetime.now().isoformat()
        else:
            db.add_log(f"⚠️ [{idx+1}/{total_videos}] A videó elemzése nem fejeződött be teljesen: '{v_title}'. Nyitva maradt, a következő 'Összes' futtatásnál újra át lesz nézve.", "warning")

    def _run_scan_loop(self, channel_url: str, max_videos: int, incremental: bool = False):
        try:
            db.scan_state["source_url"] = channel_url
            if incremental:
                db.add_log(f"⚡ Inkrementális heti frissítés: csak az új videók keresése...", "info")
            else:
                db.add_log(f"📡 Videók lekérése a listáról ({channel_url})...", "info")
            
            ydl_opts = get_ydl_opts({
                'extract_flat': True,
                'playlist_items': f'1-{max_videos}',
                'quiet': True
            })
            
            videos = []
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(channel_url, download=False)
                    title = info.get('title') or "WeAreTheVR Indie Horror"
                    videos = info.get('entries', [])
                    db.scan_state["source_title"] = title
                    db.add_log(f"🎯 Kiválasztott lista: '{title}' ({len(videos)} videó)", "success")
            except Exception as e:
                db.add_log(f"❌ HIBA a videók lekérésekor: {e}", "warning")
                db.scan_state["status"] = "idle"
                return

            total_videos = len(videos)
            db.scan_state["total_channel_videos"] = total_videos
            
            # Intelligens sorrend: Normál videók (< 2.5 óra = 9000 mp) előre vétele,
            # a maratoni (≥ 2.5 óra) videók automatikusan a sor legvégére kerülnek!
            MARATHON_THRESHOLD_SEC = 2.5 * 3600  # 9000 mp (2 óra 30 perc)
            normal_videos = []
            marathon_videos = []
            for v in videos:
                dur = float(v.get('duration') or 0.0)
                if dur >= MARATHON_THRESHOLD_SEC:
                    marathon_videos.append(v)
                else:
                    normal_videos.append(v)

            videos = normal_videos + marathon_videos

            # Count already scanned videos
            already_scanned = sum(1 for v in videos if v.get('id') and db.is_video_scanned(v.get('id')))
            db.scan_state["processed_count"] = already_scanned
            remaining = total_videos - already_scanned

            if marathon_videos:
                db.add_log(
                    f"📋 [Intelligens sorrend]: {len(normal_videos)} db normál videó (< 2.5 óra) előre véve, "
                    f"{len(marathon_videos)} db hosszú maratoni videó (≥ 2.5 óra) a sor legvégére ütemezve!",
                    "info"
                )

            if already_scanned > 0:
                db.add_log(f"📋 Összesen {total_videos} videó: {already_scanned} már korábban teljesen átnézve (kihagyva), {remaining} még nem ellenőrzött vagy félbemaradt videó vizsgálata indul!", "info")
            else:
                db.add_log(f"📋 Összesen {total_videos} videó ellenőrzése indul!", "info")

            api = YouTubeTranscriptApi()

            consecutive_seen = 0
            for idx, video in enumerate(videos):
                if self.stop_event.is_set():
                    db.add_log("⏹ Keresési folyamat leállítva a felhasználó által.", "warning")
                    break
                while self.pause_event.is_set():
                    time.sleep(0.5)
                    if self.stop_event.is_set():
                        break

                v_id = video.get('id')
                # Only scan videos that have NOT been completely scanned yet!
                if v_id and db.is_video_scanned(v_id):
                    if incremental:
                        consecutive_seen += 1
                        if consecutive_seen >= 3:
                            db.add_log("✓ Elértük a korábban már feldolgozott videókat. Az inkrementális heti frissítés kész!", "success")
                            break
                    continue
                else:
                    consecutive_seen = 0

                self._process_single_video(video, idx, total_videos, api, force=False)
                
                # Kíméletes szünet a videók között a YouTube IP-blokkolás megelőzésére
                if not self.stop_event.is_set():
                    time.sleep(random.uniform(2.0, 3.5))

            db.scan_state["status"] = "completed"
            db.add_log("🎉 Keresési folyamat sikeresen befejeződött!", "success")

        except Exception as top_e:
            db.scan_state["status"] = "idle"
            db.add_log(f"❌ VÁRATLAN SZERVER HIBA: {top_e}", "warning")
            db.add_log(f"Stacktrace: {traceback.format_exc()}", "warning")

    def _process_transcript(self, video_id: str, video_title: str, transcript: List[Dict[str, Any]], game_title: str = ""):
        matched_indices = []

        for idx, item in enumerate(transcript):
            text = item.get('text', '')
            text_lower = text.lower()

            is_match = False
            matched_kw = ""

            for pat in PRIMARY_PATTERNS:
                m = re.search(pat, text_lower)
                if m:
                    is_match = True
                    matched_kw = m.group(0)
                    break

            if not is_match:
                for noun_pat in TOILET_NOUN_PATTERNS:
                    m_noun = re.search(noun_pat, text_lower)
                    if m_noun:
                        start_window = max(0, idx - 2)
                        end_window = min(len(transcript), idx + 3)
                        window_text = " ".join([transcript[i].get('text', '').lower() for i in range(start_window, end_window)])
                        
                        # Strict check: only count if actual checking or scoring is happening!
                        strict_review_words = ['check', 'csekk', 'teszt', 'szemle', 'értékel', 'pont', 'skálá', 'tízből', '10-ből', 'csillag']
                        if any(mod in window_text for mod in strict_review_words):
                            is_match = True
                            matched_kw = m_noun.group(0)
                            break

            if is_match:
                matched_indices.append((idx, matched_kw))

        if not matched_indices:
            return

        filtered_matches = []
        for idx, kw in matched_indices:
            item = transcript[idx]
            start_sec = item.get('start', 0)
            if not filtered_matches or (start_sec - filtered_matches[-1]['start_sec']) > 60:
                filtered_matches.append({'idx': idx, 'start_sec': start_sec, 'kw': kw})

        for match in filtered_matches:
            idx = match['idx']
            start_sec = match['start_sec']
            kw = match['kw']

            quote_start = max(0, idx - 5)
            quote_end = min(len(transcript), idx + 12)
            quote_lines = [transcript[i].get('text', '') for i in range(quote_start, quote_end)]
            quote_text = " ... ".join(quote_lines)

            rating = extract_rating_from_text(quote_text)
            self._save_budi_check_entry(video_id, video_title, start_sec, rating, quote_text, kw, game_title=game_title)

scanner = VideoScanner()

