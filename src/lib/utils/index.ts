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
  
  if (/\b(red|wine|maroon|crimson|ruby|coral|rust|cherry)\b/i.test(combined)) {
    return 'https://cdn.shopify.com/s/files/1/0798/9710/0596/files/red-sparrow-embroidered-shirt-men-shirt-mydesignation-9055241.jpg?v=1768400762';
  }
  if (/\b(saree|sari|ethnic|traditional|silk)\b/i.test(combined)) {
    return 'https://cdn.shopify.com/s/files/1/0798/9710/0596/files/royal-heritage-saree-saree-mydesignation-9088859.jpg?v=1790346254';
  }
  if (/\b(kurta|kurti|anarkali|combo|festive)\b/i.test(combined)) {
    return 'https://cdn.shopify.com/s/files/1/0798/9710/0596/files/yellow-floral-kurta-pant-combo-box-combo-mydesignation-2391080.jpg?v=1790346252';
  }
  if (/\b(dress|frock|gown|women|ladies|girl)\b/i.test(combined)) {
    return 'https://cdn.shopify.com/s/files/1/0798/9710/0596/files/dragon-couple-combo-856570.jpg?v=1736815273';
  }
  if (/\b(jogger|pant|pants|bottom|bottoms|trousers|jeans|denim)\b/i.test(combined)) {
    return 'https://cdn.shopify.com/s/files/1/0798/9710/0596/files/bottle-green-everyday-pants-premium-cotton-968745.jpg?v=1743081831';
  }
  if (/\b(corduroy|casual|formal|button|shirt)\b/i.test(combined)) {
    return 'https://cdn.shopify.com/s/files/1/0798/9710/0596/files/wild-west-relaxed-fit-luxe-cotton-shirt-men-shirt-mydesignation-2435595.jpg?v=1757544283';
  }
  if (/\b(tee|tshirt|graphic|anime|streetwear|oversized)\b/i.test(combined)) {
    return 'https://cdn.shopify.com/s/files/1/0798/9710/0596/files/snake-embroidered-oversized-t-shirt-mydesignation-1958453.jpg?v=1778972889';
  }
  return 'https://cdn.shopify.com/s/files/1/0798/9710/0596/files/aristotle-relaxed-fit-premium-rayon-shirt-men-shirt-mydesignation-7158773.jpg?v=1764389887';
}

