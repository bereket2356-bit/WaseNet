.PHONY: help install migrate seed run test openapi retention docker-up docker-down

help:
	@echo "WaseNet Backend Management Commands:"
	@echo "  make install     - Install Python dependencies"
	@echo "  make migrate     - Run Alembic database migrations to head"
	@echo "  make seed        - Seed initial admin, issuer, key, and demo revoked doc"
	@echo "  make run         - Run Uvicorn development server"
	@echo "  make test        - Run complete pytest test suite (unit + integration)"
	@echo "  make openapi     - Generate openapi.json directly from code"
	@echo "  make retention   - Run data retention purge job"
	@echo "  make docker-up   - Start PostgreSQL, migration, and API with Docker Compose"
	@echo "  make docker-down - Stop and tear down Docker containers"

install:
	pip install -r requirements.txt

migrate:
	alembic upgrade head

seed:
	python scripts/seed.py

run:
	uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

test:
	pytest tests -v

openapi:
	python scripts/generate_openapi.py

retention:
	python scripts/run_retention.py

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down -v
