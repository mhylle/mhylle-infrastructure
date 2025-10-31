"""
Tests for FastAPI embeddings service
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check():
    """Test health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "model" in data
    assert "device" in data
    assert "dimension" in data
    assert data["dimension"] == 384  # all-MiniLM-L6-v2 dimension


def test_generate_embedding():
    """Test single embedding generation"""
    request_data = {
        "text": "This is a test sentence.",
        "model": "all-MiniLM-L6-v2"
    }
    response = client.post("/api/embeddings/generate", json=request_data)
    assert response.status_code == 200
    data = response.json()
    assert "embedding" in data
    assert "model" in data
    assert "dimension" in data
    assert len(data["embedding"]) == 384
    assert data["model"] == "all-MiniLM-L6-v2"
    assert data["dimension"] == 384


def test_generate_embedding_empty_text():
    """Test embedding generation with empty text"""
    request_data = {
        "text": "",
        "model": "all-MiniLM-L6-v2"
    }
    response = client.post("/api/embeddings/generate", json=request_data)
    assert response.status_code == 422  # Validation error


def test_generate_embedding_wrong_model():
    """Test embedding generation with unsupported model"""
    request_data = {
        "text": "Test sentence",
        "model": "unsupported-model"
    }
    response = client.post("/api/embeddings/generate", json=request_data)
    assert response.status_code == 400  # Bad request


def test_generate_embeddings_batch():
    """Test batch embedding generation"""
    request_data = {
        "texts": [
            "First test sentence.",
            "Second test sentence.",
            "Third test sentence."
        ],
        "model": "all-MiniLM-L6-v2"
    }
    response = client.post("/api/embeddings/generate/batch", json=request_data)
    assert response.status_code == 200
    data = response.json()
    assert "embeddings" in data
    assert "model" in data
    assert "dimension" in data
    assert "count" in data
    assert len(data["embeddings"]) == 3
    assert data["count"] == 3
    assert data["dimension"] == 384
    assert all(len(emb) == 384 for emb in data["embeddings"])


def test_generate_embeddings_batch_empty():
    """Test batch embedding with empty list"""
    request_data = {
        "texts": [],
        "model": "all-MiniLM-L6-v2"
    }
    response = client.post("/api/embeddings/generate/batch", json=request_data)
    assert response.status_code == 422  # Validation error


def test_generate_embeddings_batch_large():
    """Test batch embedding with larger batch"""
    texts = [f"Test sentence number {i}" for i in range(100)]
    request_data = {
        "texts": texts,
        "model": "all-MiniLM-L6-v2"
    }
    response = client.post("/api/embeddings/generate/batch", json=request_data)
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 100
    assert len(data["embeddings"]) == 100


def test_embedding_consistency():
    """Test that same text produces same embedding"""
    text = "Consistency test sentence"
    request_data = {
        "text": text,
        "model": "all-MiniLM-L6-v2"
    }

    # Generate embedding twice
    response1 = client.post("/api/embeddings/generate", json=request_data)
    response2 = client.post("/api/embeddings/generate", json=request_data)

    assert response1.status_code == 200
    assert response2.status_code == 200

    embedding1 = response1.json()["embedding"]
    embedding2 = response2.json()["embedding"]

    # Check embeddings are identical
    assert embedding1 == embedding2
