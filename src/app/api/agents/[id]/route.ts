import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthSession, requireRole } from '@/lib/auth';
import { db } from '@/lib/db';

const updateAgentSchema = z.object({
  agent: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(1000).optional(),
    industry: z.string().max(100).optional(),
    primary_objective: z.string().max(500).optional(),
    language: z.string().max(50).optional(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional()
  }).strict().optional(),
  config: z.object({
    identity: z.object({
      name: z.string().optional(),
      avatar_url: z.string().optional(),
      brand_name: z.string().optional(),
      description: z.string().optional(),
      greeting: z.string().optional(),
      language: z.string().optional()
    }).optional(),
    personality: z.object({
      tone: z.enum(['friendly', 'professional', 'concise', 'detailed', 'persuasive', 'casual']).optional(),
      enthusiasm_level: z.number().min(0).max(100).optional(),
      creativity_level: z.number().min(0).max(100).optional(),
      formality_level: z.number().min(0).max(100).optional(),
      custom_persona_prompt: z.string().optional()
    }).optional(),
    instructions: z.object({
      system_prompt: z.string().optional(),
      custom_rules: z.array(z.string()).optional(),
      anti_injection_rules: z.array(z.string()).optional(),
      fallback_response: z.string().optional()
    }).optional(),
    appearance: z.object({
      theme_preset: z.string().optional(),
      theme_mode: z.string().optional(),
      primary_color: z.string().optional(),
      background_color: z.string().optional(),
      header_background: z.string().optional(),
      border_color: z.string().optional(),
      text_color: z.string().optional(),
      launcher_icon: z.string().optional(),
      launcher_shape: z.string().optional(),
      launcher_text: z.string().optional(),
      logo_url: z.string().optional(),
      logo_background: z.string().optional(),
      bottom_padding: z.string().optional(),
      side_padding: z.string().optional(),
      position: z.enum(['bottom-left', 'bottom-right']).optional(),
      widget_title: z.string().optional(),
      show_branding: z.boolean().optional(),
      custom_css: z.string().optional()
    }).optional(),
    memory: z.object({
      enabled: z.boolean().optional(),
      session_memory: z.boolean().optional(),
      customer_preferences: z.boolean().optional(),
      retention_days: z.number().optional()
    }).optional(),
    starter_questions: z.array(z.string()).optional(),
    capabilities: z.record(z.boolean()).optional(),
    goals: z.array(z.string()).optional()
  }).optional(),
  tool_permissions: z.array(
    z.object({
      tool_id: z.string(),
      is_enabled: z.boolean(),
      permission_mode: z.enum(['ALLOWED', 'REQUIRES_CONFIRMATION', 'DISABLED'])
    }).strict()
  ).optional()
}).strict();

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });

  let agent = db.agents.find(a => a.id === id && a.workspace_id === session.workspaceId);
  if (!agent) {
    agent = db.agents.find(a => a.workspace_id === session.workspaceId);
  }
  if (!agent) {
    const templateAgent = db.agents.find(a => a.id === id) || db.agents[0];
    agent = {
      id: id || 'agent_shopmate_01',
      workspace_id: session.workspaceId,
      name: templateAgent?.name || 'ShopMate AI',
      description: templateAgent?.description || 'Autonomous commerce concierge specialized in product discovery, live inventory queries, order status, and customer assistance.',
      industry: templateAgent?.industry || 'Omnichannel Retail & E-Commerce',
      primary_objective: templateAgent?.primary_objective || 'Boost product conversions and handle order inquiries autonomously with verified tool executions.',
      language: templateAgent?.language || 'English',
      status: 'PUBLISHED' as const,
      current_version_id: 'ver_shopmate_v1_0',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.agents.push(agent);

    const templateConfig = db.agent_configs.find(c => c.agent_id === templateAgent?.id) || db.agent_configs[0];
    if (templateConfig) {
      db.agent_configs.push({
        ...templateConfig,
        id: 'cfg_' + agent.id,
        agent_id: agent.id,
        updated_at: new Date().toISOString()
      });
    }
    db.saveImmediate();
  }

  const config = db.agent_configs.find(c => c.agent_id === agent.id) || db.agent_configs[0];
  const permissions = db.tool_permissions.filter(p => p.agent_id === agent.id);
  const policies = db.agent_policies.filter(p => p.agent_id === agent.id);
  const versions = db.agent_versions.filter(v => v.agent_id === agent.id);
  const deployments = db.deployments.filter(d => d.agent_id === agent.id);

  return NextResponse.json({
    agent,
    config,
    tools: db.tools.map(t => {
      const perm = permissions.find(p => p.tool_id === t.id);
      return {
        ...t,
        is_enabled: perm ? perm.is_enabled : true,
        permission_mode: perm ? perm.permission_mode : (t.risk_level === 'HIGH' ? 'REQUIRES_CONFIRMATION' : 'ALLOWED')
      };
    }),
    policies,
    versions,
    deployments
  });
}

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  if (!requireRole(session, ['OWNER', 'ADMIN'])) {
    return NextResponse.json({ error: { message: 'Forbidden: Admin or Owner role required to update agent' } }, { status: 403 });
  }

  const agent = db.agents.find(a => a.id === id && a.workspace_id === session.workspaceId);
  if (!agent) return NextResponse.json({ error: { message: 'Agent not found' } }, { status: 404 });

  try {
    const rawBody = await req.json();
    let payload = rawBody;
    if (rawBody && !rawBody.agent && !rawBody.config && !rawBody.tool_permissions) {
      payload = {
        agent: {
          name: rawBody.name,
          description: rawBody.description,
          industry: rawBody.industry,
          primary_objective: rawBody.primary_objective,
          language: rawBody.language,
          status: rawBody.status
        },
        config: {
          instructions: rawBody.system_prompt !== undefined || rawBody.prompt !== undefined ? {
            system_prompt: rawBody.system_prompt || rawBody.prompt
          } : undefined,
          personality: rawBody.tone !== undefined || rawBody.temperature !== undefined ? {
            tone: rawBody.tone,
            enthusiasm_level: rawBody.temperature !== undefined ? Math.round(rawBody.temperature * 100) : undefined
          } : undefined
        }
      };
    }
    const parseResult = updateAgentSchema.safeParse(payload);

    if (!parseResult.success) {
      return NextResponse.json({
        error: {
          message: 'Invalid agent update payload. Disallowed fields or invalid types detected.',
          details: parseResult.error.flatten()
        }
      }, { status: 400 });
    }

    const { agent: agentData, config: configData, tool_permissions } = parseResult.data;

    if (agentData) {
      if (agentData.name !== undefined) agent.name = agentData.name;
      if (agentData.description !== undefined) agent.description = agentData.description;
      if (agentData.industry !== undefined) agent.industry = agentData.industry;
      if (agentData.primary_objective !== undefined) agent.primary_objective = agentData.primary_objective;
      if (agentData.language !== undefined) agent.language = agentData.language;
      if (agentData.status !== undefined) agent.status = agentData.status;
      agent.updated_at = new Date().toISOString();
    }

    if (configData) {
      let config = db.agent_configs.find(c => c.agent_id === id);
      if (config) {
        if (configData.identity) config.identity = { ...config.identity, ...configData.identity };
        if (configData.personality) config.personality = { ...config.personality, ...configData.personality };
        if (configData.instructions) config.instructions = { ...config.instructions, ...configData.instructions };
        if (configData.appearance) config.appearance = { ...config.appearance, ...configData.appearance };
        if (configData.memory) config.memory = { ...config.memory, ...configData.memory };
        if (configData.capabilities) config.capabilities = { ...config.capabilities, ...configData.capabilities };
        if (configData.starter_questions) config.starter_questions = configData.starter_questions;
        if (configData.goals) config.goals = configData.goals;
        config.updated_at = new Date().toISOString();
      }
    }

    if (tool_permissions && Array.isArray(tool_permissions)) {
      tool_permissions.forEach((tp) => {
        let perm = db.tool_permissions.find(p => p.agent_id === id && p.tool_id === tp.tool_id);
        if (perm) {
          perm.is_enabled = tp.is_enabled;
          if (tp.permission_mode) perm.permission_mode = tp.permission_mode;
        } else {
          db.tool_permissions.push({
            id: 'perm_' + id + '_' + tp.tool_id,
            agent_id: id,
            tool_id: tp.tool_id,
            is_enabled: tp.is_enabled,
            permission_mode: tp.permission_mode || 'ALLOWED'
          });
        }
      });
    }

    db.saveImmediate();
    return NextResponse.json({ success: true, agent });
  } catch (err: any) {
    return NextResponse.json({ error: { message: err.message || 'Update failed' } }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  return PUT(req, context);
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await getAuthSession(req);
  if (!session) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  if (!requireRole(session, ['OWNER', 'ADMIN'])) {
    return NextResponse.json({ error: { message: 'Forbidden: Admin or Owner role required to delete agent' } }, { status: 403 });
  }

  const index = db.agents.findIndex(a => a.id === id && a.workspace_id === session.workspaceId);
  if (index >= 0) {
    // 1. Remove agent
    db.agents.splice(index, 1);

    // 2. Cascade delete configs, versions, policies, tool_permissions, deployments
    const configs = db.agent_configs;
    for (let i = configs.length - 1; i >= 0; i--) {
      if (configs[i].agent_id === id) configs.splice(i, 1);
    }

    const versions = db.agent_versions;
    for (let i = versions.length - 1; i >= 0; i--) {
      if (versions[i].agent_id === id) versions.splice(i, 1);
    }

    const policies = db.agent_policies;
    for (let i = policies.length - 1; i >= 0; i--) {
      if (policies[i].agent_id === id) policies.splice(i, 1);
    }

    const toolPerms = db.tool_permissions;
    for (let i = toolPerms.length - 1; i >= 0; i--) {
      if (toolPerms[i].agent_id === id) toolPerms.splice(i, 1);
    }

    const deps = db.deployments;
    for (let i = deps.length - 1; i >= 0; i--) {
      if (deps[i].agent_id === id) deps.splice(i, 1);
    }

    // 3. Cascade delete conversations & messages
    const convIdsToDelete = new Set<string>();
    const convs = db.conversations;
    for (let i = convs.length - 1; i >= 0; i--) {
      if (convs[i].agent_id === id) {
        convIdsToDelete.add(convs[i].id);
        convs.splice(i, 1);
      }
    }

    if (convIdsToDelete.size > 0) {
      const msgs = db.messages;
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (convIdsToDelete.has(msgs[i].conversation_id)) msgs.splice(i, 1);
      }

      const traces = db.executions;
      for (let i = traces.length - 1; i >= 0; i--) {
        if (convIdsToDelete.has(traces[i].conversation_id)) traces.splice(i, 1);
      }
    }

    db.saveImmediate();
    return NextResponse.json({ success: true, message: `Agent ${id} and all cascaded resources deleted successfully.` });
  }
  return NextResponse.json({ error: { message: 'Agent not found' } }, { status: 404 });
}


