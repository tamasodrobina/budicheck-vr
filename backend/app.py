import os
import time
from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Query, Body, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from .database import db, SCREENSHOTS_DIR
from .scanner import (
    scanner, capture_screenshot,
    find_quote_timestamp_in_subtitles, parse_timestamp_str, format_timestamp
)
from .config import (
    load_config, save_config, has_gemini_api_key,
    verify_admin_password, change_admin_password,
    create_admin_token, verify_admin_token, revoke_admin_token
)
from .gemini_analyzer import check_models_quota, audit_budi_check_with_ai
from .game_detector import detect_game_title_from_video

app = FastAPI(title="TheVR Jani BudiCheck API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/screenshots", StaticFiles(directory=SCREENSHOTS_DIR), name="screenshots")

def require_admin(x_admin_token: Optional[str] = Header(None)):
    if not x_admin_token or not verify_admin_token(x_admin_token):
        raise HTTPException(status_code=401, detail="Adminisztrátori hitelesítés szükséges!")
    return True

class LoginModel(BaseModel):
    password: str

class ChangePasswordModel(BaseModel):
    old_password: str
    new_password: str

class UpdateCheckModel(BaseModel):
    rating: float
    quote: str
    game_title: Optional[str] = None
    is_verified: Optional[bool] = None
    timestamp: Optional[str] = None

class VerifyCheckModel(BaseModel):
    is_verified: Optional[bool] = None

class ReportCreateModel(BaseModel):
    check_id: str
    reason: str
    details: Optional[str] = ""

class ReportUpdateModel(BaseModel):
    status: str

class ResnapshotModel(BaseModel):
    timestamp_sec: float

class ConfigUpdateModel(BaseModel):
    gemini_api_key: Optional[str] = None
    model_name: Optional[str] = None
    use_gemini: Optional[bool] = None
    enable_whisper_fallback: Optional[bool] = None

class SingleVideoScanModel(BaseModel):
    video_url: str

class VoteModel(BaseModel):
    check_id: str
    rating: float

# --- ADMIN AUTH ENDPOINTS ---

@app.post("/api/admin/login")
def admin_login(data: LoginModel):
    if verify_admin_password(data.password):
        token = create_admin_token()
        return {"success": True, "token": token}
    raise HTTPException(status_code=401, detail="Helytelen adminisztrátori jelszó!")

@app.post("/api/admin/logout")
def admin_logout(x_admin_token: Optional[str] = Header(None)):
    if x_admin_token:
        revoke_admin_token(x_admin_token)
    return {"message": "Sikeres kijelentkezés"}

@app.get("/api/admin/check")
def admin_check(x_admin_token: Optional[str] = Header(None)):
    is_valid = verify_admin_token(x_admin_token) if x_admin_token else False
    return {"authenticated": is_valid}

@app.post("/api/admin/change-password")
def admin_change_password(data: ChangePasswordModel, admin: bool = Depends(require_admin)):
    if not verify_admin_password(data.old_password):
        raise HTTPException(status_code=400, detail="A jelenlegi jelszó helytelen!")
    if len(data.new_password.strip()) < 4:
        raise HTTPException(status_code=400, detail="Az új jelszónak legalább 4 karakter hosszúnak kell lennie!")
    change_admin_password(data.new_password.strip())
    db.add_log("🔐 Adminisztrátori jelszó sikeresen megváltoztatva!", "success")
    return {"message": "Admin jelszó sikeresen megváltoztatva!"}

# --- CONFIG & MODELS ---

@app.get("/api/config")
def get_config(admin: bool = Depends(require_admin)):
    cfg = load_config()
    raw_key = cfg.get("gemini_api_key", "").strip()
    masked = ""
    if raw_key:
        masked = raw_key[:4] + "..." + raw_key[-4:] if len(raw_key) > 8 else "********"
    return {
        "has_gemini_api_key": bool(raw_key),
        "masked_api_key": masked,
        "model_name": cfg.get("model_name", "gemini-3.5-flash-lite"),
        "use_gemini": cfg.get("use_gemini", True),
        "enable_whisper_fallback": cfg.get("enable_whisper_fallback", False)
    }

@app.get("/api/models")
def get_models(refresh: bool = False, admin: bool = Depends(require_admin)):
    models = check_models_quota(force_refresh=refresh)
    return {"models": models}

