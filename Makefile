# =================================================================
# TAN-PMS PROJECT MAKEFILE
# Enterprise Property Management System (Hourly, Daily, Monthly)
# Compatible with macOS GNU Make 3.81+
# =================================================================

SHELL := /bin/bash
.DEFAULT_GOAL := help

# -----------------------------------------------------------------
# Configurable Ports and Settings
# -----------------------------------------------------------------
FE_PORT       ?= 3000
BE_PORT       ?= 5050
DB_PORT       ?= 5432
DB_HOST       ?= localhost
DB_NAME       ?= tan_pms
DB_USER       ?= postgres
DB_PASS       ?= postgres
DB_CONN       ?= "Host=$(DB_HOST);Port=$(DB_PORT);Database=$(DB_NAME);Username=$(DB_USER);Password=$(DB_PASS)"

COMPOSE_FILE  := docker-compose.yml
BACKEND_SLN   := backend/TanPms.slnx
BACKEND_API   := backend/src/TanPms.WebApi
BACKEND_INFRA := backend/src/TanPms.Infrastructure
FRONTEND_DIR  := frontend

.PHONY: help \
        dev dev-backend dev-frontend \
        up down stop restart logs ps db-wait db-migrate db-add-migration \
        test test-backend test-frontend \
        build build-backend build-frontend \
        lint typecheck api-gen verify-docs verify clean

# -----------------------------------------------------------------
# 1. คู่มือและรายการคำสั่งทั้งหมด (Help)
# -----------------------------------------------------------------
help:
	@echo ""
	@echo "================================================================="
	@echo "                   TAN-PMS MAKE COMMANDS                         "
	@echo "================================================================="
	@echo "พอร์ตมาตรฐาน: Frontend=:$(FE_PORT) | Backend=:$(BE_PORT) | DB=:$(DB_PORT)"
	@echo ""
	@echo "  🛠️  การรันและพัฒนาระบบ (Development):"
	@echo "    make dev            - รันทั้ง Frontend (:$(FE_PORT)) และ Backend (:$(BE_PORT)) พร้อมกัน"
	@echo "    make dev-frontend   - รันเฉพาะ Next.js Frontend บนพอร์ต :$(FE_PORT)"
	@echo "    make dev-backend    - รันเฉพาะ .NET 10 WebApi บนพอร์ต :$(BE_PORT)"
	@echo ""
	@echo "  🐘 ฐานข้อมูลและคอนเทนเนอร์ (Database & Docker):"
	@echo "    make up             - สตาร์ต PostgreSQL 17 + PostGIS (เบื้องหลัง)"
	@echo "    make down           - หยุดและลบคอนเทนเนอร์ฐานข้อมูล"
	@echo "    make stop           - สั่งพักคอนเทนเนอร์"
	@echo "    make restart        - รีสตาร์ตคอนเทนเนอร์"
	@echo "    make logs           - ดูบันทึกการทำงานของฐานข้อมูล (Follow)"
	@echo "    make ps             - ตรวจสอบสถานะคอนเทนเนอร์"
	@echo "    make db-wait        - รอจนฐานข้อมูล PostgreSQL พร้อมรับ Connection"
	@echo "    make db-migrate     - ปรับปรุงฐานข้อมูลด้วย EF Core Migration ล่าสุด"
	@echo "    make db-add-migration NAME=... - สร้าง EF Core Migration ใหม่"
	@echo ""
	@echo "  🧪 การทดสอบและตรวจสอบคุณภาพ (Test & Verification):"
	@echo "    make test           - รัน Unit/Integration Tests ทั้ง Backend และ Frontend"
	@echo "    make test-backend   - รัน xUnit + ArchUnitNET ทั้งหมดของ Backend"
	@echo "    make test-frontend  - รัน Vitest ทั้งหมดของ Frontend"
	@echo "    make lint           - ตรวจสอบ TypeScript & Linter ของ Frontend"
	@echo "    make typecheck      - ตรวจสอบความถูกต้องของ Type ทั้งหมด"
	@echo "    make verify-docs    - ตรวจสอบเอกสาร ธรรมาภิบาล และ Broken Links"
	@echo "    make verify         - ตรวจสอบครบวงจร (verify-docs + lint + test)"
	@echo ""
	@echo "  📦 การบิลด์และสัญญา API (Build & Contracts):"
	@echo "    make build          - คอมไพล์และบิลด์ทั้ง Backend และ Frontend"
	@echo "    make build-backend  - บิลด์ .NET 10 Solution"
	@echo "    make build-frontend - บิลด์ Next.js Production Bundle"
	@echo "    make api-gen        - สร้าง TypeScript API Client จาก OpenAPI Contract"
	@echo "    make clean          - ล้าง Cache และ Build Artifacts ทั้งหมด"
	@echo "================================================================="
	@echo ""

