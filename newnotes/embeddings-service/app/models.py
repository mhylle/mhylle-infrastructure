"""
Sentence Transformers wrapper for embedding generation
"""
from sentence_transformers import SentenceTransformer
import torch
from typing import List
import logging

logger = logging.getLogger(__name__)


class EmbeddingModel:
    """Wrapper for Sentence Transformers with GPU support"""

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        logger.info(f"Loading model {model_name} on device {self.device}")
        self.model = SentenceTransformer(model_name, device=self.device)
        logger.info(f"Model loaded successfully. Embedding dimension: {self.model.get_sentence_embedding_dimension()}")

    def generate_embedding(self, text: str) -> List[float]:
        """
        Generate embedding for a single text

        Args:
            text: Input text to embed

        Returns:
            List of floats representing the embedding vector
        """
        embedding = self.model.encode(text, convert_to_numpy=True)
        return embedding.tolist()

    def generate_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for multiple texts

        Args:
            texts: List of input texts to embed

        Returns:
            List of embedding vectors
        """
        embeddings = self.model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
        return [emb.tolist() for emb in embeddings]

    def get_dimension(self) -> int:
        """Get the embedding dimension"""
        return self.model.get_sentence_embedding_dimension()


# Global model instance (lazy loaded)
_model_instance = None


def get_model() -> EmbeddingModel:
    """Get or create the global model instance"""
    global _model_instance
    if _model_instance is None:
        _model_instance = EmbeddingModel()
    return _model_instance
