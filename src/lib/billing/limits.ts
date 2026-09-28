import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateId } from '@/lib/utils';
import { UsageEvent } from '@/types';

export interface PlanLimitConfig {
  messages: number;
  chunks: number;
  agents: number;
}

export const PLAN_LIMITS: Record<string, PlanLimitConfig> = {
  'FREE': { messages: 500, chunks: 50, agents: 1 },
  'STARTER': { messages: 5000, chunks: 1000, agents: 3 },
  'GROWTH': { messages: 50000, chunks: 5000, agents: 15 },
  'BUSINESS': { messages: 150000, chunks: 20000, agents: 50 },
  'ENTERPRISE': { messages: 500000, chunks: 50000, agents: 100 }
};

export function getWorkspaceLimits(workspaceId: string): { plan: string; limits: PlanLimitConfig } {
  const ws = db.workspaces.find(w => w.id === workspaceId);
  const plan = (ws?.plan || 'GROWTH').toUpperCase();
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS['GROWTH'];
  return { plan, limits };
}

export function getWorkspaceUsage(workspaceId: string) {
  const { plan, limits } = getWorkspaceLimits(workspaceId);

  // Use usage_events or count directly from live database tables
  const messageEvents = db.usage_events.filter(e => e.workspace_id === workspaceId && e.event_type === 'MESSAGE');
  const rawMessagesCount = db.messages.filter(m => m.workspace_id === workspaceId).length;
  const messageCount = rawMessagesCount + messageEvents.reduce((acc, cur) => acc + (cur.quantity || 1), 0);

  const chunkEvents = db.usage_events.filter(e => e.workspace_id === workspaceId && e.event_type === 'CHUNK_EMBED');
  const rawChunksCount = db.knowledge_chunks.filter(c => c.workspace_id === workspaceId).length;
  const chunkCount = rawChunksCount + chunkEvents.reduce((acc, cur) => acc + (cur.quantity || 1), 0);

  const rawAgentsCount = db.agents.filter(a => a.workspace_id === workspaceId && a.status !== 'ARCHIVED').length;
  const agentCount = rawAgentsCount;

  return {
    plan,
    usage: {
      messages: {
        used: messageCount,
        limit: limits.messages,
        percentage: Math.min(100, Math.round((messageCount / limits.messages) * 100))
      },
      chunks: {
        used: chunkCount,
        limit: limits.chunks,
        percentage: Math.min(100, Math.round((chunkCount / limits.chunks) * 100))
      },
      agents: {
        used: agentCount,
        limit: limits.agents,
        percentage: Math.min(100, Math.round((agentCount / limits.agents) * 100))
      }
    }
  };
}

export function recordUsage(workspaceId: string, eventType: UsageEvent['event_type'], quantity: number = 1, metadata?: Record<string, any>) {
  db.usage_events.push({
    id: generateId('use'),
    workspace_id: workspaceId,
    event_type: eventType,
    quantity,
    metadata,
    created_at: new Date().toISOString()
  });
  db.scheduleSave();
}

export function enforceQuota(
  workspaceId: string, 
  resourceType: 'messages' | 'chunks' | 'agents', 
  additionalCount: number = 1
): { allowed: boolean; response?: NextResponse } {
  const { plan, limits } = getWorkspaceLimits(workspaceId);
  const usage = getWorkspaceUsage(workspaceId);
  const current = usage.usage[resourceType].used;
  const limit = limits[resourceType];

  if (current + additionalCount > limit) {
    return {
      allowed: false,
      response: NextResponse.json({
        error: {
          code: 'PAYMENT_REQUIRED',
          message: `Workspace quota exceeded for ${resourceType}. Current usage: ${current}/${limit}. Please upgrade your plan.`,
          resource: resourceType,
          current,
          limit,
          plan,
          upgrade_url: '/billing'
        }
      }, { status: 402 })
    };
  }

  return { allowed: true };
}
