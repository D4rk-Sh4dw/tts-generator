# Stage 1: Build Vite React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve with FastAPI & uv
FROM python:3.11-slim
WORKDIR /app

# Install uv
RUN pip install uv

# Copy uv package configuration
COPY pyproject.toml .

# Install dependencies using uv
RUN uv pip install --system fastapi uvicorn httpx

# Copy FastAPI backend
COPY main.py .

# Copy built frontend assets
COPY --from=frontend-builder /app/dist /app/dist

# Expose FastAPI port
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
