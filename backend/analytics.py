import os
import json
import time
import hashlib
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from urllib.parse import urlparse

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
ANALYTICS_FILE = os.path.join(DATA_DIR, "analytics.json")
BACKUP_FILE = os.path.join(DATA_DIR, "analytics.backup.json")
SALT = "budicheck_analytics_salt_2026"

os.makedirs(DATA_DIR, exist_ok=True)

class AnalyticsTracker:
    def __init__(self, file_path: str = ANALYTICS_FILE):
        self.file_path = file_path
        self.lock = threading.Lock()
        self.data: Dict[str, Any] = {
            "daily": {},
            "all_time": {
                "pageviews": 0,
                "events": {}
            },
            "recent_activity": []
        }
        self.load()

    def load(self):
        with self.lock:
            if os.path.exists(self.file_path):
                try:
                    with open(self.file_path, "r", encoding="utf-8") as f:
                        loaded = json.load(f)
                        self.data["daily"] = loaded.get("daily", {})
                        self.data["all_time"] = loaded.get("all_time", {"pageviews": 0, "events": {}})
                        self.data["recent_activity"] = loaded.get("recent_activity", [])
                except Exception as e:
                    print(f"Error loading analytics file: {e}")

    def save(self):
        # Must be called inside with self.lock
        temp_file = self.file_path + ".tmp"
        try:
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(self.data, f, ensure_ascii=False, indent=2)
            os.replace(temp_file, self.file_path)
        except Exception as e:
            print(f"Error saving analytics file: {e}")
            if os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                except Exception:
                    pass

    @staticmethod
    def parse_device(user_agent: Optional[str]) -> str:
        if not user_agent:
            return "desktop"
        ua = user_agent.lower()
        if "ipad" in ua or "tablet" in ua:
            return "tablet"
        if "mobi" in ua or "android" in ua or "iphone" in ua:
            return "mobile"
        return "desktop"

    @staticmethod
    def parse_referrer(referrer: Optional[str]) -> str:
        if not referrer or not referrer.strip():
            return "Közvetlen (Direct)"
        try:
            parsed = urlparse(referrer)
            host = parsed.netloc.lower()
            if not host:
                return "Közvetlen (Direct)"
            if "localhost" in host or "127.0.0.1" in host or "budicheck" in host:
                return "Belső navigáció"
            if "youtube.com" in host or "youtu.be" in host:
                return "YouTube"
            if "discord" in host:
                return "Discord"
            if "google" in host:
                return "Google"
            if "facebook.com" in host or "fb.com" in host:
                return "Facebook"
            if "reddit.com" in host:
                return "Reddit"
            if "twitter.com" in host or "x.com" in host or "t.co" in host:
                return "X / Twitter"
            if "twitch.tv" in host:
                return "Twitch"
            if host.startswith("www."):
                host = host[4:]
            return host.capitalize() if host else "Közvetlen (Direct)"
        except Exception:
            return "Egyéb (Ismeretlen)"

    @staticmethod
    def generate_visitor_hash(client_ip: str, visitor_id: Optional[str], date_str: str) -> str:
        raw = f"{date_str}_{SALT}_{client_ip}_{visitor_id or ''}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:12]

    def track(
        self,
        event_type: str = "pageview",
        path: Optional[str] = "/",
        referrer: Optional[str] = "",
        user_agent: Optional[str] = "",
        client_ip: str = "127.0.0.1",
        visitor_id: Optional[str] = None,
        event_data: Optional[Dict[str, Any]] = None
    ):
        try:
            now = datetime.now()
            date_str = now.strftime("%Y-%m-%d")
            time_str = now.strftime("%H:%M:%S")
            iso_ts = now.isoformat()

            device = self.parse_device(user_agent)
            ref_category = self.parse_referrer(referrer)
            visitor_hash = self.generate_visitor_hash(client_ip, visitor_id, date_str)

            with self.lock:
                daily_buckets = self.data.setdefault("daily", {})
                day_entry = daily_buckets.setdefault(date_str, {
                    "pageviews": 0,
                    "unique_visitors": [],
                    "routes": {},
                    "referrers": {},
                    "devices": {"desktop": 0, "mobile": 0, "tablet": 0},
                    "events": {}
                })

                # Register unique visitor hash if not yet seen today
                if visitor_hash not in day_entry.get("unique_visitors", []):
                    day_entry.setdefault("unique_visitors", []).append(visitor_hash)

                # Device count
                dev_counts = day_entry.setdefault("devices", {"desktop": 0, "mobile": 0, "tablet": 0})
                dev_counts[device] = dev_counts.get(device, 0) + 1

                # Referrer count (ignore internal navigation for referrer source stats)
                if ref_category != "Belső navigáció":
                    ref_counts = day_entry.setdefault("referrers", {})
                    ref_counts[ref_category] = ref_counts.get(ref_category, 0) + 1

                all_time = self.data.setdefault("all_time", {"pageviews": 0, "events": {}})
                activity_item = None

                if event_type == "pageview":
                    day_entry["pageviews"] = day_entry.get("pageviews", 0) + 1
                    all_time["pageviews"] = all_time.get("pageviews", 0) + 1
                    routes = day_entry.setdefault("routes", {})
                    clean_path = path or "/"
                    routes[clean_path] = routes.get(clean_path, 0) + 1

                    activity_item = {
                        "id": f"{int(time.time()*1000)}_{visitor_hash[:4]}",
                        "timestamp": iso_ts,
                        "time_formatted": time_str,
                        "type": "pageview",
                        "title": f"Oldalmegtekintés ({clean_path})",
                        "details": f"Forrás: {ref_category}",
                        "device": device,
                        "referrer": ref_category
                    }
                else:
                    # Non-pageview event (quiz, vote, click, video play, etc.)
                    day_events = day_entry.setdefault("events", {})
                    day_events[event_type] = day_events.get(event_type, 0) + 1

                    all_time_events = all_time.setdefault("events", {})
                    all_time_events[event_type] = all_time_events.get(event_type, 0) + 1

                    # Create human-readable title & details
                    title = "Interakció"
                    details = ""
                    if event_type == "quiz_start":
                        title = "🎮 Kvíz játék elindítása"
                        details = "Felhasználó elindította a 'Tippeld meg a pontot!' játékot"
                    elif event_type == "quiz_guess":
                        rating = event_data.get("rating", "?") if event_data else "?"
                        game = event_data.get("game_title", "") if event_data else ""
                        title = f"🎯 Kvíz tipp leadása: {rating} pont"
                        details = f"Játék: {game}" if game else ""
                    elif event_type == "budi_vote":
                        rating = event_data.get("rating", "?") if event_data else "?"
                        game = event_data.get("game_title", "") if event_data else ""
                        title = f"⭐ Közösségi szavazat: {rating} pont"
                        details = f"Budi check: {game}" if game else ""
                    elif event_type == "video_play":
                        game = event_data.get("game_title", "") if event_data else ""
                        title = "🎬 Videó lejátszása"
                        details = f"Megnyitott videó: {game}" if game else ""
                    elif event_type == "search":
                        query = event_data.get("query", "") if event_data else ""
                        title = "🔍 Keresés az archívumban"
                        details = f"Kifejezés: '{query}'" if query else ""
                    elif event_type == "report_create":
                        reason = event_data.get("reason", "") if event_data else ""
                        title = "🚨 Hibabejelentés beküldése"
                        details = f"Ok: {reason}" if reason else ""
                    else:
                        title = f"⚡ Esemény: {event_type}"
                        details = str(event_data) if event_data else ""

                    activity_item = {
                        "id": f"{int(time.time()*1000)}_{visitor_hash[:4]}",
                        "timestamp": iso_ts,
                        "time_formatted": time_str,
                        "type": event_type,
                        "title": title,
                        "details": details,
                        "device": device,
                        "referrer": ref_category
                    }

                if activity_item:
                    recent = self.data.setdefault("recent_activity", [])
                    recent.insert(0, activity_item)
                    if len(recent) > 50:
                        self.data["recent_activity"] = recent[:50]

                self.save()

        except Exception as e:
            print(f"Error tracking analytics event: {e}")

    def get_summary(self, days: int = 30) -> Dict[str, Any]:
        with self.lock:
            now = datetime.now()
            today_str = now.strftime("%Y-%m-%d")
            yesterday_str = (now - timedelta(days=1)).strftime("%Y-%m-%d")

            daily_buckets = self.data.get("daily", {})
            all_time = self.data.get("all_time", {"pageviews": 0, "events": {}})
            recent = self.data.get("recent_activity", [])

            # Today KPIs
            today_entry = daily_buckets.get(today_str, {})
            today_views = today_entry.get("pageviews", 0)
            today_uniques = len(today_entry.get("unique_visitors", []))
            today_events = sum(today_entry.get("events", {}).values())

            # Yesterday KPIs
            yesterday_entry = daily_buckets.get(yesterday_str, {})
            yesterday_views = yesterday_entry.get("pageviews", 0)
            yesterday_uniques = len(yesterday_entry.get("unique_visitors", []))

            # Build daily timeline for requested window
            chart_data = []
            last_7_views = 0
            last_7_uniques = 0
            last_30_views = 0
            last_30_uniques = 0

            aggregated_referrers: Dict[str, int] = {}
            aggregated_devices: Dict[str, int] = {"desktop": 0, "mobile": 0, "tablet": 0}
            aggregated_events: Dict[str, int] = {}
            aggregated_routes: Dict[str, int] = {}

            # Generate range from (now - days + 1) to today
            start_date = now - timedelta(days=days - 1)
            for i in range(days):
                day_dt = start_date + timedelta(days=i)
                d_str = day_dt.strftime("%Y-%m-%d")
                d_entry = daily_buckets.get(d_str, {})

                d_views = d_entry.get("pageviews", 0)
                d_uniques = len(d_entry.get("unique_visitors", []))
                d_events_count = sum(d_entry.get("events", {}).values())

                chart_data.append({
                    "date": d_str,
                    "display_date": day_dt.strftime("%m.%d."),
                    "day_name": ["Hét", "Kedd", "Szer", "Csüt", "Pén", "Szom", "Vas"][day_dt.weekday()],
                    "pageviews": d_views,
                    "unique_visitors": d_uniques,
                    "events": d_events_count
                })

                # Aggregations for window
                last_30_views += d_views
                last_30_uniques += d_uniques
                if i >= (days - 7):
                    last_7_views += d_views
                    last_7_uniques += d_uniques

                # Referrers
                for ref, cnt in d_entry.get("referrers", {}).items():
                    aggregated_referrers[ref] = aggregated_referrers.get(ref, 0) + cnt

                # Devices
                for dev, cnt in d_entry.get("devices", {}).items():
                    aggregated_devices[dev] = aggregated_devices.get(dev, 0) + cnt

                # Events
                for ev, cnt in d_entry.get("events", {}).items():
                    aggregated_events[ev] = aggregated_events.get(ev, 0) + cnt

                # Routes
                for rt, cnt in d_entry.get("routes", {}).items():
                    aggregated_routes[rt] = aggregated_routes.get(rt, 0) + cnt

            # Referrer breakdown list with percentages
            total_ref_count = sum(aggregated_referrers.values()) or 1
            top_referrers = []
            for ref, cnt in sorted(aggregated_referrers.items(), key=lambda x: x[1], reverse=True)[:6]:
                top_referrers.append({
                    "name": ref,
                    "count": cnt,
                    "percentage": round((cnt / total_ref_count) * 100, 1)
                })

            # Devices breakdown percentages
            total_devices = sum(aggregated_devices.values()) or 1
            device_stats = {
                "desktop": aggregated_devices.get("desktop", 0),
                "mobile": aggregated_devices.get("mobile", 0),
                "tablet": aggregated_devices.get("tablet", 0),
                "desktop_pct": round((aggregated_devices.get("desktop", 0) / total_devices) * 100, 1),
                "mobile_pct": round((aggregated_devices.get("mobile", 0) / total_devices) * 100, 1),
                "tablet_pct": round((aggregated_devices.get("tablet", 0) / total_devices) * 100, 1),
            }

            # Top events breakdown
            human_event_labels = {
                "quiz_start": "Kvíz elindítás",
                "quiz_guess": "Kvíz leadott tipp",
                "budi_vote": "Közösségi szavazat",
                "video_play": "Videó lejátszás",
                "search": "Keresés / Szűrés",
                "report_create": "Hibabejelentés",
            }
            top_events = []
            for ev, cnt in sorted(aggregated_events.items(), key=lambda x: x[1], reverse=True):
                top_events.append({
                    "type": ev,
                    "label": human_event_labels.get(ev, ev),
                    "count": cnt
                })

            # Trend calculation (today vs yesterday)
            diff_views = today_views - yesterday_views
            if yesterday_views > 0:
                trend_pct = round((diff_views / yesterday_views) * 100, 1)
            else:
                trend_pct = 100.0 if today_views > 0 else 0.0

            return {
                "today": {
                    "pageviews": today_views,
                    "unique_visitors": today_uniques,
                    "events": today_events,
                    "trend_pct": trend_pct
                },
                "yesterday": {
                    "pageviews": yesterday_views,
                    "unique_visitors": yesterday_uniques
                },
                "last_7_days": {
                    "pageviews": last_7_views,
                    "unique_visitors": last_7_uniques,
                    "daily_avg_views": round(last_7_views / 7, 1)
                },
                "last_30_days": {
                    "pageviews": last_30_views,
                    "unique_visitors": last_30_uniques
                },
                "all_time": {
                    "pageviews": all_time.get("pageviews", 0),
                    "total_events": sum(all_time.get("events", {}).values()),
                    "events_breakdown": all_time.get("events", {})
                },
                "chart_data": chart_data,
                "top_referrers": top_referrers,
                "device_stats": device_stats,
                "top_events": top_events,
                "recent_activity": recent[:30]
            }

    def reset(self):
        with self.lock:
            if os.path.exists(self.file_path):
                try:
                    import shutil
                    shutil.copy2(self.file_path, BACKUP_FILE)
                except Exception as e:
                    print(f"Error creating backup of analytics: {e}")
            self.data = {
                "daily": {},
                "all_time": {
                    "pageviews": 0,
                    "events": {}
                },
                "recent_activity": []
            }
            self.save()

analytics = AnalyticsTracker()
