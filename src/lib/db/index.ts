import fs from 'fs';
import path from 'path';
import {
  User,
  Workspace,
  WorkspaceMember,
  Agent,
  AgentConfig,
  AgentVersion,
  AgentPolicy,
  KnowledgeSource,
  KnowledgeDocument,
  KnowledgeChunk,
  CommerceProduct,
  CommerceOrder,
  CommerceCart,
  Integration,
  Tool,
  ToolPermission,
  Conversation,
  Message,
  ExecutionTrace,
  Deployment,
  ApiKey,
  Webhook,
  WebhookDelivery,
  EvaluationCase,
  EvaluationRun,
  AuditLog,
  UsageEvent,
  ProcessedWebhookEvent,
  WorkspaceIntegration,
  IntegrationSyncJob
} from '@/types';

export interface DatabaseSchema {
  users: User[];
  workspaces: Workspace[];
  workspace_members: WorkspaceMember[];
  agents: Agent[];
  agent_configs: AgentConfig[];
  agent_versions: AgentVersion[];
  agent_policies: AgentPolicy[];
  knowledge_sources: KnowledgeSource[];
  knowledge_documents: KnowledgeDocument[];
  knowledge_chunks: KnowledgeChunk[];
  commerce_products: CommerceProduct[];
  commerce_orders: CommerceOrder[];
  commerce_carts: CommerceCart[];
  integrations: Integration[];
  tools: Tool[];
  tool_permissions: ToolPermission[];
  conversations: Conversation[];
  messages: Message[];
  executions: ExecutionTrace[];
  deployments: Deployment[];
  api_keys: ApiKey[];
  webhooks: Webhook[];
  webhook_deliveries: WebhookDelivery[];
  evaluation_cases: EvaluationCase[];
  evaluation_runs: EvaluationRun[];
  audit_logs: AuditLog[];
  usage_events: UsageEvent[];
  processed_webhook_events: ProcessedWebhookEvent[];
  workspace_integrations: WorkspaceIntegration[];
  integration_sync_jobs: IntegrationSyncJob[];
}

const DB_FILE_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'aaas.db.json');

class DatabaseEngine {
  private static instance: DatabaseEngine;
  private data: DatabaseSchema;
  private saveTimeout: NodeJS.Timeout | null = null;

  private constructor() {
    this.data = this.loadDatabase();
  }

  public static getInstance(): DatabaseEngine {
    if (!DatabaseEngine.instance) {
      DatabaseEngine.instance = new DatabaseEngine();
    }
    return DatabaseEngine.instance;
  }

  private loadDatabase(): DatabaseSchema {
    try {
      const dir = path.dirname(DB_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(DB_FILE_PATH)) {
        const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        parsed.usage_events = parsed.usage_events || [];
        parsed.processed_webhook_events = parsed.processed_webhook_events || [];
        parsed.workspace_integrations = parsed.workspace_integrations || [];
        parsed.integration_sync_jobs = parsed.integration_sync_jobs || [];
        if (parsed.users !== undefined && parsed.workspaces !== undefined) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading database file, initializing empty schema:', e);
    }

    const initialSchema: DatabaseSchema = {
      users: [],
      workspaces: [],
      workspace_members: [],
      agents: [],
      agent_configs: [],
      agent_versions: [],
      agent_policies: [],
      knowledge_sources: [],
      knowledge_documents: [],
      knowledge_chunks: [],
      commerce_products: [],
      commerce_orders: [],
      commerce_carts: [],
      integrations: [],
      tools: [],
      tool_permissions: [],
      conversations: [],
      messages: [],
      executions: [],
      deployments: [],
      api_keys: [],
      webhooks: [],
      webhook_deliveries: [],
      evaluation_cases: [],
      evaluation_runs: [],
      audit_logs: [],
      usage_events: [],
      processed_webhook_events: [],
      workspace_integrations: [],
      integration_sync_jobs: []
    };

    this.saveImmediate(initialSchema);
    return initialSchema;
  }

  public saveImmediate(customData?: DatabaseSchema): void {
    const toSave = customData || this.data;
    try {
      const dir = path.dirname(DB_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const jsonContent = JSON.stringify(toSave, null, 2);
      try {
        fs.writeFileSync(DB_FILE_PATH, jsonContent, 'utf-8');
      } catch (e: any) {
        // Fallback with retry
        const tempPath = DB_FILE_PATH + '.tmp.' + Math.random().toString(36).substring(2, 8);
        fs.writeFileSync(tempPath, jsonContent, 'utf-8');
        try {
          fs.renameSync(tempPath, DB_FILE_PATH);
        } catch {
          fs.writeFileSync(DB_FILE_PATH, jsonContent, 'utf-8');
        }
      }
    } catch (e) {
      console.error('Error saving database:', e);
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

  public get users() { return this.data.users; }
  public get workspaces() { return this.data.workspaces; }
  public get workspace_members() { return this.data.workspace_members; }
  public get agents() { return this.data.agents; }
  public get agent_configs() { return this.data.agent_configs; }
  public get agent_versions() { return this.data.agent_versions; }
  public get agent_policies() { return this.data.agent_policies; }
  public get knowledge_sources() { return this.data.knowledge_sources; }
  public get knowledge_documents() { return this.data.knowledge_documents; }
  public get knowledge_chunks() { return this.data.knowledge_chunks; }
  public get commerce_products() { return this.data.commerce_products; }
  public get commerce_orders() { return this.data.commerce_orders; }
  public get commerce_carts() { return this.data.commerce_carts; }
  public get integrations() { return this.data.integrations; }
  public get tools() { return this.data.tools; }
  public get tool_permissions() { return this.data.tool_permissions; }
  public get conversations() { return this.data.conversations; }
  public get messages() { return this.data.messages; }
  public get executions() { return this.data.executions; }
  public get deployments() { return this.data.deployments; }
  public get api_keys() { return this.data.api_keys; }
  public get webhooks() { return this.data.webhooks; }
  public get webhook_deliveries() { return this.data.webhook_deliveries; }
  public get evaluation_cases() { return this.data.evaluation_cases; }
  public get evaluation_runs() { return this.data.evaluation_runs; }
  public get audit_logs() { return this.data.audit_logs; }
  public get usage_events() { return this.data.usage_events; }
  public get processed_webhook_events() { return this.data.processed_webhook_events; }
  public get workspace_integrations() { return this.data.workspace_integrations; }
  public get integration_sync_jobs() { return this.data.integration_sync_jobs; }
}

export const db = DatabaseEngine.getInstance();
export function getDatabase() { return DatabaseEngine.getInstance(); }
