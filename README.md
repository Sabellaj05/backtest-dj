# Django Full-Stack Project

A full-stack application with Django backend and React frontend.

## Project Structure

```
django-project/
├── django-backend/     # Django REST API
├── django-front/       # React + Vite frontend
└── assets/            # Shared assets
```

## Getting Started

### Backend Setup

```bash
cd django-backend

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
# with uv
uv sync
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate
uv run manage.py migrate

# Start development server
python manage.py runserver
uv run manage.py runserver
```

Backend runs at: `http://localhost:8000`

### Frontend Setup

```bash
cd django-front

# Install dependencies
npm install

# Start development server
npm run dev
# for local access
# npm run dev -- --host 0.0.0.0
```

Frontend runs at: `http://localhost:5173` (or another port if 5173 is busy)

## Development Workflow

1. Start both servers in separate terminals
2. Frontend proxies API requests to backend
3. Make changes and see them hot-reload

## Tech Stack

**Backend:**
- Django
- Django REST Framework

**Frontend:**
- React
- Vite
- TailwindCSS

## Notes

- Environment files (`.env`, `.env.local`) are gitignored - never commit secrets!
- Database file (`db.sqlite3`) is gitignored for local development
- `node_modules` and `venv` are gitignored - always reinstall dependencies
