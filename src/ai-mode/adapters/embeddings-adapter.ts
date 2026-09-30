import { generateEmbedding, cosineSimilarity } from '@/lib/rag';

export class EmbeddingsAdapter {
  /**
   * Generates a 128-dim dense embedding for semantic vector search.
   */
  public static async generateEmbedding(text: string): Promise<number[]> {
    return generateEmbedding(text);
  }

  /**
   * Computes cosine similarity between two dense embedding vectors.
   */
  public static cosineSimilarity(a: number[], b: number[]): number {
    return cosineSimilarity(a, b);
  }
}
