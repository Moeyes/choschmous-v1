"""Report artifact storage (CHOS-202).

The render worker produces document bytes off the request path and hands them
here. In production these belong in object storage (S3) so the API can return a
short-lived URL and the bytes never round-trip through Redis. There is no live
bucket in this environment, so the default is a local-filesystem store that the
job-status download endpoint can stream back — the S3 path is wired but guarded
and clearly marked TODO.

# TODO(CHOS-202 / infra): provision the object store and inject:
#   REPORTS_S3_BUCKET   - target bucket name (REQUIRED to enable S3)
#   REPORTS_S3_ENDPOINT - optional S3-compatible endpoint (MinIO, etc.)
#   REPORTS_S3_REGION   - bucket region
#   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (or an instance role)
# Then implement ``_store_s3`` (boto3 put_object + presigned GET) below.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

# Where local artifacts land when no bucket is configured. Kept out of the repo
# (var/ is git-ignored) and created on demand.
_ARTIFACT_DIR = Path(
    os.getenv(
        "REPORTS_ARTIFACT_DIR",
        str(Path(__file__).resolve().parents[2] / "var" / "report-artifacts"),
    )
)

_S3_BUCKET = os.getenv("REPORTS_S3_BUCKET")


def _store_local(job_id: str, content: bytes, media_type: str, filename: str) -> dict:
    job_dir = _ARTIFACT_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    (job_dir / "artifact.bin").write_bytes(content)
    (job_dir / "meta.json").write_text(
        json.dumps({"media_type": media_type, "filename": filename})
    )
    # Relative to the API prefix; the route builds the absolute path. The bytes
    # are streamed by GET /reports/jobs/{job_id}/download.
    return {
        "storage": "local",
        "url": f"reports/jobs/{job_id}/download",
        "filename": filename,
        "media_type": media_type,
        "size_bytes": len(content),
    }


def _store_s3(job_id: str, content: bytes, media_type: str, filename: str) -> dict:
    # TODO(CHOS-202 / infra): implement with boto3 once a bucket exists:
    #   client.put_object(Bucket=_S3_BUCKET, Key=key, Body=content,
    #                     ContentType=media_type)
    #   url = client.generate_presigned_url("get_object", ...)
    # Until then, refuse silently-wrong behaviour: warn and fall back to local so
    # the feature keeps working rather than returning an s3:// URL to nothing.
    logger.warning(
        "REPORTS_S3_BUCKET=%s set but S3 upload is not implemented yet "
        "(CHOS-202 TODO); falling back to local artifact storage.",
        _S3_BUCKET,
    )
    return _store_local(job_id, content, media_type, filename)


def store_artifact(job_id: str, content: bytes, media_type: str, filename: str) -> dict:
    """Persist the rendered bytes and return a result descriptor for the
    job-status endpoint (``storage``, ``url``, ``filename``, ``media_type``,
    ``size_bytes``)."""
    if _S3_BUCKET:
        return _store_s3(job_id, content, media_type, filename)
    return _store_local(job_id, content, media_type, filename)


def load_artifact(job_id: str) -> tuple[bytes, str, str] | None:
    """Read a locally-stored artifact back for the download endpoint. Returns
    ``(content, media_type, filename)`` or ``None`` if it is not present (e.g.
    the job is still running, expired, or was stored in S3)."""
    job_dir = _ARTIFACT_DIR / job_id
    blob = job_dir / "artifact.bin"
    meta = job_dir / "meta.json"
    if not blob.exists() or not meta.exists():
        return None
    info = json.loads(meta.read_text())
    return blob.read_bytes(), info["media_type"], info["filename"]
