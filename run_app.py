import os
import sys
import webbrowser
import threading
import time
import uvicorn

# Ensure utf-8 output encoding
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

def open_browser():
    time.sleep(1.5)
    print("Megnyitás a böngészőben: http://127.0.0.1:8000")
    webbrowser.open("http://127.0.0.1:8000")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    is_cloud = "PORT" in os.environ or "RENDER" in os.environ or sys.platform != "win32"
    host = "0.0.0.0" if is_cloud else "127.0.0.1"

    print("=" * 60)
    print("🚽 TheVR Jani BudiCheck - Budi Értékelő Rangsor & Archívum Indítása...")
    print("=" * 60)
    print(f"Szerver fut a következő címen: http://{host}:{port}")
    
    # Open browser automatically when running locally on desktop unless disabled
    if not is_cloud and not os.environ.get("NO_BROWSER"):
        threading.Thread(target=open_browser, daemon=True).start()

    # Run FastAPI app
    uvicorn.run("backend.app:app", host=host, port=port, reload=False)
