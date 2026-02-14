"""mem0 客户端池单元测试"""
from app.utils.memory_client import build_mem0_config, _hash_config


class TestBuildConfig:
    def test_default_config(self):
        config = build_mem0_config("test-project-123")
        assert config["llm"]["provider"] == "openai"
        assert config["embedder"]["provider"] == "openai"
        assert config["vector_store"]["provider"] == "qdrant"
        assert config["vector_store"]["config"]["collection_name"] == "memvault_test-project-123"
        assert config["version"] == "v1.1"

    def test_custom_llm(self):
        project_config = {
            "llm": {"provider": "anthropic", "model": "claude-sonnet-4-5-20250929", "temperature": 0.5}
        }
        config = build_mem0_config("proj-1", project_config)
        assert config["llm"]["provider"] == "anthropic"
        assert config["llm"]["config"]["model"] == "claude-sonnet-4-5-20250929"
        assert config["llm"]["config"]["temperature"] == 0.5

    def test_custom_embedder(self):
        project_config = {
            "embedder": {"provider": "huggingface", "model": "bge-large-en-v1.5"}
        }
        config = build_mem0_config("proj-2", project_config)
        assert config["embedder"]["provider"] == "huggingface"
        assert config["embedder"]["config"]["model"] == "bge-large-en-v1.5"

    def test_graph_store(self):
        project_config = {
            "graph_store": {"provider": "neo4j", "url": "bolt://localhost:7687", "username": "neo4j", "password": "pass"}
        }
        config = build_mem0_config("proj-3", project_config)
        assert "graph_store" in config
        assert config["graph_store"]["provider"] == "neo4j"
        assert config["graph_store"]["config"]["url"] == "bolt://localhost:7687"

    def test_reranker(self):
        project_config = {
            "reranker": {"provider": "cross-encoder", "model": "ms-marco-MiniLM-L-6-v2"}
        }
        config = build_mem0_config("proj-4", project_config)
        assert "reranker" in config
        assert config["reranker"]["provider"] == "cross-encoder"

    def test_custom_instructions(self):
        project_config = {
            "custom_instructions": "Extract only facts about user preferences."
        }
        config = build_mem0_config("proj-5", project_config)
        assert config["custom_fact_extraction_prompt"] == "Extract only facts about user preferences."

    def test_none_project_config(self):
        config = build_mem0_config("proj-6", None)
        assert config["llm"]["provider"] == "openai"

    def test_empty_project_config(self):
        config = build_mem0_config("proj-7", {})
        assert config["llm"]["provider"] == "openai"

    def test_collection_name_per_project(self):
        c1 = build_mem0_config("proj-a")
        c2 = build_mem0_config("proj-b")
        assert c1["vector_store"]["config"]["collection_name"] != c2["vector_store"]["config"]["collection_name"]


class TestConfigHash:
    def test_same_config_same_hash(self):
        config = {"a": 1, "b": 2}
        assert _hash_config(config) == _hash_config(config)

    def test_different_config_different_hash(self):
        h1 = _hash_config({"model": "gpt-4"})
        h2 = _hash_config({"model": "gpt-3.5"})
        assert h1 != h2

    def test_key_order_irrelevant(self):
        h1 = _hash_config({"a": 1, "b": 2})
        h2 = _hash_config({"b": 2, "a": 1})
        assert h1 == h2
