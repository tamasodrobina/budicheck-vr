import os
import json
import shutil
import threading
import random
from datetime import datetime
from typing import Dict, List, Any, Optional

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
SCREENSHOTS_DIR = os.path.join(os.path.dirname(__file__), "static", "screenshots")
DB_FILE = os.path.join(DATA_DIR, "budicheck.json")
REPORTS_FILE = os.path.join(DATA_DIR, "reports.json")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

class Database:
    def __init__(self):
        self.lock = threading.Lock()
        self.scanned_video_ids: set = set()
        self.budi_checks: List[Dict[str, Any]] = []
        self.reports: List[Dict[str, Any]] = []
        self.scan_state: Dict[str, Any] = {
            "status": "idle",
            "total_channel_videos": 0,
            "processed_count": 0,
            "matches_found": 0,
            "current_video_id": "",
            "current_video_title": "",
            "last_scanned_at": None,
            "source_title": "TheVR Jani BudiCheck",
            "source_url": "https://youtube.com/playlist?list=PL-0aMuV87MLWOwH9PLKO1EBYStLmIKScV",
            "logs": []
        }
        self.load()
        self.load_reports()

    def load_reports(self):
        with self.lock:
            if os.path.exists(REPORTS_FILE):
                try:
                    with open(REPORTS_FILE, "r", encoding="utf-8") as f:
                        self.reports = json.load(f)
                except Exception as e:
                    print(f"Error loading reports file: {e}")
                    self.reports = []
            else:
                self.reports = []

    def save_reports(self):
        with self.lock:
            try:
                with open(REPORTS_FILE, "w", encoding="utf-8") as f:
                    json.dump(self.reports, f, ensure_ascii=False, indent=2)
            except Exception as e:
                print(f"Error saving reports file: {e}")

    def load(self):
        with self.lock:
            if os.path.exists(DB_FILE):
                try:
                    with open(DB_FILE, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        self.scanned_video_ids = set(data.get("scanned_video_ids", []))
                        self.budi_checks = data.get("budi_checks", [])
                except Exception as e:
                    print(f"Error loading database file: {e}")

    def save(self):
        with self.lock:
            data = {
                "scanned_video_ids": list(self.scanned_video_ids),
                "budi_checks": self.budi_checks
            }
            with open(DB_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

    def reset(self):
        """Completely reset database state, logs, and screenshots."""
        with self.lock:
            self.scanned_video_ids.clear()
            self.budi_checks.clear()
            self.scan_state["status"] = "idle"
            self.scan_state["processed_count"] = 0
            self.scan_state["matches_found"] = 0
            self.scan_state["current_video_id"] = ""
            self.scan_state["current_video_title"] = ""
            self.scan_state["logs"] = []
            
            # Clean screenshots directory
            if os.path.exists(SCREENSHOTS_DIR):
                for fname in os.listdir(SCREENSHOTS_DIR):
                    fpath = os.path.join(SCREENSHOTS_DIR, fname)
                    if os.path.isfile(fpath):
                        try:
                            os.remove(fpath)
                        except Exception:
                            pass
        self.save()
        self.add_log("🔄 Rendszer teljes alaphelyzetbe állítva (Reset). Az összes talált adat és videó lista törölve!", "success")

    def reset_votes(self):
        """Reset only community votes and user rating averages."""
        with self.lock:
            for c in self.budi_checks:
                c.pop("user_votes_count", None)
                c.pop("user_votes_sum", None)
                c.pop("user_votes_avg", None)
                c.pop("user_votes", None)
        self.save()
        self.add_log("🗳️ Felhasználói szavazatok és közösségi átlagok sikeresen nullázva!", "success")

    def reset_scanned_history(self):
        """Reset only the list of scanned video IDs, keeping discovered budi checks."""
        with self.lock:
            self.scanned_video_ids.clear()
            self.scan_state["processed_count"] = 0
        self.save()
        self.add_log("📋 Szkennelt videó történet sikeresen nullázva (az eddig mentett budik megmaradtak)!", "success")

    def is_video_scanned(self, video_id: str) -> bool:
        with self.lock:
            return video_id in self.scanned_video_ids

    def mark_video_scanned(self, video_id: str):
        with self.lock:
            self.scanned_video_ids.add(video_id)
        self.save()

    def add_budi_check(self, check: Dict[str, Any]) -> tuple:
        """
        Adds or updates a BudiCheck card.
        Deduplication rule:
        If a card with the same ID, OR a card for the same video within 90 seconds exists,
        it updates that card instead of creating a duplicate!
        Returns: (saved_check, is_updated)
        """
        with self.lock:
            target_vid = check.get("video_id")
            target_ts = float(check.get("timestamp_sec", 0.0))
            
            existing_idx = None
            # 1. Exact ID match
            for i, c in enumerate(self.budi_checks):
                if c["id"] == check["id"]:
                    existing_idx = i
                    break
            
            # 2. Same video and close timestamp match (within 90s)
            if existing_idx is None and target_vid:
                for i, c in enumerate(self.budi_checks):
                    if c.get("video_id") == target_vid:
                        c_ts = float(c.get("timestamp_sec", 0.0))
                        if abs(c_ts - target_ts) <= 90.0:
                            existing_idx = i
                            break
            
            if existing_idx is not None:
                existing = self.budi_checks[existing_idx]
                existing_id = existing["id"]
                # Preserve community votes if present
                for vote_key in ["user_votes_count", "user_votes_sum", "user_votes_avg"]:
                    if vote_key in existing and vote_key not in check:
                        check[vote_key] = existing[vote_key]
                # Preserve verified status if admin already verified it
                if existing.get("is_verified") and check.get("audit_status") != "rejected":
                    check["is_verified"] = True
                    if check.get("audit_status") == "pending":
                        check["audit_status"] = "verified"
                
                # Keep the original stable ID
                check["id"] = existing_id
                self.budi_checks[existing_idx] = check
                ret_item = check
                is_updated = True
            else:
                self.budi_checks.append(check)
                ret_item = check
                is_updated = False

        self.save()
        return ret_item, is_updated

    def delete_budi_check(self, check_id: str) -> bool:
        with self.lock:
            initial_len = len(self.budi_checks)
            self.budi_checks = [c for c in self.budi_checks if c["id"] != check_id]
            removed = len(self.budi_checks) < initial_len
            if removed:
                for r in self.reports:
                    if r.get("check_id") == check_id and r.get("status") == "open":
                        r["status"] = "resolved"
                        r["resolved_at"] = datetime.now().isoformat()
        if removed:
            self.save()
            self.save_reports()
            self.add_log(f"🗑️ Budi bejegyzés törölve: ID {check_id}", "info")
        return removed

    def toggle_verify_budi_check(self, check_id: str, is_verified: Optional[bool] = None) -> Optional[bool]:
        new_val = None
        with self.lock:
            for c in self.budi_checks:
                if c["id"] == check_id:
                    if is_verified is not None:
                        c["is_verified"] = is_verified
                    else:
                        c["is_verified"] = not c.get("is_verified", False)
                    new_val = c["is_verified"]
                    break
        if new_val is not None:
            self.save()
            status_text = "jóváhagyva" if new_val else "jóváhagyás visszavonva"
            self.add_log(f"✅ Budi státusz frissítve: {check_id} ({status_text})", "success")
        return new_val

    def update_budi_check(
        self,
        check_id: str,
        rating: float,
        quote: str,
        game_title: Optional[str] = None,
        is_verified: Optional[bool] = None,
        timestamp_sec: Optional[float] = None,
        timestamp_formatted: Optional[str] = None,
        screenshot_url: Optional[str] = None
    ) -> bool:
        updated = False
        with self.lock:
            for c in self.budi_checks:
                if c["id"] == check_id:
                    c["rating"] = rating
                    c["quote"] = quote
                    if game_title is not None:
                        c["game_title"] = game_title.strip()
                    if is_verified is not None:
                        c["is_verified"] = is_verified
                    if timestamp_sec is not None:
                        c["timestamp_sec"] = float(timestamp_sec)
                        c["timestamp_formatted"] = timestamp_formatted or c.get("timestamp_formatted", "")
                        c["yt_timestamp_url"] = f"https://www.youtube.com/watch?v={c['video_id']}&t={int(timestamp_sec)}s"
                    if screenshot_url:
                        c["screenshot_url"] = screenshot_url
                    updated = True
                    break
        if updated:
            self.save()
            self.add_log(f"✏️ Budi kártya frissítve: ID {check_id}", "info")
        return updated

    def update_check_audit(self, check_id: str, is_verified: bool, audit_status: str, audit_notes: str, corrected_game_title: Optional[str] = None, corrected_rating: Optional[float] = None) -> Optional[Dict[str, Any]]:
        updated_item = None
        with self.lock:
            for c in self.budi_checks:
                if c["id"] == check_id:
                    c["is_verified"] = is_verified
                    c["audit_status"] = audit_status
                    c["audit_notes"] = audit_notes
                    c["audited_at"] = datetime.now().isoformat()
                    if corrected_game_title and corrected_game_title.strip():
                        c["game_title"] = corrected_game_title.strip()
                    if corrected_rating is not None and 0.0 <= corrected_rating <= 10.0:
                        c["rating"] = round(float(corrected_rating), 1)
                    updated_item = dict(c)
                    break
        if updated_item:
            self.save()
            st_text = "Jóváhagyva" if is_verified else ("Fals találat" if audit_status == "rejected" else "Kérdéses")
            self.add_log(f"🤖 [AI Audit]: {updated_item.get('game_title')} -> {st_text} ({audit_notes})", "success" if is_verified else ("warning" if audit_status == "warning" else "error"))
        return updated_item

    def delete_rejected_checks(self) -> int:
        removed_count = 0
        with self.lock:
            initial_len = len(self.budi_checks)
            self.budi_checks = [c for c in self.budi_checks if c.get("audit_status") != "rejected"]
            removed_count = initial_len - len(self.budi_checks)
        if removed_count > 0:
            self.save()
            self.add_log(f"🗑️ Tömeges takarítás: {removed_count} db fals / elutasított budi kártya véglegesen törölve.", "success")
        return removed_count

    def add_report(self, report_entry: Dict[str, Any]) -> Dict[str, Any]:
        with self.lock:
            self.reports.insert(0, report_entry)
        self.save_reports()
        self.add_log(f"🚨 Új hibabejelentés érkezett: {report_entry.get('game_title')} ({report_entry.get('reason')})", "warning")
        return report_entry

    def get_reports(self) -> List[Dict[str, Any]]:
        with self.lock:
            return list(self.reports)

    def update_report_status(self, report_id: str, status: str) -> bool:
        updated = False
        with self.lock:
            for r in self.reports:
                if r["id"] == report_id:
                    r["status"] = status
                    r["resolved_at"] = datetime.now().isoformat()
                    updated = True
                    break
        if updated:
            self.save_reports()
        return updated

    def delete_report(self, report_id: str) -> bool:
        with self.lock:
            initial_len = len(self.reports)
            self.reports = [r for r in self.reports if r["id"] != report_id]
            removed = len(self.reports) < initial_len
        if removed:
            self.save_reports()
        return removed

    def get_checks(self) -> List[Dict[str, Any]]:
        with self.lock:
            return list(self.budi_checks)

    def record_community_vote(self, check_id: str, rating: float, voter_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        with self.lock:
            target = next((c for c in self.budi_checks if c["id"] == check_id), None)
            if not target:
                return None
            
            rating_val = round(float(rating), 1)
            v_map = target.setdefault("user_votes", {})
            is_updated = False

            if voter_id:
                if voter_id in v_map:
                    is_updated = True
                    old_score = float(v_map[voter_id])
                    v_map[voter_id] = rating_val
                    current_sum = float(target.get("user_votes_sum") or 0.0) - old_score + rating_val
                    target["user_votes_sum"] = max(0.0, current_sum)
                else:
                    v_map[voter_id] = rating_val
                    target["user_votes_count"] = int(target.get("user_votes_count") or 0) + 1
                    target["user_votes_sum"] = float(target.get("user_votes_sum") or 0.0) + rating_val
            else:
                target["user_votes_count"] = int(target.get("user_votes_count") or 0) + 1
                target["user_votes_sum"] = float(target.get("user_votes_sum") or 0.0) + rating_val

            votes_count = int(target.get("user_votes_count") or 0)
            votes_sum = float(target.get("user_votes_sum") or 0.0)
            votes_avg = round(votes_sum / votes_count, 1) if votes_count > 0 else rating_val
            target["user_votes_avg"] = votes_avg
        
        self.save()
        return {
            "check_id": check_id,
            "user_rating": rating_val,
            "jani_rating": target.get("rating", 7.0),
            "community_avg": votes_avg,
            "votes_count": votes_count,
            "game_title": target.get("game_title", target.get("video_title")),
            "quote": target.get("quote", ""),
            "is_updated": is_updated
        }

    def get_random_check_for_game(self, exclude_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        with self.lock:
            # Only verified checks should appear in the quiz
            valid_checks = [c for c in self.budi_checks if c.get("is_verified") is True and c.get("audit_status") != "rejected"]
            if not valid_checks:
                valid_checks = self.budi_checks
            if not valid_checks:
                return None
            candidates = [c for c in valid_checks if c["id"] != exclude_id] if exclude_id and len(valid_checks) > 1 else valid_checks
            choice = random.choice(candidates) if candidates else None
            if not choice:
                return None
            return {
                "id": choice["id"],
                "video_id": choice["video_id"],
                "video_title": choice["video_title"],
                "game_title": choice.get("game_title", choice["video_title"]),
                "timestamp_sec": choice["timestamp_sec"],
                "timestamp_formatted": choice["timestamp_formatted"],
                "screenshot_url": choice.get("screenshot_url"),
                "yt_timestamp_url": choice["yt_timestamp_url"],
                "user_votes_avg": choice.get("user_votes_avg"),
                "user_votes_count": choice.get("user_votes_count", 0),
                "rating": choice.get("rating"),
                "quote": choice.get("quote")
            }

    def add_log(self, message: str, level: str = "info"):
        now_str = datetime.now().strftime("%H:%M:%S")
        log_entry = {
            "time": now_str,
            "message": message,
            "level": level
        }
        with self.lock:
            self.scan_state["logs"].append(log_entry)
            if len(self.scan_state["logs"]) > 500:
                self.scan_state["logs"].pop(0)

    def clear_logs(self):
        with self.lock:
            self.scan_state["logs"] = []

db = Database()
