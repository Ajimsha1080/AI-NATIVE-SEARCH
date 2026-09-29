import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  } catch (e) {
    return currency + ' ' + amount.toFixed(2);
  }
}

export function formatDate(isoDateString: string): string {
  if (!isoDateString) return 'N/A';
  try {
    const d = new Date(isoDateString);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return isoDateString;
  }
}

export function generateId(prefix: string = 'id'): string {
  const rand = Math.random().toString(36).substring(2, 10);
  const time = Date.now().toString(36);
  return prefix + '_' + time + rand;
}

export function truncateText(text: string, maxLength: number = 80): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function sanitizeImageUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('data:image/')) {
    // Valid data url for images
    if (/^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
      return trimmed;
    }
    return '';
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch {
    return '';
  }
  return '';
}

export function getProductFallbackImage(title?: string, category?: string, tags?: string[]): string {
  const combined = `${title || ''} ${category || ''} ${(tags || []).join(' ')}`.toLowerCase();
  
  if (/\b(saree|sari|kanjivaram|banarasi|silk|georgette)\b/i.test(combined)) {
    if (/\b(green|emerald)\b/i.test(combined)) {
      return 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&auto=format&fit=crop&q=80';
    }
    if (/\b(yellow|floral)\b/i.test(combined)) {
      return 'https://images.unsplash.com/photo-1610030469668-935cb17fa6b8?w=600&auto=format&fit=crop&q=80';
    }
    return 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=600&auto=format&fit=crop&q=80';
  }
  if (/\b(kurta|kurti|anarkali|combo|festive)\b/i.test(combined)) {
    if (/\b(pant|trouser)\b/i.test(combined)) {
      return 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&auto=format&fit=crop&q=80';
    }
    if (/\b(yellow|floral)\b/i.test(combined)) {
      return 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=600&auto=format&fit=crop&q=80';
    }
    if (/\b(emerald|green)\b/i.test(combined)) {
      return 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=600&auto=format&fit=crop&q=80';
    }
    return 'https://images.unsplash.com/photo-1609357605129-26f69add5d6e?w=600&auto=format&fit=crop&q=80';
  }
  if (/\b(red|wine|maroon|crimson|ruby|coral|rust|cherry)\b/i.test(combined)) {
    return 'https://images.unsplash.com/photo-1603252109303-2751441dd157?w=600&auto=format&fit=crop&q=80';
  }
  if (/\b(corduroy|brown)\b/i.test(combined)) {
    return 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&auto=format&fit=crop&q=80';
  }
  if (/\b(jogger|pant|pants|bottom|bottoms|trousers|jeans|denim)\b/i.test(combined)) {
    return 'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=600&auto=format&fit=crop&q=80';
  }
  if (/\b(shirt|cotton|casual|button|bamboo)\b/i.test(combined)) {
    return 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&auto=format&fit=crop&q=80';
  }
  if (/\b(tee|tshirt|graphic|anime|streetwear|oversized)\b/i.test(combined)) {
    return 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80';
  }
  if (/\b(jacket|outerwear|sunscreen|hoodie)\b/i.test(combined)) {
    return 'https://cdn.shopify.com/s/files/1/0446/5629/6087/files/SJ1-1-100.webp?v=1776246748';
  }
  return 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&auto=format&fit=crop&q=80';
}

