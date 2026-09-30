import fs from 'fs';
import path from 'path';
import {
  AiModeConfig,
  AiModeKnowledgeSource,
  AiModeDeployment,
  AiModeConversation
} from '../types';

export interface AiModeStorageSchema {
  configs: Record<string, AiModeConfig>; // workspace_id -> AiModeConfig
  knowledge_sources: AiModeKnowledgeSource[];
  deployments: AiModeDeployment[];
  conversations: AiModeConversation[];
}

const AI_MODE_STORAGE_PATH = process.env.AI_MODE_DATABASE_PATH || path.join(process.cwd(), 'data', 'ai_mode_data.json');

export class AiModeStorageEngine {
  private static instance: AiModeStorageEngine;
  private data: AiModeStorageSchema;
  private saveTimeout: NodeJS.Timeout | null = null;

  private constructor() {
    this.data = this.loadData();
  }

  public static getInstance(): AiModeStorageEngine {
    if (!AiModeStorageEngine.instance) {
      AiModeStorageEngine.instance = new AiModeStorageEngine();
    }
    return AiModeStorageEngine.instance;
  }

  private loadData(): AiModeStorageSchema {
    try {
      const dir = path.dirname(AI_MODE_STORAGE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(AI_MODE_STORAGE_PATH)) {
        const raw = fs.readFileSync(AI_MODE_STORAGE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          configs: parsed.configs || {},
          knowledge_sources: parsed.knowledge_sources || [],
          deployments: parsed.deployments || [],
          conversations: parsed.conversations || []
        };
      }
    } catch (e) {
      console.error('[AI Mode Storage] Error loading storage file, initializing empty schema:', e);
    }

    const initial: AiModeStorageSchema = {
      configs: {},
      knowledge_sources: [],
      deployments: [],
      conversations: []
    };
    this.saveImmediate(initial);
    return initial;
  }

  public saveImmediate(customData?: AiModeStorageSchema): void {
    const toSave = customData || this.data;
    try {
      const dir = path.dirname(AI_MODE_STORAGE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const jsonContent = JSON.stringify(toSave, null, 2);
      fs.writeFileSync(AI_MODE_STORAGE_PATH, jsonContent, 'utf-8');
    } catch (e) {
      console.error('[AI Mode Storage] Error saving AI Mode storage:', e);
    }
  }

  public scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveImmediate();
    }, 150);
  }

  // Configurations
  public getConfig(workspaceId: string): AiModeConfig {
    if (!this.data.configs[workspaceId]) {
      this.data.configs[workspaceId] = {
        enabled: true,
        model: 'gemini-1.5-pro',
        temperature: 0.2,
        confidence_threshold: 0.7,
        system_instructions: 'You are ShopMate AI Mode, an intelligent shopping assistant for this merchant. Answer accurately based on the catalog and store knowledge.',
        enable_comparisons: true,
        enable_recommendations: true,
        enable_cart_actions: true,
        updated_at: new Date().toISOString()
      };
      this.scheduleSave();
    }
    return this.data.configs[workspaceId];
  }

  public updateConfig(workspaceId: string, partial: Partial<AiModeConfig>): AiModeConfig {
    const current = this.getConfig(workspaceId);
    const updated = {
      ...current,
      ...partial,
      updated_at: new Date().toISOString()
    };
    this.data.configs[workspaceId] = updated;
    this.scheduleSave();
    return updated;
  }

  // Knowledge Sources
  public getKnowledgeSources(workspaceId: string): AiModeKnowledgeSource[] {
    return this.data.knowledge_sources.filter(s => s.workspace_id === workspaceId);
  }

  public getKnowledgeSourceById(id: string, workspaceId: string): AiModeKnowledgeSource | undefined {
    return this.data.knowledge_sources.find(s => s.id === id && s.workspace_id === workspaceId);
  }

  public addKnowledgeSource(source: AiModeKnowledgeSource): void {
    this.data.knowledge_sources.push(source);
    this.scheduleSave();
  }

  public updateKnowledgeSource(id: string, workspaceId: string, partial: Partial<AiModeKnowledgeSource>): AiModeKnowledgeSource | null {
    const idx = this.data.knowledge_sources.findIndex(s => s.id === id && s.workspace_id === workspaceId);
    if (idx === -1) return null;
    this.data.knowledge_sources[idx] = {
      ...this.data.knowledge_sources[idx],
      ...partial,
      updated_at: new Date().toISOString()
    };
    this.scheduleSave();
    return this.data.knowledge_sources[idx];
  }

  public removeKnowledgeSource(id: string, workspaceId: string): boolean {
    const initialLen = this.data.knowledge_sources.length;
    this.data.knowledge_sources = this.data.knowledge_sources.filter(
      s => !(s.id === id && s.workspace_id === workspaceId)
    );
    if (this.data.knowledge_sources.length !== initialLen) {
      this.scheduleSave();
      return true;
    }
    return false;
  }

  // Deployments
  public getDeployments(workspaceId: string): AiModeDeployment[] {
    return this.data.deployments.filter(d => d.workspace_id === workspaceId);
  }

  public getDeploymentById(id: string): AiModeDeployment | undefined {
    return this.data.deployments.find(d => d.id === id);
  }

  public saveDeployment(deployment: AiModeDeployment): void {
    const idx = this.data.deployments.findIndex(d => d.id === deployment.id);
    if (idx >= 0) {
      this.data.deployments[idx] = {
        ...deployment,
        updated_at: new Date().toISOString()
      };
    } else {
      this.data.deployments.push(deployment);
    }
    this.scheduleSave();
  }

  public removeDeployment(id: string, workspaceId: string): boolean {
    const initialLen = this.data.deployments.length;
    this.data.deployments = this.data.deployments.filter(
      d => !(d.id === id && d.workspace_id === workspaceId)
    );
    if (this.data.deployments.length !== initialLen) {
      this.scheduleSave();
      return true;
    }
    return false;
  }

  // Conversations
  public getConversation(sessionId: string, workspaceId: string): AiModeConversation | undefined {
    return this.data.conversations.find(c => c.session_id === sessionId && c.workspace_id === workspaceId);
  }

  public saveConversation(conversation: AiModeConversation): void {
    const idx = this.data.conversations.findIndex(
      c => c.session_id === conversation.session_id && c.workspace_id === conversation.workspace_id
    );
    if (idx >= 0) {
      this.data.conversations[idx] = {
        ...conversation,
        updated_at: new Date().toISOString()
      };
    } else {
      this.data.conversations.push(conversation);
    }
    this.scheduleSave();
  }
}

export const aiModeStorage = AiModeStorageEngine.getInstance();
