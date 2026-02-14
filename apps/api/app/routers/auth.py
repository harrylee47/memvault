from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.dependencies import get_current_user, AuthContext
from app.schemas.auth import UserRegister, UserLogin, UserResponse, UserUpdate, TokenResponse, TokenRefresh
from app.services.auth_service import register_user, login_user
from app.middleware.auth import decode_token, create_access_token, create_refresh_token
from fastapi import HTTPException, status

router = APIRouter(prefix="/auth", tags=["认证"])


@router.post("/register", response_model=TokenResponse)
async def register(data: UserRegister, db: AsyncSession = Depends(get_db)):
    """注册新用户"""
    _, tokens = await register_user(data, db)
    return tokens


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    """邮箱密码登录"""
    _, tokens = await login_user(data, db)
    return tokens


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(data: TokenRefresh):
    """刷新 token"""
    payload = decode_token(data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    token_data = {"sub": payload["sub"], "email": payload["email"]}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(auth: AuthContext = Depends(get_current_user)):
    """获取当前用户信息"""
    if not auth.user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="API key auth does not have user info")
    return auth.user


@router.put("/me", response_model=UserResponse)
async def update_me(
    data: UserUpdate,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新当前用户信息"""
    if not auth.user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    user = auth.user
    if data.name is not None:
        user.name = data.name
    if data.avatar_url is not None:
        user.avatar_url = data.avatar_url
    return user
