import fs from 'fs';
import path from 'path';
import { AIModeConfig, AIModeKnowledgeSource, AIModeDeployment, AIModeConversation } from '../types';

interface AIModeStorageSchema {
  configs: AIModeConfig[];
  knowledge_sources: AIModeKnowledgeSource[];
  deployments: AIModeDeployment[];
  conversations: AIModeConversation[];
}

const STORAGE_PATH = path.join(process.cwd(), 'data', 'ai_mode_data.json');

export class AIModeStorage {
  private static instance: AIModeStorage;
  private data: AIModeStorageSchema;

  private constructor() {
    this.data = this.load();
  }

  public static getInstance(): AIModeStorage {
    if (!AIModeStorage.instance) {
      AIModeStorage.instance = new AIModeStorage();
    }
    return AIModeStorage.instance;
  }

  private load(): AIModeStorageSchema {
    try {
      const dir = path.dirname(STORAGE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(STORAGE_PATH)) {
        const raw = fs.readFileSync(STORAGE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          configs: parsed.configs || [],
          knowledge_sources: parsed.knowledge_sources || [],
          deployments: parsed.deployments || [],
          conversations: parsed.conversations || [],
        };
      }
    } catch (e) {
      console.warn('AI Mode: initializing fresh storage schema');
    }

    return {
      configs: [],
      knowledge_sources: [],
      deployments: [],
      conversations: [],
    };
  }

  public save(): void {
    try {
      const dir = path.dirname(STORAGE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(STORAGE_PATH, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('AI Mode storage save error:', e);
    }
  }

  // --- Configs ---
  public getConfig(workspaceId: string): AIModeConfig {
    let cfg = this.data.configs.find(c => c.workspace_id === workspaceId);
    if (!cfg) {
      cfg = {
        id: `aimode_cfg_${workspaceId}`,
        workspace_id: workspaceId,
        enabled: true,
        model_provider: 'sarvam',
        model_name: 'sarvam-105b-conversations',
        temperature: 0.3,
        retrieval_threshold: 0.25,
        max_search_results: 6,
        enable_recommendations: true,
        enable_comparisons: true,
        enable_cart_actions: true,
        system_instructions: 'You are an AI Mode shopping assistant specialized in product discovery, recommendations, comparisons, and verified merchant catalog advice.',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.data.configs.push(cfg);
      this.save();
    }
    return cfg;
  }

  public updateConfig(workspaceId: string, updates: Partial<AIModeConfig>): AIModeConfig {
    const cfg = this.getConfig(workspaceId);
    Object.assign(cfg, updates, { updated_at: new Date().toISOString() });
    this.save();
    return cfg;
  }

  // --- Knowledge Sources ---
  public getKnowledgeSources(workspaceId?: string): AIModeKnowledgeSource[] {
    if (!workspaceId) return this.data.knowledge_sources;
    return this.data.knowledge_sources.filter(k => k.workspace_id === workspaceId);
  }

  public getKnowledgeSourceById(id: string): AIModeKnowledgeSource | null {
    return this.data.knowledge_sources.find(k => k.id === id) || null;
  }

  public addKnowledgeSource(source: AIModeKnowledgeSource): void {
    this.data.knowledge_sources.push(source);
    this.save();
  }

  public updateKnowledgeSource(id: string, updates: Partial<AIModeKnowledgeSource>): AIModeKnowledgeSource | null {
    const item = this.data.knowledge_sources.find(k => k.id === id);
    if (item) {
      Object.assign(item, updates, { updated_at: new Date().toISOString() });
      this.save();
      return item;
    }
    return null;
  }

  public deleteKnowledgeSource(id: string): boolean {
    const initLen = this.data.knowledge_sources.length;
    this.data.knowledge_sources = this.data.knowledge_sources.filter(k => k.id !== id);
    const changed = this.data.knowledge_sources.length !== initLen;
    if (changed) this.save();
    return changed;
  }

  // --- Deployments ---
  public getDeployments(workspaceId: string): AIModeDeployment[] {
    let deps = this.data.deployments.filter(d => d.workspace_id === workspaceId);
    if (deps.length === 0) {
      const defaultDep: AIModeDeployment = {
        id: `aim_dep_${workspaceId.replace(/[^a-zA-Z0-9]/g, '_')}_01`,
        workspace_id: workspaceId,
        name: 'Storefront AI Mode Widget',
        status: 'LIVE',
        allowed_domains: ['*'],
        theme: {
          primary_color: '#09090b',
          background_color: '#ffffff',
          text_color: '#09090b',
          border_radius: 'lg',
          font_family: 'Inter, system-ui, sans-serif'
        },
        branding: {
          title: 'AI Shopping Mode',
          subtitle: 'Instant recommendations & product search',
          welcome_message: 'Hi there! 👋 I am in AI Mode. Ask me to find products, compare styles, or recommend items for any occasion.',
          suggested_prompts: [
            'Find formal shirts under ₹2000',
            'Recommend a summer outfit',
            'Compare top rated items'
          ],
          position: 'bottom-right'
        },
        embed_code: `<script src="/api/ai-mode/widget/aim_dep_${workspaceId.replace(/[^a-zA-Z0-9]/g, '_')}_01/script.js" async defer></script>`,
        total_conversations: 0,
        total_product_clicks: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.data.deployments.push(defaultDep);
      this.save();
      return [defaultDep];
    }
    return deps;
  }

  public getDeploymentById(id: string): AIModeDeployment | null {
    return this.data.deployments.find(d => d.id === id) || null;
  }

  public addDeployment(dep: AIModeDeployment): void {
    this.data.deployments.push(dep);
    this.save();
  }

  public updateDeployment(id: string, updates: Partial<AIModeDeployment>): AIModeDeployment | null {
    let dep = this.data.deployments.find(d => d.id === id);
    if (dep) {
      Object.assign(dep, updates, { updated_at: new Date().toISOString() });
      this.save();
      return dep;
    }
    return null;
  }

  public deleteDeployment(id: string): boolean {
    const initLen = this.data.deployments.length;
    this.data.deployments = this.data.deployments.filter(d => d.id !== id);
    const changed = this.data.deployments.length !== initLen;
    if (changed) this.save();
    return changed;
  }

  // --- Conversations ---
  public getConversation(id: string): AIModeConversation | null {
    return this.data.conversations.find(c => c.id === id) || null;
  }

  public saveConversation(conv: AIModeConversation): void {
    const idx = this.data.conversations.findIndex(c => c.id === conv.id);
    if (idx >= 0) {
      this.data.conversations[idx] = conv;
    } else {
      this.data.conversations.push(conv);
    }
    this.save();
  }
}

export const aiModeStorage = AIModeStorage.getInstance();
