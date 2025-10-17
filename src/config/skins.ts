/**
 * Skins Configuration
 * Defines all available skins for the clicker star
 */

export interface Skin {
  id: string;
  name: string;
  description: string;
  icon: string; // Path to skin preview
  cost: number; // Cost in stars (0 for default)
  isDefault?: boolean;
  // Visual properties
  emoji?: string; // Fallback emoji if image not available
  imageUrl?: string; // Path to skin image
  glow?: string; // Glow color for CSS
}

export const SKINS: Record<string, Skin> = {
  default: {
    id: 'default',
    name: 'Classic Star',
    description: 'The original yellow star',
    icon: `${import.meta.env.BASE_URL}icons/star.png`,
    cost: 0,
    isDefault: true,
    emoji: '⭐',
    imageUrl: `${import.meta.env.BASE_URL}icons/star.png`,
    glow: 'rgba(255, 214, 10, 0.5)'
  },

  pumpkin: {
    id: 'pumpkin',
    name: 'Pumpkin Star',
    description: 'Spooky Halloween-themed star',
    icon: `${import.meta.env.BASE_URL}icons/pumpkin-star.png`,
    cost: 10000,
    emoji: '🎃',
    imageUrl: `${import.meta.env.BASE_URL}icons/pumpkin-star.png`,
    glow: 'rgba(255, 140, 0, 0.5)'
  },

  // Add more skins here as you create them
  gold: {
    id: 'gold',
    name: 'Golden Star',
    description: 'Luxurious golden star',
    icon: `${import.meta.env.BASE_URL}icons/star.png`,
    cost: 25000,
    emoji: '🌟',
    glow: 'rgba(255, 215, 0, 0.6)'
  },

  rainbow: {
    id: 'rainbow',
    name: 'Rainbow Star',
    description: 'Colorful rainbow star',
    icon: `${import.meta.env.BASE_URL}icons/star.png`,
    cost: 50000,
    emoji: '🌈',
    glow: 'rgba(138, 43, 226, 0.5)'
  }
};

/**
 * Get skin by ID
 */
export function getSkin(skinId: string): Skin {
  return SKINS[skinId] || SKINS.default;
}

/**
 * Check if user owns a skin
 */
export function userOwnsSkin(ownedSkins: string[], skinId: string): boolean {
  return ownedSkins.includes(skinId);
}

/**
 * Get all purchasable skins
 */
export function getPurchasableSkins(): Skin[] {
  return Object.values(SKINS).filter(skin => !skin.isDefault);
}
