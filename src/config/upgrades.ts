/**
 * Upgrades Configuration
 * Defines all available upgrades, their costs, and effects
 */

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  icon: string; // Path to icon or emoji
  maxLevel: number;
  baseCost: number; // Base cost for level 1
  costMultiplier: number; // Cost increase per level
  effect: (level: number) => number; // Calculate effect at given level
  effectDescription: (level: number) => string;
}

export const UPGRADES: Record<string, Upgrade> = {
  clickPower: {
    id: 'clickPower',
    name: 'Click Power',
    description: 'Increase stars earned per click',
    icon: `${import.meta.env.BASE_URL}icons/money-bag.png`,
    maxLevel: 50,
    baseCost: 100,
    costMultiplier: 1.5,
    effect: (level: number) => level, // Level 1 = +1 per click, Level 2 = +2, etc.
    effectDescription: (level: number) => `+${level} stars per click`
  },

  multiplier: {
    id: 'multiplier',
    name: 'Click Multiplier',
    description: 'Multiply your click earnings',
    icon: `${import.meta.env.BASE_URL}icons/star.png`,
    maxLevel: 20,
    baseCost: 500,
    costMultiplier: 2.0,
    effect: (level: number) => 1 + (level * 0.1), // Level 1 = 1.1x, Level 2 = 1.2x, etc.
    effectDescription: (level: number) => `${(1 + level * 0.1).toFixed(1)}x multiplier`
  },

  autoClicker: {
    id: 'autoClicker',
    name: 'Auto Clicker',
    description: 'Automatically earn stars per second',
    icon: `${import.meta.env.BASE_URL}icons/gift.png`,
    maxLevel: 30,
    baseCost: 1000,
    costMultiplier: 1.8,
    effect: (level: number) => level, // Level 1 = 1 star/sec, Level 2 = 2 stars/sec
    effectDescription: (level: number) => `${level} stars per second`
  }
};

/**
 * Calculate upgrade cost at a specific level
 */
export function getUpgradeCost(upgradeId: string, currentLevel: number): number {
  const upgrade = UPGRADES[upgradeId];
  if (!upgrade || currentLevel >= upgrade.maxLevel) return 0;

  return Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, currentLevel));
}

/**
 * Calculate total click value based on upgrades
 */
export function calculateClickValue(clickPower: number, multiplierLevel: number): number {
  const baseValue = 1 + clickPower;
  const multiplier = UPGRADES.multiplier.effect(multiplierLevel);
  return Math.floor(baseValue * multiplier);
}

/**
 * Calculate auto-clicker stars per second
 */
export function calculateAutoClickerRate(autoClickerLevel: number): number {
  return UPGRADES.autoClicker.effect(autoClickerLevel);
}
