"""
Tests for embedding model wrapper
"""
import pytest
from app.models import EmbeddingModel, get_model


def test_model_initialization():
    """Test model initializes correctly"""
    model = EmbeddingModel()
    assert model.model_name == "all-MiniLM-L6-v2"
    assert model.device in ["cuda", "cpu"]
    assert model.model is not None


def test_get_dimension():
    """Test getting embedding dimension"""
    model = EmbeddingModel()
    dimension = model.get_dimension()
    assert dimension == 384  # all-MiniLM-L6-v2 dimension


def test_generate_embedding():
    """Test single embedding generation"""
    model = EmbeddingModel()
    text = "This is a test sentence."
    embedding = model.generate_embedding(text)

    assert isinstance(embedding, list)
    assert len(embedding) == 384
    assert all(isinstance(x, float) for x in embedding)


def test_generate_embeddings_batch():
    """Test batch embedding generation"""
    model = EmbeddingModel()
    texts = [
        "First sentence.",
        "Second sentence.",
        "Third sentence."
    ]
    embeddings = model.generate_embeddings_batch(texts)

    assert isinstance(embeddings, list)
    assert len(embeddings) == 3
    assert all(len(emb) == 384 for emb in embeddings)
    assert all(isinstance(x, float) for emb in embeddings for x in emb)


def test_get_model_singleton():
    """Test that get_model returns same instance"""
    model1 = get_model()
    model2 = get_model()
    assert model1 is model2


def test_embedding_values_range():
    """Test that embedding values are in reasonable range"""
    model = EmbeddingModel()
    text = "Test sentence for value range check."
    embedding = model.generate_embedding(text)

    # Embeddings should be normalized (roughly between -1 and 1)
    assert all(-1.5 <= x <= 1.5 for x in embedding)


def test_empty_text():
    """Test embedding generation with empty text"""
    model = EmbeddingModel()
    embedding = model.generate_embedding("")

    # Should still return an embedding (model handles empty text)
    assert isinstance(embedding, list)
    assert len(embedding) == 384


def test_batch_empty_list():
    """Test batch generation with empty list"""
    model = EmbeddingModel()
    embeddings = model.generate_embeddings_batch([])

    assert isinstance(embeddings, list)
    assert len(embeddings) == 0


def test_embedding_semantic_similarity():
    """Test that similar texts have similar embeddings"""
    model = EmbeddingModel()

    # Generate embeddings for similar sentences
    emb1 = model.generate_embedding("The cat sits on the mat.")
    emb2 = model.generate_embedding("A cat is sitting on a mat.")

    # Generate embedding for different sentence
    emb3 = model.generate_embedding("The weather is sunny today.")

    # Calculate cosine similarity (simplified)
    def cosine_similarity(a, b):
        dot_product = sum(x * y for x, y in zip(a, b))
        magnitude_a = sum(x * x for x in a) ** 0.5
        magnitude_b = sum(y * y for y in b) ** 0.5
        return dot_product / (magnitude_a * magnitude_b)

    sim_similar = cosine_similarity(emb1, emb2)
    sim_different = cosine_similarity(emb1, emb3)

    # Similar sentences should have higher similarity
    assert sim_similar > sim_different
    assert sim_similar > 0.7  # Reasonable threshold for similar sentences
