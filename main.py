import os
import httpx
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi import UploadFile, File, Form
import io
import soundfile as sf
from qwen_engine import qwen_engine

app = FastAPI(title="Chatterbox Synth Proxy/API")

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

# Headers to strip when forwarding (hop-by-hop, conflicting, or origin-based that cause 403)
HOP_BY_HOP = {"host", "connection", "keep-alive", "transfer-encoding", "te", "trailers", "upgrade", "content-length", "origin", "referer"}


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


def _get_audio_response(wav_array, sr):
    buffer = io.BytesIO()
    sf.write(buffer, wav_array, sr, format='WAV')
    buffer.seek(0)
    return Response(content=buffer.read(), media_type="audio/wav")


# ── Qwen-TTS Native Routes ─────────────────────────────
@app.post("/api/qwen/custom-voice")
def qwen_custom_voice(text: str = Form(...), language: str = Form("Auto"), speaker: str = Form(...), instruct: str = Form("")):
    wavs, sr = qwen_engine.custom_voice(text, language, speaker, instruct)
    return _get_audio_response(wavs, sr)

@app.post("/api/qwen/voice-design")
def qwen_voice_design(text: str = Form(...), language: str = Form("Auto"), instruct: str = Form(...)):
    wavs, sr = qwen_engine.voice_design(text, language, instruct)
    return _get_audio_response(wavs, sr)

@app.post("/api/qwen/voice-clone")
async def qwen_voice_clone(text: str = Form(...), language: str = Form("Auto"), ref_audio: UploadFile = File(...), ref_text: str = Form(...)):
    audio_bytes = await ref_audio.read()
    audio_buffer = io.BytesIO(audio_bytes)
    audio_data, audio_sr = sf.read(audio_buffer)
    
    # Run the blocking model execution in a thread pool managed by FastAPI/anyio internally
    import anyio
    wavs, sr = await anyio.to_thread.run_sync(
        qwen_engine.voice_clone, text, language, (audio_data, audio_sr), ref_text
    )
    return _get_audio_response(wavs, sr)


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
