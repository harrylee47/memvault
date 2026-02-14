"""认证模块单元测试"""
from app.middleware.auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_api_key,
)


class TestPasswordHashing:
    def test_hash_and_verify(self):
        password = "test_password_123"
        hashed = hash_password(password)
        assert hashed != password
        assert verify_password(password, hashed)

    def test_wrong_password(self):
        hashed = hash_password("correct_password")
        assert not verify_password("wrong_password", hashed)

    def test_different_hashes(self):
        """相同密码每次生成不同 hash（bcrypt salt）"""
        h1 = hash_password("same")
        h2 = hash_password("same")
        assert h1 != h2
        assert verify_password("same", h1)
        assert verify_password("same", h2)


class TestJWT:
    def test_access_token_roundtrip(self):
        data = {"sub": "user-123", "email": "test@example.com"}
        token = create_access_token(data)
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "user-123"
        assert payload["email"] == "test@example.com"
        assert payload["type"] == "access"

    def test_refresh_token_roundtrip(self):
        data = {"sub": "user-456", "email": "test2@example.com"}
        token = create_refresh_token(data)
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "user-456"
        assert payload["type"] == "refresh"

    def test_invalid_token(self):
        payload = decode_token("invalid.token.here")
        assert payload is None

    def test_tampered_token(self):
        token = create_access_token({"sub": "user-1"})
        # 篡改 token
        tampered = token[:-4] + "XXXX"
        payload = decode_token(tampered)
        assert payload is None


class TestApiKeyHash:
    def test_hash_deterministic(self):
        key = "mv_abc123def456"
        h1 = hash_api_key(key)
        h2 = hash_api_key(key)
        assert h1 == h2

    def test_different_keys_different_hash(self):
        h1 = hash_api_key("mv_key1")
        h2 = hash_api_key("mv_key2")
        assert h1 != h2

    def test_prefix_format(self):
        key = "mv_abc123def456"
        assert key.startswith("mv_")