# -----------------------------------------------------------------
# 2. การรันเซิร์ฟเวอร์สำหรับพัฒนา (Development)
# -----------------------------------------------------------------
dev-frontend:
	@echo "⚡ Starting Next.js frontend on port $(FE_PORT)..."
	@cd $(FRONTEND_DIR) && npm run dev

dev-backend:
	@echo "⚡ Starting .NET 10 WebApi on port $(BE_PORT)..."
	@cd $(BACKEND_API) && ASPNETCORE_ENVIRONMENT=Development Persistence__Provider=$${PERSISTENCE_PROVIDER:-InMemory} dotnet run --urls "http://localhost:$(BE_PORT)"

dev:
	@echo "🚀 Launching tan-pms Frontend (:$(FE_PORT)) and Backend (:$(BE_PORT))..."
	@trap 'kill 0' SIGINT SIGTERM EXIT; \
	(cd $(BACKEND_API) && ASPNETCORE_ENVIRONMENT=Development Persistence__Provider=$${PERSISTENCE_PROVIDER:-InMemory} dotnet run --urls "http://localhost:$(BE_PORT)") & \
	(cd $(FRONTEND_DIR) && NEXT_PUBLIC_API_URL=http://localhost:$(BE_PORT) npm run dev) & \
	wait

# -----------------------------------------------------------------
# 3. การจัดการ Docker Compose และฐานข้อมูล (Database)
# -----------------------------------------------------------------
up:
	@echo "🐘 Starting PostgreSQL 17 + PostGIS container..."
	@docker compose -f $(COMPOSE_FILE) up -d

down:
	@echo "🛑 Stopping PostgreSQL container..."
	@docker compose -f $(COMPOSE_FILE) down

stop:
	@docker compose -f $(COMPOSE_FILE) stop

restart:
	@docker compose -f $(COMPOSE_FILE) restart

logs:
	@docker compose -f $(COMPOSE_FILE) logs -f postgres

ps:
	@docker compose -f $(COMPOSE_FILE) ps

db-wait:
	@echo "⏳ Waiting for PostgreSQL to become healthy..."
	@until [ "$$(docker inspect --format='{{.State.Health.Status}}' tan-pms-postgres 2>/dev/null)" = "healthy" ]; do \
		sleep 1; \
	done
	@echo "✅ PostgreSQL is ready and healthy."

db-migrate:
	@echo "🔄 Applying EF Core migrations to database..."
	@ConnectionStrings__DefaultConnection=$(DB_CONN) \
	dotnet ef database update \
		--project $(BACKEND_INFRA) \
		--startup-project $(BACKEND_API)

db-add-migration:
	@if [ -z "$(NAME)" ]; then \
		echo "❌ Error: กรุณาระบุชื่อ Migration เช่น make db-add-migration NAME=AddOccupancyIndex"; \
		exit 1; \
	fi
	@echo "📝 Creating EF Core migration: $(NAME)..."
	@dotnet ef migrations add $(NAME) \
		--project $(BACKEND_INFRA) \
		--startup-project $(BACKEND_API) \
		--output-dir Persistence/Migrations

# -----------------------------------------------------------------
# 4. การทดสอบและตรวจสอบคุณภาพ (Testing & Linting)
# -----------------------------------------------------------------
test-backend:
	@echo "🧪 Running backend tests (xUnit & ArchUnitNET)..."
	@dotnet test $(BACKEND_SLN)

test-frontend:
	@echo "🧪 Running frontend tests (Vitest)..."
	@cd $(FRONTEND_DIR) && npm test

test: test-backend test-frontend
	@echo "✅ All tests passed successfully."

lint:
	@echo "🔍 Linting frontend codebase..."
	@cd $(FRONTEND_DIR) && npm run lint

typecheck:
	@echo "🔍 Running TypeScript typecheck..."
	@cd $(FRONTEND_DIR) && npm run typecheck

verify-docs:
	@echo "📑 Verifying documentation governance and links..."
	@node scripts/verify-docs.mjs

verify: verify-docs lint test
	@echo "🌟 All enterprise verification gates passed!"

# -----------------------------------------------------------------
# 5. การบิลด์ สัญญา API และการทำความสะอาด (Build & Clean)
# -----------------------------------------------------------------
build-backend:
	@echo "🏗️  Building backend solution..."
	@dotnet build $(BACKEND_SLN)

build-frontend:
	@echo "🏗️  Building frontend Next.js bundle..."
	@cd $(FRONTEND_DIR) && npm run build

build: build-backend build-frontend
	@echo "✅ Full project build succeeded."

api-gen:
	@echo "⚡ Generating TypeScript API contracts from OpenAPI spec..."
	@cd $(FRONTEND_DIR) && npm run generate:api

clean:
	@echo "🧹 Cleaning build artifacts and caches..."
	@find . -type d -name "bin" -prune -exec rm -rf {} +
	@find . -type d -name "obj" -prune -exec rm -rf {} +
	@rm -rf $(FRONTEND_DIR)/.next $(FRONTEND_DIR)/dist
	@echo "✨ Clean complete."
