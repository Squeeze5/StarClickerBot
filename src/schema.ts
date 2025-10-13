import { i } from '@instantdb/react';

/**
 * InstantDB Schema for Stars Clicker Bot
 *
 * This schema defines all the data structures for the application:
 * - users: User profiles and game statistics
 * - clicks: Individual click events for tracking
 * - referrals: Referral relationships and rewards
 *
 * To apply this schema to your InstantDB app:
 * 1. Go to https://instantdb.com/dash
 * 2. Select your app (dd446df4-6921-44be-afb1-fd77ef486d95)
 * 3. Navigate to the Schema tab
 * 4. Apply the schema structure defined below
 */

export const schema = i.schema({
  entities: {
    // Users table - stores player profiles and game data
    users: i.entity({
      telegramId: i.number().unique().indexed(),
      username: i.string(),
      firstName: i.string(),
      lastName: i.string(),
      photoUrl: i.string(),
      balance: i.number(),
      totalClicks: i.number(),
      referralCode: i.string().unique().indexed(),
      referredBy: i.string(),
      createdAt: i.number(),
    }),

    // Clicks table - tracks individual click events
    clicks: i.entity({
      userId: i.string().indexed(),
      amount: i.number(),
      timestamp: i.number(),
    }),

    // Referrals table - manages referral relationships
    referrals: i.entity({
      referrerId: i.string().indexed(),
      referredUserId: i.string().indexed(),
      reward: i.number(),
      timestamp: i.number(),
    }),
  },

  links: {
    // User has many clicks
    userClicks: {
      forward: {
        on: 'users',
        has: 'many',
        label: 'clicks',
      },
      reverse: {
        on: 'clicks',
        has: 'one',
        label: 'user',
      },
    },

    // User has many referrals they made
    userReferrals: {
      forward: {
        on: 'users',
        has: 'many',
        label: 'referrals',
      },
      reverse: {
        on: 'referrals',
        has: 'one',
        label: 'referrer',
      },
    },
  },
});

// Type definitions for TypeScript
export type Schema = typeof schema;

export type User = {
  id: string;
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  photoUrl?: string;
  balance: number;
  totalClicks: number;
  referralCode: string;
  referredBy?: string;
  createdAt: number;
};

export type Click = {
  id: string;
  userId: string;
  amount: number;
  timestamp: number;
};

export type Referral = {
  id: string;
  referrerId: string;
  referredUserId: string;
  reward: number;
  timestamp: number;
};

// Query helpers
export type UserWithClicks = User & {
  clicks: Click[];
};

export type UserWithReferrals = User & {
  referrals: Referral[];
};
