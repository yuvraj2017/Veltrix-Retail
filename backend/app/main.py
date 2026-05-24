# from fastapi import FastAPI
# from fastapi.middleware.cors import CORSMiddleware
# from fastapi.staticfiles import StaticFiles

# from app.api.v1.api import api_router
# from app.core.config import settings

# app = FastAPI(
#     title=settings.app_name,
#     debug=settings.debug,
# )

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=settings.cors_origins,
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# app.include_router(api_router)


# @app.get("/health")
# def health():
#     return {"status": "ok"}






from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1.api import api_router
from app.core.config import settings

app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
)

# Support both old list-based config and new comma-separated env config
cors_origins = settings.cors_origins

if isinstance(cors_origins, str):
    cors_origins = [
        origin.strip()
        for origin in cors_origins.split(",")
        if origin.strip()
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(api_router)


@app.get("/health")
def health():
    return {"status": "ok"}