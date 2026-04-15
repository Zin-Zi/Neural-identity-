import Dexie, { type Table } from 'dexie';

export interface Habit {
  id?: number;
  name: string;
  icon: string;
  color?: string;
  intensity: number;
  goalDays: number;
  isStrict: boolean;
  createdAt: Date;
  order: number;
}

export interface HabitLog {
  id?: number;
  habitId: number;
  date: string; // ISO date string (YYYY-MM-DD)
  status: 'completed' | 'skipped';
  notes?: string;
}

export interface Settings {
  id?: number;
  primaryGlow: string;
  soundPreset: string;
  userName: string;
  neuralSyncEnabled: boolean;
  frequencyLevel: number;
  glassPreset: 'Aura' | 'Frosted' | 'Crystal' | 'Obsidian' | 'Cyber' | 'Light' | 'Nebula' | 'Prism' | 'Void';
  hapticEnabled: boolean;
  notificationsEnabled: boolean;
}

export class AuraDatabase extends Dexie {
  habits!: Table<Habit>;
  logs!: Table<HabitLog>;
  settings!: Table<Settings>;

  constructor() {
    super('AuraDatabase');
    this.version(6).stores({
      habits: '++id, name, order',
      logs: '++id, habitId, date, [habitId+date]',
      settings: '++id'
    });
  }
}

export const db = new AuraDatabase();

// Initialize default settings if not exists
db.on('ready', async () => {
  const count = await db.settings.count();
  if (count === 0) {
    await db.settings.add({
      primaryGlow: '#00ffcc',
      soundPreset: 'Starlink Alpha',
      userName: 'Thant Zin Aung',
      neuralSyncEnabled: true,
      frequencyLevel: 3,
      glassPreset: 'Aura',
      hapticEnabled: true,
      notificationsEnabled: false
    });
  }
});
