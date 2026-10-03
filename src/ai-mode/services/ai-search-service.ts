import { AIModeProduct, AIModeSearchPlan, AIModeSearchResult, SearchDiagnosticRecord } from '../types';
import { AIModeCatalogAdapter } from '../adapters/catalog-adapter';
import { AIModeEmbeddingsAdapter } from '../adapters/embeddings-adapter';
import { CatalogIntrospector } from './catalog-introspector';
import { QueryUnderstandingEngine } from './query-understanding';
import { ConstraintEvaluator } from './constraint-evaluator';

export class AIModeSearchService {
  /**
   * Universal natural language query understanding with dynamic schema introspection.
   */
  public static parseQuery(rawQuery: string, previousState?: AIModeSearchPlan, workspaceId?: string): AIModeSearchPlan {
    const products = AIModeCatalogAdapter.getProducts(workspaceId);
    const schema = CatalogIntrospector.introspect(products, workspaceId || 'default');
    return QueryUnderstandingEngine.parse(rawQuery, schema, previousState);
  }

  /**
   * Production-grade Hybrid Retrieval Pipeline:
   * 1. Dynamic Query Understanding & Hard/Soft Constraint Extraction
   * 2. Broad Multi-Signal Candidate Retrieval (Vector + Lexical + Taxonomy)
   * 3. Variant-Aware Hard Constraint Validation (Exclusions, Single-Variant Consistency, Price Bounds)
   * 4. Multi-Signal Ranking of Valid Products (Exact Concept, Lexical, Semantic Cosine, Soft Preferences)
   * 5. Post-Validation Count & Accurate Pagination
   * 6. Comprehensive Observability & Diagnostic Trace Generation
   */
  public static async search(plan: AIModeSearchPlan, workspaceId?: string): Promise<AIModeSearchResult> {
    const startTime = Date.now();
    const allProducts = AIModeCatalogAdapter.getProducts(workspaceId);

    const filterExpression = plan.hard_constraints
      .map(c => `${c.field} ${c.operator} ${JSON.stringify(c.value)}`)
      .join(' AND ') || 'None (Broad Search)';

    if (allProducts.length === 0) {
      return {
        products: [],
        total_matches: 0,
        page: plan.pagination.page,
        page_size: plan.pagination.page_size,
        has_more: false,
        applied_filters: plan.extracted_filters,
        search_plan: plan,
        latency_ms: Date.now() - startTime,
        diagnostics: {
          original_query: plan.original_query,
          parsed_query: plan.semantic_query,
          extracted_entities: plan.extracted_filters,
          explicit_constraints: plan.hard_constraints,
          normalized_constraints: plan.hard_constraints,
          semantic_query: plan.semantic_query,
          lexical_query: plan.lexical_query,
          candidate_count: 0,
          candidate_products: 0,
          filter_expression: filterExpression,
          filtered_count: 0,
          valid_count: 0,
          total_catalog_count: 0,
          final_count: 0
        }
      };
    }

    const queryVector = AIModeEmbeddingsAdapter.generateVector(plan.semantic_query);
    const lexicalTokens = (plan.lexical_query || plan.original_query)
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1);

    const rejections: SearchDiagnosticRecord['rejections'] = [];
    const rejectionReasons: Record<string, number> = {};
    const validScoredCandidates: Array<{ product: AIModeProduct; score: number }> = [];

