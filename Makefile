.PHONY: help dev up down build logs restart clean migrate test

help: ## 显示帮助信息
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# --- Docker ---

up: ## 启动所有服务
	docker compose up -d

down: ## 停止所有服务
	docker compose down

build: ## 构建所有镜像
	docker compose build

rebuild: ## 重新构建并启动
	docker compose up -d --build

logs: ## 查看所有服务日志
	docker compose logs -f

logs-api: ## 查看 API 日志
	docker compose logs -f api

logs-web: ## 查看 Web 日志
	docker compose logs -f web

restart: ## 重启所有服务
	docker compose restart

clean: ## 清理所有数据（危险）
	docker compose down -v

# --- 开发 ---

dev-api: ## 本地启动 API 开发服务器
	cd apps/api && uvicorn main:app --reload --host 0.0.0.0 --port 8765

dev-web: ## 本地启动 Web 开发服务器
	cd apps/web && npm run dev

# --- 数据库 ---

migrate: ## 运行数据库迁移
	cd apps/api && alembic upgrade head

migrate-new: ## 创建新迁移（需要 MSG 参数: make migrate-new MSG="add users table"）
	cd apps/api && alembic revision --autogenerate -m "$(MSG)"

# --- 测试 ---

test: ## 运行后端测试
	cd apps/api && pytest tests/ -v

test-web: ## 运行前端测试
	cd apps/web && npm test

# --- 初始化 ---

init: ## 首次初始化项目
	cp -n .env.example .env || true
	$(MAKE) build
	$(MAKE) up
	sleep 5
	$(MAKE) migrate
	@echo "\n✅ MemVault 已启动!"
	@echo "   Web:  http://localhost:3000"
	@echo "   API:  http://localhost:8765"
	@echo "   Docs: http://localhost:8765/docs"
