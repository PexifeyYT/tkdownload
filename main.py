import os
import secrets
import shutil
import tempfile
import time
from urllib.parse import quote

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from downloader import download_video

app = FastAPI(title="Video Downloader")

# In-memory token store: token → {path, dir, fname, ts}
_store: dict[str, dict] = {}
_TOKEN_TTL = 600  # seconds before stale cleanup


class DownloadRequest(BaseModel):
    url: str


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
async def index():
    return FileResponse("static/index.html")


@app.post("/api/download")
async def download(req: DownloadRequest):
    url = req.url.strip()
    if not url:
        raise HTTPException(400, detail={"message": "URL is empty", "platform": "unknown"})

    tmpdir = tempfile.mkdtemp(prefix="vdl_")
    try:
        (ok, msg, fname), platform = download_video(url, tmpdir)
    except Exception as e:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise HTTPException(500, detail={"message": str(e), "platform": "unknown"})

    if not ok:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise HTTPException(400, detail={"message": msg, "platform": platform})

    token = secrets.token_urlsafe(16)
    _store[token] = {
        "path":  os.path.join(tmpdir, fname),
        "dir":   tmpdir,
        "fname": fname,
        "ts":    time.time(),
    }

    # Prune stale tokens
    stale = [k for k, v in list(_store.items()) if time.time() - v["ts"] > _TOKEN_TTL]
    for k in stale:
        item = _store.pop(k, None)
        if item:
            shutil.rmtree(item["dir"], ignore_errors=True)

    return {"token": token, "filename": fname, "platform": platform}


def _content_disposition(fname: str) -> str:
    ascii_name = fname.encode("ascii", "ignore").decode("ascii").strip() or "video.mp4"
    encoded = quote(fname, safe="")
    return f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{encoded}"


@app.get("/api/file/{token}")
async def serve_file(token: str, background_tasks: BackgroundTasks):
    item = _store.pop(token, None)
    if not item or not os.path.exists(item["path"]):
        raise HTTPException(404, detail="File not found or already downloaded")

    background_tasks.add_task(shutil.rmtree, item["dir"], True)
    return FileResponse(
        item["path"],
        media_type="application/octet-stream",
        headers={"Content-Disposition": _content_disposition(item["fname"])},
    )


# Static files (served last so routes above take priority)
app.mount("/", StaticFiles(directory="static", html=True), name="static")
