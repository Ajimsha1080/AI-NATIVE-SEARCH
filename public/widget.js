(function () {
  // Find currently executing script tag to parse data attributes
  var currentScript = document.currentScript || (function() {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  if (!currentScript) return;

  var agentKey = currentScript.getAttribute('data-agent-key') || '';
  var apiUrl = currentScript.getAttribute('data-api-url') || (window.location.origin);
  var position = currentScript.getAttribute('data-position') || 'bottom_right';
  var primaryColor = currentScript.getAttribute('data-primary-color') || '#4f46e5';
  var themeMode = currentScript.getAttribute('data-theme-mode') || 'dark';
  var customBgColor = currentScript.getAttribute('data-background-color') || '';
  var customHeaderBg = currentScript.getAttribute('data-header-background') || '';
  var customBorderColor = currentScript.getAttribute('data-border-color') || '';
  var logoUrl = currentScript.getAttribute('data-logo-url') || '';
  var logoBackground = currentScript.getAttribute('data-logo-background') || 'transparent';
  var launcherText = currentScript.getAttribute('data-launcher-text') || 'Chat with us';
  var launcherShape = currentScript.getAttribute('data-launcher-shape') || 'teardrop';
  var launcherIcon = currentScript.getAttribute('data-launcher-icon') || 'chat';
  var bottomPadding = parseInt(currentScript.getAttribute('data-bottom-padding') || '20', 10);
  var sidePadding = parseInt(currentScript.getAttribute('data-side-padding') || '20', 10);
  var assistantName = currentScript.getAttribute('data-assistant-name') || 'ShopMate Assistant';
  var greetingMessage = currentScript.getAttribute('data-greeting-message') || "Hello! 👋 I'm your AI assistant. How can I help you today?";
  var starterQuestionsRaw = currentScript.getAttribute('data-starter-questions') || 'What are your pricing plans?||How do I get started?||Talk to human support';
  var starterQuestions = starterQuestionsRaw.split('||').filter(Boolean);

  var chatBg = themeMode === 'light' ? (customBgColor || '#ffffff') : '#0B132B';
  var chatHeaderBg = themeMode === 'light' ? (customHeaderBg || '#f8fafc') : '#0c1633';
  var chatBorder = themeMode === 'light' ? (customBorderColor || '#e2e8f0') : '#1e293b';

  // Avoid duplicate injection
  if (document.getElementById('shopmate-ai-widget-root')) return;

  var root = document.createElement('div');
  root.id = 'shopmate-ai-widget-root';
  root.style.position = 'fixed';
  root.style.bottom = bottomPadding + 'px';
  if (position === 'bottom_left') {
    root.style.left = sidePadding + 'px';
  } else {
    root.style.right = sidePadding + 'px';
  }
  root.style.zIndex = '999999';
  root.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  // Inject CSS Styles
  var style = document.createElement('style');
  style.innerHTML = `
    #shopmate-ai-widget-root * { box-sizing: border-box; }
    .sm-launcher-btn {
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      color: #ffffff;
      border: none;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.3);
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s;
    }
    .sm-launcher-btn:hover { transform: scale(1.05); }
    .sm-launcher-btn:active { transform: scale(0.96); }
    .sm-teardrop { padding: 12px 20px; border-radius: 20px 20px 4px 20px; }
    .sm-pill { padding: 12px 22px; border-radius: 9999px; }
    .sm-circle { width: 56px; height: 56px; border-radius: 56px; justify-content: center; padding: 0; }
    .sm-rounded { padding: 12px 18px; border-radius: 16px; }

    .sm-chat-window {
      position: absolute;
      bottom: 72px;
      ${position === 'bottom_left' ? 'left: 0;' : 'right: 0;'}
      width: 380px;
      max-width: calc(100vw - 40px);
      height: 600px;
      max-height: calc(100vh - 120px);
      background: ${chatBg};
      color: ${themeMode === 'light' ? '#0f172a' : '#f8fafc'};
      border: 1px solid ${chatBorder};
      border-radius: 20px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: smFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes smFadeIn { from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
    
    .sm-header {
      padding: 16px;
      background: ${chatHeaderBg};
      border-bottom: 1px solid ${chatBorder};
    }
    .sm-header-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(255,255,255,0.1);
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      color: ${themeMode === 'light' ? '#334155' : '#e2e8f0'};
      margin-bottom: 8px;
    }
    .sm-header-title { font-size: 18px; font-weight: 700; color: ${primaryColor}; margin: 0; }
    .sm-header-subtitle { font-size: 11px; color: #94a3b8; margin: 2px 0 0 0; }
    .sm-close-btn { position: absolute; top: 16px; right: 16px; background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 18px; }
    .sm-close-btn:hover { color: #ffffff; }

    .sm-messages {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .sm-msg { max-width: 85%; padding: 10px 14px; font-size: 13px; line-height: 1.4; border-radius: 14px; }
    .sm-msg-user { align-self: flex-end; background: ${primaryColor}; color: #ffffff; border-bottom-right-radius: 2px; }
    .sm-msg-agent { align-self: flex-start; background: ${themeMode === 'light' ? '#f1f5f9' : '#1e293b'}; color: ${themeMode === 'light' ? '#0f172a' : '#f1f5f9'}; border-bottom-left-radius: 2px; }

    .sm-chip {
      background: ${themeMode === 'light' ? '#f8fafc' : 'rgba(30, 41, 59, 0.7)'};
      border: 1px solid ${themeMode === 'light' ? '#cbd5e1' : '#334155'};
      color: ${themeMode === 'light' ? '#1e293b' : '#e2e8f0'};
      padding: 8px 12px;
      border-radius: 10px;
      font-size: 12px;
      text-align: left;
      cursor: pointer;
      width: 100%;
      transition: all 0.15s;
    }
    .sm-chip:hover { border-color: ${primaryColor}; background: ${primaryColor}15; }

    .sm-footer {
      padding: 12px;
      background: ${themeMode === 'light' ? '#f8fafc' : '#0c1633'};
      border-top: 1px solid ${themeMode === 'light' ? '#e2e8f0' : '#1e293b'};
      display: flex;
      gap: 8px;
    }
    .sm-input {
      flex: 1;
      padding: 8px 14px;
      border-radius: 10px;
      border: 1px solid ${themeMode === 'light' ? '#cbd5e1' : '#334155'};
      background: ${themeMode === 'light' ? '#ffffff' : '#070e24'};
      color: ${themeMode === 'light' ? '#0f172a' : '#ffffff'};
      font-size: 13px;
      outline: none;
    }
    .sm-input:focus { border-color: ${primaryColor}; }
    .sm-send-btn {
      background: ${primaryColor};
      color: #ffffff;
      border: none;
      border-radius: 10px;
      padding: 0 14px;
      cursor: pointer;
      font-weight: 600;
    }
    .sm-send-btn:disabled { opacity: 0.5; }
    .sm-branding { text-align: center; font-size: 10px; color: #64748b; padding: 4px 0; background: ${themeMode === 'light' ? '#f1f5f9' : '#070e24'}; }

    /* Mobile & Phone Responsive Rules */
    @media (max-width: 640px) {
      #shopmate-ai-widget-root {
        bottom: 12px !important;
        right: 12px !important;
        left: 12px !important;
        display: flex;
        justify-content: flex-end;
      }
      .sm-chat-window {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100vw !important;
        max-width: 100vw !important;
        height: 100% !important;
        height: 100dvh !important;
        max-height: 100dvh !important;
        border-radius: 0 !important;
        border: none !important;
        z-index: 9999999 !important;
      }
      .sm-header {
        padding: 14px 16px env(safe-area-inset-top, 14px) 16px;
      }
      .sm-footer {
        padding: 10px 12px env(safe-area-inset-bottom, 12px) 12px;
      }
      .sm-input {
        font-size: 16px !important; /* Prevents auto-zoom on iOS devices */
      }
      .sm-launcher-btn {
        padding: 10px 18px;
        font-size: 13px;
      }
    }
  `;
  document.head.appendChild(style);

  var isOpen = false;
  var messages = [{ sender: 'agent', text: greetingMessage }];

  function render() {
    root.innerHTML = '';

    if (isOpen) {
      var chatWin = document.createElement('div');
      chatWin.className = 'sm-chat-window';

      // Header
      var logoBadgeHtml = logoUrl 
        ? `<img src="${logoUrl}" style="width: 14px; height: 14px; border-radius: 50%; object-fit: cover; vertical-align: middle;" />` 
        : `<span style="width: 6px; height: 6px; border-radius: 6px; background: ${primaryColor};"></span>`;

      chatWin.innerHTML = `
        <div class="sm-header">
          <div class="sm-header-badge">
            ${logoBadgeHtml}
            ${assistantName}
          </div>
          <button class="sm-close-btn" id="sm-close">✕</button>
          <h2 class="sm-header-title">${assistantName}</h2>
          <p class="sm-header-subtitle">We usually reply in a few seconds</p>
        </div>
        <div class="sm-messages" id="sm-msg-container"></div>
        <div style="padding: 0 16px 8px 16px;" id="sm-chips-container"></div>
        <div class="sm-footer">
          <input type="text" class="sm-input" id="sm-chat-input" placeholder="Type your message..." />
          <button class="sm-send-btn" id="sm-send-btn">➤</button>
        </div>
        <div class="sm-branding">Powered by <strong>ShopMate AI</strong></div>
      `;

      root.appendChild(chatWin);

      // Render Messages
      var msgContainer = chatWin.querySelector('#sm-msg-container');
      messages.forEach(function (m) {
        var el = document.createElement('div');
        el.className = 'sm-msg ' + (m.sender === 'user' ? 'sm-msg-user' : 'sm-msg-agent');
        el.innerText = m.text;
        msgContainer.appendChild(el);
      });
      msgContainer.scrollTop = msgContainer.scrollHeight;

      // Render Suggested Question Chips
      var chipsContainer = chatWin.querySelector('#sm-chips-container');
      if (messages.length <= 1 && starterQuestions.length > 0) {
        var label = document.createElement('div');
        label.style.fontSize = '10px';
        label.style.fontWeight = '700';
        label.style.color = '#94a3b8';
        label.style.marginBottom = '6px';
        label.innerText = 'SUGGESTED QUESTIONS:';
        chipsContainer.appendChild(label);

        starterQuestions.forEach(function (q) {
          var chip = document.createElement('button');
          chip.className = 'sm-chip';
          chip.innerHTML = '💬 ' + q;
          chip.onclick = function () {
            sendMessage(q);
          };
          chipsContainer.appendChild(chip);
        });
      }

      // Event handlers
      chatWin.querySelector('#sm-close').onclick = function () {
        isOpen = false;
        render();
      };

      var input = chatWin.querySelector('#sm-chat-input');
      var sendBtn = chatWin.querySelector('#sm-send-btn');

      function doSend() {
        var text = input.value.trim();
        if (text) {
          input.value = '';
          sendMessage(text);
        }
      }

      sendBtn.onclick = doSend;
      input.onkeydown = function (e) {
        if (e.key === 'Enter') doSend();
      };

      input.focus();
    } else {
      // Launcher Button
      var shapeRadius = '50%';
      if (launcherShape === 'teardrop') shapeRadius = '24px 24px 4px 24px';
      else if (launcherShape === 'rounded') shapeRadius = '16px';
      else if (launcherShape === 'pill' || launcherShape === 'circle') shapeRadius = '9999px';

      var shapeClass = 'sm-' + launcherShape;
      var btn = document.createElement('button');
      btn.className = 'sm-launcher-btn ' + shapeClass;
      btn.style.backgroundColor = primaryColor;
      btn.style.borderRadius = shapeRadius;
      
      var hasText = Boolean(launcherText && launcherText.trim());
      if (!hasText || launcherShape === 'circle') {
        btn.style.width = '56px';
        btn.style.height = '56px';
        btn.style.padding = '0';
        btn.style.justifyContent = 'center';
      }

      var iconHtml = '💬';
      if (launcherIcon === 'logo' && logoUrl) {
        if (!hasText || launcherShape === 'circle') {
          if (logoBackground === 'transparent') {
            btn.style.backgroundColor = 'transparent';
            btn.style.padding = '0';
            btn.style.boxShadow = 'none';
            btn.innerHTML = `
              <div style="position: relative; width: 56px; height: 56px; border-radius: ${shapeRadius}; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.35); border: 2px solid #ffffff; overflow: hidden;">
                <img src="${logoUrl}" style="width: 56px; height: 56px; border-radius: ${shapeRadius}; object-fit: cover; display: block;" />
                <span style="position: absolute; bottom: 1px; right: 1px; width: 12px; height: 12px; background: #10b981; border: 2px solid #ffffff; border-radius: 50%;"></span>
              </div>
            `;
          } else {
            btn.innerHTML = `
              <div style="position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
                <img src="${logoUrl}" style="width: 38px; height: 38px; border-radius: ${shapeRadius}; object-fit: cover; border: 2px solid rgba(255,255,255,0.9); display: block;" />
                <span style="position: absolute; bottom: 0; right: 0; width: 10px; height: 10px; background: #10b981; border: 1.5px solid #ffffff; border-radius: 50%;"></span>
              </div>
            `;
          }
        } else {
          iconHtml = `<img src="${logoUrl}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 1.5px solid rgba(255,255,255,0.8); vertical-align: middle;" />`;
          btn.innerHTML = `<span style="font-size: 16px; display: flex; align-items: center;">${iconHtml}</span><span style="font-size: 13px; font-weight: 600;">${launcherText}</span>`;
        }
      } else {
        if (launcherIcon === 'sparkles') iconHtml = '✨';
        else if (launcherIcon === 'droplet') iconHtml = '💧';
        else if (launcherIcon === 'bot') iconHtml = '🤖';
        else if (launcherIcon === 'bag') iconHtml = '🛍️';
        else if (launcherIcon === 'help') iconHtml = '❓';

        if (!hasText || launcherShape === 'circle') {
          btn.innerHTML = `<span style="font-size: 20px; display: flex; align-items: center; justify-content: center;">${iconHtml}</span>`;
        } else {
          btn.innerHTML = `<span style="font-size: 16px; display: flex; align-items: center;">${iconHtml}</span><span style="font-size: 13px; font-weight: 600;">${launcherText}</span>`;
        }
      }

      btn.onclick = function () {
        isOpen = true;
        render();
      };

      root.appendChild(btn);
    }
  }

  function sendMessage(text) {
    messages.push({ sender: 'user', text: text });
    render();

    var loadingMsg = { sender: 'agent', text: '...' };
    messages.push(loadingMsg);
    render();

    fetch(apiUrl + '/api/v1/agents/agent_shopmate_01/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + agentKey
      },
      body: JSON.stringify({ message: text })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        messages.pop(); // Remove loading
        messages.push({
          sender: 'agent',
          text: data.response || "Thanks for your message! How else can I assist you?"
        });
        render();
      })
      .catch(function () {
        messages.pop();
        messages.push({
          sender: 'agent',
          text: "I'm currently connected to your store knowledge base. Let me know if you have questions!"
        });
        render();
      });
  }

  document.body.appendChild(root);
  render();
})();
