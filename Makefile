# moeys — container workflow.
# Dev   = docker-compose.yml + docker-compose.override.yml (auto-merged).
# Prod  = docker-compose.prod.yml ONLY, with --env-file .env.production.
#
# Use `>` for recipe indentation instead of a TAB (avoids whitespace foot-guns).
.RECIPEPREFIX = >
.DEFAULT_GOAL := help

DC      := docker compose
DC_PROD := docker compose --env-file .env.production -f docker-compose.prod.yml

.PHONY: help up down logs ps config rebuild migrate \
        prod prod-down prod-logs prod-config prod-migrate

help: ## Show this help
> @grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
>   | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

## ── Dev ──────────────────────────────────────────────────────────────────
up: ## Build + start the dev stack (foreground)
> $(DC) up --build

down: ## Stop the dev stack
> $(DC) down

logs: ## Tail dev logs
> $(DC) logs -f

ps: ## Show dev service status
> $(DC) ps

config: ## Render the resolved dev compose config
> $(DC) config

rebuild: ## Rebuild + recreate anon volumes (.venv/node_modules) after dep changes
> $(DC) up -d --build -V

migrate: ## Run Alembic migrations inside the running dev backend
> $(DC) exec backend uv run alembic upgrade head

## ── Prod (docker-compose.prod.yml ONLY) ──────────────────────────────────
prod: ## Build + start the prod stack (detached)
> $(DC_PROD) up -d --build

prod-down: ## Stop the prod stack
> $(DC_PROD) down

prod-logs: ## Tail prod logs
> $(DC_PROD) logs -f

prod-config: ## Render the resolved prod compose config
> $(DC_PROD) config

prod-migrate: ## Out-of-band Alembic upgrade — run BEFORE serving traffic
> $(DC_PROD) run --rm backend alembic upgrade head
