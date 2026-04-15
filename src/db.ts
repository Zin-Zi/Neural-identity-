import Dexie, { type Table } from 'dexie';

export interface Habit {
  id?: number;
  name: string;
  icon: string;
  intensity: number;
  goalDays: number;
  createdAt: Date;
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
}

export class AuraDatabase extends Dexie {
  habits!: Table<Habit>;
  logs!: Table<HabitLog>;
  settings!: Table<Settings>;

  constructor() {
    super('AuraDatabase');
    this.version(2).stores({
      habits: '++id, name',
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
      soundPreset: 'Cyber Chime',
      userName: 'Thant Zin Aung',
      neuralSyncEnabled: true
    });
  }
});
