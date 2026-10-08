-- ==============================================================================
-- SHOPMATE AAAS - POSTGRESQL ROW-LEVEL SECURITY (RLS) POLICIES
-- Multi-Tenant Data Isolation Enforcement Script
-- Run on PostgreSQL production cluster
-- ==============================================================================

-- 1. Enable Row Level Security on all tenant-owned tables
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_mode_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 2. Define Tenant Isolation Policies using current_setting('app.current_workspace_id', true)
-- Superadmins bypass tenant isolation when app.is_super_admin = 'true'

CREATE OR REPLACE FUNCTION app_current_tenant() RETURNS text AS $$
BEGIN
    RETURN current_setting('app.current_workspace_id', true);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION app_is_super_admin() RETURNS boolean AS $$
BEGIN
    RETURN COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true';
END;
$$ LANGUAGE plpgsql STABLE;

-- Workspaces Policy
CREATE POLICY tenant_isolation_workspaces ON workspaces
    FOR ALL
    USING (id = app_current_tenant() OR app_is_super_admin());

-- Workspace Members Policy
CREATE POLICY tenant_isolation_workspace_members ON workspace_members
    FOR ALL
    USING (workspace_id = app_current_tenant() OR app_is_super_admin());

-- Agents Policy
CREATE POLICY tenant_isolation_agents ON agents
    FOR ALL
    USING (workspace_id = app_current_tenant() OR app_is_super_admin());

-- Knowledge Sources Policy
CREATE POLICY tenant_isolation_knowledge_sources ON knowledge_sources
    FOR ALL
    USING (workspace_id = app_current_tenant() OR app_is_super_admin());

-- Knowledge Chunks Policy
CREATE POLICY tenant_isolation_knowledge_chunks ON knowledge_chunks
    FOR ALL
    USING (workspace_id = app_current_tenant() OR app_is_super_admin());

-- Commerce Products Policy
CREATE POLICY tenant_isolation_commerce_products ON commerce_products
    FOR ALL
    USING (workspace_id = app_current_tenant() OR app_is_super_admin());

-- Commerce Orders Policy
CREATE POLICY tenant_isolation_commerce_orders ON commerce_orders
    FOR ALL
    USING (workspace_id = app_current_tenant() OR app_is_super_admin());

-- Deployments Policy
CREATE POLICY tenant_isolation_deployments ON deployments
    FOR ALL
    USING (workspace_id = app_current_tenant() OR app_is_super_admin());

-- AI Mode Configs Policy
CREATE POLICY tenant_isolation_ai_mode_configs ON ai_mode_configs
    FOR ALL
    USING (workspace_id = app_current_tenant() OR app_is_super_admin());

-- Audit Logs Policy
CREATE POLICY tenant_isolation_audit_logs ON audit_logs
    FOR ALL
    USING (workspace_id = app_current_tenant() OR app_is_super_admin());
