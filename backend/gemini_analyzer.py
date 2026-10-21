import os
import json
import re
import time
import random
import shutil
import subprocess
import concurrent.futures
from typing import List, Dict, Any, Optional
from google import genai
from google.genai import types
from PIL import Image

from .config import get_gemini_api_key, load_config
from .database import db, SCREENSHOTS_DIR
from .game_detector import detect_game_title_from_video

def get_ffmpeg_path() -> str:
    local_bin = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "bin", "ffmpeg.exe"))
    if os.path.exists(local_bin):
        return local_bin
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        pass
    return shutil.which("ffmpeg") or "ffmpeg"

def get_client() -> Optional[genai.Client]:
    api_key = get_gemini_api_key()
    if not api_key:
        return None
    try:
        return genai.Client(api_key=api_key)
    except Exception as e:
        db.add_log(f"⚠️ Hiba a Gemini kliens inicializálásakor: {e}", "warning")
        return None

SYSTEM_INSTRUCTION = """
Te egy professzionális videóelemző asszisztens vagy, akinek a feladata a magyar WeAreTheVR YouTube csatorna videóiban megkeresni az összes "Budi Check" / WC és piszoár értékelést.

Pisti és Jani (WeAreTheVR) játékok során vagy valós helyszíneken gyakran végeznek humoros, de alapos "Budi check"-et: megnézik a vécét, lehúzható-e, tiszta-e, van-e vécépapír, kuka, és pontozzák (általában 0-10-es skálán, pl. 4/10, 4.5, "négy és fél", 8 pont, vagy 10-ből 9).

SZIGORÚ KÖVETELMÉNYEK:
1. KIZÁRÓLAG VALÓDI BUDI ÉRTÉKELÉSEKET KERESS!
   - TÉNYLEGESEN vécét, vécékagylót, budit, toalettet, piszoárt vagy pottyantóst kell értékelniük.
   - HA NINCS BUDI, KI KELL HAGYNI! Különálló vízcsap, mosdókagyló, fürdőkád vagy zuhanyzó önmagában NEM budicheck, amennyiben nem szerepel benne vécé/budi! Ha Jani csak egy csapot vagy kádat dicsér, azt HAGYD KI, ne vegyél fel találatot!
2. Szűrd ki a hamis találatokat! Csak akkor hozz létre találatot, ha valóban magát a WC-t / budit / piszoárt értékelik vagy szemlézik.
3. Pontszám (rating):
   - Ha elhangzik konkrét pontszám (pl. "négy és fél", "4 és fél", "4/10", "10-ből 7", "8 pont", "adok rá egy 5-öst"), pontosan azt a lebegőpontos számot add meg (pl. 4.5).
   - Ha nem mondanak konkrét számot, de nagyon dicsérik (tiszta, szép, csodás), adj 8.5-öt.
   - Ha undorító, retkes, koszos, használhatatlan, adj 2.0-t.
   - Ha semleges, adj 6.5-öt.
4. Idézet (quote):
   - Írd le szó szerint, természetes és hibátlan magyar helyesírással a legfontosabb elhangzott mondatokat (mit mondtak a budiról és az értékelésről).
5. Időpontok (start_time, start_sec és verdict_sec):
   - "start_sec": A budi check jelenet kezdete másodpercben (amikor Jani belép a mosdóba és megkezdi a szemlét).
   - "verdict_sec": Az a másodperc, amikor Jani elkezdi KIMONDANI a pontszámot (pl. "Erre adok egy...", "Ez nálam egy 8-as"). A kvízjáték videója pont eddig a másodpercig fog játszani, hogy a játékosnak ne spoilerezze el a pontszámot a szavazás előtt!
   - "start_time": A kezdő időpont szöveges formátumban (pl. "01:16:31" vagy "12:45").

SZIGORÚ VÁLASZFORMÁTUM:
Kizárólag érvényes JSON formátumban válaszolj az alábbi séma szerint:
{
  "matches": [
    {
      "start_time": "01:16:31",
      "start_sec": 4591.5,
      "verdict_sec": 4604.0,
      "rating": 5.0,
      "matched_keyword": "budi check",
      "quote": "Ne aggódjatok, megy a budi check! Hát ilyen budit meg ilyen fürdőt még életemben nem láttam. Thin design, ezt úgy hívják.",
      "summary": "Jani megnézi a furcsa Backrooms mosdót és 5 pontot ad rá."
    }
  ]
}
Ha nincs a videóban budi check, a válaszod ez legyen: {"matches": []}
"""

