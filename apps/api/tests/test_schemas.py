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


class TestProjectSchemas:
    def test_project_create_valid(self):
        from app.schemas.project import ProjectCreate
        p = ProjectCreate(name="My Project", slug="my-project")
        assert p.name == "My Project"
        assert p.slug == "my-project"

    def test_project_create_slug_auto_lowercase(self):
        from app.schemas.project import ProjectCreate
        p = ProjectCreate(name="Test", slug="My-Project")
        assert p.slug == "my-project"

    def test_project_create_invalid_slug(self):
        from app.schemas.project import ProjectCreate
        with pytest.raises(ValidationError):
            ProjectCreate(name="Test", slug="My Project!")

    def test_project_create_slug_too_short(self):
        from app.schemas.project import ProjectCreate
        with pytest.raises(ValidationError):
            ProjectCreate(name="Test", slug="a")

    def test_project_create_slug_leading_hyphen(self):
        from app.schemas.project import ProjectCreate
        with pytest.raises(ValidationError):
            ProjectCreate(name="Test", slug="-my-project")

    def test_project_create_name_too_long(self):
        from app.schemas.project import ProjectCreate
        with pytest.raises(ValidationError):
            ProjectCreate(name="x" * 101, slug="valid-slug")


class TestOrganizationSchemas:
    def test_org_create_valid(self):
        from app.schemas.organization import OrgCreate
        o = OrgCreate(name="My Org", slug="my-org")
        assert o.slug == "my-org"

    def test_org_create_invalid_slug(self):
        from app.schemas.organization import OrgCreate
        with pytest.raises(ValidationError):
            OrgCreate(name="Org", slug="INVALID SLUG")

    def test_org_member_add_valid_role(self):
        from app.schemas.organization import OrgMemberAdd
        m = OrgMemberAdd(email="test@test.com", role="admin")
        assert m.role == "admin"

    def test_org_member_add_invalid_role(self):
        from app.schemas.organization import OrgMemberAdd
        with pytest.raises(ValidationError):
            OrgMemberAdd(email="test@test.com", role="superadmin")


class TestAgentSchemas:
    def test_agent_create_valid(self):
        from app.schemas.agent import AgentCreate
        a = AgentCreate(name="My Agent", agent_id="my-agent-1")
        assert a.agent_type == "api"

    def test_agent_create_invalid_id(self):
        from app.schemas.agent import AgentCreate
        with pytest.raises(ValidationError):
            AgentCreate(name="Agent", agent_id="invalid id with spaces")

    def test_agent_create_invalid_type(self):
        from app.schemas.agent import AgentCreate
        with pytest.raises(ValidationError):
            AgentCreate(name="Agent", agent_id="valid-id", agent_type="unknown")

    def test_agent_create_id_too_long(self):
        from app.schemas.agent import AgentCreate
        with pytest.raises(ValidationError):
            AgentCreate(name="Agent", agent_id="a" * 65)

    def test_agent_create_valid_types(self):
        from app.schemas.agent import AgentCreate
        for t in ["api", "mcp", "webhook"]:
            a = AgentCreate(name="Agent", agent_id="test-id", agent_type=t)
            assert a.agent_type == t


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
