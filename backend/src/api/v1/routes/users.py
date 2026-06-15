from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from core.ratelimit import create_user_limiter
from src.database.deps import get_db, require_superadmin
from src.models.user import User
from src.schemas.user import UserCreate, UserUpdate
from src.services.user_service import UserService
from src.schemas import user as user_schema

router = APIRouter()


async def get_user_service(db: AsyncSession = Depends(get_db)) -> UserService:
    return UserService(db)


@router.get("", response_model=user_schema.UsersPublic)
async def list_users(
    skip: int = 0,
    limit: int = 100,
    role: str | None = Query(None),
    is_active: bool | None = Query(None),
    username: str | None = Query(None),
    email: str | None = Query(None),
    db_service: UserService = Depends(get_user_service),
    _: User = Depends(require_superadmin),
):
    """
    **List all system users with filters.**

    **Scenario:**
    Used by admins to manage the user list. It supports filtering by role, status, or searching by username/email.

    **Success Response:**
    - `200 OK`: Returns a paginated list of users.

    **Error Cases:**
    - `422 Unprocessable Entity`: Invalid query parameters.
    """
    filters = {}
    for field, value in [
        ("role", role),
        ("is_active", is_active),
        ("username", username),
        ("email", email),
    ]:
        if value is not None:
            filters[field] = value

    users = await db_service.get_users(skip=skip, limit=limit, filters=filters)
    return {
        "data": [user_schema.UserPublic.model_validate(user) for user in users],
        "count": len(users),
    }


@router.get("/{user_id}", response_model=user_schema.UserPublic)
async def get_user(
    user_id: uuid.UUID,
    db_service: UserService = Depends(get_user_service),
    _: User = Depends(require_superadmin),
):
    """
    **Get specific user details.**

    **Scenario:**
    Requested when viewing a single staff profile. Uses the internal UUID for precise identification.

    **Success Response:**
    - `200 OK`: Returns the full user object.

    **Error Cases:**
    - `404 Not Found`: User UUID does not exist.
    """
    user = await db_service.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("", response_model=user_schema.UserPublic)
async def create_user(
    request: Request,
    response: Response,
    payload: UserCreate,
    db_service: UserService = Depends(get_user_service),
    current_user: User = Depends(require_superadmin),
):
    await create_user_limiter.check(request, key_suffix=str(current_user.id), response=response)
    """
    **Register a new Administrative User.**

    **Scenario:**
    Used by admin to create new user accounts.
    Requires a unique username, email, and a secure password.

    **Success Response:**
    - `201 Created`: User account created successfully.

    **Error Cases:**
    - `400 Bad Request`: Username or Email already exists.
    - `422 Unprocessable Entity`: Invalid data format (e.g., weak password, invalid email).
    """
    try:
        user = await db_service.create_user(payload, current_user)
    except IntegrityError:
        raise HTTPException(status_code=400, detail="Username or email already exists.")
    return user


from fastapi import Body


class UserUpdateBody(BaseModel):
    user_id: uuid.UUID
    data: UserUpdate


@router.patch("/update", response_model=user_schema.UserPublic)
async def update_user(
    body: UserUpdateBody = Body(...),
    db_service: UserService = Depends(get_user_service),
    current_user: User = Depends(require_superadmin),
):
    """
    **Update existing user details.**

    **Scenario:**
    Used when a user changes their password, role, or contact info. Supports partial updates via the `data` body field.

    **Success Response:**
    - `200 OK`: Account updated successfully.

    **Error Cases:**
    - `404 Not Found`: User UUID not found.
    - `422 Unprocessable Entity`: Malformed data object.
    """
    user = await db_service.update_user(body.user_id, body.data, current_user)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


class UserDeleteBody(BaseModel):
    user_id: uuid.UUID


@router.delete("/delete", response_model=dict)
async def delete_user(
    body: UserDeleteBody = Body(...),
    db_service: UserService = Depends(get_user_service),
    _: User = Depends(require_superadmin),
):
    """
    **Permanently deactivate and delete a User Account.**

    **Scenario:**
    Used when a staff member leaves the organization.
    **Warning**: This action is PERMANENT. All logs associated with this UUID will lose their foreign key reference or be deleted.

    **Success Response:**
    - `200 OK`: Account successfully removed.

    **Error Cases:**
    - `404 Not Found`: User UUID does not exist.
    """
    success = await db_service.delete_user(body.user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted successfully"}
