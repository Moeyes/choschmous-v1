<div align="center">

[![Python 3.14+](https://img.shields.io/badge/python-3.14+-blue.svg)](https://www.python.org/downloads/) &nbsp;[![FastAPI](https://img.shields.io/badge/FastAPI-0.135+-brightgreen.svg)](https://fastapi.tiangolo.com/) &nbsp;[![uv](https://img.shields.io/badge/uv-managed-orange)](https://docs.astral.sh/uv/) &nbsp;[![JWT Auth](https://img.shields.io/badge/JWT-Auth-purple)](https://jwt.io/) &nbsp;[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/) &nbsp;[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0+-red?logo=sqlalchemy&logoColor=white)](https://www.sqlalchemy.org/) &nbsp;[![Pydantic](https://img.shields.io/badge/Pydantic-v2+-blue?logo=pydantic&logoColor=white)](https://docs.pydantic.dev/)

</div>

# Sport Data Normalized System

FastAPI-based backend for normalizing and processing sport-related data.

Modern, high-performance API using FastAPI + uv for lightning-fast dependency & environment management.

## Quick Start (developers)

1. **Install uv** (one-time, global tool)

   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   # Or via Homebrew (macOS): brew install uv
   # Verify
   uv --version
   ```

2. **Clone the repository & enter the directoryBash**

    ```bash
    git clone <your-repo-url>
    cd backend-v2
    # only run this below installation command when first pull project/setup
    uv python install 3.14.3   
    ```

3. **Install and sync Dependancies**

    ```bash
    uv sync
    ```
    or
    ```bash
    make sync
    ```

4. **Run the FastAPI server**

    ### normal uv runtime
    ```bash
    # Quick Development mode (with auto-reload and no Port)
    uv run uvicorn app.main:app --reload
    ```
    ```bash
    # Development mode (with auto-reload and Port)
    uv run uvicorn app.main:app --reload --port 8000
    ```
    ```bash
    # Or production-like (no reload but with Port)
    uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
    ```

    ### IMPORTANT NOTE USE makerfile
    ```bash
    # Quick Dev
    make dev
    ```
    
    ```bash
    make prod
    ```
    



    ### Read this when you working on project Development
    ### Everytime pull/track/
        
        ```bash
        # Update dependencies to latest compatible versions
        uv lock --upgrade
        uv sync
        ```
        
    ### Re-create environment from scratch (e.g. after big changes)
        
        ```bash
        rm -rf .venv
        uv sync
        ```


