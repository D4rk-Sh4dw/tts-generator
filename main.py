import os
import httpx
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Chatterbox Synth Proxy")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_TARGET = os.getenv("OLLAMA_TARGET", "http://host.docker.internal:11434")
CHATTERBOX_TARGET = os.getenv("CHATTERBOX_TARGET", "http://host.docker.internal:4123")

# Increased timeout: Ollama & TTS can take a long time
client = httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=10.0))

# Headers to strip when forwarding (hop-by-hop or conflicting)
HOP_BY_HOP = {"host", "connection", "keep-alive", "transfer-encoding", "te", "trailers", "upgrade", "content-length"}


def _forwarded_headers(request: Request) -> dict:
    """Build a clean dict of headers safe to forward."""
    return {
        k: v for k, v in request.headers.items()
        if k.lower() not in HOP_BY_HOP
    }


async def _proxy(request: Request, target_url: str) -> StreamingResponse:
    """Generic reverse-proxy helper."""
    body = await request.body()
    headers = _forwarded_headers(request)

    req = client.build_request(
        method=request.method,
        url=target_url,
        headers=headers,
        content=body,
    )
    resp = await client.send(req, stream=True)

    return StreamingResponse(
        resp.aiter_raw(),
        status_code=resp.status_code,
        media_type=resp.headers.get("content-type"),
    )


# ── Ollama proxy ────────────────────────────────────────────
@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"])
async def proxy_ollama(request: Request, path: str):
    url = f"{OLLAMA_TARGET}/api/{path}"
    return await _proxy(request, url)


# ── Chatterbox proxy (OpenAI-compatible /v1/*) ──────────────
@app.api_route("/v1/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"])
async def proxy_chatterbox(request: Request, path: str):
    url = f"{CHATTERBOX_TARGET}/v1/{path}"
    return await _proxy(request, url)


# ── Chatterbox voice library (/voices, /languages, /health) ─
@app.api_route("/voices", methods=["GET", "POST", "DELETE"])
@app.api_route("/voices/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_voices(request: Request, path: str = ""):
    url = f"{CHATTERBOX_TARGET}/voices"
    if path:
        url = f"{url}/{path}"
    return await _proxy(request, url)


@app.api_route("/languages", methods=["GET"])
async def proxy_languages(request: Request):
    url = f"{CHATTERBOX_TARGET}/languages"
    return await _proxy(request, url)


@app.api_route("/health", methods=["GET"])
async def proxy_health(request: Request):
    url = f"{CHATTERBOX_TARGET}/health"
    return await _proxy(request, url)


# ── Serve compiled Vite frontend ─────────────────────────────
static_dir = os.path.join(os.path.dirname(__file__), "dist")
if os.path.exists(static_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(static_dir, "assets")), name="assets")

    @app.get("/{catchall:path}")
    async def serve_static(catchall: str):
        file_path = os.path.join(static_dir, catchall)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(static_dir, "index.html"))
