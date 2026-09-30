import { aiModeStorage } from './storage';
import { AiModeDeployment } from '../types';

export class AiModeDeploymentService {
  /**
   * Retrieves all AI Mode deployments for a workspace.
   */
  public static getDeployments(workspaceId: string): AiModeDeployment[] {
    let deployments = aiModeStorage.getDeployments(workspaceId);
    if (deployments.length === 0) {
      // Create initial default deployment if none exists
      const defaultDep: AiModeDeployment = {
        id: `aimode_dep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        workspace_id: workspaceId,
        name: 'Production AI Mode Widget',
        status: 'LIVE',
        allowed_domains: ['*'],
        theme: {
          primary_color: '#4f46e5',
          theme_mode: 'light',
          position: 'bottom-right',
          launcher_style: 'bubble',
          launcher_text: 'Shop with AI',
          widget_title: 'ShopMate AI Assistant',
          welcome_message: 'Hi there! Looking for something special or need product recommendations? I can help you find, compare, and discover products.',
          placeholder_text: 'Ask anything (e.g. "Find something for a wedding", "Compare top items")...',
          starter_prompts: [
            'Find gift ideas under $50',
            'Show popular products',
            'Compare best sellers'
          ],
          show_branding: true
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      aiModeStorage.saveDeployment(defaultDep);
      deployments = [defaultDep];
    }
    return deployments;
  }

  /**
   * Retrieves a specific deployment by ID.
   */
  public static getDeploymentById(id: string): AiModeDeployment | undefined {
    return aiModeStorage.getDeploymentById(id);
  }

  /**
   * Creates or updates an AI Mode deployment.
   */
  public static saveDeployment(deployment: AiModeDeployment): AiModeDeployment {
    aiModeStorage.saveDeployment(deployment);
    return deployment;
  }

  /**
   * Deletes a deployment.
   */
  public static removeDeployment(id: string, workspaceId: string): boolean {
    return aiModeStorage.removeDeployment(id, workspaceId);
  }

  /**
   * Generates embed code snippets (HTML Script and iFrame).
   */
  public static generateEmbedSnippets(deploymentId: string, hostUrl: string = ''): {
    scriptTag: string;
    iframeTag: string;
    directUrl: string;
  } {
    const base = hostUrl.replace(/\/$/, '');
    const scriptUrl = `${base}/api/ai-mode/widget/${deploymentId}/script.js`;
    const embedUrl = `${base}/ai-mode/embed/${deploymentId}`;

    const scriptTag = `<!-- ShopMate AI Mode Widget -->
<script
  src="${scriptUrl}"
  data-deployment-id="${deploymentId}"
  async
></script>`;

    const iframeTag = `<iframe
  src="${embedUrl}"
  width="420"
  height="640"
  frameborder="0"
  style="border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.15);"
  allow="clipboard-write"
></iframe>`;

    return {
      scriptTag,
      iframeTag,
      directUrl: embedUrl
    };
  }

  /**
   * Validates if a request origin is allowed by the deployment security settings.
   */
  public static isOriginAllowed(deployment: AiModeDeployment, origin?: string | null): boolean {
    if (!deployment.allowed_domains || deployment.allowed_domains.length === 0) return true;
    if (deployment.allowed_domains.includes('*')) return true;
    if (!origin) return true; // Direct embed or same-origin allowed

    try {
      const url = new URL(origin);
      const hostname = url.hostname;
      return deployment.allowed_domains.some(domain => {
        const clean = domain.trim().replace(/^https?:\/\//, '').split('/')[0];
        return clean === hostname || clean === '*' || hostname.endsWith(`.${clean}`);
      });
    } catch {
      return false;
    }
  }
}