@app.post("/api/config")
def update_config(data: ConfigUpdateModel, admin: bool = Depends(require_admin)):
    updates = {}
    if data.gemini_api_key is not None:
        updates["gemini_api_key"] = data.gemini_api_key.strip()
    if data.model_name is not None:
        updates["model_name"] = data.model_name.strip()
    if data.use_gemini is not None:
        updates["use_gemini"] = data.use_gemini
    if data.enable_whisper_fallback is not None:
        updates["enable_whisper_fallback"] = data.enable_whisper_fallback
    saved = save_config(updates)
    db.add_log("⚙️ Gemini AI konfiguráció sikeresen frissítve!", "success")
    return {
        "message": "Beállítások sikeresen elmentve!",
        "has_gemini_api_key": bool(saved.get("gemini_api_key"))
    }

# --- SCANNER STATUS & CONTROL ---

@app.get("/api/status")
def get_status(x_admin_token: Optional[str] = Header(None)):
    checks = db.get_checks()
    state = db.scan_state.copy()
    is_admin = verify_admin_token(x_admin_token) if x_admin_token else False
    if not is_admin:
        # Public visitor sees count of verified checks only
        verified_checks = [c for c in checks if c.get("is_verified") is True and c.get("audit_status") != "rejected"]
        state["matches_found"] = len(verified_checks)
    else:
        state["matches_found"] = len(checks)
    state["scanned_videos_count"] = len(db.scanned_video_ids)
    state["has_gemini_api_key"] = has_gemini_api_key() if is_admin else False
    if is_admin:
        state["open_reports_count"] = sum(1 for r in db.get_reports() if r.get("status") == "open")
        state["total_reports_count"] = len(db.get_reports())
    else:
        # Hide live processing logs and sensitive URLs from public visitors
        state["logs"] = []
    return state

@app.post("/api/scanner/start")
def start_scanner(
    max_videos: int = Query(226, ge=1, le=5000),
    playlist_url: Optional[str] = Query(None),
    incremental: bool = Query(False),
    admin: bool = Depends(require_admin)
):
    scanner.start_scan(max_videos=max_videos, channel_url=playlist_url, incremental=incremental)
    return {"message": "Scanner started", "status": db.scan_state["status"]}

@app.post("/api/scanner/scan_single")
def scan_single_video(data: SingleVideoScanModel, admin: bool = Depends(require_admin)):
    url = data.video_url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="Videó URL vagy ID megadása kötelező")
    success = scanner.scan_single_video_by_url(url)
    if not success:
        raise HTTPException(status_code=400, detail="Érvénytelen YouTube URL vagy azonosító")
    return {"message": "Single video scan started", "status": db.scan_state["status"]}

@app.post("/api/scanner/pause")
def pause_scanner(admin: bool = Depends(require_admin)):
    scanner.pause_scan()
    return {"message": "Scanner paused", "status": db.scan_state["status"]}

@app.post("/api/scanner/stop")
def stop_scanner(admin: bool = Depends(require_admin)):
    scanner.stop_scan()
    return {"message": "Scanner stopped", "status": db.scan_state["status"]}

@app.post("/api/scanner/reset")
def reset_scanner(admin: bool = Depends(require_admin)):
    scanner.stop_scan()
    db.reset()
    return {"message": "Scanner state reset successfully"}

@app.post("/api/scanner/reset-votes")
def reset_scanner_votes(admin: bool = Depends(require_admin)):
    db.reset_votes()
    return {"message": "Közösségi szavazatok sikeresen nullázva!"}

@app.post("/api/scanner/reset-history")
def reset_scanner_history(admin: bool = Depends(require_admin)):
    db.reset_scanned_history()
    return {"message": "Szkennelt videók listája sikeresen nullázva!"}

@app.post("/api/logs/clear")
def clear_logs(admin: bool = Depends(require_admin)):
    db.clear_logs()
    return {"message": "Logs cleared"}

# --- BUDI CHECKS PUBLIC VIEW & CRUD ---

