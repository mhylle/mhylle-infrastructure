"""
FastAPI Embeddings Service

Provides REST API for generating text embeddings using Sentence Transformers
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import logging

from app.models import get_model

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Embeddings Service",
    description="Text embedding generation using Sentence Transformers",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response models
class EmbeddingRequest(BaseModel):
    text: str = Field(..., description="Text to generate embedding for", min_length=1)
    model: str = Field(default="all-MiniLM-L6-v2", description="Model to use for embedding generation")


class BatchEmbeddingRequest(BaseModel):
    texts: List[str] = Field(..., description="List of texts to generate embeddings for", min_items=1)
    model: str = Field(default="all-MiniLM-L6-v2", description="Model to use for embedding generation")


class EmbeddingResponse(BaseModel):
    embedding: List[float] = Field(..., description="Generated embedding vector")
    model: str = Field(..., description="Model used for generation")
    dimension: int = Field(..., description="Embedding dimension")


class BatchEmbeddingResponse(BaseModel):
    embeddings: List[List[float]] = Field(..., description="Generated embedding vectors")
    model: str = Field(..., description="Model used for generation")
    dimension: int = Field(..., description="Embedding dimension")
    count: int = Field(..., description="Number of embeddings generated")


class HealthResponse(BaseModel):
    status: str
    model: str
    device: str
    dimension: int


# API endpoints
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    try:
        model = get_model()
        return HealthResponse(
            status="healthy",
            model=model.model_name,
            device=model.device,
            dimension=model.get_dimension()
        )
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Service unhealthy: {str(e)}")


@app.post("/api/embeddings/generate", response_model=EmbeddingResponse)
async def generate_embedding(request: EmbeddingRequest):
    """
    Generate embedding for a single text

    Args:
        request: EmbeddingRequest with text and model

    Returns:
        EmbeddingResponse with generated embedding
    """
    try:
        logger.info(f"Generating embedding for text (length: {len(request.text)})")

        model = get_model()

        # Validate model name
        if request.model != model.model_name:
            raise HTTPException(
                status_code=400,
                detail=f"Model {request.model} not supported. Only {model.model_name} is available."
            )

        # Generate embedding
        embedding = model.generate_embedding(request.text)

        logger.info(f"Successfully generated embedding (dimension: {len(embedding)})")

        return EmbeddingResponse(
            embedding=embedding,
            model=model.model_name,
            dimension=model.get_dimension()
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating embedding: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate embedding: {str(e)}")


@app.post("/api/embeddings/generate/batch", response_model=BatchEmbeddingResponse)
async def generate_embeddings_batch(request: BatchEmbeddingRequest):
    """
    Generate embeddings for multiple texts

    Args:
        request: BatchEmbeddingRequest with texts and model

    Returns:
        BatchEmbeddingResponse with generated embeddings
    """
    try:
        logger.info(f"Generating embeddings for {len(request.texts)} texts")

        model = get_model()

        # Validate model name
        if request.model != model.model_name:
            raise HTTPException(
                status_code=400,
                detail=f"Model {request.model} not supported. Only {model.model_name} is available."
            )

        # Generate embeddings
        embeddings = model.generate_embeddings_batch(request.texts)

        logger.info(f"Successfully generated {len(embeddings)} embeddings")

        return BatchEmbeddingResponse(
            embeddings=embeddings,
            model=model.model_name,
            dimension=model.get_dimension(),
            count=len(embeddings)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating embeddings: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate embeddings: {str(e)}")


@app.on_event("startup")
async def startup_event():
    """Initialize model on startup"""
    logger.info("Starting Embeddings Service...")
    try:
        model = get_model()
        logger.info(f"Model loaded: {model.model_name} on {model.device}")
        logger.info(f"Embedding dimension: {model.get_dimension()}")
    except Exception as e:
        logger.error(f"Failed to load model on startup: {str(e)}")
        raise


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
