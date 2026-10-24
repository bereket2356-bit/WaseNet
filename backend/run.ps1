# WaseNet Backend Management Script for Windows PowerShell
param (
    [Parameter(Position=0)]
    [ValidateSet("install", "migrate", "seed", "run", "test", "openapi", "retention", "docker-up", "docker-down", "help")]
    [string]$Command = "help"
)

$VENV_PYTHON = "$PSScriptRoot\venv\Scripts\python.exe"
$VENV_PYTEST = "$PSScriptRoot\venv\Scripts\pytest.exe"
$VENV_ALEMBIC = "$PSScriptRoot\venv\Scripts\alembic.exe"
$VENV_UVICORN = "$PSScriptRoot\venv\Scripts\uvicorn.exe"

if (-not (Test-Path $VENV_PYTHON)) {
    $VENV_PYTHON = "python"
    $VENV_PYTEST = "pytest"
    $VENV_ALEMBIC = "alembic"
    $VENV_UVICORN = "uvicorn"
}

switch ($Command) {
    "install" {
        Write-Host "Installing dependencies from requirements.txt..." -ForegroundColor Cyan
        & $VENV_PYTHON -m pip install -r "$PSScriptRoot\requirements.txt"
    }
    "migrate" {
        Write-Host "Applying database migrations (Alembic)..." -ForegroundColor Cyan
        Set-Location $PSScriptRoot
        & $VENV_ALEMBIC upgrade head
    }
    "seed" {
        Write-Host "Seeding database..." -ForegroundColor Cyan
        Set-Location $PSScriptRoot
        & $VENV_PYTHON scripts/seed.py
    }
    "run" {
        Write-Host "Starting WaseNet API development server on http://localhost:8000..." -ForegroundColor Green
        Set-Location $PSScriptRoot
        & $VENV_UVICORN app.main:app --host 0.0.0.0 --port 8000 --reload
    }
    "test" {
        Write-Host "Running comprehensive test suite..." -ForegroundColor Cyan
        Set-Location $PSScriptRoot
        & $VENV_PYTEST tests -v
    }
    "openapi" {
        Write-Host "Generating OpenAPI specification from application code..." -ForegroundColor Cyan
        Set-Location $PSScriptRoot
        & $VENV_PYTHON scripts/generate_openapi.py
    }
    "retention" {
        Write-Host "Running scheduled data retention purge..." -ForegroundColor Cyan
        Set-Location $PSScriptRoot
        & $VENV_PYTHON scripts/run_retention.py
    }
    "docker-up" {
        Write-Host "Starting Docker Compose services (PostgreSQL, migration, API)..." -ForegroundColor Green
        Set-Location $PSScriptRoot
        docker compose up --build -d
    }
    "docker-down" {
        Write-Host "Tearing down Docker Compose services..." -ForegroundColor Yellow
        Set-Location $PSScriptRoot
        docker compose down -v
    }
    Default {
        Write-Host "WaseNet Backend PowerShell Commands:" -ForegroundColor Yellow
        Write-Host "  .\run.ps1 install     - Install Python dependencies"
        Write-Host "  .\run.ps1 migrate     - Apply Alembic migrations to head"
        Write-Host "  .\run.ps1 seed        - Seed database (admin, issuer, key, revoked doc)"
        Write-Host "  .\run.ps1 run         - Start Uvicorn development server"
        Write-Host "  .\run.ps1 test        - Run test suite"
        Write-Host "  .\run.ps1 openapi     - Generate openapi.json"
        Write-Host "  .\run.ps1 retention   - Run retention purge job"
        Write-Host "  .\run.ps1 docker-up   - Start Docker Compose"
        Write-Host "  .\run.ps1 docker-down - Stop Docker Compose"
    }
}
