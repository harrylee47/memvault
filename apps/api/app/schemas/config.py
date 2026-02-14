from pydantic import BaseModel


class LLMConfig(BaseModel):
    provider: str = "openai"
    model: str = "gpt-4o-mini"
    api_key: str | None = None
    api_base_url: str | None = None
    temperature: float = 0.7
    max_tokens: int = 1500


class EmbedderConfig(BaseModel):
    provider: str = "openai"
    model: str = "text-embedding-3-small"
    api_key: str | None = None
    api_base_url: str | None = None


class VectorStoreConfig(BaseModel):
    provider: str = "qdrant"
    collection_name: str | None = None
    host: str | None = None
    port: int | None = None


class GraphStoreConfig(BaseModel):
    provider: str = "neo4j"
    url: str | None = None
    username: str | None = None
    password: str | None = None


class RerankerConfig(BaseModel):
    provider: str = "cross-encoder"
    model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"


class ProjectConfigUpdate(BaseModel):
    llm: LLMConfig | None = None
    embedder: EmbedderConfig | None = None
    vector_store: VectorStoreConfig | None = None
    graph_store: GraphStoreConfig | None = None
    reranker: RerankerConfig | None = None
    custom_instructions: str | None = None
    max_memories: int | None = None


class ProjectConfigResponse(BaseModel):
    project_id: str
    llm: LLMConfig | None = None
    embedder: EmbedderConfig | None = None
    vector_store: VectorStoreConfig | None = None
    graph_store: GraphStoreConfig | None = None
    reranker: RerankerConfig | None = None
    custom_instructions: str | None = None
    max_memories: int = 10000