@app.get("/api/checks")
def get_budi_checks(
    min_rating: Optional[float] = Query(None, ge=0.0, le=10.0),
    max_rating: Optional[float] = Query(None, ge=0.0, le=10.0),
    search: Optional[str] = None,
    sort_by: Optional[str] = Query("rating_desc", pattern="^(rating_desc|rating_asc|newest|oldest|community_desc)$"),
    all_status: bool = Query(False),
    x_admin_token: Optional[str] = Header(None)
):
    checks = db.get_checks()
    is_admin = verify_admin_token(x_admin_token) if x_admin_token else False

    # Public visibility: only verified checks appear to public visitors!
    # Unverified, warning, pending, or rejected cards remain in the Admin Panel until verified.
    if not (is_admin and all_status):
        checks = [c for c in checks if c.get("is_verified") is True and c.get("audit_status") != "rejected"]

    if min_rating is not None:
        checks = [c for c in checks if c.get("rating", 0) >= min_rating]
    if max_rating is not None:
        checks = [c for c in checks if c.get("rating", 0) <= max_rating]

    if search:
        s = search.lower()
        checks = [
            c for c in checks
            if s in c.get("game_title", "").lower() or s in c.get("video_title", "").lower() or s in c.get("quote", "").lower()
        ]

    if sort_by == "rating_desc":
        checks.sort(key=lambda x: x.get("rating", 0), reverse=True)
    elif sort_by == "rating_asc":
        checks.sort(key=lambda x: x.get("rating", 0))
    elif sort_by == "newest":
        checks.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    elif sort_by == "oldest":
        checks.sort(key=lambda x: x.get("created_at", ""))
    elif sort_by == "community_desc":
        checks.sort(key=lambda x: (x.get("user_votes_avg") or 0.0, x.get("user_votes_count") or 0), reverse=True)

    return {
        "total": len(checks),
        "items": checks
    }

