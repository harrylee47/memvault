"""Schema 验证测试"""
import pytest
from pydantic import ValidationError
from app.schemas.auth import UserRegister, UserLogin, TokenResponse
from app.schemas.memory import MemoryAdd, MemorySearch, MemoryUpdate
from app.schemas.config import LLMConfig, EmbedderConfig, ProjectConfigUpdate
from app.schemas.api_key import ApiKeyCreate


class TestAuthSchemas:
    def test_user_register_valid(self):
        user = UserRegister(email="test@example.com", name="Test", password="123456")
        assert user.email == "test@example.com"
        assert user.name == "Test"

    def test_user_register_invalid_email(self):
        with pytest.raises(ValidationError):
            UserRegister(email="not-an-email", name="Test", password="123456")

    def test_user_login_valid(self):
        login = UserLogin(email="test@example.com", password="pass")
        assert login.email == "test@example.com"

    def test_token_response(self):
        token = TokenResponse(access_token="abc", refresh_token="def")
        assert token.token_type == "bearer"


class TestMemorySchemas:
    def test_memory_add_valid(self):
        mem = MemoryAdd(messages=[{"role": "user", "content": "Hello"}])
        assert len(mem.messages) == 1
        assert mem.user_id is None

    def test_memory_add_with_ids(self):
        mem = MemoryAdd(
            messages=[{"role": "user", "content": "Test"}],
            user_id="u1",
            agent_id="a1",
            run_id="r1",
        )
        assert mem.user_id == "u1"
        assert mem.agent_id == "a1"

    def test_memory_search(self):
        search = MemorySearch(query="test query", limit=5)
        assert search.query == "test query"
        assert search.limit == 5
        assert search.rerank is False

    def test_memory_update(self):
        update = MemoryUpdate(content="updated content")
        assert update.content == "updated content"


class TestConfigSchemas:
    def test_llm_config_defaults(self):
        config = LLMConfig()
        assert config.provider == "openai"
        assert config.model == "gpt-4o-mini"
        assert config.temperature == 0.0

    def test_embedder_config(self):
        config = EmbedderConfig(provider="huggingface", model="bge-large")
        assert config.provider == "huggingface"

    def test_project_config_update_partial(self):
        update = ProjectConfigUpdate(
            llm=LLMConfig(provider="anthropic", model="claude-sonnet-4-5-20250929")
        )
        assert update.llm.provider == "anthropic"
        assert update.embedder is None

    def test_project_config_update_empty(self):
        update = ProjectConfigUpdate()
        assert update.llm is None
        assert update.max_memories is None


class TestApiKeySchemas:
    def test_api_key_create_defaults(self):
        key = ApiKeyCreate(name="test key")
        assert key.name == "test key"
        assert "memories:read" in key.scopes
        assert "memories:write" in key.scopes
        assert key.expires_in_days is None

    def test_api_key_create_custom(self):
        key = ApiKeyCreate(name="readonly", scopes=["memories:read"], expires_in_days=30)
        assert len(key.scopes) == 1
        assert key.expires_in_days == 30
