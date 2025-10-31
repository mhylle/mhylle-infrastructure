# Embeddings Service

FastAPI microservice for generating text embeddings using Sentence Transformers.

## Features

- **GPU Acceleration**: Automatic CUDA detection and GPU utilization
- **REST API**: Simple HTTP endpoints for embedding generation
- **Batch Processing**: Efficient batch embedding generation
- **Health Checks**: Monitoring endpoint for service health
- **Model**: all-MiniLM-L6-v2 (384 dimensions)

## API Endpoints

### Health Check
```
GET /health
```

Returns service status, model info, device, and embedding dimension.

### Generate Single Embedding
```
POST /api/embeddings/generate
Content-Type: application/json

{
  "text": "Your text here",
  "model": "all-MiniLM-L6-v2"
}
```

Returns:
```json
{
  "embedding": [0.123, -0.456, ...],
  "model": "all-MiniLM-L6-v2",
  "dimension": 384
}
```

### Generate Batch Embeddings
```
POST /api/embeddings/generate/batch
Content-Type: application/json

{
  "texts": ["First text", "Second text", "Third text"],
  "model": "all-MiniLM-L6-v2"
}
```

Returns:
```json
{
  "embeddings": [[0.123, ...], [0.456, ...], [0.789, ...]],
  "model": "all-MiniLM-L6-v2",
  "dimension": 384,
  "count": 3
}
```

## Development

### Install Dependencies
```bash
pip install -r requirements.txt
```

### Run Development Server
```bash
python -m uvicorn app.main:app --reload --port 8001
```

### Run Tests
```bash
pytest
```

### Run Tests with Coverage
```bash
pytest --cov=app --cov-report=html
```

## Docker

### Build Image
```bash
docker build -t embeddings-service:latest .
```

### Run Container (CPU)
```bash
docker run -p 8001:8001 embeddings-service:latest
```

### Run Container (GPU)
```bash
docker run --gpus all -p 8001:8001 embeddings-service:latest
```

## Configuration

The service automatically detects and uses CUDA GPUs if available. If no GPU is found, it falls back to CPU processing.

## Model Information

- **Model**: sentence-transformers/all-MiniLM-L6-v2
- **Dimensions**: 384
- **Max Sequence Length**: 256 tokens
- **Performance**: ~3,800 sentences/second on GPU

## Health Check

The service includes a health check endpoint that can be used for monitoring:

```bash
curl http://localhost:8001/health
```

Expected response:
```json
{
  "status": "healthy",
  "model": "all-MiniLM-L6-v2",
  "device": "cuda",
  "dimension": 384
}
```