@app.put("/api/checks/{check_id}")
def update_check(check_id: str, data: UpdateCheckModel, admin: bool = Depends(require_admin)):
    checks = db.get_checks()
    target = next((c for c in checks if c["id"] == check_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Budi check record not found")

    new_sec = None
    new_fmt = None
    new_shot = None
    if data.timestamp and data.timestamp.strip():
        parsed_sec = parse_timestamp_str(data.timestamp)
        if abs(parsed_sec - target.get("timestamp_sec", 0)) > 1.0:
            new_sec = parsed_sec
            new_fmt = format_timestamp(new_sec)
            new_shot = capture_screenshot(target["video_id"], new_sec)

    success = db.update_budi_check(
        check_id=check_id,
        rating=data.rating,
        quote=data.quote,
        game_title=data.game_title,
        is_verified=data.is_verified,
        timestamp_sec=new_sec,
        timestamp_formatted=new_fmt,
        screenshot_url=new_shot
    )
    if not success:
        raise HTTPException(status_code=404, detail="Budi check record not found")
    return {"message": "Updated successfully"}

@app.delete("/api/checks/{check_id}")
def delete_check(check_id: str, admin: bool = Depends(require_admin)):
    success = db.delete_budi_check(check_id)
    if not success:
        raise HTTPException(status_code=404, detail="Budi check record not found")
    return {"message": "Deleted successfully"}

@app.post("/api/checks/{check_id}/verify")
def verify_check(check_id: str, data: Optional[VerifyCheckModel] = Body(None), admin: bool = Depends(require_admin)):
    val = data.is_verified if data else None
    result = db.toggle_verify_budi_check(check_id, val)
    if result is None:
        raise HTTPException(status_code=404, detail="Budi check record not found")
    return {"message": "Verification status updated", "is_verified": result}

# --- AUTOMATED AI AUDIT & VERIFICATION ---

@app.post("/api/admin/audit/run")
def run_batch_audit(admin: bool = Depends(require_admin)):
    """Runs automated verification on all budicheck items."""
    checks = db.get_checks()
    if not checks:
        return {"message": "Nincs auditálható budi kártya az adatbázisban.", "total": 0, "verified": 0, "warnings": 0, "rejected": 0}

    db.add_log(f"🤖 [Automata Visszaellenőrzés]: {len(checks)} db kártya tömeges auditálása indult...", "info")
    
    verified_count = 0
    warnings_count = 0
    rejected_count = 0

    for c in checks:
        res = audit_budi_check_with_ai(c)
        st = res.get("audit_status", "warning")
        has_fixture = res.get("has_toilet_fixture", True)
        is_ver = (st == "verified" and has_fixture)
        notes = res.get("audit_notes", "")
        corr_game = res.get("corrected_game_title")
        corr_rating = res.get("corrected_rating")

        db.update_check_audit(
            check_id=c["id"],
            is_verified=is_ver,
            audit_status=st,
            audit_notes=notes,
            corrected_game_title=corr_game,
            corrected_rating=corr_rating
        )

        if st == "verified":
            verified_count += 1
        elif st == "rejected":
            rejected_count += 1
        else:
            warnings_count += 1

    db.add_log(f"🎉 [Automata Visszaellenőrzés Kész]: ✅ {verified_count} igazolt, ⚠️ {warnings_count} figyelmeztetés, ❌ {rejected_count} fals találat", "success")

    return {
        "success": True,
        "total": len(checks),
        "verified": verified_count,
        "warnings": warnings_count,
        "rejected": rejected_count
    }

@app.post("/api/admin/audit/{check_id}")
def audit_single_check(check_id: str, admin: bool = Depends(require_admin)):
    checks = db.get_checks()
    target = next((c for c in checks if c["id"] == check_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Budi check record not found")

    res = audit_budi_check_with_ai(target)
    st = res.get("audit_status", "warning")
    has_fixture = res.get("has_toilet_fixture", True)
    is_ver = (st == "verified" and has_fixture)
    notes = res.get("audit_notes", "")
    corr_game = res.get("corrected_game_title")
    corr_rating = res.get("corrected_rating")

    updated = db.update_check_audit(
        check_id=check_id,
        is_verified=is_ver,
        audit_status=st,
        audit_notes=notes,
        corrected_game_title=corr_game,
        corrected_rating=corr_rating
    )
    return {"success": True, "item": updated, "audit": res}

@app.post("/api/admin/audit/clean-rejected")
def clean_rejected_checks(admin: bool = Depends(require_admin)):
    deleted = db.delete_rejected_checks()
    return {"success": True, "deleted_count": deleted}

@app.post("/api/checks/{check_id}/resnapshot")
def resnapshot_check(check_id: str, data: ResnapshotModel, admin: bool = Depends(require_admin)):
    checks = db.get_checks()
    target = next((c for c in checks if c["id"] == check_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Budi check record not found")

    new_url = capture_screenshot(target["video_id"], data.timestamp_sec)
    if not new_url:
        raise HTTPException(status_code=500, detail="Failed to capture screenshot")

    target["screenshot_url"] = new_url
    target["timestamp_sec"] = data.timestamp_sec
    db.add_budi_check(target)
    return {"message": "Screenshot updated", "screenshot_url": new_url}

@app.post("/api/checks/{check_id}/sync-timestamp")
def sync_check_timestamp(check_id: str, admin: bool = Depends(require_admin)):
    checks = db.get_checks()
    target = next((c for c in checks if c["id"] == check_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Budi check record not found")

    quote = target.get("quote", "")
    video_id = target.get("video_id", "")
    if not quote or not video_id:
        raise HTTPException(status_code=400, detail="Hiányzó videó vagy idézet az automatikus szinkronizáláshoz!")

    found_sec = find_quote_timestamp_in_subtitles(video_id, quote)
    if found_sec is None:
        raise HTTPException(
            status_code=404,
            detail="Nem sikerült az idézet pontos időpontját automatikusan megtalálni a feliratban. Kérlek add meg manuálisan az időbélyeget!"
        )

    new_sec = round(found_sec, 1)
    new_fmt = format_timestamp(new_sec)
    new_shot = capture_screenshot(video_id, new_sec)

    chapter_game = detect_game_title_from_video(video_id, new_sec, target.get("video_title", ""))
    g_title = chapter_game if chapter_game else target.get("game_title")

    db.update_budi_check(
        check_id=check_id,
        rating=target.get("rating", 7.0),
        quote=quote,
        game_title=g_title,
        timestamp_sec=new_sec,
        timestamp_formatted=new_fmt,
        screenshot_url=new_shot
    )

    # Re-run AI audit with updated timestamp & screenshot
    updated_target = next((c for c in db.get_checks() if c["id"] == check_id), target)
    audit_res = audit_budi_check_with_ai(updated_target)
    st = audit_res.get("audit_status", "warning")
    has_fix = audit_res.get("has_toilet_fixture", True)
    is_ver = (st == "verified" and has_fix)

    db.update_check_audit(
        check_id=check_id,
        is_verified=is_ver,
        audit_status=st,
        audit_notes=audit_res.get("audit_notes", ""),
        corrected_game_title=audit_res.get("corrected_game_title") or g_title,
        corrected_rating=audit_res.get("corrected_rating")
    )

    final_item = next((c for c in db.get_checks() if c["id"] == check_id), None)
    return {
        "success": True,
        "message": f"Időpont sikeresen szinkronizálva: {new_fmt} ({new_sec}s)" + (f" ➔ Játék: {g_title}" if chapter_game else ""),
        "item": final_item
    }

@app.post("/api/checks/{check_id}/sync-game-title")
def sync_check_game_title(check_id: str, admin: bool = Depends(require_admin)):
    checks = db.get_checks()
    target = next((c for c in checks if c["id"] == check_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Budi check record not found")

    video_id = target.get("video_id", "")
    ts_sec = float(target.get("timestamp_sec", 0.0))
    v_title = target.get("video_title", "")

    detected = detect_game_title_from_video(video_id, ts_sec, v_title)
    if not detected:
        raise HTTPException(status_code=404, detail="Nem található YouTube fejezet vagy leírás-alapú játék cím ehhez az időponthoz.")

    db.update_budi_check(
        check_id=check_id,
        rating=target.get("rating", 7.0),
        quote=target.get("quote", ""),
        game_title=detected,
        timestamp_sec=ts_sec,
        timestamp_formatted=target.get("timestamp_formatted", "")
    )
    return {
        "success": True,
        "game_title": detected,
        "message": f"Játéknév beállítva a YouTube fejezet alapján: '{detected}'"
    }

# --- USER REPORTING & ADMIN REPORT MANAGEMENT ---

@app.post("/api/reports")
def create_report(data: ReportCreateModel):
    checks = db.get_checks()
    target = next((c for c in checks if c["id"] == data.check_id), None)
    
    rep_id = f"rep_{int(time.time()*1000)}"
    entry = {
        "id": rep_id,
        "check_id": data.check_id,
        "reason": data.reason.strip(),
        "details": (data.details or "").strip(),
        "game_title": target.get("game_title", "Ismeretlen játék") if target else "Törölt vagy ismeretlen budi",
        "video_title": target.get("video_title", "") if target else "",
        "timestamp_formatted": target.get("timestamp_formatted", "") if target else "",
        "screenshot_url": target.get("screenshot_url", "") if target else "",
        "created_at": datetime.now().isoformat(),
        "status": "open"
    }
    db.add_report(entry)
    return {
        "success": True,
        "message": "Köszönjük a bejelentést! Az adminisztrátor át fogja vizsgálni ezt a budit.",
        "report_id": rep_id
    }

@app.get("/api/admin/reports")
def get_admin_reports(status: Optional[str] = None, admin: bool = Depends(require_admin)):
    reps = db.get_reports()
    if status:
        reps = [r for r in reps if r.get("status") == status]
    return {
        "total": len(reps),
        "open_count": sum(1 for r in db.get_reports() if r.get("status") == "open"),
        "items": reps
    }

@app.put("/api/admin/reports/{report_id}")
def update_admin_report(report_id: str, data: ReportUpdateModel, admin: bool = Depends(require_admin)):
    success = db.update_report_status(report_id, data.status)
    if not success:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"message": "Report status updated"}

@app.delete("/api/admin/reports/{report_id}")
def delete_admin_report(report_id: str, admin: bool = Depends(require_admin)):
    success = db.delete_report(report_id)
    if not success:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"message": "Report deleted"}

# --- MINIGAME / COMMUNITY VOTE ENDPOINTS ---

@app.get("/api/game/random")
def get_game_random(exclude_id: Optional[str] = None):
    item = db.get_random_check_for_game(exclude_id=exclude_id)
    if not item:
        raise HTTPException(status_code=404, detail="Nincs még mentett budi az adatbázisban a játékhoz!")
    safe_item = {
        "id": item["id"],
        "video_id": item["video_id"],
        "video_title": item["video_title"],
        "game_title": item.get("game_title", item["video_title"]),
        "timestamp_sec": item["timestamp_sec"],
        "timestamp_formatted": item["timestamp_formatted"],
        "screenshot_url": item.get("screenshot_url"),
        "yt_timestamp_url": item["yt_timestamp_url"],
        "user_votes_avg": item.get("user_votes_avg"),
        "user_votes_count": item.get("user_votes_count", 0),
    }
    return safe_item

@app.post("/api/game/vote")
def post_game_vote(data: VoteModel):
    if data.rating < 0.0 or data.rating > 10.0:
        raise HTTPException(status_code=400, detail="A pontszámnak 0 és 10 között kell lennie!")
    result = db.record_community_vote(data.check_id, data.rating)
    if not result:
        raise HTTPException(status_code=404, detail="A megadott budi elem nem található!")
    return result

FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        file_path = os.path.join(FRONTEND_DIST, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
