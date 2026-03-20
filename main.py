import os
import httpx
from fastapi import FastAPI, Request, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Chatterbox Synth Proxy")

# Allow all CORS for development purposes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_TARGET = os.getenv("OLLAMA_TARGET", "http://host.docker.internal:11434")
CHATTERBOX_TARGET = os.getenv("CHATTERBOX_TARGET", "http://host.docker.internal:4123")

client = httpx.AsyncClient()

@app.api_route("/api/generate", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"])
async def proxy_ollama(request: Request):
    url = f"{OLLAMA_TARGET}/api/generate"
    body = await request.body()
    # Forward the request to Ollama
    req = client.build_request(
        request.method,
        url,
        headers=request.headers.raw,
        content=body,
    )
    resp = await client.send(req, stream=True)
    return StreamingResponse(
        resp.aiter_raw(),
        status_code=resp.status_code,
        media_type=resp.headers.get("content-type")
    )

@app.api_route("/v1/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"])
async def proxy_chatterbox(request: Request, path: str):
    url = f"{CHATTERBOX_TARGET}/v1/{path}"
    body = await request.body()
    # Forward the request to Chatterbox
    req = client.build_request(
        request.method,
        url,
        headers=request.headers.raw,
        content=body,
    )
    resp = await client.send(req, stream=True)
    return StreamingResponse(
        resp.aiter_raw(),
        status_code=resp.status_code,
        media_type=resp.headers.get("content-type")
    )

# Serve static files from the Vite build directory
static_dir = os.path.join(os.path.dirname(__file__), "dist")
if os.path.exists(static_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(static_dir, "assets")), name="assets")

    @app.get("/{catchall:path}")
    async def serve_static(catchall: str):
        file_path = os.path.join(static_dir, catchall)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(static_dir, "index.html"))
