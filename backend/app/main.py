import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles

from app import models  # noqa: F401
from app.api.v1.api import api_router
from app.core.config import settings

app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
)

os.makedirs("uploads", exist_ok=True)

# Middleware order note: Starlette's add_middleware() inserts at the FRONT of
# the stack, so the LAST one registered ends up OUTERMOST. GZip is registered
# first and CORS second, which leaves CORS on the outside where it can attach
# headers to every response (preflights and error responses included).

# Compress JSON responses. List/report payloads (invoices, products, reports)
# are highly repetitive JSON and shrink by roughly 70-85%. Responses under
# minimum_size are left alone, since compressing them costs more than it saves.
app.add_middleware(GZipMiddleware, minimum_size=1000, compresslevel=6)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ImmutableStaticFiles(StaticFiles):
    """StaticFiles that marks served files as immutable.

    StaticFiles sends ETag/Last-Modified but no Cache-Control, so browsers
    re-validate every upload on every navigation -- a round trip per image per
    page. Upload filenames are freshly generated UUIDs and are never
    overwritten in place, so each URL's content genuinely cannot change and a
    long immutable max-age is safe.
    """

    def file_response(self, *args, **kwargs):
        response = super().file_response(*args, **kwargs)
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response


app.mount("/uploads", ImmutableStaticFiles(directory="uploads"), name="uploads")

app.include_router(api_router)


@app.get("/health")
def health():
    return {"status": "ok"}
