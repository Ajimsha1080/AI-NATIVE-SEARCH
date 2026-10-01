import { generateEmbedding, cosineSimilarity } from '@/lib/rag';

export class AIModeEmbeddingsAdapter {
  public static generateVector(text: string): number[] {
    return generateEmbedding(text);
  }

  public static calculateSimilarity(vectorA: number[], vectorB: number[]): number {
    return cosineSimilarity(vectorA, vectorB);
  }
}
