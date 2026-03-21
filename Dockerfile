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

# Set up CUDA-related environment variables for torch
ENV NVIDIA_VISIBLE_DEVICES=all
ENV NVIDIA_DRIVER_CAPABILITIES=compute,utility

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install uv

# Copy python project config
COPY pyproject.toml .

# Install dependencies using uv. Install torch with CUDA 12.1 index first.
RUN uv pip install --system torch torchaudio --index-url https://download.pytorch.org/whl/cu121
RUN uv pip install --system .

# Copy FastAPI backend
COPY main.py .

# Copy built frontend assets
COPY --from=frontend-builder /app/dist /app/dist

# Expose FastAPI port
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
