/**
 * InstantDB Schema File
 *
 * This file defines the schema for the Stars Clicker Bot application.
 *
 * To push this schema to your InstantDB app:
 * 1. Install InstantDB CLI: npm install -g @instantdb/cli
 * 2. Login: instant-cli login
 * 3. Push schema: instant-cli push-schema --app dd446df4-6921-44be-afb1-fd77ef486d95
 *
 * Or manually apply via the dashboard:
 * https://instantdb.com/dash?s=main&t=home&app=dd446df4-6921-44be-afb1-fd77ef486d95
 */

import { i } from '@instantdb/core';

const _schema = i.schema({
  entities: {
    /**
     * Users Entity
     * Stores player profiles and game statistics
     */
    users: i.entity({
      telegramId: i.number().unique().indexed(),    // Telegram user ID (unique, searchable)
      username: i.string(),                          // Telegram username
      firstName: i.string(),                         // User's first name
      lastName: i.string(),                          // User's last name
      photoUrl: i.string(),                          // Profile photo URL
      balance: i.number(),                           // Current star balance
      totalClicks: i.number(),                       // Total clicks made
      referralCode: i.string().unique().indexed(),   // Unique referral code
      referredBy: i.string(),                        // Referral code of who referred this user
      createdAt: i.number(),                         // Account creation timestamp
      // Upgrades (optional to support existing users)
      clickPower: i.number().optional(),                        // Stars earned per click
      autoClickerLevel: i.number().optional(),                  // Auto-clicker upgrade level
      multiplierLevel: i.number().optional(),                   // Click multiplier level
      // Skins (optional to support existing users)
      currentSkin: i.string().optional(),                       // Currently equipped skin ID
      ownedSkins: i.json().optional(),                          // Array of owned skin IDs
    }),

    /**
     * Clicks Entity
     * Tracks individual click events for analytics
     */
    clicks: i.entity({
      userId: i.string().indexed(),                  // ID of user who clicked (searchable)
      amount: i.number(),                            // Stars earned per click
      timestamp: i.number(),                         // When the click occurred
    }),

    /**
     * Referrals Entity
     * Manages referral relationships and rewards
     */
    referrals: i.entity({
      referrerId: i.string().indexed(),              // User who made the referral (searchable)
      referredUserId: i.string().indexed(),          // User who was referred (searchable)
      reward: i.number(),                            // Stars awarded to referrer
      timestamp: i.number(),                         // When the referral occurred
    }),

    /**
     * Activities Entity
     * Tracks all user activities for recent activity feed
     */
    activities: i.entity({
      userId: i.string().indexed(),                  // User who performed the activity
      type: i.string(),                              // Activity type: 'upgrade', 'skin', 'referral', 'achievement'
      description: i.string(),                       // Human-readable description
      amount: i.number().optional(),                 // Stars spent/earned (optional)
      timestamp: i.number(),                         // When the activity occurred
      metadata: i.json().optional(),                 // Additional data (upgrade name, skin ID, etc.)
    }),
  },

  links: {
    /**
     * Link: User -> Clicks
     * A user has many clicks
     */
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

    /**
     * Link: User -> Referrals
     * A user has many referrals they've made
     */
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

    /**
     * Link: User -> Activities
     * A user has many activities
     */
    userActivities: {
      forward: {
        on: 'users',
        has: 'many',
        label: 'activities',
      },
      reverse: {
        on: 'activities',
        has: 'one',
        label: 'user',
      },
    },
  },

  rooms: {},
});

export default _schema;
