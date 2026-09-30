import { aiModeStorage } from './storage';
import { AiModeKnowledgeSource, AiModeKnowledgeType } from '../types';
import { CrawlerAdapter } from '../adapters/crawler-adapter';

export class AiModeKnowledgeService {
  /**
   * Lists all knowledge sources for a workspace.
   */
  public static getSources(workspaceId: string): AiModeKnowledgeSource[] {
    return aiModeStorage.getKnowledgeSources(workspaceId);
  }

  /**
   * Adds a new knowledge source.
   */
  public static async addSource(
    workspaceId: string,
    params: {
      type: AiModeKnowledgeType;
      name: string;
      url?: string;
      file_name?: string;
      file_type?: string;
      file_size?: number;
      content_preview?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<AiModeKnowledgeSource> {
    const id = `aimode_ks_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newSource: AiModeKnowledgeSource = {
      id,
      workspace_id: workspaceId,
      type: params.type,
      name: params.name,
      url: params.url,
      file_name: params.file_name,
      file_type: params.file_type,
      file_size: params.file_size,
      content_preview: params.content_preview,
      status: 'READY',
      document_count: 1,
      product_count: 0,
      last_synced_at: new Date().toISOString(),
      metadata: params.metadata,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    aiModeStorage.addKnowledgeSource(newSource);

    // If it's a URL, trigger background sync
    if (params.type === 'WEBSITE_URL' && params.url) {
      this.syncSource(id, workspaceId).catch(err => {
        console.error('[AI Mode Knowledge] Background sync error:', err);
      });
    }

    return newSource;
  }

  /**
   * Syncs / re-indexes a specific knowledge source.
   */
  public static async syncSource(id: string, workspaceId: string): Promise<AiModeKnowledgeSource | null> {
    const source = aiModeStorage.getKnowledgeSourceById(id, workspaceId);
    if (!source) return null;

    aiModeStorage.updateKnowledgeSource(id, workspaceId, { status: 'SYNCING' });

    try {
      if (source.type === 'WEBSITE_URL' && source.url) {
        const crawled = await CrawlerAdapter.crawlUrl(source.url);
        const updated = aiModeStorage.updateKnowledgeSource(id, workspaceId, {
          status: 'READY',
          product_count: crawled.products.length,
          document_count: 1 + (crawled.headings.length ? 1 : 0),
          last_synced_at: new Date().toISOString(),
          error_message: undefined,
          metadata: {
            headings: crawled.headings,
            faq_count: crawled.faqItems.length,
            extracted_products: crawled.products.map(p => p.title)
          }
        });
        return updated;
      } else {
        // Files / FAQs / Business Info
        const updated = aiModeStorage.updateKnowledgeSource(id, workspaceId, {
          status: 'READY',
          last_synced_at: new Date().toISOString(),
          error_message: undefined
        });
        return updated;
      }
    } catch (e: any) {
      const updated = aiModeStorage.updateKnowledgeSource(id, workspaceId, {
        status: 'FAILED',
        error_message: e.message || 'Sync failed'
      });
      return updated;
    }
  }

  /**
   * Removes a knowledge source.
   */
  public static removeSource(id: string, workspaceId: string): boolean {
    return aiModeStorage.removeKnowledgeSource(id, workspaceId);
  }
}
