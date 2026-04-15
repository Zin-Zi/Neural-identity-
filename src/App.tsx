/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Settings as SettingsIcon, 
  Activity, 
  Zap, 
  Calendar, 
  Trash2, 
  Edit3, 
  Check, 
  X,
  ChevronRight,
  Volume2,
  Palette,
  Crown,
  Brain,
  Target,
  Heart,
  Code,
  Book,
  Music,
  Camera,
  Coffee,
  Moon,
  Sun,
  FileText,
  Save,
  User,
  ShieldCheck
} from 'lucide-react';

const ICON_MAP: Record<string, any> = {
  Activity, Zap, Brain, Target, Heart, Code, Book, Music, Camera, Coffee, Moon, Sun
};
import { useLiveQuery } from 'dexie-react-hooks';
import { format, startOfToday, subDays, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { db, type Habit, type HabitLog } from './db';
import { cn, hexToRgb } from './lib/utils';

// --- Sound Utility ---
const playSyncSound = (preset: string = 'Cyber Chime') => {
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  const now = audioCtx.currentTime;

  if (preset === 'Cyber Chime') {
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, now);
    oscillator.frequency.exponentialRampToValueAtTime(1760, now + 0.1);
    gainNode.gain.setValueAtTime(0.1, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    oscillator.start(now);
    oscillator.stop(now + 0.3);
  } else if (preset === 'Neural Beep') {
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(440, now);
    gainNode.gain.setValueAtTime(0.05, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    oscillator.start(now);
    oscillator.stop(now + 0.1);
  } else if (preset === 'SpaceX Launch') {
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(110, now);
    oscillator.frequency.exponentialRampToValueAtTime(440, now + 0.5);
    gainNode.gain.setValueAtTime(0.1, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    oscillator.start(now);
    oscillator.stop(now + 0.5);
  }
};

// --- Components ---

const Typewriter = ({ text }: { text: string }) => {
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isDeleting && index < text.length) {
        setDisplayText(prev => prev + text[index]);
        setIndex(prev => prev + 1);
      } else if (isDeleting && index > 0) {
        setDisplayText(prev => prev.slice(0, -1));
        setIndex(prev => prev - 1);
      } else if (!isDeleting && index === text.length) {
        setTimeout(() => setIsDeleting(true), 2000);
      } else if (isDeleting && index === 0) {
        setIsDeleting(false);
      }
    }, isDeleting ? 50 : 150);

    return () => clearTimeout(timeout);
  }, [index, isDeleting, text]);

  return (
    <span className="font-mono text-sm tracking-widest uppercase opacity-80">
      {displayText}
      <span className="animate-pulse">|</span>
    </span>
  );
};

