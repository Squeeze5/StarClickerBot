import { init } from '@instantdb/react';
import { schema, type Schema, type User, type Click, type Referral } from './schema';

// Initialize InstantDB with your app ID and schema
const APP_ID = 'dd446df4-6921-44be-afb1-fd77ef486d95';

export const db = init<Schema>({ appId: APP_ID, schema });

// Re-export types
export type { User, Click, Referral };