def parse_scene_timestamp(m: Dict[str, Any], video_duration: float = 0.0) -> float:
    """Parses timestamps accurately from Gemini responses. Handles 'MM:SS', 'HH:MM:SS',
    and detects accidental MMSS/HHMMSS float concatenations (like 7631.5 -> 76m 31.5s = 4591.5s)."""
    # 1. Textual start_time (e.g. "01:16:31", "76:31", "12:45")
    st = str(m.get("start_time", "")).strip()
    if st and ":" in st:
        parts = st.split(":")
        try:
            if len(parts) == 3:
                cand = float(parts[0]) * 3600.0 + float(parts[1]) * 60.0 + float(parts[2])
                if video_duration <= 0 or cand <= video_duration:
                    return cand
            elif len(parts) == 2:
                cand = float(parts[0]) * 60.0 + float(parts[1])
                if video_duration <= 0 or cand <= video_duration:
                    return cand
        except Exception:
            pass

    # 2. Numeric start_sec
    raw_sec = m.get("start_sec")
    try:
        sec = float(raw_sec)
    except (TypeError, ValueError):
        sec = 0.0

    # 3. Detect if Gemini concatenated MM:SS or HH:MM:SS without colon
    # For instance 7631.5 in a 4852s video means 76 mins 31.5 secs = 4591.5s
    if video_duration > 0 and sec > video_duration:
        # Check MMSS: e.g. 7631.5 -> mm=76, ss=31.5
        mm = int(sec // 100)
        ss = sec % 100
        if ss < 60:
            cand = mm * 60.0 + ss
            if 0 <= cand <= video_duration:
                return cand
        # Check HHMMSS: e.g. 11631 -> hh=1, mm=16, ss=31
        hh = int(sec // 10000)
        rem = sec % 10000
        mm = int(rem // 100)
        ss = rem % 100
        if mm < 60 and ss < 60:
            cand = hh * 3600.0 + mm * 60.0 + ss
            if 0 <= cand <= video_duration:
                return cand

    # Clamp to valid duration if video_duration is known
    if video_duration > 5.0:
        sec = max(0.0, min(sec, video_duration - 5.0))
    return max(0.0, sec)

SUPPORTED_MODELS = [
    {"id": "gemini-3.5-flash-lite", "name": "Gemini 3.5 Flash-Lite (Ajánlott - Nagy kvóta)"},
    {"id": "gemini-3.1-flash-lite", "name": "Gemini 3.1 Flash-Lite (Gyors - Nagy kvóta)"},
    {"id": "gemini-3.7-flash", "name": "Gemini 3.7 Flash"},
    {"id": "gemini-3.5-flash", "name": "Gemini 3.5 Flash"},
    {"id": "gemini-flash-latest", "name": "Gemini Flash (Hivatalos legfrissebb)"},
]

FALLBACK_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.7-flash",
    "gemini-3.5-flash",
    "gemini-flash-latest"
]

_quota_cache = {
    "timestamp": 0.0,
    "data": []
}

def check_models_quota(force_refresh: bool = False) -> List[Dict[str, Any]]:
    global _quota_cache
    now = time.time()
    # Cache for 180 seconds (3 mins)
    if not force_refresh and _quota_cache["data"] and (now - _quota_cache["timestamp"] < 180):
        return _quota_cache["data"]

    client = get_client()
    if not client:
        return [
            {
                "id": m["id"],
                "name": m["name"],
                "status": "no_key",
                "label_status": "⚠️ Nincs API kulcs",
                "full_label": f"{m['name']} — ⚠️ Nincs API kulcs",
                "retry": None
            }
            for m in SUPPORTED_MODELS
        ]

    def _probe(item: Dict[str, str]) -> Dict[str, Any]:
        m_id = item["id"]
        m_name = item["name"]
        try:
            client.models.generate_content(
                model=m_id,
                contents="ping",
                config=types.GenerateContentConfig(max_output_tokens=1)
            )
            return {
                "id": m_id,
                "name": m_name,
                "status": "available",
                "label_status": "🟢 Aktív (Bőséges kvóta)",
                "full_label": f"{m_name} — 🟢 Aktív",
                "retry": None
            }
        except Exception as e:
            err_str = str(e)
            if "RESOURCE_EXHAUSTED" in err_str or "429" in err_str:
                m_match = re.search(r'retry in (\d+h\d+m|\d+h|\d+m|\d+s)', err_str)
                if m_match:
                    raw_time = m_match.group(1)
                    retry_hu = raw_time.replace("h", "ó ").replace("m", "p").replace("s", "mp")
                    label = f"🔴 Limit elérve (Újra: ~{retry_hu})"
                    retry_val = retry_hu
                else:
                    label = "🔴 Napi limit elérve (Reset: holnap reggel)"
                    retry_val = "holnap reggel"
                return {
                    "id": m_id,
                    "name": m_name,
                    "status": "exhausted",
                    "label_status": label,
                    "full_label": f"{m_name} — {label}",
                    "retry": retry_val
                }
            elif "503" in err_str or "UNAVAILABLE" in err_str or "high demand" in err_str.lower():
                return {
                    "id": m_id,
                    "name": m_name,
                    "status": "busy",
                    "label_status": "🟡 Túlterhelt (Átmenetileg foglalt)",
                    "full_label": f"{m_name} — 🟡 Túlterhelt",
                    "retry": "pár perc"
                }
            elif "NOT_FOUND" in err_str or "404" in err_str:
                return {
                    "id": m_id,
                    "name": m_name,
                    "status": "unavailable",
                    "label_status": "⚪ Nem elérhető",
                    "full_label": f"{m_name} — ⚪ Nem elérhető",
                    "retry": None
                }
            else:
                return {
                    "id": m_id,
                    "name": m_name,
                    "status": "warning",
                    "label_status": "⚠️ Átmeneti hiba",
                    "full_label": f"{m_name} — ⚠️ Átmeneti hiba",
                    "retry": None
                }

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(SUPPORTED_MODELS)) as executor:
            results = list(executor.map(_probe, SUPPORTED_MODELS))
    except Exception as e:
        results = [
            {
                "id": m["id"],
                "name": m["name"],
                "status": "unknown",
                "label_status": "❓ Állapot nem lekérdezhető",
                "full_label": m["name"],
                "retry": None
            }
            for m in SUPPORTED_MODELS
        ]

    _quota_cache = {
        "timestamp": now,
        "data": results
    }
    return results

def get_models_list(preferred_model: Optional[str] = None) -> List[str]:
    cfg = load_config()
    chosen = preferred_model or cfg.get("model_name", "gemini-3.5-flash-lite")
    models = [chosen] + FALLBACK_MODELS
    seen = set()
    return [m for m in models if not (m in seen or seen.add(m))]

def analyze_transcript_with_gemini(video_id: str, video_title: str, transcript_items: List[Dict[str, Any]], video_duration: float = 0.0) -> Optional[List[Dict[str, Any]]]:
    client = get_client()
    if not client:
        return None

    # Format transcript with timestamps
    lines = []
    for item in transcript_items:
        sec = item.get("start", 0.0)
        m = int(sec // 60)
        s = int(sec % 60)
        text = item.get("text", "").strip()
        if text:
            lines.append(f"[{m:02d}:{s:02d} | {sec:.1f}s] {text}")

    full_transcript_text = "\n".join(lines)
    if not full_transcript_text.strip():
        return []

    dur_str = f"{int(video_duration // 60)} perc {int(video_duration % 60)} másodperc ({video_duration:.0f} mp)" if video_duration > 0 else "ismeretlen"
    prompt = f"""
Videó címe: "{video_title}"
YouTube Azonosító: {video_id}
Videó hossza: {dur_str}

Itt van a videó teljes magyar szövegátirata időkódokkal:
---
{full_transcript_text}
---

Keresd meg az összes Budi Check / mosdó értékelés jelenetet az utasítások szerint, és válaszolj szigorúan JSON formátumban!
"""

    models_to_try = get_models_list()

    for m_name in models_to_try:
        for attempt in range(3):
            try:
                db.add_log(f"🧠 [Gemini AI] Videószöveg elemzése magyar nyelven ({m_name})...", "info")
                response = client.models.generate_content(
                    model=m_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_INSTRUCTION,
                        response_mime_type="application/json",
                        temperature=0.2
                    )
                )

                raw_text = response.text or "{}"
                clean_json = raw_text.strip()
                if clean_json.startswith("```json"):
                    clean_json = clean_json[7:]
                if clean_json.startswith("```"):
                    clean_json = clean_json[3:]
                if clean_json.endswith("```"):
                    clean_json = clean_json[:-3]
                clean_json = clean_json.strip()

                data = json.loads(clean_json)
                matches = data.get("matches", [])
                for m in matches:
                    m["start_sec"] = parse_scene_timestamp(m, video_duration)
                db.add_log(f"✨ [Gemini AI] Elemzés sikeres ({m_name})! Találatok: {len(matches)}", "success" if matches else "info")
                return matches

            except Exception as e:
                err_str = str(e)
                if ("503" in err_str or "UNAVAILABLE" in err_str or "overloaded" in err_str.lower()) and attempt < 2:
                    wait_time = (attempt + 1) * 8.0 + random.uniform(1.0, 3.0)
                    db.add_log(f"⏳ Gemini szerver pillanatnyilag leterhelt ({m_name}), kímélő újrapróbálás {int(wait_time)} mp múlva...", "warning")
                    time.sleep(wait_time)
                    continue
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                    db.add_log(f"⚠️ Gemini kvótakorlát elérve ({m_name}), automatikus átváltás a következő modellre...", "warning")
                    break
                else:
                    short_err = err_str.split("\n")[0][:100]
                    db.add_log(f"⚠️ Gemini modell hiba ({m_name}): {short_err}", "warning")
                    break

    return None

def _analyze_single_audio_file(
    client: genai.Client,
    video_id: str,
    video_title: str,
    audio_path: str,
    segment_duration: float,
    slice_start_sec: float = 0.0,
    slice_label: str = ""
) -> Optional[List[Dict[str, Any]]]:
    """Helper to upload and analyze a single audio file/slice with Gemini."""
    if not os.path.exists(audio_path) or os.path.getsize(audio_path) < 1000:
        return None

    uploaded_file = None
    try:
        size_mb = os.path.getsize(audio_path) / (1024 * 1024)
        prefix = f" [{slice_label}]" if slice_label else ""
        db.add_log(f"☁️ [Gemini AI]{prefix} Hangfájl feltöltése a felhőbe ({size_mb:.1f} MB)...", "info")
        
        uploaded_file = client.files.upload(file=audio_path)
        
        # Wait for file to become active in Google cloud
        for _ in range(45):
            if uploaded_file.state and uploaded_file.state.name == "ACTIVE":
                break
            time.sleep(1)
            try:
                uploaded_file = client.files.get(name=uploaded_file.name)
            except Exception:
                pass

        dur_str = f"{int(segment_duration // 60)} perc {int(segment_duration % 60)} másodperc ({segment_duration:.0f} mp)" if segment_duration > 0 else "ismeretlen"
        
        if slice_start_sec > 0 or slice_label:
            prompt = f"""
Videó címe: "{video_title}"
YouTube Azonosító: {video_id}
Ez a hanganyag egy {int(segment_duration // 60)} perces részlet a videóból az alábbi idősávban: {slice_label or dur_str}.

Hallgasd végig a mellékelt magyar nyelvű hanganyagot (WeAreTheVR videó).
Keresd meg azokat a részeket, ahol mosdót / WC-t / budit értékelnek vagy ellenőriznek ("Budi Check").
SZABÁLY:
A talált "start_sec" és "start_time" relatív legyen ehhez a részlethez képest (0 másodperctől {int(segment_duration)} másodpercig).
Add meg a pontszámot (0-10, pl. 4.5), a szó szerinti elhangzott magyar mondatokat (quote), és a kulcsszót.
Válaszolj szigorúan JSON formátumban a megadott séma szerint!
"""
        else:
            prompt = f"""
Videó címe: "{video_title}"
YouTube Azonosító: {video_id}
Videó teljes hossza: {dur_str}

Hallgasd végig a mellékelt magyar nyelvű hanganyagot (WeAreTheVR videó).
Keresd meg azokat a részeket, ahol mosdót / WC-t / budit értékelnek vagy ellenőriznek ("Budi Check").
Határozd meg a jelenet pontos kezdési idejét mind szövegesen ("start_time", pl. "01:16:31" vagy "12:45"), mind összes másodpercben ("start_sec", pl. 4591), a pontszámot (0-10, pl. 4.5), a szó szerinti elhangzott magyar mondatokat (quote), és a kulcsszót.
Válaszolj szigorúan JSON formátumban a megadott séma szerint!
"""

        models_to_try = get_models_list()

        for m_name in models_to_try:
            for attempt in range(3):
                try:
                    response = client.models.generate_content(
                        model=m_name,
                        contents=[uploaded_file, prompt],
                        config=types.GenerateContentConfig(
                            system_instruction=SYSTEM_INSTRUCTION,
                            response_mime_type="application/json",
                            temperature=0.2
                        )
                    )

                    raw_text = response.text or "{}"
                    clean_json = raw_text.strip()
                    if clean_json.startswith("```json"):
                        clean_json = clean_json[7:]
                    if clean_json.startswith("```"):
                        clean_json = clean_json[3:]
                    if clean_json.endswith("```"):
                        clean_json = clean_json[:-3]
                    clean_json = clean_json.strip()

                    data = json.loads(clean_json)
                    matches = data.get("matches", [])
                    adjusted = []
                    for m in matches:
                        rel_sec = parse_scene_timestamp(m, segment_duration)
                        abs_sec = round(slice_start_sec + rel_sec, 1)
                        m["start_sec"] = abs_sec
                        secs = int(abs_sec)
                        hh = secs // 3600
                        mm = (secs % 3600) // 60
                        ss = secs % 60
                        m["start_time"] = f"{hh:02d}:{mm:02d}:{ss:02d}" if hh > 0 else f"{mm:02d}:{ss:02d}"
                        adjusted.append(m)

                    db.add_log(f"✨ [Gemini AI Audió]{prefix} Sikeres hallgatási elemzés ({m_name})! Találatok: {len(adjusted)}", "success" if adjusted else "info")
                    return adjusted

                except Exception as e_m:
                    err_str = str(e_m)
                    if ("503" in err_str or "UNAVAILABLE" in err_str or "overloaded" in err_str.lower()) and attempt < 2:
                        wait_time = (attempt + 1) * 8.0 + random.uniform(1.0, 3.0)
                        db.add_log(f"⏳ Gemini szerver pillanatnyilag leterhelt ({m_name}), kímélő újrapróbálás {int(wait_time)} mp múlva...", "warning")
                        time.sleep(wait_time)
                        continue
                    if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                        db.add_log(f"⚠️ Gemini audió kvótakorlát ({m_name}), átváltás a következő modellre...", "warning")
                        break
                    elif "503" in err_str or "UNAVAILABLE" in err_str:
                        db.add_log(f"⚠️ Gemini szerver túlterhelt ({m_name}), átváltás a következő modellre...", "warning")
                        break
                    else:
                        short_err = err_str.split("\n")[0][:100]
                        db.add_log(f"⚠️ Gemini audió hiba ({m_name}): {short_err}", "warning")
                        break

    except Exception as e:
        db.add_log(f"⚠️ Gemini hangfájl feldolgozási hiba: {str(e).split('\n')[0][:100]}", "warning")
    finally:
        if uploaded_file and client:
            try:
                client.files.delete(name=uploaded_file.name)
            except Exception:
                pass

    return None

def analyze_audio_with_gemini(video_id: str, video_title: str, audio_path: str, video_duration: float = 0.0) -> Optional[List[Dict[str, Any]]]:
    """
    Intelligently analyzes video audio with Gemini.
    - For normal videos (< 2.5 hours = 9000s): processes single audio file directly.
    - For marathon videos (>= 2.5 hours): slices audio with FFmpeg into 40-minute overlapping windows
      with 3-minute overlap, preventing Gemini token overflow and eliminating boundary misses!
    """
    client = get_client()
    if not client:
        return None

    if not os.path.exists(audio_path) or os.path.getsize(audio_path) < 1000:
        return None

    MARATHON_THRESHOLD_SEC = 2.5 * 3600  # 9000 seconds (2.5 hours)
    
    # If the video is 2.5+ hours long, apply overlapping sliding window chunking!
    if video_duration >= MARATHON_THRESHOLD_SEC:
        CHUNK_SEC = 2400.0   # 40 minutes per slice
        OVERLAP_SEC = 180.0  # 3 minutes overlap buffer
        STEP_SEC = CHUNK_SEC - OVERLAP_SEC  # 37 minutes advance

        slices = []
        curr = 0.0
        while curr < video_duration:
            dur = min(CHUNK_SEC, video_duration - curr)
            if dur < 30.0:
                break
            slices.append((curr, dur))
            curr += STEP_SEC
            if curr + 60.0 >= video_duration:
                break

        dur_hours = video_duration / 3600.0
        db.add_log(
            f"✂️ [Maratoni Videó - Átfedéses Szeletelés]: {dur_hours:.1f} órás hanganyag feldarabolása "
            f"{len(slices)} db 40 perces szeletre (3 perc átfedéssel a határokon a budik elvesztése ellen)...",
            "info"
        )

        ffmpeg_exe = get_ffmpeg_path()
        data_dir = os.path.dirname(audio_path)
        all_matches = []

        for idx, (s_start, s_dur) in enumerate(slices):
            s_start_fmt = f"{int(s_start//3600):02d}:{int((s_start%3600)//60):02d}:{int(s_start%60):02d}"
            s_end = s_start + s_dur
            s_end_fmt = f"{int(s_end//3600):02d}:{int((s_end%3600)//60):02d}:{int(s_end%60):02d}"
            slice_file = os.path.join(data_dir, f"slice_{video_id}_{idx}.m4a")

            cmd = [
                ffmpeg_exe,
                '-y',
                '-ss', str(s_start),
                '-i', audio_path,
                '-t', str(s_dur),
                '-c', 'copy',
                slice_file
            ]
            try:
                subprocess.run(cmd, capture_output=True, timeout=45)
            except Exception as e_cut:
                db.add_log(f"⚠️ Hiba a szelet kivágásakor ({s_start_fmt}): {e_cut}", "warning")
                continue

            if not os.path.exists(slice_file) or os.path.getsize(slice_file) < 1000:
                continue

            try:
                slice_label = f"{s_start_fmt} - {s_end_fmt}"
                db.add_log(f"🎧 [Szelet {idx+1}/{len(slices)}]: {slice_label} meghallgatása és elemzése...", "info")
                s_matches = _analyze_single_audio_file(
                    client=client,
                    video_id=video_id,
                    video_title=video_title,
                    audio_path=slice_file,
                    segment_duration=s_dur,
                    slice_start_sec=s_start,
                    slice_label=slice_label
                )
                if s_matches:
                    for m in s_matches:
                        # Deduplicate across overlap windows:
                        # If a match within 90s already exists in all_matches, ignore duplicate
                        is_dup = any(abs(m["start_sec"] - ex["start_sec"]) <= 90.0 for ex in all_matches)
                        if not is_dup:
                            all_matches.append(m)
            finally:
                if os.path.exists(slice_file):
                    try:
                        os.remove(slice_file)
                    except Exception:
                        pass

        db.add_log(f"✨ [Maratoni Videó Kész]: {len(slices)} szelet feldolgozva, összesen {len(all_matches)} budi check találat!", "success" if all_matches else "info")
        return all_matches

    # Standard analysis for normal videos (< 2.5 hours)
    return _analyze_single_audio_file(
        client=client,
        video_id=video_id,
        video_title=video_title,
        audio_path=audio_path,
        segment_duration=video_duration,
        slice_start_sec=0.0
    )

def extract_game_title(video_id: str, video_title: str, video_description: str = "", intro_transcript_text: str = "", timestamp_sec: float = 0.0) -> str:
    """Extracts the actual game title (e.g. 'Silent Hill 2 Remake', 'Lobotomy', 'Silent Wounds: The Doll', 'Black Pines')."""
    # 1. YouTube chapters / description priority!
    try:
        detected = detect_game_title_from_video(video_id, timestamp_sec, video_title, video_description)
        if detected:
            db.add_log(f"🎮 [Játék YouTube Chapter alapján azonosítva]: '{detected}' ({video_title})", "info")
            return detected
    except Exception:
        pass

    client = get_client()
    if not client:
        return video_title

    prompt = f"""
Videó YouTube címe: "{video_title}"
YouTube Leírás (részlet): "{video_description[:600]}"
Videó első 2-3 percében elhangzott szöveg:
"{intro_transcript_text[:1500]}"

FELADAT:
A TheVR YouTube videók címei gyakran clickbait / vicces mondatok (pl. "NEM VOLT NORMÁLIS, aki ezt kitalálta 😅" vagy "11 évesen nem viccesek a Backroomok 😳").
A te feladatod az, hogy azonosítsd a videóban játszott konkrét videojáték pontos, valódi címét.

SZIGORÚ SZABÁLYOK:
1. ELSŐDLEGESEN A VIDEÓ CÍMÉRE TÁMASZKODJ:
   - Ha a videó címében szerepel egy játék neve vagy ismert kifejezése (pl. "Backroomok" -> "The Backrooms", "Silent Hill" -> "Silent Hill", "Outlast" -> "Outlast", "The Plant Shop" -> "The Plant Shop", "Fears to Fathom" -> "Fears to Fathom", "Minecraft" -> "Minecraft"), KÖTELEZŐEN azt a játéknevet használd!
2. TILOS A HALLUCINÁCIÓ:
   - SOHA NE találj ki teljesen idegen, más műfajú játéknevet (pl. ne nevezz egy Backrooms horrort 'Beyond the Frame'-nek csak azért, mert egy mondatban elhangzott valami hasonló szó)!
   - Ha nem vagy biztos a játék címében, válaszold a videó YouTube címét a hangulatjelek nélkül (pl. "Nem volt normális aki ezt kitalálta").
3. SOHA ne adj vissza általános kategóriát, mint 'Vlog' vagy 'WeAreTheVR'!
4. Kizárólag a játék tiszta címét írd le válaszul (max 3-5 szó), semmi egyéb magyarázatot, idézőjelet vagy bevezetést!
"""

    models_to_try = get_models_list()
    for m_name in models_to_try:
        try:
            resp = client.models.generate_content(
                model=m_name,
                contents=prompt,
                config=types.GenerateContentConfig(temperature=0.1)
            )
            raw = (resp.text or "").strip()
            # Clean up potential markdown formatting or quotes
            clean_title = re.sub(r'[\*\"\'`]', '', raw).strip()
            if clean_title and len(clean_title) < 60:
                db.add_log(f"🎮 [Játék Felismerve]: '{clean_title}' (Videó: '{video_title}')", "info")
                return clean_title
        except Exception:
            continue

    return video_title

def audit_budi_check_with_ai(entry: Dict[str, Any]) -> Dict[str, Any]:
    """
    Automated AI verification for a BudiCheck card:
    - Analyzes if a real toilet/wc check happened (rejects standalone taps/sinks/bathtubs without toilet).
    - Audits and auto-corrects the game title using YouTube chapters and timestamps.
    - Audits and auto-corrects the score based on what was said.
    - Uses Gemini Vision to check if the screenshot actually shows a toilet fixture.
    """
    client = get_client()
    v_id = entry.get("video_id", "")
    v_title = entry.get("video_title", "")
    g_title = entry.get("game_title", v_title)
    quote = entry.get("quote", "")
    rating = float(entry.get("rating", 7.0))
    keyword = entry.get("matched_keyword", "")
    ts_fmt = entry.get("timestamp_formatted", "")
    ts_sec = float(entry.get("timestamp_sec", 0.0))

    # Detect game title from YouTube chapters for this timestamp
    chapter_game = None
    try:
        chapter_game = detect_game_title_from_video(v_id, ts_sec, v_title)
    except Exception:
        pass

    target_game_title = chapter_game or g_title

    if not client:
        return {
            "is_valid_budicheck": True,
            "audit_status": "verified" if entry.get("is_verified") else "warning",
            "audit_notes": "Gemini API nem elérhető, manuális ellenőrzés szükséges.",
            "corrected_game_title": target_game_title,
            "corrected_rating": rating,
            "has_toilet_fixture": True
        }

    # Vision check if screenshot exists
    has_toilet_fixture = True
    vision_note = ""
    screenshot_url = entry.get("screenshot_url", "")
    desc = ""
    if screenshot_url and screenshot_url.startswith("/screenshots/"):
        fname = os.path.basename(screenshot_url)
        fpath = os.path.join(SCREENSHOTS_DIR, fname)
        if os.path.exists(fpath) and os.path.getsize(fpath) > 1000:
            try:
                img = Image.open(fpath)
                vis_prompt = [
                    "Vizsgáld meg a mellékelt képernyőképet egy videóból.",
                    "Kérdés: Látható ezen a képen WC, vécékagyló, piszoár vagy pottyantós budi?",
                    "SZIGORÚ SZABÁLY: A BudiCheck kizárólag budikat/vécéket értékel! Ha a képen CSAK egy különálló vízcsap, mosdókagyló, fürdőkád vagy zuhanyzó látható és EGYÁLTALÁN NINCS vécékagyló/budi/piszoár, vagy csak sötét szoba/menü látható, akkor has_fixture = false.",
                    "Szigorú JSON válasz: {\"has_fixture\": true/false, \"description\": \"rövid 1 mondatos leírás mi látható a képen\"}"
                ]
                models_to_try = get_models_list()
                for m_name in models_to_try:
                    try:
                        v_resp = client.models.generate_content(
                            model=m_name,
                            contents=[vis_prompt[0], vis_prompt[1], vis_prompt[2], vis_prompt[3], img],
                            config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.1)
                        )
                        v_raw = (v_resp.text or "{}").strip()
                        if v_raw.startswith("```json"):
                            v_raw = v_raw[7:]
                        if v_raw.startswith("```"):
                            v_raw = v_raw[3:]
                        if v_raw.endswith("```"):
                            v_raw = v_raw[:-3]
                        v_data = json.loads(v_raw.strip())
                        has_toilet_fixture = bool(v_data.get("has_fixture", True))
                        desc = v_data.get("description", "")
                        if not has_toilet_fixture:
                            vision_note = f"⚠️ Képernyőképen budi helyett {desc} látható."
                        break
                    except Exception:
                        continue
            except Exception:
                pass

    # Main text & validity audit prompt
    audit_prompt = f"""
Te egy szigorú és intelligens AI BudiCheck Ellenőr (Auditor) vagy a TheVR Jani BudiCheck projektben.
A feladatod egy kinyert videórészlet adatlapjának felülvizsgálata, a hibák javítása és a valódiság eldöntése.

ADATLAP:
- YouTube Videó Címe: "{v_title}"
- Jelenleg beállított Játék Neve: "{g_title}"
- YouTube Fejezet / Timestamp szerint játszott játék: "{chapter_game or 'Nincs külön fejezet'}"
- Időbélyeg: {ts_fmt} ({ts_sec} másodperc)
- Kulcsszó: "{keyword}"
- Jelenlegi pontszám: {rating}/10
- Elhangzott idézet a videóból:
"{quote}"

SZEMPONTOK ÉS FELADATOK:
1. VALÓDI BUDICHECK-E (is_valid_budicheck):
   - A projekt KIZÁRÓLAG vécéket / budikat / piszoárokat értékel!
   - HA NINCS BUDI, KI KELL HAGYNI: Ha Jani CSAK egy különálló vízcsapról, mosdókagylóról vagy fürdőkádról beszél, és NEM szerepel benne vécé/budi (pl. "Egy kád és egy elképesztő minőségű csap... Ez a csap meg ez a mosdókagyló... Ez 10 per 10"): AZ NEM BUDICHECK! Ekkor is_valid_budicheck = false, audit_status = "rejected".
   - Csak akkor érvényes budicheck (true, verified), ha ténylegesen vécét, budit, toalettet vagy piszoárt értékelnek és pontoznak!
   - Ha CSAK egy hétköznapi szitokszó/kifejezés ("elmentem a budira", "szar ez a boss"), vagy csak csap/kád értékelése vécé nélkül: NEM (false), audit_status = "rejected".

2. JÁTÉKNÉV PONTOSSÁGA ÉS BEÁLLÍTÁSA (corrected_game_title):
   - Ha a YouTube Fejezet / Timestamp szerint ismert a játék címe (pl. "{chapter_game}"), KÖTELEZŐEN azt a pontos nevet használd, mert a TheVR több játékot is játszik egy videóban!
   - Ha nincs fejezet, a videó címe és leírása alapján a tényleges játékot add meg (pl. "Silent Hill 2", "The Backrooms", "Night Record: Thin Walls").

3. PONTSZÁM PONTOSSÁGA ÉS JAVÍTÁSA (corrected_rating):
   - Az idézetben konkrétan elhangzott pontszámot add meg (pl. "10 per 10" -> 10.0, "hatos budi" -> 6.0, "öt és fél" -> 5.5, "0,5" -> 0.5, "másfél" -> 1.5, "hármas" -> 3.0).
   - Ha nem hangzik el szám, de egyértelmű az ítélet: szuper=8.5, átlagos=6.0, kuka/borzasztó=2.0.

4. AUDIT STÁTUSZ (audit_status):
   - "verified": Biztosan valódi budi értékelés, helyes játéknévvel és pontszámmal.
   - "warning": Valószínűleg budi értékelés, de kisebb bizonytalanság vagy képeltérés van.
   - "rejected": Fals találat! Nem történt budi értékelés (pl. csak csap/kád volt, vagy nem vécét értékeltek). Kiszűrendő!

5. INDOKLÁS (audit_notes):
   - 1-2 mondatos, világos magyar összefoglalás a döntésről (pl. "Igazolt valódi budi értékelés a megadott YouTube fejezet alapján.").

SZIGORÚ JSON VÁLASZFORMÁTUM:
{{
  "is_valid_budicheck": true,
  "audit_status": "verified",
  "corrected_game_title": "{target_game_title}",
  "corrected_rating": {rating},
  "audit_notes": "Valódi budi értékelés a YouTube fejezet alapján."
}}
"""

    models_to_try = get_models_list()
    for m_name in models_to_try:
        try:
            resp = client.models.generate_content(
                model=m_name,
                contents=audit_prompt,
                config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.1)
            )
            raw = (resp.text or "{}").strip()
            if raw.startswith("```json"):
                raw = raw[7:]
            if raw.startswith("```"):
                raw = raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]
            res_data = json.loads(raw.strip())
            
            is_valid = bool(res_data.get("is_valid_budicheck", True))
            status = str(res_data.get("audit_status", "verified" if is_valid else "rejected")).lower()
            if status not in ["verified", "warning", "rejected"]:
                status = "verified" if is_valid else "rejected"

            corr_title = str(res_data.get("corrected_game_title", target_game_title)).strip()
            if chapter_game:
                corr_title = chapter_game
            corr_rating = float(res_data.get("corrected_rating", rating))
            base_notes = str(res_data.get("audit_notes", "")).strip()

            # Strict Visual Gate: A check can NEVER be verified if the screenshot doesn't show a toilet/fixture!
            if not has_toilet_fixture:
                if status == "verified":
                    status = "warning"
                vision_warning = f"⚠️ [KÉPHIBÁS]: A hanganyag valódi budi értékelés, de a képernyőképen budi helyett {desc or 'egyéb tárgy'} látható. A kép pontosítása szükséges!"
                final_notes = f"{base_notes} {vision_warning}".strip()
            elif vision_note:
                final_notes = f"{base_notes} {vision_note}".strip()
            else:
                final_notes = base_notes

            return {
                "is_valid_budicheck": is_valid,
                "audit_status": status,
                "audit_notes": final_notes or "Automatikus audit sikeres.",
                "corrected_game_title": corr_title or target_game_title,
                "corrected_rating": corr_rating,
                "has_toilet_fixture": has_toilet_fixture
            }
        except Exception:
            continue

    return {
        "is_valid_budicheck": True,
        "audit_status": "warning",
        "audit_notes": "Sikertelen AI audit hívás, manuális felülvizsgálat.",
        "corrected_game_title": target_game_title,
        "corrected_rating": rating,
        "has_toilet_fixture": has_toilet_fixture
    }

