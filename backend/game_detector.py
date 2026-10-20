import re
import threading
from typing import Dict, List, Any, Optional
import yt_dlp

_cache_lock = threading.Lock()
_video_info_cache: Dict[str, Dict[str, Any]] = {}

GENERIC_CHAPTER_NAMES = {
    'intro', 'outro', 'bevezetés', 'bevezeto', 'kezdes', 'kezdés', 'vege', 'vége',
    'beszelgetes', 'beszélgetés', 'velemeny', 'vélemény', 'összegzés', 'osszegzes',
    'szponzor', 'sponsor', 'hirdetés', 'hirdetes', 'q&a', 'faq'
}

def clean_chapter_title(title: str) -> Optional[str]:
    """Cleans up chapter title, removes prefixes like '1. ' or emojis, and ignores generic titles."""
    if not title:
        return None
    t = title.strip()
    # Strip leading markers like "1. ", "01 - ", "Chapter 1: ", "#1 "
    t = re.sub(r'^(?:ch(?:apter)?\.?\s*\d+[:\-–\.]?\s*|\d+[\.\-–\)]\s*|#\d+\s*)', '', t, flags=re.I).strip()
    # Strip wrapping quotes
    t = re.sub(r'^[\"\'`“]+|[\"\'`”]+$', '', t).strip()
    
    t_lower = t.lower()
    if t_lower in GENERIC_CHAPTER_NAMES:
        return None
    for gen in GENERIC_CHAPTER_NAMES:
        if t_lower.startswith(f"{gen} ") or t_lower.endswith(f" {gen}"):
            return None

    return t if t else None

def parse_description_chapters(description: str) -> List[Dict[str, Any]]:
    """Parses timestamps and chapter/game titles written in the video description."""
    if not description:
        return []
    chapters = []
    lines = description.splitlines()
    for line in lines:
        # Match e.g. "00:00 - Beyond the Frame (Demo)" or "54:43 Black Pines" or "01:16:26: Game"
        m = re.search(r'(?:^|[^\d])((?:[0-9]{1,2}:)?[0-9]{1,2}:[0-9]{2})\s*[-–:]?\s*([^\r\n]+)', line)
        if m:
            ts_str, raw_title = m.group(1).strip(), m.group(2).strip()
            # Ignore if raw_title is just another timestamp or link
            if raw_title.startswith("http") or not raw_title:
                continue
            parts = [int(p) for p in ts_str.split(':')]
            if len(parts) == 3:
                sec = parts[0] * 3600 + parts[1] * 60 + parts[2]
            elif len(parts) == 2:
                sec = parts[0] * 60 + parts[1]
            else:
                continue

            cleaned = clean_chapter_title(raw_title)
            if cleaned:
                chapters.append({'start_time': float(sec), 'title': cleaned})

    chapters.sort(key=lambda c: c['start_time'])
    for i in range(len(chapters)):
        chapters[i]['end_time'] = chapters[i + 1]['start_time'] if i + 1 < len(chapters) else 999999.0
    return chapters

def get_video_metadata(video_id: str) -> Dict[str, Any]:
    """Fetches video metadata (title, description, chapters) with in-memory caching."""
    with _cache_lock:
        if video_id in _video_info_cache:
            return _video_info_cache[video_id]

    try:
        ydl_opts = {
            'quiet': True,
            'skip_download': True,
            'extract_flat': False,
            'no_warnings': True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
            
            raw_chapters = info.get('chapters')
            chapters = []
            if raw_chapters:
                for c in raw_chapters:
                    ctitle = clean_chapter_title(c.get('title', ''))
                    if ctitle:
                        chapters.append({
                            'start_time': float(c.get('start_time', 0.0)),
                            'end_time': float(c.get('end_time', 999999.0)),
                            'title': ctitle
                        })
            else:
                desc = info.get('description', '')
                chapters = parse_description_chapters(desc)

            meta = {
                'video_id': video_id,
                'title': info.get('title', ''),
                'description': info.get('description', ''),
                'chapters': chapters
            }
            with _cache_lock:
                _video_info_cache[video_id] = meta
            return meta
    except Exception as e:
        return {'video_id': video_id, 'title': '', 'description': '', 'chapters': []}

def detect_game_title_from_video(
    video_id: str,
    timestamp_sec: float = 0.0,
    video_title: str = "",
    video_description: str = ""
) -> Optional[str]:
    """
    Identifies the precise game title being played at the specified timestamp.
    Prioritizes:
    1. Official YouTube Chapters / Timestamps matching timestamp_sec
    2. Description chapters matching timestamp_sec
    3. Description game patterns (e.g. 'a ... játékkal játszottam', Steam links)
    """
    meta = get_video_metadata(video_id)
    chapters = meta.get('chapters') or []
    
    # 1. Match in Chapters for timestamp_sec
    if chapters and timestamp_sec >= 0:
        for ch in chapters:
            if ch['start_time'] <= timestamp_sec < ch.get('end_time', 999999.0):
                return ch['title']

    # 2. Description game patterns
    desc = meta.get('description') or video_description or ""
    if desc:
        m_play = re.search(r'\b(?:a|az)\s+([A-Z0-9][A-Za-z0-9: \-\'\.\!]+?)\s+játékkal játszott(?:am|unk)\b', desc, re.I)
        if m_play:
            g_cand = clean_chapter_title(m_play.group(1).strip())
            if g_cand:
                return g_cand

        m_steam = re.search(r'store\.steampowered\.com/app/\d+/([A-Za-z0-9_]+)', desc)
        if m_steam:
            steam_name = m_steam.group(1).replace('_', ' ').strip()
            if steam_name:
                return steam_name

    return None
