"""认证路由 - 支持邮箱/GitHub/Google"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import httpx

from app.database import get_db
from app.dependencies import get_current_user, AuthContext
from app.schemas.auth import UserRegister, UserLogin, UserResponse, UserUpdate, TokenResponse, TokenRefresh
from app.services.auth_service import register_user, login_user
from app.middleware.auth import decode_token, create_access_token, create_refresh_token
from app.models.user import User
from app.config import get_settings

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


# ---- OAuth ----

async def _oauth_login_or_register(
    db: AsyncSession,
    provider: str,
    provider_id: str,
    email: str,
    name: str,
    avatar_url: str | None = None,
) -> TokenResponse:
    """OAuth 通用登录/注册逻辑"""
    # 查找已有用户（按 provider + provider_id）
    result = await db.execute(
        select(User).where(User.provider == provider, User.provider_id == provider_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        # 按 email 查找（可能是邮箱注册后又用 OAuth 登录）
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

    if user:
        # 更新 provider 信息
        if not user.provider_id:
            user.provider = provider
            user.provider_id = provider_id
        if avatar_url:
            user.avatar_url = avatar_url
    else:
        # 创建新用户
        user = User(
            id=str(uuid.uuid4()),
            email=email,
            name=name,
            provider=provider,
            provider_id=provider_id,
            avatar_url=avatar_url,
        )
        db.add(user)
        await db.flush()

    token_data = {"sub": user.id, "email": user.email}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.post("/login/github", response_model=TokenResponse)
async def github_login(
    code: str = Query(..., description="GitHub OAuth authorization code"),
    db: AsyncSession = Depends(get_db),
):
    """GitHub OAuth 登录"""
    settings = get_settings()
    if not settings.GITHUB_CLIENT_ID or not settings.GITHUB_CLIENT_SECRET:
        raise HTTPException(status_code=501, detail="GitHub OAuth not configured")

    # 交换 code 获取 access_token
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
            },
            headers={"Accept": "application/json"},
        )
        if token_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange GitHub code")

        token_data = token_resp.json()
        gh_token = token_data.get("access_token")
        if not gh_token:
            raise HTTPException(status_code=400, detail=token_data.get("error_description", "OAuth failed"))

        # 获取 GitHub 用户信息
        user_resp = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {gh_token}", "Accept": "application/json"},
        )
        gh_user = user_resp.json()

        # 获取邮箱
        email = gh_user.get("email")
        if not email:
            emails_resp = await client.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"Bearer {gh_token}", "Accept": "application/json"},
            )
            emails = emails_resp.json()
            for e in emails:
                if e.get("primary"):
                    email = e.get("email")
                    break
            if not email and emails:
                email = emails[0].get("email")

    if not email:
        raise HTTPException(status_code=400, detail="Cannot retrieve email from GitHub")

    return await _oauth_login_or_register(
        db=db,
        provider="github",
        provider_id=str(gh_user["id"]),
        email=email,
        name=gh_user.get("name") or gh_user.get("login", ""),
        avatar_url=gh_user.get("avatar_url"),
    )


@router.post("/login/google", response_model=TokenResponse)
async def google_login(
    code: str = Query(..., description="Google OAuth authorization code"),
    db: AsyncSession = Depends(get_db),
):
    """Google OAuth 登录"""
    settings = get_settings()
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=501, detail="Google OAuth not configured")

    redirect_uri = f"{settings.OAUTH_REDIRECT_BASE}/api/auth/callback/google"

    async with httpx.AsyncClient() as client:
        # 交换 code 获取 token
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        if token_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange Google code")

        token_data = token_resp.json()
        access_token = token_data.get("access_token")

        # 获取用户信息
        user_resp = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        google_user = user_resp.json()

    return await _oauth_login_or_register(
        db=db,
        provider="google",
        provider_id=google_user["id"],
        email=google_user["email"],
        name=google_user.get("name", ""),
        avatar_url=google_user.get("picture"),
    )
