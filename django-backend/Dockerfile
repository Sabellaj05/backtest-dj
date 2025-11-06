# Use an official Python runtime as a parent image
FROM python:3.11-slim AS build

# Install uv
COPY --from=ghcr.io/astral-sh/uv:0.8.21 /uv /uv

# Set environment variables
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy

# Set the working directory in the container
WORKDIR /app

# Copy the lock file and pyproject.toml
COPY uv.lock pyproject.toml ./

# Install dependencies
RUN --mount=type=cache,target=/root/.cache/uv \
    /uv sync --no-install-project --no-dev

# Copy the rest of the application
COPY . .

# Install the project itself
RUN --mount=type=cache,target=/root/.cache/uv \
    /uv sync --frozen --no-dev

# Final image
FROM python:3.11-slim AS runtime

# Set the working directory
WORKDIR /app

# Set the path to include the virtual environment
ENV PATH="/app/.venv/bin:$PATH"

# Copy the virtual environment and the application from the build stage
COPY --from=build /app .

# Expose the port the app runs on
EXPOSE 8000

# Run the application
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
