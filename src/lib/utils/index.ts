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
  
  if (/\b(red|wine|maroon|crimson|ruby|coral|rust|cherry|shadow red)\b/i.test(combined)) {
    return 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=600&auto=format&fit=crop&q=80';
  }
  if (/\b(saree|sari|ethnic|traditional|silk)\b/i.test(combined)) {
    return 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&auto=format&fit=crop&q=80';
  }
  if (/\b(kurta|kurti|anarkali|combo|festive)\b/i.test(combined)) {
    return 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&auto=format&fit=crop&q=80';
  }
  if (/\b(dress|frock|gown|women|ladies|girl)\b/i.test(combined)) {
    return 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&auto=format&fit=crop&q=80';
  }
  if (/\b(hoodie|jacket|sweater|shacket|sweatshirt|winter)\b/i.test(combined)) {
    return 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=600&auto=format&fit=crop&q=80';
  }
  if (/\b(jogger|pant|pants|bottom|bottoms|trousers|jeans|denim)\b/i.test(combined)) {
    return 'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=600&auto=format&fit=crop&q=80';
  }
  if (/\b(corduroy|casual|formal|button|shirt)\b/i.test(combined)) {
    return 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&auto=format&fit=crop&q=80';
  }
  if (/\b(tee|tshirt|graphic|anime|streetwear)\b/i.test(combined)) {
    return 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80';
  }
  return 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=600&auto=format&fit=crop&q=80';
}

