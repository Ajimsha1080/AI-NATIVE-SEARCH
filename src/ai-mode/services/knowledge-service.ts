import { AIModeKnowledgeSource } from '../types';
import { aiModeStorage } from './storage';
import { AIModeCrawlerAdapter } from '../adapters/crawler-adapter';
import { generateId } from '@/lib/utils';

export class AIModeKnowledgeService {
  public static getSources(workspaceId: string): AIModeKnowledgeSource[] {
    return aiModeStorage.getKnowledgeSources(workspaceId);
  }

  public static async addWebsiteSource(params: {
    workspaceId: string;
    url: string;
    name?: string;
  }): Promise<AIModeKnowledgeSource> {
    const sourceId = `aim_ks_${generateId('web')}`;
    const newSource: AIModeKnowledgeSource = {
      id: sourceId,
      workspace_id: params.workspaceId,
      name: params.name || params.url,
      type: 'WEBSITE',
      source_url: params.url,
      status: 'INDEXING',
      document_count: 0,
      product_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    aiModeStorage.addKnowledgeSource(newSource);

    // Run crawl
    const crawlResult = await AIModeCrawlerAdapter.crawlWebsite(params.url);
    if (crawlResult.status === 'SUCCESS') {
      aiModeStorage.updateKnowledgeSource(sourceId, {
        status: 'INDEXED',
        name: params.name || crawlResult.title || params.url,
        document_count: crawlResult.policyChunks.length,
        product_count: crawlResult.extractedProducts.length,
        last_synced_at: new Date().toISOString(),
        raw_content: crawlResult.textContent.substring(0, 5000),
        metadata: {
          policy_count: crawlResult.policyChunks.length,
          extracted_products_count: crawlResult.extractedProducts.length
        }
      });
    } else {
      aiModeStorage.updateKnowledgeSource(sourceId, {
        status: 'ERROR',
        error_message: crawlResult.errorMessage || 'Failed to crawl website'
      });
    }

    return aiModeStorage.getKnowledgeSources(params.workspaceId).find(s => s.id === sourceId) || newSource;
  }

  public static addDocumentSource(params: {
    workspaceId: string;
    name: string;
    content: string;
    type?: 'DOCUMENT' | 'FAQ' | 'CSV';
  }): AIModeKnowledgeSource {
    const sourceId = `aim_ks_${generateId('doc')}`;
    const newSource: AIModeKnowledgeSource = {
      id: sourceId,
      workspace_id: params.workspaceId,
      name: params.name,
      type: params.type || 'DOCUMENT',
      status: 'INDEXED',
      document_count: 1,
      product_count: 0,
      raw_content: params.content,
      last_synced_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    aiModeStorage.addKnowledgeSource(newSource);
    return newSource;
  }

  public static async syncSource(id: string): Promise<AIModeKnowledgeSource | null> {
    const allSources = aiModeStorage.getKnowledgeSources('');
    const source = allSources.find(s => s.id === id);
    if (!source) return null;

    if (source.type === 'WEBSITE' && source.source_url) {
      aiModeStorage.updateKnowledgeSource(id, { status: 'INDEXING' });
      const crawl = await AIModeCrawlerAdapter.crawlWebsite(source.source_url);
      if (crawl.status === 'SUCCESS') {
        return aiModeStorage.updateKnowledgeSource(id, {
          status: 'INDEXED',
          document_count: crawl.policyChunks.length,
          product_count: crawl.extractedProducts.length,
          last_synced_at: new Date().toISOString(),
          raw_content: crawl.textContent.substring(0, 5000)
        });
      } else {
        return aiModeStorage.updateKnowledgeSource(id, {
          status: 'ERROR',
          error_message: crawl.errorMessage || 'Re-sync failed'
        });
      }
    }

    return aiModeStorage.updateKnowledgeSource(id, {
      status: 'INDEXED',
      last_synced_at: new Date().toISOString()
    });
  }

  public static deleteSource(id: string): boolean {
    return aiModeStorage.deleteKnowledgeSource(id);
  }
}
