import { AIModeProduct, AIModeConfig } from '../types';
import { aiModeStorage } from './storage';

export interface AIModeLLMParams {
  userMessage: string;
  workspaceId: string;
  searchPlan?: any;
  products?: AIModeProduct[];
  knowledgeContext?: string;
  conversationHistory?: { role: string; content: string }[];
  intent?: 'SEARCH' | 'RECOMMENDATION' | 'COMPARISON' | 'FAQ' | 'GENERAL';
  comparisonData?: {
    itemA: AIModeProduct;
    itemB: AIModeProduct;
    summary?: string;
  };
}

export class AIModeLLMService {
  /**
   * Generates a conversational, merchant-tailored response using the active LLM provider.
   * Supports Sarvam AI, OpenAI, Groq, Anthropic, and local Ollama with automatic fallback.
   */
  public static async generateResponse(params: AIModeLLMParams): Promise<string | null> {
    const config = aiModeStorage.getConfig(params.workspaceId);
    
    // Construct relevant product context
    let productContext = '';
    if (params.products && params.products.length > 0) {
      productContext = 'Verified In-Stock Catalog Products:\n' + params.products.slice(0, 6).map((p, idx) => {
        const variantsInfo = (p.variants || []).slice(0, 4).map(v => 
          `[${v.title}: ₹${v.price}${v.attributes?.size ? ` Size:${v.attributes.size}` : ''}${v.attributes?.color ? ` Color:${v.attributes.color}` : ''}]`
        ).join(', ');
        return `${idx + 1}. **${p.title}** — ₹${p.price.toLocaleString('en-IN')}\n` +
          `   Category: ${p.category || 'General'}\n` +
          `   Description: ${p.description ? p.description.substring(0, 120) : 'Quality catalog product.'}\n` +
          (variantsInfo ? `   Available Variants: ${variantsInfo}\n` : '');
      }).join('\n');
    }

    // Build system prompt
    const baseInstructions = config?.system_instructions || 
      'You are ShopMate AI, a premium merchant e-commerce shopping concierge. Provide clear, helpful, stylish, and concise product advice based strictly on the verified catalog items provided.';
    
    let promptRole = `${baseInstructions}\n\n`;

    if (params.knowledgeContext) {
      promptRole += `Merchant Knowledge & Store Policy Context:\n${params.knowledgeContext}\n\n`;
    }

    if (productContext) {
      promptRole += `${productContext}\n\n`;
    }

    promptRole += `CRITICAL INSTRUCTIONS:
1. Answer the customer's query naturally, engagingly, and concisely in 2-4 sentences.
2. When mentioning products, use bold titles e.g. **Product Name** and mention the verified price in ₹ INR.
3. If giving advice, highlight practical benefits (fabric, occasion, value, styling tips).
4. Never invent products or prices that are not in the verified catalog context.`;

    const messages = [
      { role: 'system', content: promptRole },
      ...(params.conversationHistory || []).slice(-4),
      { role: 'user', content: params.userMessage }
    ];

    // 1. Try configured provider
    const provider = (config?.model_provider || process.env.AI_MODE_LLM_PROVIDER || 'sarvam').toLowerCase();
    
    try {
      if (provider === 'sarvam' || process.env.SARVAM_API_KEY) {
        const res = await this.callSarvam(messages, config);
        if (res) return res;
      }

      if (provider === 'openai' || process.env.OPENAI_API_KEY) {
        const res = await this.callOpenAI(messages, config);
        if (res) return res;
      }

      if (provider === 'groq' || process.env.GROQ_API_KEY) {
        const res = await this.callGroq(messages, config);
        if (res) return res;
      }

      if (provider === 'anthropic' || process.env.ANTHROPIC_API_KEY) {
        const res = await this.callAnthropic(messages, config);
        if (res) return res;
      }

      if (provider === 'ollama' || process.env.OLLAMA_BASE_URL) {
        const res = await this.callOllama(messages, config);
        if (res) return res;
      }
    } catch (err) {
      console.warn('AI Mode LLM execution warning (falling back to deterministic synthesis):', err);
    }

    return null;
  }

  /**
   * Sarvam AI API Gateway
   */
  private static async callSarvam(messages: any[], config?: AIModeConfig): Promise<string | null> {
    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) return null;

    const model = config?.model_name || process.env.SARVAM_MODEL || 'sarvam-105b-conversations';
    const temperature = config?.temperature ?? 0.3;

    const res = await fetch('https://api.sarvam.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: 500
      }),
      signal: AbortSignal.timeout(4000)
    });

    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() || null;
    }
    return null;
  }

  /**
   * OpenAI API Gateway
   */
  private static async callOpenAI(messages: any[], config?: AIModeConfig): Promise<string | null> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;

    const model = config?.model_name || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const temperature = config?.temperature ?? 0.3;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: 500
      }),
      signal: AbortSignal.timeout(4000)
    });

    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() || null;
    }
    return null;
  }

  /**
   * Groq High-Speed LLM API Gateway
   */
  private static async callGroq(messages: any[], config?: AIModeConfig): Promise<string | null> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return null;

    const model = config?.model_name || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    const temperature = config?.temperature ?? 0.3;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: 500
      }),
      signal: AbortSignal.timeout(3500)
    });

    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() || null;
    }
    return null;
  }

  /**
   * Anthropic Claude API Gateway
   */
  private static async callAnthropic(messages: any[], config?: AIModeConfig): Promise<string | null> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;

    const model = config?.model_name || process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const userAndAssistant = messages.filter(m => m.role !== 'system');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        system: systemMessage,
        messages: userAndAssistant,
        max_tokens: 500
      }),
      signal: AbortSignal.timeout(4000)
    });

    if (res.ok) {
      const data = await res.json();
      return data.content?.[0]?.text?.trim() || null;
    }
    return null;
  }

  /**
   * Ollama Local Model Gateway
   */
  private static async callOllama(messages: any[], config?: AIModeConfig): Promise<string | null> {
    const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const model = config?.model_name || process.env.OLLAMA_MODEL || 'llama3.2';

    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false
      }),
      signal: AbortSignal.timeout(4000)
    });

    if (res.ok) {
      const data = await res.json();
      return data.message?.content?.trim() || null;
    }
    return null;
  }
}
