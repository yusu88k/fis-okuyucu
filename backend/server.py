"""
PLATFORM YAPIŞTIRICISI (glue) — Gerçek backend Node.js + Express'tir (src/index.js).

Emergent platformunun supervisor yapılandırması backend'i her zaman
`uvicorn server:app --port 8001` ile başlatır ve bu yapılandırma değiştirilemez.
Bu dosya iki iş yapar:
  1) Node.js Express sunucusunu (127.0.0.1:8002) alt süreç olarak başlatır
  2) 8001'e gelen tüm HTTP isteklerini Express'e şeffaf şekilde yönlendirir

LOKAL GELİŞTİRME İÇİN BU DOSYAYA GEREK YOK:
  cd backend && npm install && npm run dev   (Express doğrudan çalışır)
"""
import atexit
import os
import subprocess
import time

import httpx
from starlette.applications import Starlette
from starlette.background import BackgroundTask
from starlette.responses import JSONResponse, StreamingResponse
from starlette.routing import Route

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
NODE_PORT = int(os.environ.get("NODE_PORT", "8002"))
NODE_BASE_URL = f"http://127.0.0.1:{NODE_PORT}"

_node_process = None


def _kill_stale_node():
    """Önceki reload'dan kalan Node sürecini temizle (port çakışmasını önler)."""
    subprocess.run(
        ["pkill", "-f", "node --watch src/index.js"],
        capture_output=True,
    )


def _start_node():
    """Node.js Express sunucusunu başlat (çökmüşse yeniden başlat)."""
    global _node_process
    if _node_process is not None and _node_process.poll() is None:
        return
    _kill_stale_node()
    time.sleep(0.2)
    env = dict(os.environ, PORT=str(NODE_PORT))
    _node_process = subprocess.Popen(
        ["node", "--watch", "src/index.js"],
        cwd=BACKEND_DIR,
        env=env,
    )


def _stop_node():
    global _node_process
    if _node_process is not None and _node_process.poll() is None:
        _node_process.terminate()
        try:
            _node_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            _node_process.kill()


_start_node()
atexit.register(_stop_node)

# Uzun süren AI çağrıları için geniş timeout
_client = httpx.AsyncClient(base_url=NODE_BASE_URL, timeout=httpx.Timeout(600.0))

# Uçtan uca iletilmemesi gereken hop-by-hop header'lar
_HOP_HEADERS = {
    b"connection",
    b"keep-alive",
    b"proxy-authenticate",
    b"proxy-authorization",
    b"te",
    b"trailers",
    b"transfer-encoding",
    b"upgrade",
    b"host",
}


async def proxy(request):
    """Gelen isteği olduğu gibi Node/Express sunucusuna aktar."""
    _start_node()  # Node çöktüyse otomatik yeniden başlat

    url = httpx.URL(path=request.url.path, query=request.url.query.encode("utf-8"))
    headers = [
        (k, v) for k, v in request.headers.raw if k.lower() not in _HOP_HEADERS
    ]

    try:
        node_request = _client.build_request(
            request.method,
            url,
            headers=headers,
            content=request.stream(),
        )
        node_response = await _client.send(node_request, stream=True)
    except httpx.ConnectError:
        # Node henüz ayağa kalkmadıysa kısa bekle ve bir kez daha dene
        time.sleep(1.0)
        try:
            node_request = _client.build_request(
                request.method, url, headers=headers, content=request.stream()
            )
            node_response = await _client.send(node_request, stream=True)
        except Exception:
            return JSONResponse(
                {"error": "Sunucu başlatılıyor, lütfen birkaç saniye sonra tekrar deneyin."},
                status_code=503,
            )

    response_headers = {
        k.decode(): v.decode()
        for k, v in node_response.headers.raw
        if k.lower() not in _HOP_HEADERS
    }
    return StreamingResponse(
        node_response.aiter_raw(),
        status_code=node_response.status_code,
        headers=response_headers,
        background=BackgroundTask(node_response.aclose),
    )


app = Starlette(
    routes=[
        Route("/{path:path}", proxy, methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]),
    ]
)
