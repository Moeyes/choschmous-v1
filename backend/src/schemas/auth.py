from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str  # validated server-side in auth_service before verify


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
