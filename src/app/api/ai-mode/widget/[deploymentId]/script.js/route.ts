import { NextRequest, NextResponse } from 'next/server';
import { AiModeDeploymentService } from '@/ai-mode/services/deployment-service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ deploymentId: string }> }
) {
  try {
    const { deploymentId } = await params;
    const deployment = AiModeDeploymentService.getDeploymentById(deploymentId);

    if (!deployment || deployment.status === 'PAUSED') {
      return new NextResponse('/* AI Mode Deployment Inactive */', {
        headers: { 'Content-Type': 'application/javascript' }
      });
    }

    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const hostUrl = `${protocol}://${host}`;
    const embedUrl = `${hostUrl}/ai-mode/embed/${deploymentId}`;

    const theme = deployment.theme || {};
    const primaryColor = theme.primary_color || '#4f46e5';
    const position = theme.position || 'bottom-right';
    const launcherText = theme.launcher_text || 'Shop with AI';

    const jsContent = `
(function() {
  if (window.__SHOPMATE_AI_MODE_INITIALIZED__) return;
  window.__SHOPMATE_AI_MODE_INITIALIZED__ = true;

  var deploymentId = "${deploymentId}";
  var embedUrl = "${embedUrl}";
  var primaryColor = "${primaryColor}";
  var position = "${position}";
  var launcherText = "${launcherText}";

  // Create Container
  var container = document.createElement('div');
  container.id = 'shopmate-ai-mode-widget-root';
  container.style.position = 'fixed';
  container.style.zIndex = '2147483640';
  container.style.bottom = '20px';
  if (position === 'bottom-left') {
    container.style.left = '20px';
  } else {
    container.style.right = '20px';
  }
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  // Create Iframe Container
  var iframeWrapper = document.createElement('div');
  iframeWrapper.id = 'shopmate-ai-mode-iframe-wrapper';
  iframeWrapper.style.display = 'none';
  iframeWrapper.style.position = 'fixed';
  iframeWrapper.style.bottom = '85px';
  if (position === 'bottom-left') {
    iframeWrapper.style.left = '20px';
  } else {
    iframeWrapper.style.right = '20px';
  }
  iframeWrapper.style.width = '420px';
  iframeWrapper.style.maxWidth = 'calc(100vw - 40px)';
  iframeWrapper.style.height = '640px';
  iframeWrapper.style.maxHeight = 'calc(100vh - 120px)';
  iframeWrapper.style.boxShadow = '0 20px 45px rgba(0, 0, 0, 0.2), 0 0 1px rgba(0, 0, 0, 0.1)';
  iframeWrapper.style.borderRadius = '20px';
  iframeWrapper.style.overflow = 'hidden';
  iframeWrapper.style.transition = 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
  iframeWrapper.style.zIndex = '2147483645';

  var iframe = document.createElement('iframe');
  iframe.src = embedUrl;
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.style.background = '#ffffff';
  iframeWrapper.appendChild(iframe);

  // Create Launcher Button
  var button = document.createElement('button');
  button.id = 'shopmate-ai-mode-launcher-btn';
  button.style.background = primaryColor;
  button.style.color = '#ffffff';
  button.style.border = 'none';
  button.style.borderRadius = '9999px';
  button.style.padding = '12px 20px';
  button.style.fontSize = '14px';
  button.style.fontWeight = '600';
  button.style.cursor = 'pointer';
  button.style.display = 'flex';
  button.style.alignItems = 'center';
  button.style.gap = '8px';
  button.style.boxShadow = '0 8px 25px rgba(79, 70, 229, 0.35)';
  button.style.transition = 'transform 0.15s ease, box-shadow 0.15s ease';

  button.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg> <span>' + launcherText + '</span>';

  var isOpen = false;
  button.onclick = function() {
    isOpen = !isOpen;
    if (isOpen) {
      iframeWrapper.style.display = 'block';
      button.style.transform = 'scale(0.95)';
    } else {
      iframeWrapper.style.display = 'none';
      button.style.transform = 'scale(1)';
    }
  };

  container.appendChild(button);
  document.body.appendChild(iframeWrapper);
  document.body.appendChild(container);
})();
    `.trim();

    return new NextResponse(jsContent, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=60'
      }
    });
  } catch (e: any) {
    return new NextResponse('/* Error loading widget script */', {
      headers: { 'Content-Type': 'application/javascript' }
    });
  }
}
