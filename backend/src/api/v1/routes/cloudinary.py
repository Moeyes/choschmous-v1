import os
import time
import secrets
import cloudinary
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from core.ratelimit import cloudinary_limiter
from src.database.deps import get_current_user
from src.models.user import User

router = APIRouter()

_ALLOWED_FOLDERS = {"domrov-pictures", "athlete-photos", "event-images"}


class PresignUrlResponse(BaseModel):
    signature: str
    timestamp: int
    folder: str
    public_id: str
    cloud_name: str
    api_key: str


@router.get("/presign-url", response_model=PresignUrlResponse)
async def get_presigned_url(
    request: Request,
    response: Response,
    folder: str = "domrov-pictures",
    current_user: User = Depends(get_current_user),
):
    await cloudinary_limiter.check(request, key_suffix=str(current_user.id), response=response)
    if folder not in _ALLOWED_FOLDERS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid folder. Allowed: {', '.join(sorted(_ALLOWED_FOLDERS))}",
        )
    """
    **Generate a Pre-signed URL for direct image uploads.**

    **Scenario:**
    Requested by the frontend before an athlete/user uploads a photo. This logic uses Cloudinary's API to create a secure, time-limited signature. The frontend then uses this signature to upload the image directly from the browser, bypassing the backend server for performance.

    **Success Response:**
    - `200 OK`: Returns the signature, timestamp, and Cloudinary API key.

    **Error Cases:**
    - `500 Internal Server Error`: Cloudinary credentials missing or API call failed.
    """
    cloudinary.config(
        cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
        api_key=os.getenv("CLOUDINARY_API_KEY"),
        api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    )
    timestamp = int(time.time())
    public_id = f"{folder}/{timestamp}_{secrets.token_hex(8)}"
    signature = cloudinary.utils.api_sign_request(
        {"timestamp": timestamp, "folder": folder, "public_id": public_id},
        os.getenv("CLOUDINARY_API_SECRET"),
    )
    return PresignUrlResponse(
        signature=signature,
        timestamp=timestamp,
        folder=folder,
        public_id=public_id,
        cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
        api_key=os.getenv("CLOUDINARY_API_KEY"),
    )