def select_best_toilet_frame(candidate_frame_paths: List[str]) -> int:
    """Uses Gemini Vision to select which candidate frame shows the toilet/bathroom most clearly."""
    client = get_client()
    if not client or not candidate_frame_paths:
        return 0

    valid_frames = []
    for idx, path in enumerate(candidate_frame_paths):
        if os.path.exists(path) and os.path.getsize(path) > 1000:
            try:
                img = Image.open(path)
                valid_frames.append((idx, path, img))
            except Exception:
                pass

    if not valid_frames:
        return 0
    if len(valid_frames) == 1:
        return valid_frames[0][0]

    contents = [
        "Ezek a képkockák egy videó mosdó-értékelés (Budi Check) jelenetéből származnak.",
        "A feladatod kiválasztani azt a képkockát, ahol a LEGINKÁBB, LEGKÖZELEBBRŐL ÉS LEGTISZTÁBBAN látható a WC / vécékagyló / piszoár / mosdókagyló.",
        "Ha több képen is látható, válaszd azt, ahol a legtisztábban, fókuszban van a vécé.",
        "Válaszolj szigorúan JSON formátumban az alábbi séma szerint:",
        "{\"best_index\": <a kiválasztott kép indexe egész számként>, \"reason\": \"rövid indoklás\"}"
    ]

    for idx, _, img in valid_frames:
        contents.append(f"Képkocka index: {idx}")
        contents.append(img)

    models_to_try = get_models_list()
    for m_name in models_to_try:
        try:
            resp = client.models.generate_content(
                model=m_name,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1
                )
            )
            raw = (resp.text or "{}").strip()
            if raw.startswith("```json"):
                raw = raw[7:]
            if raw.startswith("```"):
                raw = raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]
            data = json.loads(raw.strip())
            best_idx = int(data.get("best_index", valid_frames[0][0]))
            reason = data.get("reason", "")
            db.add_log(f"📸 [Gemini Vision]: A(z) {best_idx}. képkocka mutatja legszebben a vécét! ({reason})", "snapshot")
            # Ensure index is valid
            for v_idx, _, _ in valid_frames:
                if v_idx == best_idx:
                    return best_idx
        except Exception:
            continue

    # Fallback to second or middle frame if vision fails (usually when they step closer to toilet)
    return valid_frames[min(1, len(valid_frames) - 1)][0]