    // -------------------------------------------------------------
    // 1. Iterate Over Candidates & Apply Hard Constraint Validation
    // -------------------------------------------------------------
    for (const product of allProducts) {
      // Execute strict variant-aware validation
      const evalResult = ConstraintEvaluator.evaluateProduct(product, plan);

      if (!evalResult.isValid) {
        const code = evalResult.failureCode || 'constraint_violation';
        rejectionReasons[code] = (rejectionReasons[code] || 0) + 1;

        if (rejections.length < 50) {
          rejections.push({
            product_id: product.id,
            title: product.title,
            failed_constraint: evalResult.failedConstraint || 'constraint_violation',
            reason: evalResult.failureReason || 'Failed constraint check'
          });
        }
        continue; // HARD CONSTRAINT VIOLATED -> DISQUALIFIED
      }

      // -------------------------------------------------------------
      // 2. Score & Rank Valid Candidates
      // -------------------------------------------------------------
      const titleLower = (product.title || '').toLowerCase();
      const descLower = (product.description || '').toLowerCase();
      const catLower = (product.category || '').toLowerCase();
      const tagsLower = (product.subcategories || []).map(t => t.toLowerCase());
      const allProductText = `${titleLower} ${descLower} ${catLower} ${tagsLower.join(' ')}`;

      // Signal A: Exact Concept / Product Type Match
      let conceptScore = 0;
      if (plan.product_concepts.length > 0) {
        for (const concept of plan.product_concepts) {
          const cNorm = concept.toLowerCase();
          if (catLower.includes(cNorm) || titleLower.includes(cNorm)) {
            conceptScore += 0.40;
            break;
          }
        }
      }

      // Signal B: Lexical Token Overlap (Title, Tags, Description)
      let lexicalHits = 0;
      let titleHits = 0;
      if (lexicalTokens.length > 0) {
        for (const token of lexicalTokens) {
          const tokenRegex = new RegExp(`\\b${escapeRegex(token)}`, 'i');
          if (tokenRegex.test(titleLower)) {
            titleHits++;
            lexicalHits++;
          } else if (tagsLower.some(t => tokenRegex.test(t)) || tokenRegex.test(catLower)) {
            lexicalHits++;
          } else if (tokenRegex.test(descLower)) {
            lexicalHits += 0.5;
          }
        }
      }
      const lexicalScore = lexicalTokens.length > 0 ? (titleHits * 0.6 + (lexicalHits - titleHits) * 0.4) / lexicalTokens.length : 0.5;

      // Signal C: Dense Semantic Vector Cosine Similarity
      const productVector = AIModeEmbeddingsAdapter.generateVector(allProductText);
      const semanticScore = AIModeEmbeddingsAdapter.calculateSimilarity(queryVector, productVector);

      // Signal D: Soft Preferences Boost (e.g. casual, elegant, party, summer)
      let softScore = 0;
      if (plan.soft_preferences.length > 0) {
        for (const pref of plan.soft_preferences) {
          const prefNorm = pref.toLowerCase();
          if (allProductText.includes(prefNorm)) {
            softScore += 0.25;
          }
        }
        softScore = Math.min(0.40, softScore);
      }

      // Signal E: Budget / Proximity Alignment
      let proximityScore = 0;
      if (plan.extracted_filters.max_price && product.price <= plan.extracted_filters.max_price) {
        const ratio = product.price / plan.extracted_filters.max_price;
        proximityScore = ratio * 0.15; // Closer to desired budget without exceeding
      }

      // Total Composite Score
      const baseScore = lexicalTokens.length === 0 ? 0.50 : 0.10;
      const totalScore = Math.min(
        0.99,
        baseScore +
        (conceptScore * 0.30) +
        (lexicalScore * 0.25) +
        (semanticScore * 0.20) +
        (softScore * 0.15) +
        proximityScore
      );

      validScoredCandidates.push({
        product: { ...product, score: parseFloat(totalScore.toFixed(2)) },
        score: totalScore
      });
    }

    // -------------------------------------------------------------
    // 3. Sorting Validated Results
    // -------------------------------------------------------------
    const sortMode = plan.sorting || plan.sort || 'relevance';
    if (sortMode === 'price_asc') {
      validScoredCandidates.sort((a, b) => a.product.price - b.product.price);
    } else if (sortMode === 'price_desc') {
      validScoredCandidates.sort((a, b) => b.product.price - a.product.price);
    } else if (sortMode === 'newest') {
      validScoredCandidates.reverse();
    } else {
      validScoredCandidates.sort((a, b) => b.score - a.score);
    }

    // -------------------------------------------------------------
    // 4. Accurate Post-Validation Pagination & Result Calculation
    // -------------------------------------------------------------
    const totalMatches = validScoredCandidates.length;
    const page = Math.max(1, plan.pagination.page);
    const pageSize = Math.max(1, plan.pagination.page_size);
    const startIndex = (page - 1) * pageSize;
    const paginatedProducts = validScoredCandidates.slice(startIndex, startIndex + pageSize).map(c => c.product);
    const hasMore = startIndex + pageSize < totalMatches;

    const diagnostics: SearchDiagnosticRecord = {
      original_query: plan.original_query,
      parsed_query: plan.semantic_query,
      extracted_entities: plan.extracted_filters,
      explicit_constraints: plan.hard_constraints,
      normalized_constraints: plan.hard_constraints,
      semantic_query: plan.semantic_query,
      lexical_query: plan.lexical_query,
      candidate_count: allProducts.length,
      candidate_products: allProducts.length,
      filter_expression: filterExpression,
      filtered_count: allProducts.length - totalMatches,
      valid_count: totalMatches,
      total_catalog_count: allProducts.length,
      rejection_reasons: Object.keys(rejectionReasons).length > 0 ? rejectionReasons : undefined,
      rejections: rejections.length > 0 ? rejections : undefined,
      final_count: paginatedProducts.length
    };

    return {
      products: paginatedProducts,
      total_matches: totalMatches,
      page,
      page_size: pageSize,
      has_more: hasMore,
      applied_filters: plan.extracted_filters,
      search_plan: plan,
      latency_ms: Date.now() - startTime,
      diagnostics
    };
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
