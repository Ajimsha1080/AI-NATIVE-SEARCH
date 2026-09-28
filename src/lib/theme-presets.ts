export interface ThemePreset {
  id: string;
  name: string;
  isPremium?: boolean;
  primaryColor: string;
  themeMode: 'light' | 'dark';
  canvasBg: string;
  topBubbleBg: string;
  midBubbleBg: string;
  inputBg: string;
  dotColor: string;
  cardBgHex: string;
  headerBgHex: string;
  borderHex: string;
  headerTextColor?: string;
  description: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'mint_breeze',
    name: 'Mint Breeze',
    primaryColor: '#ec4899',
    themeMode: 'light',
    canvasBg: 'bg-[#f0fdf4]',
    topBubbleBg: 'bg-[#dcfce7]',
    midBubbleBg: 'bg-white',
    inputBg: 'bg-white',
    dotColor: '#10b981',
    cardBgHex: '#f0fdf4',
    headerBgHex: '#dcfce7',
    borderHex: '#bbf7d0',
    headerTextColor: '#065f46',
    description: 'Fresh soothing mint green with lively rose magenta accents'
  },
  {
    id: 'cosmic_chills',
    name: 'Cosmic Chills',
    primaryColor: '#7c3aed',
    themeMode: 'light',
    canvasBg: 'bg-[#f4f5f8]',
    topBubbleBg: 'bg-white',
    midBubbleBg: 'bg-[#ede9fe]',
    inputBg: 'bg-white',
    dotColor: '#7c3aed',
    cardBgHex: '#f4f5f8',
    headerBgHex: '#ede9fe',
    borderHex: '#ddd6fe',
    headerTextColor: '#4338ca',
    description: 'Clean modern lavender aesthetic with soft violet accents'
  },
  {
    id: 'sunset_coral',
    name: 'Sunset Coral',
    primaryColor: '#f97316',
    themeMode: 'light',
    canvasBg: 'bg-[#fff7ed]',
    topBubbleBg: 'bg-[#ffedd5]',
    midBubbleBg: 'bg-white',
    inputBg: 'bg-white',
    dotColor: '#f97316',
    cardBgHex: '#fff7ed',
    headerBgHex: '#ffedd5',
    borderHex: '#fed7aa',
    headerTextColor: '#c2410c',
    description: 'Radiant warm sunrise coral and golden amber tones'
  },
  {
    id: 'sunset_bliss',
    name: 'Sunset Bliss',
    primaryColor: '#f97316',
    themeMode: 'light',
    canvasBg: 'bg-[#fff7ed]',
    topBubbleBg: 'bg-[#ffedd5]',
    midBubbleBg: 'bg-white',
    inputBg: 'bg-white',
    dotColor: '#f97316',
    cardBgHex: '#fff7ed',
    headerBgHex: '#ffedd5',
    borderHex: '#fed7aa',
    headerTextColor: '#c2410c',
    description: 'Warm pastel peach & sunset glow with coral accents'
  },
  {
    id: 'stary_night',
    name: 'Stary Night',
    primaryColor: '#2563eb',
    themeMode: 'light',
    canvasBg: 'bg-[#f8fafc]',
    topBubbleBg: 'bg-[#e0e7ff]',
    midBubbleBg: 'bg-[#ede9fe]',
    inputBg: 'bg-white',
    dotColor: '#2563eb',
    cardBgHex: '#f8fafc',
    headerBgHex: '#e0e7ff',
    borderHex: '#c7d2fe',
    headerTextColor: '#1d4ed8',
    description: 'Crisp royal blue and starry starlight indigo'
  },
  {
    id: 'emerald_luxury',
    name: 'Emerald Luxury',
    primaryColor: '#059669',
    themeMode: 'light',
    canvasBg: 'bg-[#ecfdf5]',
    topBubbleBg: 'bg-[#d1fae5]',
    midBubbleBg: 'bg-white',
    inputBg: 'bg-white',
    dotColor: '#059669',
    cardBgHex: '#ecfdf5',
    headerBgHex: '#d1fae5',
    borderHex: '#a7f3d0',
    headerTextColor: '#047857',
    description: 'Prestige forest emerald with deep jewel tone accents'
  },
  {
    id: 'rose_velvet',
    name: 'Rose Velvet',
    primaryColor: '#e11d48',
    themeMode: 'light',
    canvasBg: 'bg-[#fff1f2]',
    topBubbleBg: 'bg-[#ffe4e6]',
    midBubbleBg: 'bg-white',
    inputBg: 'bg-white',
    dotColor: '#e11d48',
    cardBgHex: '#fff1f2',
    headerBgHex: '#ffe4e6',
    borderHex: '#fecdd3',
    headerTextColor: '#be123c',
    description: 'Soft pastel pink with romantic berry red accents'
  },
  {
    id: 'electric_indigo',
    name: 'Electric Indigo',
    primaryColor: '#6366f1',
    themeMode: 'light',
    canvasBg: 'bg-[#eef2ff]',
    topBubbleBg: 'bg-[#e0e7ff]',
    midBubbleBg: 'bg-white',
    inputBg: 'bg-white',
    dotColor: '#6366f1',
    cardBgHex: '#eef2ff',
    headerBgHex: '#e0e7ff',
    borderHex: '#c7d2fe',
    headerTextColor: '#4338ca',
    description: 'Vibrant cyberpunk indigo and electric sapphire'
  },
  {
    id: 'nordic_frost',
    name: 'Nordic Frost',
    primaryColor: '#0284c7',
    themeMode: 'light',
    canvasBg: 'bg-[#f0f9ff]',
    topBubbleBg: 'bg-[#e0f2fe]',
    midBubbleBg: 'bg-white',
    inputBg: 'bg-white',
    dotColor: '#0284c7',
    cardBgHex: '#f0f9ff',
    headerBgHex: '#e0f2fe',
    borderHex: '#bae6fd',
    headerTextColor: '#0369a1',
    description: 'Glacial arctic sky blue and clean frosted glass'
  },
  {
    id: 'amber_glow',
    name: 'Amber Glow',
    primaryColor: '#d97706',
    themeMode: 'light',
    canvasBg: 'bg-[#fffbeb]',
    topBubbleBg: 'bg-[#fef3c7]',
    midBubbleBg: 'bg-white',
    inputBg: 'bg-white',
    dotColor: '#d97706',
    cardBgHex: '#fffbeb',
    headerBgHex: '#fef3c7',
    borderHex: '#fde68a',
    headerTextColor: '#b45309',
    description: 'Warm honey caramel and golden twilight aesthetic'
  },
  {
    id: 'matcha_zen',
    name: 'Matcha Zen',
    primaryColor: '#16a34a',
    themeMode: 'light',
    canvasBg: 'bg-[#f2f9f4]',
    topBubbleBg: 'bg-[#dcfce7]',
    midBubbleBg: 'bg-white',
    inputBg: 'bg-white',
    dotColor: '#16a34a',
    cardBgHex: '#f2f9f4',
    headerBgHex: '#dcfce7',
    borderHex: '#bbf7d0',
    headerTextColor: '#15803d',
    description: 'Organic soothing matcha green with crisp botanical leaf accents'
  },
  {
    id: 'lavender_mist',
    name: 'Lavender Mist',
    primaryColor: '#9333ea',
    themeMode: 'light',
    canvasBg: 'bg-[#faf5ff]',
    topBubbleBg: 'bg-[#f3e8ff]',
    midBubbleBg: 'bg-white',
    inputBg: 'bg-white',
    dotColor: '#9333ea',
    cardBgHex: '#faf5ff',
    headerBgHex: '#f3e8ff',
    borderHex: '#e9d5ff',
    headerTextColor: '#7e22ce',
    description: 'Delicate wisteria blossom with royal purple accents'
  },
  {
    id: 'oceanic_wave',
    name: 'Oceanic Wave',
    primaryColor: '#0d9488',
    themeMode: 'light',
    canvasBg: 'bg-[#f0fdfa]',
    topBubbleBg: 'bg-[#ccfbf1]',
    midBubbleBg: 'bg-white',
    inputBg: 'bg-white',
    dotColor: '#0d9488',
    cardBgHex: '#f0fdfa',
    headerBgHex: '#ccfbf1',
    borderHex: '#99f6e4',
    headerTextColor: '#0f766e',
    description: 'Deep marine navy and soothing seafoam turquoise'
  },
  {
    id: 'nordic_slate',
    name: 'Nordic Slate',
    primaryColor: '#475569',
    themeMode: 'light',
    canvasBg: 'bg-[#f8fafc]',
    topBubbleBg: 'bg-[#e2e8f0]',
    midBubbleBg: 'bg-white',
    inputBg: 'bg-white',
    dotColor: '#475569',
    cardBgHex: '#f8fafc',
    headerBgHex: '#e2e8f0',
    borderHex: '#cbd5e1',
    headerTextColor: '#334155',
    description: 'Cool Scandinavian slate with clean neutral architectural tones'
  },
  {
    id: 'cherry_blossom',
    name: 'Cherry Blossom',
    primaryColor: '#db2777',
    themeMode: 'light',
    canvasBg: 'bg-[#fdf2f8]',
    topBubbleBg: 'bg-[#fce7f3]',
    midBubbleBg: 'bg-white',
    inputBg: 'bg-white',
    dotColor: '#db2777',
    cardBgHex: '#fdf2f8',
    headerBgHex: '#fce7f3',
    borderHex: '#fbcfe8',
    headerTextColor: '#be185d',
    description: 'Japanese sakura pastel pink and vibrant fuchsia'
  }
];

export function getThemePreset(presetId?: string): ThemePreset {
  if (!presetId) return THEME_PRESETS[0];
  const found = THEME_PRESETS.find(p => p.id === presetId);
  return found || THEME_PRESETS[0];
}