const HabitCard = ({ 
  habit, 
  onLog, 
  onEdit, 
  onDelete 
}: { 
  key?: React.Key;
  habit: Habit; 
  onLog: (id: number, status: 'completed' | 'skipped', date?: Date) => Promise<void>;
  onEdit: (habit: Habit) => void;
  onDelete: (id: number) => Promise<void>;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [note, setNote] = useState('');
  
  const logs = useLiveQuery(() => db.logs.where('habitId').equals(habit.id!).toArray(), [habit.id]);
  const todayLog = logs?.find(l => l.date === format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    if (todayLog?.notes) setNote(todayLog.notes);
    else setNote('');
  }, [todayLog]);

  const streak = useMemo(() => {
    if (!logs) return 0;
    let count = 0;
    let current = new Date();
    const todayStr = format(current, 'yyyy-MM-dd');
    const todayLogEntry = logs.find(l => l.date === todayStr);
    
    if (todayLogEntry?.status !== 'completed') {
      current = subDays(current, 1);
    }

    while (true) {
      const dateStr = format(current, 'yyyy-MM-dd');
      const log = logs.find(l => l.date === dateStr);
      if (log?.status === 'completed') {
        count++;
        current = subDays(current, 1);
      } else {
        break;
      }
    }
    return count;
  }, [logs]);

  const IconComponent = ICON_MAP[habit.icon];

  const handleSaveNote = async () => {
    if (todayLog?.id) {
      await db.logs.update(todayLog.id, { notes: note });
    }
  };

  return (
    <motion.div 
      layout
      className="glass-panel rounded-2xl p-4 mb-4 relative overflow-hidden group"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-aura-glow/10 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(var(--primary-glow-rgb),0.2)]">
            {IconComponent ? (
              <IconComponent className="w-5 h-5 text-aura-glow" />
            ) : (
              <span>{habit.icon}</span>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-lg leading-tight">{habit.name}</h3>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider opacity-50 font-mono">
              <span>Streak: {streak}d</span>
              <span>•</span>
              <span>Intensity: {habit.intensity}%</span>
            </div>
          </div>
        </div>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2 hover:bg-white/5 rounded-full transition-colors"
        >
          <ChevronRight className={cn("w-5 h-5 transition-transform", isExpanded && "rotate-90")} />
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        <button 
          onClick={() => onLog(habit.id!, 'completed')}
          className={cn(
            "flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2",
            todayLog?.status === 'completed' 
              ? "bg-aura-glow text-black shadow-[0_0_20px_var(--color-aura-glow)]" 
              : "bg-aura-glow/10 text-aura-glow border border-aura-glow/30 hover:bg-aura-glow/20"
          )}
        >
          {todayLog?.status === 'completed' ? <Check className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
          {todayLog?.status === 'completed' ? 'Synchronized' : 'Complete'}
        </button>
        <button 
          onClick={() => onLog(habit.id!, 'skipped')}
          className={cn(
            "px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all",
            todayLog?.status === 'skipped'
              ? "bg-amber-500/20 text-amber-500 border border-amber-500/50"
              : "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10"
          )}
        >
          Skip
        </button>
      </div>

      {/* Progress Bar */}
      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden flex gap-0.5">
        {Array.from({ length: 7 }).map((_, i) => {
          const date = subDays(new Date(), 6 - i);
          const dateStr = format(date, 'yyyy-MM-dd');
          const log = logs?.find(l => l.date === dateStr);
          return (
            <div 
              key={i}
              className={cn(
                "flex-1 h-full transition-all duration-500",
                log?.status === 'completed' ? "bg-aura-glow shadow-[0_0_8px_var(--color-aura-glow)]" : 
                log?.status === 'skipped' ? "bg-amber-500/50" : "bg-white/10"
              )}
            />
          );
        })}
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-4 space-y-4">
              {todayLog && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[8px] uppercase tracking-[0.2em] font-bold opacity-40">Neural Journal</label>
                    <button onClick={handleSaveNote} className="text-[8px] uppercase font-bold text-aura-glow flex items-center gap-1">
                      <Save className="w-3 h-3" /> Save Note
                    </button>
                  </div>
                  <textarea 
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Log your neural state..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs outline-none focus:border-aura-glow/30 min-h-[60px] resize-none"
                  />
                </div>
              )}

              <div className="flex items-center justify-between border-t border-white/5 pt-4">
                <div className="flex gap-2">
                  <button 
                    onClick={() => onEdit(habit)}
                    className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/60 transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => onDelete(habit.id!)}
                    className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-500/60 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <button 
                  onClick={() => setShowCalendar(!showCalendar)}
                  className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-aura-glow/60 hover:text-aura-glow"
                >
                  <Calendar className="w-4 h-4" />
                  Retro Log
                </button>
              </div>

              {showCalendar && (
                <div className="mt-4 p-2 bg-black/40 rounded-xl border border-white/5 grid grid-cols-7 gap-1">
                  {Array.from({ length: 14 }).map((_, i) => {
                    const date = subDays(new Date(), 13 - i);
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const log = logs?.find(l => l.date === dateStr);
                    return (
                      <button
                        key={i}
                        onClick={() => onLog(habit.id!, 'completed', date)}
                        className={cn(
                          "aspect-square rounded-md flex flex-col items-center justify-center text-[8px] transition-all",
                          log?.status === 'completed' ? "bg-aura-glow text-black" : "bg-white/5 text-white/40 hover:bg-white/10"
                        )}
                      >
                        <span className="font-bold">{format(date, 'd')}</span>
                        <span>{format(date, 'MMM')}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const HUDModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialHabit 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSave: (habit: Partial<Habit>) => void;
  initialHabit?: Habit | null;
}) => {
  const [name, setName] = useState(initialHabit?.name || '');
  const [icon, setIcon] = useState(initialHabit?.icon || '🚀');
  const [intensity, setIntensity] = useState(initialHabit?.intensity || 50);
  const [goalDays, setGoalDays] = useState(initialHabit?.goalDays || 30);
  const [tab, setTab] = useState<'icons' | 'emojis'>('emojis');

  useEffect(() => {
    if (initialHabit) {
      setName(initialHabit.name);
      setIcon(initialHabit.icon);
      setIntensity(initialHabit.intensity);
      setGoalDays(initialHabit.goalDays);
    } else {
      setName('');
      setIcon('🚀');
      setIntensity(50);
      setGoalDays(30);
    }
  }, [initialHabit, isOpen]);

  if (!isOpen) return null;

  const emojis = ['🔥', '💧', '⚡', '🧠', '💪', '🧘', '🥗', '📚', '💻', '🎨', '🎸', '🏃'];
  const icons = ['Activity', 'Zap', 'Brain', 'Target', 'Heart', 'Code', 'Book', 'Music', 'Camera', 'Coffee', 'Moon', 'Sun'];

  return (
    <div className="hud-modal">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="glass-panel w-full max-w-sm rounded-[2rem] p-6 relative"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold tracking-tight uppercase">
            {initialHabit ? 'Edit Protocol' : 'New Protocol'}
          </h2>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40">Protocol Identity</label>
            <input 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Neural Link Deep Work"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-aura-glow/50 transition-colors font-medium"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40">Visual Core</label>
              <div className="flex gap-2 bg-white/5 p-1 rounded-lg">
                <button 
                  onClick={() => setTab('emojis')}
                  className={cn("px-2 py-1 text-[8px] rounded-md font-bold uppercase", tab === 'emojis' ? "bg-white/10 text-white" : "text-white/40")}
                >
                  Emojis
                </button>
                <button 
                  onClick={() => setTab('icons')}
                  className={cn("px-2 py-1 text-[8px] rounded-md font-bold uppercase", tab === 'icons' ? "bg-white/10 text-white" : "text-white/40")}
                >
                  Icons
                </button>
              </div>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {tab === 'emojis' ? (
                emojis.map(i => (
                  <button 
                    key={i}
                    onClick={() => setIcon(i)}
                    className={cn(
                      "aspect-square rounded-xl flex items-center justify-center text-xl transition-all",
                      icon === i ? "bg-aura-glow/20 border border-aura-glow/50 scale-110" : "bg-white/5 border border-transparent hover:bg-white/10"
                    )}
                  >
                    {i}
                  </button>
                ))
              ) : (
                icons.map(i => {
                  const IconComp = ICON_MAP[i];
                  return (
                    <button 
                      key={i}
                      onClick={() => setIcon(i)}
                      className={cn(
                        "aspect-square rounded-xl flex items-center justify-center transition-all",
                        icon === i ? "bg-aura-glow/20 border border-aura-glow/50 scale-110" : "bg-white/5 border border-transparent hover:bg-white/10"
                      )}
                    >
                      <IconComp className={cn("w-5 h-5", icon === i ? "text-aura-glow" : "text-white/40")} />
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40">Intensity Throttle</label>
              <span className="text-xs font-mono text-aura-glow">{intensity}%</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={intensity}
              onChange={(e) => setIntensity(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40">Goal Horizon</label>
              <span className="text-xs font-mono text-aura-glow">{goalDays} Days</span>
            </div>
            <input 
              type="range" 
              min="7" 
              max="365" 
              value={goalDays}
              onChange={(e) => setGoalDays(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <button 
            onClick={() => onSave({ name, icon, intensity, goalDays })}
            className="w-full py-4 bg-aura-glow text-black rounded-2xl font-black uppercase tracking-[0.2em] shadow-[0_0_30px_var(--color-aura-glow)] hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            {initialHabit ? 'Update Protocol' : 'Ignite Protocol'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// --- Main Views ---

const ProtocolsView = ({ onEdit }: { onEdit: (habit: Habit) => void }) => {
  const habits = useLiveQuery(() => db.habits.toArray());
  const settings = useLiveQuery(() => db.settings.toCollection().first());

  const handleLog = async (habitId: number, status: 'completed' | 'skipped', date?: Date) => {
    const dateStr = format(date || new Date(), 'yyyy-MM-dd');
    const existing = await db.logs.where('[habitId+date]').equals([habitId, dateStr]).first();
    
    if (existing) {
      if (existing.status === status) {
        await db.logs.delete(existing.id!);
      } else {
        await db.logs.update(existing.id!, { status });
        if (status === 'completed') {
          playSyncSound(settings?.soundPreset);
        }
      }
    } else {
      await db.logs.add({ habitId, status, date: dateStr });
      if (status === 'completed') {
        playSyncSound(settings?.soundPreset);
      }
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Decommission this protocol?')) {
      await db.habits.delete(id);
      await db.logs.where('habitId').equals(id).delete();
    }
  };

  return (
    <div className="px-6 pb-32 pt-4">
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tighter uppercase mb-1">Active Protocols</h1>
        <p className="text-[10px] font-mono uppercase tracking-widest opacity-40">System Status: Operational</p>
      </div>

      <AnimatePresence mode="popLayout">
        {habits?.map((habit, idx) => (
          <HabitCard 
            key={habit.id ?? idx} 
            habit={habit} 
            onLog={handleLog}
            onEdit={onEdit}
            onDelete={handleDelete}
          />
        ))}
      </AnimatePresence>

      {habits?.length === 0 && (
        <div className="py-20 text-center opacity-30">
          <Zap className="w-12 h-12 mx-auto mb-4" />
          <p className="uppercase tracking-widest text-xs font-bold">No Protocols Initialized</p>
        </div>
      )}
    </div>
  );
};

const EvolutionView = () => {
  const habits = useLiveQuery(() => db.habits.toArray());
  const logs = useLiveQuery(() => db.logs.toArray());

  const auraSync = useMemo(() => {
    if (!habits?.length || !logs) return 0;
    const today = format(new Date(), 'yyyy-MM-dd');
    const completedToday = logs.filter(l => l.date === today && l.status === 'completed').length;
    return Math.round((completedToday / habits.length) * 100);
  }, [habits, logs]);

  const weeklyStats = useMemo(() => {
    if (!logs) return [];
    const days = eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() });
    return days.map(d => {
      const dateStr = format(d, 'yyyy-MM-dd');
      const count = logs.filter(l => l.date === dateStr && l.status === 'completed').length;
      return { date: dateStr, count };
    });
  }, [logs]);

  const heatmapData = useMemo(() => {
    if (!logs) return [];
    const days = eachDayOfInterval({ start: subDays(new Date(), 34), end: new Date() });
    return days.map(d => {
      const dateStr = format(d, 'yyyy-MM-dd');
      const completed = logs.filter(l => l.date === dateStr && l.status === 'completed').length;
      return { date: dateStr, intensity: completed };
    });
  }, [logs]);

  return (
    <div className="px-6 pb-32 pt-4">
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tighter uppercase mb-1">Evolution</h1>
        <p className="text-[10px] font-mono uppercase tracking-widest opacity-40">Neural Sync Analytics</p>
      </div>

      <div className="glass-panel rounded-[2.5rem] p-8 mb-6 flex flex-col items-center justify-center text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-aura-glow/5 animate-pulse" />
        
        <div className="relative w-48 h-48 mb-6">
          <svg className="w-full h-full -rotate-90">
            <circle 
              cx="96" cy="96" r="80" 
              className="stroke-white/5 fill-none" 
              strokeWidth="8" 
            />
            <motion.circle 
              cx="96" cy="96" r="80" 
              className="stroke-aura-glow fill-none" 
              strokeWidth="8"
              strokeDasharray="502.6"
              initial={{ strokeDashoffset: 502.6 }}
              animate={{ strokeDashoffset: 502.6 - (502.6 * auraSync) / 100 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 8px var(--color-aura-glow))' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-black tracking-tighter">{auraSync}%</span>
            <span className="text-[8px] uppercase tracking-[0.2em] font-bold opacity-40">Daily Aura Sync</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full">
          <div className="bg-white/5 rounded-2xl p-4">
            <div className="text-2xl font-bold">{habits?.length || 0}</div>
            <div className="text-[8px] uppercase tracking-widest opacity-40">Active Nodes</div>
          </div>
          <div className="bg-white/5 rounded-2xl p-4">
            <div className="text-2xl font-bold">{logs?.filter(l => l.status === 'completed').length || 0}</div>
            <div className="text-[8px] uppercase tracking-widest opacity-40">Total Syncs</div>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-3xl p-6 mb-6">
        <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40 mb-6">Weekly Pulse</h3>
        <div className="flex items-end justify-between h-32 gap-2">
          {weeklyStats.map((s, i) => {
            const max = Math.max(...weeklyStats.map(x => x.count), 1);
            const height = (s.count / max) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  className="w-full bg-aura-glow/20 border-t-2 border-aura-glow rounded-t-sm relative group"
                >
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                    {s.count}
                  </div>
                </motion.div>
                <span className="text-[8px] font-mono opacity-30 uppercase">{format(parseISO(s.date), 'EEE')}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="glass-panel rounded-3xl p-6">
        <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40 mb-4">Neural Heatmap</h3>
        <div className="grid grid-cols-7 gap-1">
          {heatmapData.map((d, i) => (
            <div 
              key={i}
              className="aspect-square rounded-sm transition-all"
              style={{ 
                backgroundColor: d.intensity > 0 ? `rgba(var(--primary-glow-rgb), ${Math.min(d.intensity * 0.25, 1)})` : 'rgba(255,255,255,0.05)',
                boxShadow: d.intensity > 0 ? `0 0 10px rgba(var(--primary-glow-rgb), ${d.intensity * 0.1})` : 'none'
              }}
              title={`${d.date}: ${d.intensity} completed`}
            />
          ))}
        </div>
        <div className="flex justify-between mt-2 text-[8px] font-mono opacity-30 uppercase">
          <span>35 Days Ago</span>
          <span>Today</span>
        </div>
      </div>
    </div>
  );
};

const SystemView = () => {
  const settings = useLiveQuery(() => db.settings.toCollection().first());

  const updateGlow = async (color: string) => {
    if (settings?.id) {
      await db.settings.update(settings.id, { primaryGlow: color });
    }
  };

  const updateSound = async (preset: string) => {
    if (settings?.id) {
      await db.settings.update(settings.id, { soundPreset: preset });
    }
  };

  const updateUserName = async (name: string) => {
    if (settings?.id) {
      await db.settings.update(settings.id, { userName: name });
    }
  };

  const toggleNeuralSync = async () => {
    if (settings?.id) {
      await db.settings.update(settings.id, { neuralSyncEnabled: !settings.neuralSyncEnabled });
    }
  };

  const resetData = async () => {
    if (confirm('CRITICAL: This will wipe all neural data. Proceed?')) {
      await db.habits.clear();
      await db.logs.clear();
      window.location.reload();
    }
  };

  const themes = [
    { name: 'Cyberpunk Neon', color: '#00ffcc' },
    { name: 'Martian Red', color: '#ff3366' },
    { name: 'Deep Space Blue', color: '#3366ff' },
    { name: 'Neural Gold', color: '#ffcc00' },
    { name: 'Void Purple', color: '#cc00ff' }
  ];

  return (
    <div className="px-6 pb-32 pt-4">
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tighter uppercase mb-1">System</h1>
        <p className="text-[10px] font-mono uppercase tracking-widest opacity-40">Core Configuration</p>
      </div>

      <div className="space-y-6">
        <div className="glass-panel rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <User className="w-5 h-5 text-aura-glow" />
            <h3 className="text-xs uppercase tracking-widest font-bold">Neural Identity</h3>
          </div>
          <input 
            value={settings?.userName || ''}
            onChange={(e) => updateUserName(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-aura-glow/50 transition-colors font-medium"
            placeholder="Enter Name"
          />
        </div>

        <div className="glass-panel rounded-3xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-aura-glow" />
              <h3 className="text-xs uppercase tracking-widest font-bold">Neural Sync</h3>
            </div>
            <button 
              onClick={toggleNeuralSync}
              className={cn(
                "w-12 h-6 rounded-full transition-all relative",
                settings?.neuralSyncEnabled ? "bg-aura-glow" : "bg-white/10"
              )}
            >
              <div className={cn(
                "absolute top-1 w-4 h-4 rounded-full bg-black transition-all",
                settings?.neuralSyncEnabled ? "left-7" : "left-1"
              )} />
            </button>
          </div>
          <p className="text-[8px] uppercase tracking-widest opacity-30 leading-relaxed">
            Enables high-frequency audio feedback and haptic synchronization during protocol completion.
          </p>
        </div>

        <div className="glass-panel rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <Palette className="w-5 h-5 text-aura-glow" />
            <h3 className="text-xs uppercase tracking-widest font-bold">Aura Spectrum</h3>
          </div>
          
          <div className="grid grid-cols-5 gap-3 mb-6">
            {themes.map(t => (
              <button 
                key={t.name}
                onClick={() => updateGlow(t.color)}
                className={cn(
                  "aspect-square rounded-full border-2 transition-all",
                  settings?.primaryGlow === t.color ? "border-white scale-110 shadow-[0_0_15px_var(--color-aura-glow)]" : "border-transparent"
                )}
                style={{ backgroundColor: t.color }}
              />
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-bold opacity-40">Custom Hex</label>
            <div className="flex gap-2">
              <input 
                type="color" 
                value={settings?.primaryGlow || '#00ffcc'}
                onChange={(e) => updateGlow(e.target.value)}
                className="w-12 h-12 bg-transparent border-none cursor-pointer"
              />
              <input 
                type="text" 
                value={settings?.primaryGlow || ''}
                onChange={(e) => updateGlow(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 font-mono text-sm uppercase"
              />
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <Volume2 className="w-5 h-5 text-aura-glow" />
            <h3 className="text-xs uppercase tracking-widest font-bold">Audio Feedback</h3>
          </div>
          
          <select 
            value={settings?.soundPreset}
            onChange={(e) => updateSound(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-aura-glow/50 transition-colors font-medium appearance-none"
          >
            <option value="Cyber Chime">Cyber Chime</option>
            <option value="Neural Beep">Neural Beep</option>
            <option value="SpaceX Launch">SpaceX Launch</option>
          </select>
        </div>

        <button 
          onClick={resetData}
          className="w-full py-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl font-bold uppercase tracking-widest hover:bg-red-500/20 transition-all"
        >
          Decommission All Data
        </button>

        <div className="p-8 text-center opacity-20">
          <p className="text-[8px] font-mono uppercase tracking-[0.4em]">Aura OS v1.0.4 // Neuralink Certified</p>
        </div>
      </div>
    </div>
  );
};

// --- App Shell ---

export default function App() {
  const [activeTab, setActiveTab] = useState<'protocols' | 'evolution' | 'system'>('protocols');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  
  const settings = useLiveQuery(() => db.settings.toCollection().first());
  const habits = useLiveQuery(() => db.habits.toArray());
  const logs = useLiveQuery(() => db.logs.toArray());

  const isSyncActive = useMemo(() => {
    if (!habits?.length || !logs) return false;
    const today = format(new Date(), 'yyyy-MM-dd');
    const logsToday = logs.filter(l => l.date === today);
    return logsToday.length > 0;
  }, [habits, logs]);

  useEffect(() => {
    if (settings?.primaryGlow) {
      document.documentElement.style.setProperty('--primary-glow', settings.primaryGlow);
      const rgb = hexToRgb(settings.primaryGlow);
      if (rgb) {
        document.documentElement.style.setProperty('--primary-glow-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
      }
    }
  }, [settings]);

  const handleSaveHabit = async (habitData: Partial<Habit>) => {
    if (editingHabit?.id) {
      await db.habits.update(editingHabit.id, habitData);
    } else {
      await db.habits.add({
        ...habitData as Habit,
        createdAt: new Date()
      });
    }
    setIsModalOpen(false);
    setEditingHabit(null);
  };

  return (
    <div className="min-h-screen max-w-md mx-auto relative">
      {/* Header */}
      <header className="px-6 pt-8 pb-4 flex items-center justify-between sticky top-0 z-40 bg-vantablack/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-aura-glow/20 flex items-center justify-center relative animate-supernova">
            <Crown className="w-5 h-5 text-aura-glow" />
          </div>
          <div className="flex flex-col">
            <Typewriter text={settings?.userName || "Thant Zin Aung"} />
            <span className="text-[8px] font-mono uppercase tracking-widest opacity-40">Aura Level: Elite</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(
            "px-3 py-1 border rounded-full transition-all duration-500",
            isSyncActive ? "bg-aura-glow/10 border-aura-glow/30" : "bg-white/5 border-white/10 opacity-50"
          )}>
            <span className={cn(
              "text-[10px] font-bold uppercase tracking-tighter",
              isSyncActive ? "text-aura-glow" : "text-white/40"
            )}>
              {isSyncActive ? 'Sync Active' : 'Sync Standby'}
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10">
        <AnimatePresence mode="wait">
          {activeTab === 'protocols' && (
            <motion.div 
              key="protocols"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <ProtocolsView onEdit={(h) => { setEditingHabit(h); setIsModalOpen(true); }} />
            </motion.div>
          )}
          {activeTab === 'evolution' && (
            <motion.div 
              key="evolution"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <EvolutionView />
            </motion.div>
          )}
          {activeTab === 'system' && (
            <motion.div 
              key="system"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <SystemView />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating Action Button */}
      <button 
        onClick={() => { setEditingHabit(null); setIsModalOpen(true); }}
        className="fixed bottom-24 right-6 w-14 h-14 bg-aura-glow text-black rounded-full flex items-center justify-center shadow-[0_0_30px_var(--color-aura-glow)] z-50 hover:scale-110 active:scale-95 transition-all"
      >
        <Plus className="w-8 h-8" />
      </button>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm glass-panel rounded-full p-2 flex items-center justify-between z-50">
        <button 
          onClick={() => setActiveTab('protocols')}
          className={cn(
            "flex-1 flex flex-col items-center py-2 rounded-full transition-all",
            activeTab === 'protocols' ? "bg-white/10 text-aura-glow" : "text-white/40"
          )}
        >
          <Zap className="w-5 h-5" />
          <span className="text-[8px] uppercase font-bold mt-1">Protocols</span>
        </button>
        <button 
          onClick={() => setActiveTab('evolution')}
          className={cn(
            "flex-1 flex flex-col items-center py-2 rounded-full transition-all",
            activeTab === 'evolution' ? "bg-white/10 text-aura-glow" : "text-white/40"
          )}
        >
          <Activity className="w-5 h-5" />
          <span className="text-[8px] uppercase font-bold mt-1">Evolution</span>
        </button>
        <button 
          onClick={() => setActiveTab('system')}
          className={cn(
            "flex-1 flex flex-col items-center py-2 rounded-full transition-all",
            activeTab === 'system' ? "bg-white/10 text-aura-glow" : "text-white/40"
          )}
        >
          <SettingsIcon className="w-5 h-5" />
          <span className="text-[8px] uppercase font-bold mt-1">System</span>
        </button>
      </nav>

      <HUDModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleSaveHabit}
        initialHabit={editingHabit}
      />
    </div>
  );
}
