"""Image ingestion for uploaded logos and product photos.

Uploads used to be written to disk verbatim with ``shutil.copyfileobj``, so a
phone camera PNG landed on the server at its original size -- the logos
directory contains several 1.7 MB files that the UI renders into a 40 px
avatar. Every page load paid for those bytes.

Each upload is now decoded once, downscaled to a sensible maximum edge,
re-encoded as WebP, and written alongside a small square thumbnail for use in
lists, tables, and avatars.
"""

import logging
import os
import uuid

from PIL import Image, ImageOps, UnidentifiedImageError

logger = logging.getLogger(__name__)

# Formats we are willing to decode. Matches the endpoints' content-type allowlist.
ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}

# Largest edge kept for the full-size variant. Product detail views and invoice
# previews never render larger than this, so anything beyond it is waste.
MAX_FULL_EDGE = 1280

# Square thumbnail used by sidebars, avatars, and table cells.
THUMBNAIL_EDGE = 160

WEBP_QUALITY_FULL = 82
WEBP_QUALITY_THUMB = 75

# Pillow decompression-bomb guard. A legitimate shop logo or product photo is
# nowhere near this; anything larger is refused rather than decoded.
Image.MAX_IMAGE_PIXELS = 64_000_000


class ImageProcessingError(Exception):
    """Raised when an upload cannot be decoded as an image."""


def _flatten_to_rgb(image: Image.Image) -> Image.Image:
    """Composite transparency onto white so WebP encodes predictably."""
    if image.mode in ("RGBA", "LA", "P"):
        rgba = image.convert("RGBA")
        canvas = Image.new("RGB", rgba.size, (255, 255, 255))
        canvas.paste(rgba, mask=rgba.split()[-1])
        return canvas
    if image.mode != "RGB":
        return image.convert("RGB")
    return image


def save_optimized_image(upload_file, subdirectory: str) -> tuple[str, str]:
    """Decode, downscale, and store one upload.

    Args:
        upload_file: A Starlette/FastAPI ``UploadFile``.
        subdirectory: Folder under ``uploads/`` (e.g. ``"logos"``, ``"products"``).

    Returns:
        ``(full_url, thumbnail_url)`` as web paths, e.g.
        ``("/uploads/logos/<hex>.webp", "/uploads/logos/<hex>_thumb.webp")``.

    Raises:
        ImageProcessingError: the payload is not a decodable image.
    """
    upload_dir = os.path.join("uploads", subdirectory)
    os.makedirs(upload_dir, exist_ok=True)

    try:
        upload_file.file.seek(0)
        with Image.open(upload_file.file) as opened:
            # EXIF orientation is applied here; otherwise phone photos arrive
            # rotated once the orientation tag is dropped on re-encode.
            image = ImageOps.exif_transpose(opened)
            image = _flatten_to_rgb(image)

            stem = uuid.uuid4().hex

            full = image.copy()
            full.thumbnail((MAX_FULL_EDGE, MAX_FULL_EDGE), Image.LANCZOS)
            full_name = f"{stem}.webp"
            full.save(
                os.path.join(upload_dir, full_name),
                format="WEBP",
                quality=WEBP_QUALITY_FULL,
                method=6,
            )

            # ImageOps.fit crops to a centred square so thumbnails line up in
            # grids regardless of the source aspect ratio.
            thumb = ImageOps.fit(
                image, (THUMBNAIL_EDGE, THUMBNAIL_EDGE), Image.LANCZOS
            )
            thumb_name = f"{stem}_thumb.webp"
            thumb.save(
                os.path.join(upload_dir, thumb_name),
                format="WEBP",
                quality=WEBP_QUALITY_THUMB,
                method=6,
            )
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        logger.warning("Rejected unreadable image upload: %s", exc)
        raise ImageProcessingError("The uploaded file is not a readable image") from exc

    return (
        f"/uploads/{subdirectory}/{full_name}",
        f"/uploads/{subdirectory}/{thumb_name}",
    )
