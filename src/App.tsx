/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls, useMotionValue, useTransform, animate } from 'motion/react';
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
  ShieldCheck,
  ShieldAlert,
  Trophy,
  Sparkles,
  Dumbbell,
  Flame,
  Droplets,
  Utensils,
  Laptop,
  Gamepad2,
  Bike,
  Timer,
  Cloud,
  Star,
  Smile,
  GripVertical,
  BarChart3,
  Smartphone,
  Bell,
  ChevronDown
} from 'lucide-react';

const ICON_MAP: Record<string, any> = {
  Activity, Zap, Brain, Target, Heart, Code, Book, Music, Camera, Coffee, Moon, Sun,
  Dumbbell, Flame, Droplets, Utensils, Laptop, Palette, Gamepad2, Bike, Timer, Cloud, Star, Smile
};
import { useLiveQuery } from 'dexie-react-hooks';
import { format, startOfToday, subDays, eachDayOfInterval, isSameDay, parseISO, isBefore, startOfDay } from 'date-fns';
import { db, type Habit, type HabitLog, type Settings } from './db';
import { cn, hexToRgb } from './lib/utils';

import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  AreaChart, Area
} from 'recharts';

// --- Streak Utility ---
const calculateStreak = (habit: Habit, logs: HabitLog[]) => {
  let count = 0;
  let current = startOfToday();
  const todayStr = format(current, 'yyyy-MM-dd');
  const todayLogEntry = logs.find(l => l.date === todayStr);
  
  if (todayLogEntry?.status !== 'completed') {
    if (habit.isStrict && todayLogEntry?.status === 'skipped') return 0;
    current = subDays(current, 1);
  }

  while (true) {
    const dateStr = format(current, 'yyyy-MM-dd');
    const log = logs.find(l => l.date === dateStr);
    
    if (log?.status === 'completed') {
      count++;
      current = subDays(current, 1);
    } else if (log?.status === 'skipped') {
      if (habit.isStrict) {
        break;
      } else {
        current = subDays(current, 1);
      }
    } else {
      if (isBefore(current, startOfDay(habit.createdAt))) break;
      break;
    }
  }
  return count;
};

const calculateLongestStreak = (habit: Habit, logs: HabitLog[]) => {
  let maxStreak = 0;
  let currentStreak = 0;
  
  const sortedLogs = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const logMap = new Map(sortedLogs.map(l => [l.date, l.status]));
  
  const days = eachDayOfInterval({ 
    start: startOfDay(habit.createdAt), 
    end: startOfToday() 
  });
  
  for (const day of days) {
    const dateStr = format(day, 'yyyy-MM-dd');
    const status = logMap.get(dateStr);
    
    if (status === 'completed') {
      currentStreak++;
      if (currentStreak > maxStreak) maxStreak = currentStreak;
    } else if (status === 'skipped') {
      if (habit.isStrict) {
        currentStreak = 0;
      }
    } else {
      currentStreak = 0;
    }
  }
  
  return maxStreak;
};

const sendNotification = async (title: string, options: NotificationOptions & { sticky?: boolean }) => {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const notificationOptions: NotificationOptions = {
      ...options,
      badge: '/favicon.ico',
      tag: options.sticky ? 'aura-persistent' : options.tag,
      requireInteraction: options.sticky ? true : options.requireInteraction,
      silent: options.sticky ? true : options.silent,
    };

    if (registration && 'showNotification' in registration) {
      await registration.showNotification(title, notificationOptions);
    } else {
      new Notification(title, notificationOptions);
    }
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};

const triggerHaptic = (type: 'completed' | 'skipped', settings?: Settings) => {
  if (!settings?.hapticEnabled) return;
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    if (type === 'completed') {
      navigator.vibrate(50);
    } else {
      navigator.vibrate(100);
    }
  }
};

// --- Sound Utility ---
const FREQUENCY_MAP: Record<number, number> = {
  1: 150,
  2: 300,
  3: 600,
  4: 1200,
  5: 2400,
  6: 4800
};

const playSyncSound = (preset: string = 'Starlink Alpha', level: number = 3, type: 'completed' | 'skipped' = 'completed') => {
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  oscillator.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  const now = audioCtx.currentTime;
  const baseFreq = FREQUENCY_MAP[level] || 600;

  if (preset.includes('Starlink')) {
    // Starklink Tesla Sound: Clean, resonant, futuristic
    oscillator.type = 'sine';
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(type === 'completed' ? baseFreq * 2 : baseFreq, now);
    filter.Q.setValueAtTime(10, now);
    
    oscillator.frequency.setValueAtTime(type === 'completed' ? baseFreq : baseFreq * 0.5, now);
    oscillator.frequency.exponentialRampToValueAtTime(type === 'completed' ? baseFreq * 0.5 : baseFreq * 0.2, now + 0.5);
    
    gainNode.gain.setValueAtTime(0.2, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    
    oscillator.start(now);
    oscillator.stop(now + 0.5);
  } else if (preset === 'Neural Uplink' || preset === 'Quantum Pulse') {
    oscillator.type = 'square';
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(baseFreq, now);
    
    oscillator.frequency.setValueAtTime(baseFreq * 2, now);
    oscillator.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.2);
    
    gainNode.gain.setValueAtTime(0.1, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    
    oscillator.start(now);
    oscillator.stop(now + 0.2);
  } else {
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(baseFreq, now);
    gainNode.gain.setValueAtTime(0.1, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    oscillator.start(now);
    oscillator.stop(now + 0.3);
  }

  // Simulated Haptic (Screen Shake)
  if (level >= 5) {
    document.body.style.transform = `translate(${Math.random() * 2 - 1}px, ${Math.random() * 2 - 1}px)`;
    setTimeout(() => {
      document.body.style.transform = 'none';
    }, 50);
  }
};

const playCelebrationSound = () => {
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const playNote = (freq: number, startTime: number, duration: number) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0.1, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration);
  };

  const now = audioCtx.currentTime;
  // Arpeggio
  playNote(523.25, now, 0.5); // C5
  playNote(659.25, now + 0.1, 0.5); // E5
  playNote(783.99, now + 0.2, 0.5); // G5
  playNote(1046.50, now + 0.3, 1.0); // C6
};

// --- Components ---

const CelebrationOverlay = ({ 
  habitName, 
  onComplete 
}: { 
  habitName: string; 
  onComplete: () => void 
}) => {
  useEffect(() => {
    playCelebrationSound();
    const timer = setTimeout(onComplete, 4000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[2000] flex flex-col items-center justify-center bg-vantablack/90 backdrop-blur-xl overflow-hidden"
    >
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", damping: 12, stiffness: 100 }}
        className="relative mb-8"
      >
        <div className="absolute inset-0 bg-aura-glow/20 blur-[100px] rounded-full animate-pulse" />
        <div className="w-32 h-32 rounded-full bg-aura-glow/10 border-2 border-aura-glow flex items-center justify-center relative">
          <Trophy className="w-16 h-16 text-aura-glow" />
          <motion.div
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute -top-2 -right-2"
          >
            <Sparkles className="w-8 h-8 text-aura-glow" />
          </motion.div>
        </div>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-center px-8"
      >
        <h2 className="text-3xl font-black tracking-tighter uppercase mb-2 bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent">
          Goal Horizon Reached
        </h2>
        <p className="text-xs font-mono uppercase tracking-[0.3em] text-aura-glow mb-6">
          Neural Protocol Optimized: {habitName}
        </p>
        <div className="flex justify-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              className="w-2 h-2 rounded-full bg-aura-glow shadow-[0_0_10px_var(--color-aura-glow)]"
            />
          ))}
        </div>
      </motion.div>

      {/* Particle Effects */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ 
              x: "50%", 
              y: "50%", 
              scale: 0,
              opacity: 1 
            }}
            animate={{ 
              x: `${Math.random() * 100}%`, 
              y: `${Math.random() * 100}%`,
              scale: Math.random() * 2,
              opacity: 0
            }}
            transition={{ 
              duration: 2 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2
            }}
            className="absolute w-1 h-1 bg-aura-glow rounded-full"
          />
        ))}
      </div>
    </motion.div>
  );
};

const ConfirmDialog = ({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel,
  variant = 'danger'
}: { 
  isOpen: boolean; 
  title: string; 
  message: string; 
  onConfirm: () => void; 
  onCancel: () => void;
  variant?: 'danger' | 'warning'
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-vantablack/80 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-panel w-full max-w-xs rounded-3xl p-6 text-center"
      >
        <div className={cn(
          "w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center",
          variant === 'danger' ? "bg-red-500/20 text-red-500" : "bg-amber-500/20 text-amber-500"
        )}>
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold uppercase tracking-tight mb-2">{title}</h3>
        <p className="text-xs opacity-60 mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button 
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-white/5 font-bold text-[12px] uppercase tracking-widest hover:bg-white/10 transition-colors"
          >
            Abort
          </button>
          <button 
            onClick={onConfirm}
            className={cn(
              "flex-1 py-3 rounded-xl font-bold text-[12px] uppercase tracking-widest transition-colors",
              variant === 'danger' ? "bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]" : "bg-amber-500 text-black"
            )}
          >
            Confirm
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const QUOTES = [
  "Mind is the forerunner of all actions. All deeds are led by mind, created by mind.",
  "If one speaks or acts with a corrupt mind, suffering follows, as the wheel follows the hoof of the ox.",
  "If one speaks or acts with a serene mind, happiness follows, as one's shadow that never leaves.",
  "Hatred is never appeased by hatred in this world. By non-hatred alone is hatred appeased.",
  "As a solid rock is not shaken by the wind, even so the wise are not ruffled by praise or blame.",
  "Better than a thousand hollow words, is one word that brings peace.",
  "Victory breeds hatred. The defeated live in pain. Happily the peaceful live, giving up victory and defeat.",
  "Health is the greatest gift, contentment the greatest wealth, faithfulness the best relationship.",
  "Irrigators channel waters; fletchers straighten arrows; carpenters bend wood; the wise master themselves.",
  "The way is not in the sky. The way is in the heart.",
  "Purity and impurity depend on oneself; no one can purify another.",
  "Do not dwell in the past, do not dream of the future, concentrate the mind on the present moment.",
  "Three things cannot be long hidden: the sun, the moon, and the truth.",
  "Peace comes from within. Do not seek it without.",
  "The mind is everything. What you think you become.",
  "Work out your own salvation. Do not depend on others.",
  "No one saves us but ourselves. No one can and no one may. We ourselves must walk the path.",
  "Thousands of candles can be lighted from a single candle, and the life of the candle will not be shortened.",
  "A jug fills drop by drop.",
  "To conquer oneself is a greater task than conquering others.",
  "Those who are free of resentful thoughts surely find peace.",
  "If a man's mind becomes pure, his surroundings will also become pure.",
  "One who acts on truth is happy in this world and beyond."
];

const Typewriter = ({ text, className, speed = 200, delay = 3000 }: { text: string, className?: string, speed?: number, delay?: number }) => {
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setDisplayText('');
    setIsDeleting(false);
    setIndex(0);
  }, [text]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isDeleting && index < text.length) {
        setDisplayText(prev => prev + text[index]);
        setIndex(prev => prev + 1);
      } else if (isDeleting && index > 0) {
        setDisplayText(prev => prev.slice(0, -1));
        setIndex(prev => prev - 1);
      } else if (!isDeleting && index === text.length) {
        setTimeout(() => setIsDeleting(true), delay);
      } else if (isDeleting && index === 0) {
        setIsDeleting(false);
      }
    }, isDeleting ? speed / 3 : speed);

    return () => clearTimeout(timeout);
  }, [index, isDeleting, text, speed, delay]);

  return (
    <span className={cn("font-mono tracking-widest uppercase whitespace-pre-wrap inline-block", className)}>
      {displayText}
      <span className="animate-pulse">|</span>
    </span>
  );
};

const HabitCard = memo(({ 
  habit, 
  onLog, 
  onEdit, 
  onDelete,
  onExpandChange,
  onKeyboardActive,
  settings
}: { 
  key?: React.Key;
  habit: Habit; 
  onLog: (id: number, status: 'completed' | 'skipped', date?: Date) => Promise<void>;
  onEdit: (habit: Habit) => void;
  onDelete: (id: number) => Promise<void>;
  onExpandChange?: (expanded: boolean) => void;
  onKeyboardActive?: (active: boolean) => void;
  settings?: Settings;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [note, setNote] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  
  const logs = useLiveQuery(() => db.logs.where('habitId').equals(habit.id!).toArray(), [habit.id]);
  const todayLog = logs?.find(l => l.date === format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    if (todayLog?.notes) setNote(todayLog.notes);
    else setNote('');
  }, [todayLog]);

  const [dragX, setDragX] = useState(0);

  const streak = useMemo(() => {
    if (!logs) return 0;
    return calculateStreak(habit, logs);
  }, [logs, habit]);

  const IconComponent = ICON_MAP[habit.icon];

  const handleSaveNote = async () => {
    if (todayLog?.id) {
      await db.logs.update(todayLog.id, { notes: note });
      setIsSaved(true);
      setTimeout(() => {
        setIsSaved(false);
        setIsExpanded(false);
        onExpandChange?.(false);
      }, 1000);
    }
  };

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x > 100) {
      triggerHaptic('completed', settings);
      onLog(habit.id!, 'completed');
    } else if (info.offset.x < -100) {
      triggerHaptic('skipped', settings);
      onLog(habit.id!, 'skipped');
    }
    
    // Smoothly animate back to 0
    animate(dragX, 0, {
      type: "spring",
      stiffness: 500,
      damping: 30,
      onUpdate: (latest) => setDragX(latest)
    });
  };

  const toggleExpand = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    onExpandChange?.(next);
  };

  const dragControls = useDragControls();

  return (
    <Reorder.Item 
      value={habit}
      dragListener={false}
      dragControls={dragControls}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="relative"
    >
      <motion.div 
        layout
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.7}
        onDrag={(e, info) => setDragX(info.offset.x)}
        onDragEnd={handleDragEnd}
        className="glass-panel rounded-2xl p-2.5 mb-2 relative overflow-hidden group touch-none"
      >
        {/* Swipe Indicators */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
          {/* Complete Indicator (Left) */}
          <motion.div 
            className="absolute inset-y-0 left-0 w-full flex items-center justify-start pl-6"
            style={{ 
              opacity: dragX > 0 ? Math.min(dragX / 80, 1) : 0,
              backgroundColor: dragX > 0 ? `rgba(16, 185, 129, ${Math.min(dragX / 400, 0.15)})` : 'transparent'
            }}
          >
            <motion.div
              style={{ 
                x: dragX > 0 ? (dragX - 100) / 4 : -25,
                scale: dragX > 100 ? 1.2 : 1,
              }}
              animate={{ 
                scale: dragX > 100 ? [1.2, 1.3, 1.2] : 1.2,
              }}
              transition={{ repeat: dragX > 100 ? Infinity : 0, duration: 0.6 }}
            >
              <div className="relative">
                <div 
                  className="absolute inset-0 blur-xl opacity-50 rounded-full"
                  style={{ backgroundColor: habit.color || '#10b981' }}
                />
                <Check 
                  className="w-8 h-8 relative z-10" 
                  style={{ 
                    color: habit.color || '#10b981',
                    filter: dragX > 100 ? `drop-shadow(0 0 10px ${habit.color || '#10b981'})` : 'none'
                  }} 
                />
              </div>
            </motion.div>
          </motion.div>

          {/* Skip Indicator (Right) */}
          <motion.div 
            className="absolute inset-y-0 right-0 w-full flex items-center justify-end pr-6"
            style={{ 
              opacity: dragX < 0 ? Math.min(-dragX / 80, 1) : 0,
              backgroundColor: dragX < 0 ? `rgba(245, 158, 11, ${Math.min(-dragX / 400, 0.15)})` : 'transparent'
            }}
          >
            <motion.div
              style={{ 
                x: dragX < 0 ? (dragX + 100) / 4 : 25,
                scale: dragX < -100 ? 1.2 : 1,
              }}
              animate={{ 
                scale: dragX < -100 ? [1.2, 1.3, 1.2] : 1.2,
              }}
              transition={{ repeat: dragX < -100 ? Infinity : 0, duration: 0.6 }}
            >
              <div className="relative">
                <div className="absolute inset-0 blur-xl opacity-50 rounded-full bg-amber-500" />
                <X 
                  className="w-8 h-8 relative z-10 text-amber-500"
                  style={{ 
                    filter: dragX < -100 ? 'drop-shadow(0 0 10px #f59e0b)' : 'none'
                  }}
                />
              </div>
            </motion.div>
          </motion.div>
        </div>

        <motion.div 
          style={{ 
            x: dragX,
            rotate: dragX / 20,
            scale: 1 - Math.min(Math.abs(dragX) / 1000, 0.05)
          }}
          className="relative z-10"
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div 
                onPointerDown={(e) => dragControls.start(e)}
                className="p-1 -ml-2 opacity-0 group-hover:opacity-40 cursor-grab active:cursor-grabbing transition-opacity"
              >
                <GripVertical className="w-2.5 h-2.5" />
              </div>
              <div 
                className="w-7 h-7 rounded-lg flex items-center justify-center text-base overflow-hidden"
                style={{ 
                  backgroundColor: `${habit.color || '#00ffcc'}20`,
                  boxShadow: `0 0 8px ${habit.color || '#00ffcc'}30`
                }}
              >
                {habit.icon.startsWith('data:') ? (
                  <img src={habit.icon} alt={habit.name} className="w-full h-full object-cover" />
                ) : IconComponent ? (
                  <IconComponent className="w-3.5 h-3.5" style={{ color: habit.color || 'var(--color-aura-glow)' }} />
                ) : (
                  <span className="text-xs">{habit.icon}</span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm leading-tight">{habit.name}</h3>
                  {habit.isStrict && (
                    <div className="px-1 py-0.5 rounded-md bg-red-500/20 border border-red-500/30 text-[4px] text-red-500 uppercase font-black tracking-widest">
                      Strict
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[7px] uppercase tracking-wider opacity-40 font-mono">
                  <span style={{ color: habit.color }}>Streak: {streak}d</span>
                  <span>•</span>
                  <span>{habit.intensity}%</span>
                </div>
              </div>
            </div>
            <button 
              onClick={toggleExpand}
              className="p-1 hover:bg-white/5 rounded-full transition-colors"
            >
              <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", isExpanded && "rotate-90")} />
            </button>
          </div>

          <div className="flex gap-1.5 mb-2">
            <button 
              onClick={() => {
                triggerHaptic('completed', settings);
                onLog(habit.id!, 'completed');
              }}
              className={cn(
                "flex-1 py-1 rounded-lg font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-1.5",
                todayLog?.status === 'completed' 
                  ? "text-black bg-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.6)]" 
                  : "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 hover:border-emerald-400/30"
              )}
              style={todayLog?.status === 'completed' ? { 
                backgroundColor: '#10b981', // Modern Emerald Success
                boxShadow: `0 0 20px rgba(16, 185, 129, 0.5)`
              } : {}}
            >
              {todayLog?.status === 'completed' ? <Check className="w-2.5 h-2.5" /> : <Zap className="w-2.5 h-2.5" />}
              {todayLog?.status === 'completed' ? 'Complete' : 'Sync'}
            </button>
            <button 
              onClick={() => {
                triggerHaptic('skipped', settings);
                onLog(habit.id!, 'skipped');
              }}
              className={cn(
                "px-2.5 py-1.5 rounded-lg font-bold text-[11px] uppercase tracking-widest transition-all",
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
              const date = subDays(startOfToday(), 6 - i);
              const dateStr = format(date, 'yyyy-MM-dd');
              const log = logs?.find(l => l.date === dateStr);
              return (
                <div 
                  key={i}
                  className={cn(
                    "flex-1 h-full transition-all duration-500",
                    log?.status === 'completed' ? "" : 
                    log?.status === 'skipped' ? "bg-amber-500/50" : "bg-white/10"
                  )}
                  style={log?.status === 'completed' ? { 
                    backgroundColor: habit.color || 'var(--color-aura-glow)',
                    boxShadow: `0 0 8px ${habit.color || '#00ffcc'}80`
                  } : {}}
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
                        <label className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40">Neural Journal</label>
                        <button onClick={handleSaveNote} className={cn(
                          "text-[10px] uppercase font-bold flex items-center gap-1 transition-colors",
                          isSaved ? "text-green-400" : "text-aura-glow"
                        )}>
                          {isSaved ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
                          {isSaved ? 'Saved' : 'Save Note'}
                        </button>
                      </div>
                      <textarea 
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        onFocus={() => onKeyboardActive?.(true)}
                        onBlur={() => onKeyboardActive?.(false)}
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
                      className="flex items-center gap-2 text-[12px] uppercase tracking-widest font-bold text-aura-glow/60 hover:text-aura-glow"
                    >
                      <Calendar className="w-4 h-4" />
                      Retro Log
                    </button>
                  </div>

                  {showCalendar && (
                    <div className="mt-4 p-2 bg-black/40 rounded-xl border border-white/5 grid grid-cols-7 gap-1">
                      {Array.from({ length: 7 }).map((_, i) => {
                        const date = subDays(startOfToday(), 6 - i);
                        const dateStr = format(date, 'yyyy-MM-dd');
                        const log = logs?.find(l => l.date === dateStr);
                        return (
                          <button
                            key={i}
                            onClick={() => {
                              triggerHaptic('completed', settings);
                              onLog(habit.id!, 'completed', date);
                            }}
                            className={cn(
                              "aspect-square rounded-md flex flex-col items-center justify-center text-[10px] transition-all",
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
      </motion.div>
    </Reorder.Item>
  );
});

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
  const [color, setColor] = useState(initialHabit?.color || '#00ffcc');
  const [intensity, setIntensity] = useState(initialHabit?.intensity || 50);
  const [goalDays, setGoalDays] = useState(initialHabit?.goalDays || 30);
  const [isStrict, setIsStrict] = useState(initialHabit?.isStrict || false);
  const [tab, setTab] = useState<'icons' | 'emojis' | 'custom'>('emojis');
  const [isSuggested, setIsSuggested] = useState(false);
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Smart Suggestions Logic
  useEffect(() => {
    if (initialHabit || !name.trim()) {
      setIsSuggested(false);
      return;
    }

    const lowerName = name.toLowerCase();
    const suggestions: Record<string, { icon: string, color: string, tab: 'icons' | 'emojis' }> = {
      water: { icon: '💧', color: '#3366ff', tab: 'emojis' },
      drink: { icon: '💧', color: '#3366ff', tab: 'emojis' },
      hydrate: { icon: '💧', color: '#3366ff', tab: 'emojis' },
      gym: { icon: 'Dumbbell', color: '#ff3366', tab: 'icons' },
      workout: { icon: 'Dumbbell', color: '#ff3366', tab: 'icons' },
      lift: { icon: 'Dumbbell', color: '#ff3366', tab: 'icons' },
      exercise: { icon: 'Activity', color: '#ff3366', tab: 'icons' },
      read: { icon: '📚', color: '#ffcc00', tab: 'emojis' },
      book: { icon: '📚', color: '#ffcc00', tab: 'emojis' },
      study: { icon: 'Book', color: '#ffcc00', tab: 'icons' },
      code: { icon: 'Code', color: '#00ffcc', tab: 'icons' },
      dev: { icon: 'Laptop', color: '#00ffcc', tab: 'icons' },
      work: { icon: 'Zap', color: '#00ffcc', tab: 'icons' },
      meditate: { icon: '🧘', color: '#cc00ff', tab: 'emojis' },
      yoga: { icon: '🧘', color: '#cc00ff', tab: 'emojis' },
      zen: { icon: 'Brain', color: '#cc00ff', tab: 'icons' },
      run: { icon: '🏃', color: '#00ff99', tab: 'emojis' },
      walk: { icon: '🏃', color: '#00ff99', tab: 'emojis' },
      bike: { icon: 'Bike', color: '#00ff99', tab: 'icons' },
      sleep: { icon: 'Moon', color: '#6600ff', tab: 'icons' },
      rest: { icon: '🛌', color: '#6600ff', tab: 'emojis' },
      food: { icon: 'Utensils', color: '#ff6600', tab: 'icons' },
      eat: { icon: '🥗', color: '#ff6600', tab: 'emojis' },
      art: { icon: 'Palette', color: '#ff99cc', tab: 'icons' },
      paint: { icon: 'Palette', color: '#ff99cc', tab: 'icons' },
      music: { icon: 'Music', color: '#ff3366', tab: 'icons' },
      guitar: { icon: 'Music', color: '#ff3366', tab: 'icons' },
    };

    for (const [key, value] of Object.entries(suggestions)) {
      if (lowerName.includes(key)) {
        setIcon(value.icon);
        setColor(value.color);
        setTab(value.tab);
        setIsSuggested(true);
        return;
      }
    }
    setIsSuggested(false);
  }, [name, initialHabit]);

  useEffect(() => {
    if (initialHabit) {
      setName(initialHabit.name);
      setIcon(initialHabit.icon);
      setColor(initialHabit.color || '#00ffcc');
      setIntensity(initialHabit.intensity);
      setGoalDays(initialHabit.goalDays);
      setIsStrict(initialHabit.isStrict || false);
    } else {
      setName('');
      setIcon('🚀');
      setColor('#00ffcc');
      setIntensity(50);
      setGoalDays(30);
      setIsStrict(false);
    }
  }, [initialHabit, isOpen]);

  if (!isOpen) return null;

  const emojis = ['🔥', '💧', '⚡', '🧠', '💪', '🧘', '🥗', '📚', '💻', '🎨', '🎸', '🏃', '🧗', '🚴', '🏊', '🛌', '🚿'];
  const icons = Object.keys(ICON_MAP);
  const colors = ['#00ffcc', '#ff3366', '#3366ff', '#ffcc00', '#cc00ff', '#d4ff00', '#6600ff', '#ff6600', '#00ff99', '#ff99cc'];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setIcon(reader.result as string);
        setTab('custom');
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div 
      ref={scrollRef}
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm overflow-y-auto"
    >
      <div className={cn(
        "flex min-h-full items-start justify-center p-4 sm:items-center transition-all duration-500",
        isKeyboardActive ? "pb-[80vh]" : "pb-4"
      )}>
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          className="glass-panel w-full max-w-sm rounded-[2rem] p-6 relative mt-4 sm:my-8"
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
            <div className="flex justify-between items-center">
              <label className="text-[12px] uppercase tracking-[0.2em] font-bold opacity-40">Protocol Identity</label>
              {isSuggested && (
                <motion.span 
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-[8px] font-black uppercase tracking-widest text-aura-glow bg-aura-glow/10 px-2 py-0.5 rounded-full border border-aura-glow/20"
                >
                  Neural Suggestion Active
                </motion.span>
              )}
            </div>
            <input 
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={(e) => {
                setIsKeyboardActive(true);
                setTimeout(() => {
                  e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 600);
              }}
              onBlur={() => setIsKeyboardActive(false)}
              placeholder="e.g. Neural Link Deep Work"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 outline-none focus:border-aura-glow/50 transition-colors font-medium"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[12px] uppercase tracking-[0.2em] font-bold opacity-40">Visual Core</label>
              <div className="flex gap-2 bg-white/5 p-1 rounded-lg">
                <button 
                  onClick={() => setTab('emojis')}
                  className={cn("px-2 py-1 text-[10px] rounded-md font-bold uppercase", tab === 'emojis' ? "bg-white/10 text-white" : "text-white/40")}
                >
                  Emojis
                </button>
                <button 
                  onClick={() => setTab('icons')}
                  className={cn("px-2 py-1 text-[10px] rounded-md font-bold uppercase", tab === 'icons' ? "bg-white/10 text-white" : "text-white/40")}
                >
                  Icons
                </button>
                <button 
                  onClick={() => setTab('custom')}
                  className={cn("px-2 py-1 text-[10px] rounded-md font-bold uppercase", tab === 'custom' ? "bg-white/10 text-white" : "text-white/40")}
                >
                  Custom
                </button>
              </div>
            </div>

            {tab === 'custom' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                    {icon.startsWith('data:') ? (
                      <img src={icon} alt="Custom" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs opacity-40">?</span>
                    )}
                  </div>
                  <label className="flex-1 cursor-pointer">
                    <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-center text-[12px] font-bold uppercase tracking-widest hover:bg-white/10 transition-colors">
                      Upload Asset
                    </div>
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-6 gap-2 max-h-32 overflow-y-auto p-1 scrollbar-hide">
                {tab === 'emojis' ? (
                  emojis.map(i => (
                    <button 
                      key={i}
                      onClick={() => setIcon(i)}
                      className={cn(
                        "aspect-square rounded-xl flex items-center justify-center text-xl transition-all",
                        icon === i ? "bg-white/10 border border-white/20 scale-110" : "bg-white/5 border border-transparent hover:bg-white/10"
                      )}
                      style={icon === i ? { borderColor: `${color}80`, backgroundColor: `${color}20` } : {}}
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
                          icon === i ? "bg-white/10 border border-white/20 scale-110" : "bg-white/5 border border-transparent hover:bg-white/10"
                        )}
                        style={icon === i ? { borderColor: `${color}80`, backgroundColor: `${color}20` } : {}}
                      >
                        <IconComp className={cn("w-5 h-5", icon === i ? "" : "text-white/40")} style={icon === i ? { color: color } : {}} />
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[12px] uppercase tracking-[0.2em] font-bold opacity-40">Aura Color</label>
            <div className="flex flex-wrap gap-2">
              {colors.map(c => (
                <button 
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-6 h-6 rounded-full border-2 transition-all",
                    color === c ? "border-white scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input 
                type="color" 
                value={color}
                onChange={(e) => setColor(e.target.value)}
                onFocus={(e) => {
                  setIsKeyboardActive(true);
                  setTimeout(() => {
                    e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 600);
                }}
                onBlur={() => setIsKeyboardActive(false)}
                className="w-6 h-6 bg-transparent border-none cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <label className="text-[12px] uppercase tracking-[0.2em] font-bold opacity-40">Intensity Throttle</label>
              <span className="text-xs font-mono text-aura-glow">{intensity}%</span>
            </div>
            <div className="flex gap-2 mb-1">
              {[
                { label: 'Low', val: 25 },
                { label: 'Mid', val: 50 },
                { label: 'High', val: 75 },
                { label: 'Elite', val: 100 }
              ].map(p => (
                <button
                  key={p.label}
                  onClick={() => setIntensity(p.val)}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all border",
                    intensity === p.val 
                      ? "bg-aura-glow/20 border-aura-glow text-aura-glow" 
                      : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={intensity}
              onChange={(e) => setIntensity(parseInt(e.target.value))}
              onFocus={(e) => {
                setIsKeyboardActive(true);
                setTimeout(() => {
                  e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 600);
              }}
              onBlur={() => setIsKeyboardActive(false)}
              className="w-full h-8"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-[12px] uppercase tracking-[0.2em] font-bold opacity-40">Goal Horizon</label>
              <span className="text-xs font-mono text-aura-glow">{goalDays} Days</span>
            </div>
            <input 
              type="range" 
              min="7" 
              max="365" 
              value={goalDays}
              onChange={(e) => setGoalDays(parseInt(e.target.value))}
              onFocus={(e) => {
                setIsKeyboardActive(true);
                setTimeout(() => {
                  e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 600);
              }}
              onBlur={() => setIsKeyboardActive(false)}
              className="w-full h-8"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-aura-glow" />
                <span className="text-[12px] uppercase tracking-widest font-bold">Strict Protocol</span>
              </div>
              <p className="text-[9px] opacity-40 uppercase tracking-tighter">Zero-tolerance for skips. Streak resets on miss.</p>
            </div>
            <button 
              onClick={() => setIsStrict(!isStrict)}
              className={cn(
                "w-10 h-5 rounded-full transition-all relative",
                isStrict ? "bg-aura-glow" : "bg-white/10"
              )}
            >
              <div className={cn(
                "absolute top-0.5 w-4 h-4 rounded-full bg-black transition-all shadow-sm",
                isStrict ? "translate-x-5" : "translate-x-0.5"
              )} />
            </button>
          </div>

          <button 
            onClick={() => onSave({ name, icon, color, intensity, goalDays, isStrict })}
            className="w-full py-4 rounded-2xl font-black uppercase tracking-[0.2em] shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
            style={{ backgroundColor: color, color: '#000', boxShadow: `0 0 30px ${color}40` }}
          >
            {initialHabit ? 'Update Protocol' : 'Ignite Protocol'}
          </button>
        </div>
      </motion.div>
    </div>
  </div>
  );
};

// --- Main Views ---

const ProtocolsView = memo(({ 
  habits,
  onEdit, 
  onExpandChange, 
  onKeyboardActive,
  onCelebration,
  onReorder
}: { 
  habits: Habit[] | undefined,
  onEdit: (habit: Habit) => void, 
  onExpandChange: (id: number, expanded: boolean) => void, 
  onKeyboardActive: (active: boolean) => void,
  onCelebration: (habit: Habit) => void,
  onReorder: (habits: Habit[]) => void
}) => {
  const settings = useLiveQuery(() => db.settings.toCollection().first());
  const logs = useLiveQuery(() => db.logs.toArray());
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const pendingCount = useMemo(() => {
    if (!habits || !logs) return 0;
    const today = format(new Date(), 'yyyy-MM-dd');
    const logsToday = logs.filter(l => l.date === today);
    const completedIds = new Set(logsToday.filter(l => l.status === 'completed').map(l => l.habitId));
    return habits.filter(h => !completedIds.has(h.id!)).length;
  }, [habits, logs]);

  const handleLog = async (habitId: number, status: 'completed' | 'skipped', date?: Date) => {
    const dateStr = format(date || startOfToday(), 'yyyy-MM-dd');
    const existing = await db.logs.where('[habitId+date]').equals([habitId, dateStr]).first();
    
    if (existing) {
      if (existing.status === status) {
        await db.logs.delete(existing.id!);
      } else {
        await db.logs.update(existing.id!, { status });
        playSyncSound(settings?.soundPreset, settings?.frequencyLevel, status);
        if (status === 'completed') {
          checkMilestone(habitId);
        }
      }
    } else {
      await db.logs.add({ habitId, status, date: dateStr });
      playSyncSound(settings?.soundPreset, settings?.frequencyLevel, status);
      if (status === 'completed') {
        checkMilestone(habitId);
      }
    }
  };

  const checkMilestone = async (habitId: number) => {
    const habit = await db.habits.get(habitId);
    const logs = await db.logs.where('habitId').equals(habitId).toArray();
    if (habit && logs) {
      const currentStreak = calculateStreak(habit, logs);
      if (currentStreak === habit.goalDays && habit.goalDays > 0) {
        onCelebration(habit);
      }
    }
  };

  const confirmDelete = async () => {
    if (deleteId !== null) {
      await db.habits.delete(deleteId);
      await db.logs.where('habitId').equals(deleteId).delete();
      setDeleteId(null);
    }
  };

  return (
    <div className="px-6 pb-32 pt-1">
      <div className="mb-3">
        <h1 className="text-2xl font-black tracking-tighter uppercase mb-0.5">Active Protocols</h1>
        <p className="text-[10px] font-mono uppercase tracking-widest opacity-40">System Status: Operational</p>
      </div>

      <AnimatePresence>
        {/* Neural Sync Warning and Expansion Opportunity removed from dashboard as per user request */}
      </AnimatePresence>

      <Reorder.Group 
        axis="y" 
        values={habits || []} 
        onReorder={onReorder}
        className="space-y-0"
      >
        <AnimatePresence mode="popLayout">
          {habits?.map((habit, idx) => (
            <HabitCard 
              key={habit.id ?? idx} 
              habit={habit} 
              onLog={handleLog}
              onEdit={onEdit}
              onDelete={async (id) => setDeleteId(id)}
              onExpandChange={(expanded) => onExpandChange(habit.id!, expanded)}
              onKeyboardActive={onKeyboardActive}
              settings={settings}
            />
          ))}
        </AnimatePresence>
      </Reorder.Group>

      {habits?.length === 0 && (
        <div className="py-20 text-center opacity-30">
          <Zap className="w-12 h-12 mx-auto mb-4" />
          <p className="uppercase tracking-widest text-xs font-bold">No Protocols Initialized</p>
        </div>
      )}

      <ConfirmDialog 
        isOpen={deleteId !== null}
        title="Decommission Protocol"
        message="This will permanently erase this neural protocol and all associated history logs."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
});

const EvolutionView = () => {
  const habits = useLiveQuery(() => db.habits.toArray());
  const logs = useLiveQuery(() => db.logs.toArray());

  const auraSync = useMemo(() => {
    if (!habits?.length || !logs) return 0;
    const today = format(startOfToday(), 'yyyy-MM-dd');
    const completedToday = logs.filter(l => l.date === today && l.status === 'completed').length;
    return Math.round((completedToday / habits.length) * 100);
  }, [habits, logs]);

  const totalCompleted = useMemo(() => logs?.filter(l => l.status === 'completed').length || 0, [logs]);
  const totalSkipped = useMemo(() => logs?.filter(l => l.status === 'skipped').length || 0, [logs]);

  const longestStreakGlobal = useMemo(() => {
    if (!habits || !logs) return 0;
    return Math.max(...habits.map(h => calculateLongestStreak(h, logs.filter(l => l.habitId === h.id))), 0);
  }, [habits, logs]);

  const trendData = useMemo(() => {
    if (!logs || !habits?.length) return [];
    const days = eachDayOfInterval({ start: subDays(startOfToday(), 13), end: startOfToday() });
    return days.map(d => {
      const dateStr = format(d, 'yyyy-MM-dd');
      const completed = logs.filter(l => l.date === dateStr && l.status === 'completed').length;
      return {
        name: format(d, 'MMM dd'),
        rate: Math.round((completed / habits.length) * 100)
      };
    });
  }, [logs, habits]);

  const comparisonData = useMemo(() => {
    if (!habits || !logs) return [];
    return habits.map(h => {
      const habitLogs = logs.filter(l => l.habitId === h.id);
      const completed = habitLogs.filter(l => l.status === 'completed').length;
      const total = habitLogs.length || 1;
      return {
        name: h.name.length > 10 ? h.name.substring(0, 8) + '...' : h.name,
        fullName: h.name,
        rate: Math.round((completed / total) * 100),
        streak: calculateStreak(h, habitLogs)
      };
    }).sort((a, b) => b.rate - a.rate);
  }, [habits, logs]);

  const heatmapData = useMemo(() => {
    if (!logs) return [];
    const days = eachDayOfInterval({ start: subDays(startOfToday(), 34), end: startOfToday() });
    return days.map(d => {
      const dateStr = format(d, 'yyyy-MM-dd');
      const completed = logs.filter(l => l.date === dateStr && l.status === 'completed').length;
      const skipped = logs.filter(l => l.date === dateStr && l.status === 'skipped').length;
      return { date: dateStr, completed, skipped };
    });
  }, [logs]);

  return (
    <div className="px-6 pb-32 pt-4">
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tighter uppercase mb-1">Evolution</h1>
        <p className="text-[12px] font-mono uppercase tracking-widest opacity-40">Neural Sync Analytics</p>
      </div>

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="glass-panel rounded-3xl p-6 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-aura-glow/5 animate-pulse" />
          <div className="relative z-10">
            <div className="text-4xl font-black tracking-tighter text-aura-glow mb-1">{auraSync}%</div>
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40">Daily Sync</div>
          </div>
        </div>
        <div className="glass-panel rounded-3xl p-6 flex flex-col items-center justify-center text-center">
          <div className="text-4xl font-black tracking-tighter text-white mb-1">{longestStreakGlobal}</div>
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40">Max Streak</div>
        </div>
      </div>

      {/* Trend Chart */}
      <div className="glass-panel rounded-3xl p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[12px] uppercase tracking-[0.2em] font-bold opacity-40">Neural Trend (14D)</h3>
          <Activity className="w-3 h-3 text-aura-glow opacity-50" />
        </div>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-aura-glow)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--color-aura-glow)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 8, fill: 'rgba(255,255,255,0.3)', fontWeight: 'bold' }}
                interval="preserveStartEnd"
              />
              <YAxis hide domain={[0, 100]} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(5,5,5,0.9)', 
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  fontSize: '10px',
                  fontFamily: 'monospace'
                }}
                itemStyle={{ color: 'var(--color-aura-glow)' }}
              />
              <Area 
                type="monotone" 
                dataKey="rate" 
                stroke="var(--color-aura-glow)" 
                fillOpacity={1} 
                fill="url(#colorRate)" 
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const SystemView = ({ onBack }: { onBack: () => void }) => {
  const settings = useLiveQuery(() => db.settings.toCollection().first());
  const [isResetting, setIsResetting] = useState(false);

  const updateGlow = async (color: string) => {
    if (settings?.id) {
      await db.settings.update(settings.id, { primaryGlow: color });
    }
  };

  const updateSound = async (preset: string) => {
    if (settings?.id) {
      await db.settings.update(settings.id, { soundPreset: preset });
      playSyncSound(preset, settings.frequencyLevel);
    }
  };

  const updateFrequency = async (level: number) => {
    if (settings?.id) {
      await db.settings.update(settings.id, { frequencyLevel: level });
      playSyncSound(settings.soundPreset, level);
    }
  };

  const updateGlass = async (preset: string) => {
    if (settings?.id) {
      await db.settings.update(settings.id, { glassPreset: preset as any });
    }
  };

  const toggleHaptic = async () => {
    if (settings?.id) {
      await db.settings.update(settings.id, { hapticEnabled: !settings.hapticEnabled });
    }
  };

  const toggleNotifications = async () => {
    if (settings?.id) {
      const newState = !settings.notificationsEnabled;
      
      // Optimistically update the database so the UI toggle moves immediately
      await db.settings.update(settings.id, { notificationsEnabled: newState });

      if (newState && typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission !== 'granted') {
          try {
            // Request permission but don't block the UI if it fails or is denied
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
              sendNotification('Neural Link Established', {
                body: 'Aura notifications are now active.',
                icon: '/favicon.ico'
              });
            }
          } catch (error) {
            console.error('Notification permission request error:', error);
          }
        } else if (Notification.permission === 'granted') {
          // Already granted, send a test notification to confirm
          sendNotification('Neural Link Established', {
            body: 'Aura notifications are now active.',
            icon: '/favicon.ico'
          });
        }
      }
    }
  };

  const updateUserName = async (name: string) => {
    if (settings?.id) {
      await db.settings.update(settings.id, { userName: name });
    }
  };

  const handleReset = async () => {
    await db.habits.clear();
    await db.logs.clear();
    window.location.reload();
  };

  const themes = [
    { name: 'Cyberpunk Neon', color: '#00ffcc' },
    { name: 'Martian Red', color: '#ff3366' },
    { name: 'Deep Space Blue', color: '#3366ff' },
    { name: 'Neural Gold', color: '#ffcc00' },
    { name: 'Void Purple', color: '#cc00ff' },
    { name: 'Acid Lime', color: '#d4ff00' },
    { name: 'Electric Indigo', color: '#6600ff' },
    { name: 'Sunset Orange', color: '#ff6600' },
    { name: 'Mint Frost', color: '#00ff99' },
    { name: 'Rose Quartz', color: '#ff99cc' },
    { name: 'Cyber Purple', color: '#bc13fe' },
    { name: 'Neon Mint', color: '#39ff14' },
    { name: 'Solar Flare', color: '#ff4d00' },
    { name: 'Vantablack', color: '#050505' }
  ];

  const [isIdentityCollapsed, setIsIdentityCollapsed] = useState(true);
  const [isHapticCollapsed, setIsHapticCollapsed] = useState(true);
  const [isSpectrumCollapsed, setIsSpectrumCollapsed] = useState(true);
  const [isAudioCollapsed, setIsAudioCollapsed] = useState(true);
  const [isGlassCollapsed, setIsGlassCollapsed] = useState(true);
  const [isOfflineCollapsed, setIsOfflineCollapsed] = useState(true);

  return (
    <div className="px-6 pb-32 pt-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tighter uppercase mb-0.5">System</h1>
          <p className="text-[10px] font-mono uppercase tracking-widest opacity-40">Core Configuration</p>
        </div>
        <button 
          onClick={onBack}
          className="p-2.5 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4">
        <div className="glass-panel rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-aura-glow" />
              <h3 className="text-[12px] uppercase tracking-widest font-bold">Aura Spectrum</h3>
            </div>
            <button 
              onClick={() => setIsSpectrumCollapsed(!isSpectrumCollapsed)}
              className="p-1.5 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <ChevronDown className={cn("w-3 h-3 transition-transform", isSpectrumCollapsed && "rotate-180")} />
            </button>
          </div>
          
          <AnimatePresence>
            {!isSpectrumCollapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap gap-3 mb-4">
                  {themes.map(t => (
                    <button 
                      key={t.name}
                      onClick={() => updateGlow(t.color)}
                      className={cn(
                        "w-6 h-6 rounded-full border-2 transition-all relative group",
                        settings?.primaryGlow === t.color ? "border-white scale-125 shadow-[0_0_15px_var(--color-aura-glow)]" : "border-white/10"
                      )}
                      style={{ backgroundColor: t.color }}
                    >
                      <div className={cn(
                        "absolute inset-0 rounded-full blur-[2px] opacity-0 group-hover:opacity-50 transition-opacity",
                        settings?.primaryGlow === t.color && "opacity-50"
                      )} style={{ backgroundColor: t.color }} />
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input 
                    type="color" 
                    value={settings?.primaryGlow || '#00ffcc'}
                    onChange={(e) => updateGlow(e.target.value)}
                    className="w-10 h-10 bg-transparent border-none cursor-pointer shrink-0"
                  />
                  <input 
                    type="text" 
                    value={settings?.primaryGlow || ''}
                    onChange={(e) => updateGlow(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 font-mono text-[12px] uppercase"
                    placeholder="#HEX"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="glass-panel rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-aura-glow" />
              <h3 className="text-[12px] uppercase tracking-widest font-bold">Audio Feedback</h3>
            </div>
            <button 
              onClick={() => setIsAudioCollapsed(!isAudioCollapsed)}
              className="p-1.5 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <ChevronDown className={cn("w-3 h-3 transition-transform", isAudioCollapsed && "rotate-180")} />
            </button>
          </div>
          
          <AnimatePresence>
            {!isAudioCollapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-4"
              >
                <select 
                  value={settings?.soundPreset}
                  onChange={(e) => updateSound(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-aura-glow/50 transition-colors font-medium appearance-none text-xs"
                >
                  <option value="Starlink Alpha">Starlink Alpha</option>
                  <option value="Starlink Beta">Starlink Beta</option>
                  <option value="Orbital Ping">Orbital Ping</option>
                  <option value="Neural Uplink">Neural Uplink</option>
                  <option value="Atmospheric Entry">Atmospheric Entry</option>
                  <option value="Satellite Lock">Satellite Lock</option>
                  <option value="Data Burst">Data Burst</option>
                  <option value="Quantum Pulse">Quantum Pulse</option>
                  <option value="Solar Flare">Solar Flare</option>
                  <option value="Void Echo">Void Echo</option>
                </select>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Frequency Level</span>
                    <span className="text-[10px] font-mono text-aura-glow">{settings?.frequencyLevel || 3}/6</span>
                  </div>
                  <input 
                    type="range"
                    min="1"
                    max="6"
                    step="1"
                    value={settings?.frequencyLevel || 3}
                    onChange={(e) => updateFrequency(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[6px] uppercase tracking-tighter opacity-30">
                    <span>Low</span>
                    <span>Super High</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="glass-panel rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-aura-glow" />
              <h3 className="text-[12px] uppercase tracking-widest font-bold">Neural Identity</h3>
            </div>
            <button 
              onClick={() => setIsIdentityCollapsed(!isIdentityCollapsed)}
              className="p-1.5 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <ChevronDown className={cn("w-3 h-3 transition-transform", isIdentityCollapsed && "rotate-180")} />
            </button>
          </div>
          
          <AnimatePresence>
            {!isIdentityCollapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <input 
                  value={settings?.userName || ''}
                  onChange={(e) => updateUserName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-aura-glow/50 transition-colors font-medium text-sm"
                  placeholder="Enter Name"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="glass-panel rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-aura-glow" />
              <h3 className="text-[12px] uppercase tracking-widest font-bold">Neural Feedback</h3>
            </div>
            <button 
              onClick={() => setIsHapticCollapsed(!isHapticCollapsed)}
              className="p-1.5 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <ChevronDown className={cn("w-3 h-3 transition-transform", isHapticCollapsed && "rotate-180")} />
            </button>
          </div>

          <AnimatePresence>
            {!isHapticCollapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-3 h-3 opacity-40" />
                    <span className="text-[10px] uppercase tracking-widest font-bold opacity-60">Haptic Feedback</span>
                  </div>
                  <button 
                    onClick={toggleHaptic}
                    className={cn(
                      "w-10 h-5 rounded-full transition-all relative",
                      settings?.hapticEnabled ? "bg-aura-glow" : "bg-white/10"
                    )}
                  >
                    <div className={cn(
                      "absolute top-0.5 w-4 h-4 rounded-full bg-black transition-all shadow-sm",
                      settings?.hapticEnabled ? "translate-x-5" : "translate-x-0.5"
                    )} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <Bell className="w-3 h-3 opacity-40" />
                      <span className="text-[10px] uppercase tracking-widest font-bold opacity-60">Neural Notifications</span>
                    </div>
                    {typeof window !== 'undefined' && !('Notification' in window) && (
                      <span className="text-[6px] text-red-500/60 uppercase font-bold">Not supported in this browser</span>
                    )}
                    {typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'denied' && (
                      <span className="text-[6px] text-amber-500/60 uppercase font-bold">Permission Denied - Check Browser Settings</span>
                    )}
                    {typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && settings?.notificationsEnabled && (
                      <span className="text-[6px] text-aura-glow/60 uppercase font-bold">Active // Best in new tab</span>
                    )}
                  </div>
                  <button 
                    onClick={toggleNotifications}
                    className={cn(
                      "w-10 h-5 rounded-full transition-all relative",
                      settings?.notificationsEnabled ? "bg-aura-glow" : "bg-white/10"
                    )}
                  >
                    <div className={cn(
                      "absolute top-0.5 w-4 h-4 rounded-full bg-black transition-all shadow-sm",
                      settings?.notificationsEnabled ? "translate-x-5" : "translate-x-0.5"
                    )} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="glass-panel rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-aura-glow" />
              <h3 className="text-[12px] uppercase tracking-widest font-bold">Glassmorphism Preset</h3>
            </div>
            <button 
              onClick={() => setIsGlassCollapsed(!isGlassCollapsed)}
              className="p-1.5 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <ChevronDown className={cn("w-3 h-3 transition-transform", isGlassCollapsed && "rotate-180")} />
            </button>
          </div>
          
          <AnimatePresence>
            {!isGlassCollapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-3 gap-2">
                  {['Aura', 'Frosted', 'Crystal', 'Obsidian', 'Cyber', 'Light', 'Nebula', 'Prism', 'Void'].map(p => (
                    <button 
                      key={p}
                      onClick={() => updateGlass(p)}
                      className={cn(
                        "py-2 rounded-xl text-[10px] uppercase font-bold tracking-widest transition-all border",
                        settings?.glassPreset === p 
                          ? "bg-aura-glow/20 border-aura-glow text-aura-glow" 
                          : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="glass-panel rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-aura-glow" />
              <h3 className="text-[12px] uppercase tracking-widest font-bold">Offline Integrity</h3>
            </div>
            <button 
              onClick={() => setIsOfflineCollapsed(!isOfflineCollapsed)}
              className="p-1.5 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <ChevronDown className={cn("w-3 h-3 transition-transform", isOfflineCollapsed && "rotate-180")} />
            </button>
          </div>
          
          <AnimatePresence>
            {!isOfflineCollapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-3"
              >
                <div className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase font-bold text-aura-glow">Local-First Storage</span>
                    <span className="text-[8px] opacity-40 leading-tight uppercase tracking-tighter">Neural data is persisted only on this device using local IndexedDB.</span>
                  </div>
                  <ShieldCheck className="w-4 h-4 text-aura-glow/40" />
                </div>
                <div className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase font-bold text-aura-glow">PWA Service Worker</span>
                    <span className="text-[8px] opacity-40 leading-tight uppercase tracking-tighter">Application assets are cached locally for zero-latency offline start.</span>
                  </div>
                  <Zap className="w-4 h-4 text-aura-glow/40" />
                </div>
                <p className="text-[7px] font-mono text-center uppercase tracking-widest opacity-30 mt-2">
                  // Total Airgap Integrity Verified
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button 
          onClick={() => setIsResetting(true)}
          className="w-full py-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-[12px] font-bold uppercase tracking-widest hover:bg-red-500/20 transition-all"
        >
          Decommission All Data
        </button>

        <ConfirmDialog 
          isOpen={isResetting}
          title="System Reset"
          message="CRITICAL: This will wipe all neural data, protocols, and logs. This action cannot be reversed."
          onConfirm={handleReset}
          onCancel={() => setIsResetting(false)}
        />

        <div className="p-8 text-center opacity-20">
          <p className="text-[10px] font-mono uppercase tracking-[0.4em]">Aura OS v1.0.5 // Neuralink Certified</p>
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
  const [celebrationHabit, setCelebrationHabit] = useState<Habit | null>(null);
  const [lastBackPress, setLastBackPress] = useState(0);
  const [showExitToast, setShowExitToast] = useState(false);

  useEffect(() => {
    // Push initial state to handle back button
    window.history.pushState(null, '', window.location.pathname);
  }, []);
  const [expandedHabits, setExpandedHabits] = useState<Set<number>>(new Set());
  const [showStats, setShowStats] = useState(false);

  const isAnyCardExpanded = expandedHabits.size > 0;

  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex(prev => (prev + 1) % QUOTES.length);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleExpandChange = (id: number, expanded: boolean) => {
    setExpandedHabits(prev => {
      const next = new Set(prev);
      if (expanded) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  useEffect(() => {
    setExpandedHabits(new Set());
    
    // Handle history state for back button navigation
    if (activeTab !== 'protocols' || isModalOpen || showStats || celebrationHabit) {
      window.history.pushState({ 
        tab: activeTab, 
        modal: isModalOpen, 
        stats: showStats,
        celebration: !!celebrationHabit
      }, '');
    }
  }, [activeTab, isModalOpen, showStats, celebrationHabit]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // If any overlay is open, close it first
      if (celebrationHabit) {
        setCelebrationHabit(null);
        window.history.pushState(null, '', window.location.pathname);
        return;
      }
      if (isModalOpen) {
        setIsModalOpen(false);
        setEditingHabit(null);
        window.history.pushState(null, '', window.location.pathname);
        return;
      }
      if (showStats) {
        setShowStats(false);
        window.history.pushState(null, '', window.location.pathname);
        return;
      }
      // Otherwise, if not on dashboard, go to dashboard
      if (isAnyCardExpanded) {
        // We can't easily trigger the close from here without refs or a state lift, 
        // but since we know some card is expanded, we can at least push state to intercept
        // the NEXT tap which will then go to dashboard.
        // Actually, let's just let it slide to dashboard directly if expanded?
        // Let's just push state and stay where we are for one tap if something is expanded.
        window.history.pushState(null, '', window.location.pathname);
        return;
      }
      
      if (activeTab !== 'protocols') {
        setActiveTab('protocols');
        window.history.pushState(null, '', window.location.pathname);
        return;
      }

      // Double tap to exit logic
      const now = Date.now();
      if (now - lastBackPress < 2000) {
        // Allow the back event to proceed (which might exit the app context)
        // We don't push state here.
      } else {
        setLastBackPress(now);
        setShowExitToast(true);
        setTimeout(() => setShowExitToast(false), 2000);
        // Push state back to prevent exit on first tap
        window.history.pushState(null, '', window.location.pathname);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTab, isModalOpen, showStats, celebrationHabit, lastBackPress]);
  
  const settings = useLiveQuery(() => db.settings.toCollection().first());
  const habits = useLiveQuery(() => db.habits.orderBy('order').toArray());
  const logs = useLiveQuery(() => db.logs.toArray());

  useEffect(() => {
    if (!settings?.notificationsEnabled || !habits || !logs) return;

    const maintenanceStickyNotification = () => {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const today = format(new Date(), 'yyyy-MM-dd');
        const logsToday = logs.filter(l => l.date === today);
        const completedCount = logsToday.filter(l => l.status === 'completed').length;
        const totalCount = habits.length;
        
        const now = new Date();
        const startOfDayTime = "00:00";
        const endOfDayTime = "23:59";
        
        const title = `Aura Monitor: ${completedCount}/${totalCount} Protocols`;
        const body = `Active Session: [${startOfDayTime} — ${endOfDayTime}] • Evolution Progress: ${Math.round((completedCount / (totalCount || 1)) * 100)}%`;
        
        sendNotification(title, { 
          body, 
          sticky: true,
          icon: '/favicon.ico',
          tag: 'aura-persistent'
        });
      }
    };

    // Update sticky notification whenever habits or logs change
    maintenanceStickyNotification();

    const interval = setInterval(maintenanceStickyNotification, 15 * 60 * 1000); // Refresh every 15 mins
    return () => clearInterval(interval);
  }, [settings?.notificationsEnabled, habits, logs]);

  useEffect(() => {
    if (!settings?.notificationsEnabled || !habits || !logs) return;

    const checkNotifications = () => {
      const lastNoti = localStorage.getItem('aura_last_noti');
      const now = Date.now();
      const intervalTime = 4 * 60 * 60 * 1000; // Check every 4 hours

      if (!lastNoti || now - parseInt(lastNoti) >= intervalTime) {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const today = format(new Date(), 'yyyy-MM-dd');
          const logsToday = logs.filter(l => l.date === today);
          const completedCount = logsToday.filter(l => l.status === 'completed').length;
          const totalCount = habits.length;

          let title = '';
          let body = '';

          if (totalCount === 0) {
            title = 'Neural Void Detected';
            body = 'Your protocol list is empty. Ignite a new habit to start your evolution.';
          } else if (completedCount < totalCount) {
            const pending = totalCount - completedCount;
            title = 'Neural Sync Required';
            body = `Warning: ${pending} pending protocol${pending > 1 ? 's' : ''} detected. Complete them to maintain your aura.`;
          } else if (totalCount > 0 && totalCount < 3) {
            title = 'Expansion Opportunity';
            body = 'Protocols synchronized. Consider adding more to accelerate your neural evolution.';
          }

          if (title) {
            sendNotification(title, { body, icon: '/favicon.ico' });
            localStorage.setItem('aura_last_noti', now.toString());
          }
        }
      }
    };

    const interval = setInterval(checkNotifications, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [settings?.notificationsEnabled, habits, logs]);

  const handleReorder = async (newHabits: Habit[]) => {
    // Update local state is handled by Reorder.Group values prop
    // We need to update the database with new order values
    for (let i = 0; i < newHabits.length; i++) {
      if (newHabits[i].id) {
        await db.habits.update(newHabits[i].id!, { order: i });
      }
    }
  };

  useEffect(() => {
    if (settings?.primaryGlow) {
      document.documentElement.style.setProperty('--primary-glow', settings.primaryGlow);
      const rgb = hexToRgb(settings.primaryGlow);
      if (rgb) {
        document.documentElement.style.setProperty('--primary-glow-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
      }
    }
    
    if (settings?.glassPreset) {
      const presets = {
        Aura: { bg: 'rgba(255, 255, 255, 0.05)', blur: '24px', border: 'rgba(255, 255, 255, 0.1)' },
        Frosted: { bg: 'rgba(255, 255, 255, 0.15)', blur: '12px', border: 'rgba(255, 255, 255, 0.2)' },
        Crystal: { bg: 'rgba(255, 255, 255, 0.02)', blur: '40px', border: 'rgba(255, 255, 255, 0.3)' },
        Obsidian: { bg: 'rgba(0, 0, 0, 0.6)', blur: '32px', border: 'rgba(255, 255, 255, 0.05)' },
        Cyber: { bg: 'rgba(0, 255, 204, 0.03)', blur: '20px', border: 'rgba(0, 255, 204, 0.2)' },
        Light: { bg: 'rgba(0, 0, 0, 0.03)', blur: '12px', border: 'rgba(0, 0, 0, 0.08)' },
        Nebula: { bg: 'rgba(255, 0, 255, 0.03)', blur: '30px', border: 'rgba(255, 255, 255, 0.1)' },
        Prism: { bg: 'rgba(255, 255, 255, 0.05)', blur: '24px', border: 'rgba(255, 255, 255, 0.2)' },
        Void: { bg: 'rgba(255, 255, 255, 0.01)', blur: '60px', border: 'rgba(255, 255, 255, 0.03)' }
      };
      const p = presets[settings.glassPreset as keyof typeof presets] || presets.Aura;
      document.documentElement.style.setProperty('--glass-bg', p.bg);
      document.documentElement.style.setProperty('--glass-blur', p.blur);
      document.documentElement.style.setProperty('--glass-border', p.border);
      
      // Apply theme class to body
      document.body.className = `theme-${settings.glassPreset.toLowerCase()}`;
    }
  }, [settings]);

  const stats = useMemo(() => {
    if (!habits || !logs) return { total: 0, completed: 0, skipped: 0 };
    const today = format(new Date(), 'yyyy-MM-dd');
    const logsToday = logs.filter(l => l.date === today);
    return {
      total: habits.length,
      completed: logsToday.filter(l => l.status === 'completed').length,
      skipped: logsToday.filter(l => l.status === 'skipped').length
    };
  }, [habits, logs]);

  const handleSaveHabit = async (habitData: Partial<Habit>) => {
    if (editingHabit?.id) {
      await db.habits.update(editingHabit.id, habitData);
    } else {
      const count = await db.habits.count();
      await db.habits.add({
        ...habitData as Habit,
        createdAt: new Date(),
        order: count
      });
    }
    setIsModalOpen(false);
    setEditingHabit(null);
  };

  const currentQuote = useMemo(() => {
    return QUOTES[quoteIndex];
  }, [quoteIndex]);

  useEffect(() => {
    const handlePopState = () => {
      if (isModalOpen) {
        setIsModalOpen(false);
        window.history.pushState(null, '');
      } else if (activeTab !== 'protocols') {
        setActiveTab('protocols');
        window.history.pushState(null, '');
      }
    };

    // Push initial dummy state to intercept first back button
    if (window.history.state !== 'aura-intercept') {
      window.history.replaceState('aura-base', '');
      window.history.pushState('aura-intercept', '');
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTab, isModalOpen]);

  return (
    <div className="min-h-[100dvh] max-w-md mx-auto relative flex flex-col bg-vantablack">
      {/* Header */}
      <AnimatePresence mode="wait">
        {activeTab === 'protocols' && !isModalOpen && (
          <motion.header 
            initial={{ height: 0, opacity: 0, y: -20 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -20 }}
            className="px-6 pt-8 pb-2 sticky top-0 z-40 bg-vantablack/80 backdrop-blur-md border-b border-white/5 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-aura-glow/20 flex items-center justify-center relative animate-supernova">
                  <Crown className="w-5 h-5 text-aura-glow" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Typewriter text={settings?.userName || "Thant Zin Aung"} className="text-sm opacity-80 whitespace-nowrap" />
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-widest opacity-40">Aura Level: Elite</span>
                </div>
              </div>
              <div className="flex items-center gap-2 relative">
                <button 
                  onClick={() => setShowStats(!showStats)}
                  className={cn(
                    "p-2.5 rounded-xl transition-all",
                    showStats ? "bg-aura-glow text-black shadow-[0_0_15px_var(--color-aura-glow)]" : "bg-white/5 text-white/60 hover:bg-white/10"
                  )}
                >
                  <BarChart3 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="space-y-1">
              <h2 className="text-xs font-black tracking-[0.3em] uppercase text-aura-glow/60 flex items-center gap-2">
                <span className="w-8 h-[1px] bg-aura-glow/30" />
                Aura OS Interface
                <span className="w-8 h-[1px] bg-aura-glow/30" />
              </h2>
              <div className="flex items-start gap-2 h-10 overflow-hidden">
                <Brain className="w-3 h-3 text-aura-glow/40 shrink-0 mt-1" />
        <div className="line-clamp-2 leading-relaxed flex items-start gap-2">
          <div className="shrink-0 mt-0.5 opacity-20">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-aura-glow">
              <path d="M12 2a2 2 0 0 1 2 2c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2z"/>
              <path d="M12 7c-3.3 0-6 2.7-6 6v4a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-4c0-3.3-2.7-6-6-6z"/>
              <path d="M8 13c0-2.2 1.8-4 4-4s4 1.8 4 4"/>
              <path d="M9 17h6"/>
              <path d="M7 22h10"/>
              <path d="M12 11v2"/>
            </svg>
          </div>
          <Typewriter 
            text={currentQuote} 
            className="text-[9px] text-white/40 italic lowercase" 
            speed={120} 
            delay={5000}
          />
          <div className="shrink-0 mt-0.5 opacity-20">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-aura-glow">
              <path d="M12 2a2 2 0 0 1 2 2c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2z"/>
              <path d="M12 7c-3.3 0-6 2.7-6 6v4a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-4c0-3.3-2.7-6-6-6z"/>
              <path d="M8 13c0-2.2 1.8-4 4-4s4 1.8 4 4"/>
              <path d="M9 17h6"/>
              <path d="M7 22h10"/>
              <path d="M12 11v2"/>
            </svg>
          </div>
        </div>
              </div>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="relative z-10 min-h-[calc(100vh-180px)]">
        <AnimatePresence mode="wait">
          {activeTab === 'protocols' && (
            <motion.div 
              key="protocols"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <ProtocolsView 
                habits={habits}
                onEdit={(h) => { setEditingHabit(h); setIsModalOpen(true); }} 
                onExpandChange={handleExpandChange} 
                onKeyboardActive={setIsKeyboardActive}
                onCelebration={(h) => setCelebrationHabit(h)}
                onReorder={handleReorder}
              />
            </motion.div>
          )}
          {activeTab === 'evolution' && (
            <motion.div 
              key="evolution"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <EvolutionView />
            </motion.div>
          )}
          {activeTab === 'system' && (
            <motion.div 
              key="system"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <SystemView onBack={() => setActiveTab('protocols')} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Navigation */}
      <AnimatePresence>
        {showStats && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass-panel w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-aura-glow/20 pointer-events-auto"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[12px] uppercase tracking-[0.2em] font-bold opacity-40">Neural Sync Status</h3>
                <button onClick={() => setShowStats(false)} className="p-1 bg-white/5 rounded-lg">
                  <X className="w-3 h-3" />
                </button>
              </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[12px] uppercase tracking-widest opacity-40 font-bold">Total Protocols</span>
                <span className="text-sm font-mono font-bold">{stats.total}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[12px] uppercase tracking-widest text-aura-glow font-bold">Synchronized</span>
                <span className="text-sm font-mono font-bold text-aura-glow">{stats.completed}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[12px] uppercase tracking-widest text-amber-500 font-bold">Deferred</span>
                <span className="text-sm font-mono font-bold text-amber-500">{stats.skipped}</span>
              </div>
              <div className="pt-2">
                <div className="flex justify-between text-[10px] uppercase tracking-widest mb-1 opacity-30 font-bold">
                  <span>Efficiency</span>
                  <span>{Math.round((stats.completed / (stats.total || 1)) * 100)}%</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(stats.completed / (stats.total || 1)) * 100}%` }}
                    className="h-full bg-aura-glow shadow-[0_0_10px_var(--color-aura-glow)]"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

      {/* Stats Popup Backdrop */}
      <AnimatePresence>
        {showStats && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowStats(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[55]"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeTab !== 'system' && !isKeyboardActive && !showStats && (
          <motion.nav 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-64px)] max-w-[320px] z-50"
          >
            <div className="glass-panel rounded-[1.5rem] p-1.5 flex items-center justify-between relative overflow-hidden">
              <div className="absolute inset-0 bg-aura-glow/5 pointer-events-none" />
              
              <button 
                onClick={() => setActiveTab('protocols')}
                className={cn(
                  "flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all relative z-10",
                  activeTab === 'protocols' ? "text-aura-glow bg-white/5 shadow-[inset_0_0_15px_rgba(var(--primary-glow-rgb),0.1)]" : "text-white/40 hover:text-white/60"
                )}
              >
                <Activity className="w-4 h-4" />
                <span className="text-[9px] font-bold uppercase tracking-widest">Protocols</span>
                {activeTab === 'protocols' && (
                  <motion.div layoutId="nav-glow" className="absolute bottom-0.5 w-1 h-1 rounded-full bg-aura-glow shadow-[0_0_10px_var(--color-aura-glow)]" />
                )}
              </button>

              <button 
                onClick={() => setActiveTab('evolution')}
                className={cn(
                  "flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all relative z-10",
                  activeTab === 'evolution' ? "text-aura-glow bg-white/5 shadow-[inset_0_0_15px_rgba(var(--primary-glow-rgb),0.1)]" : "text-white/40 hover:text-white/60"
                )}
              >
                <Zap className="w-4 h-4" />
                <span className="text-[9px] font-bold uppercase tracking-widest">Evolution</span>
                {activeTab === 'evolution' && (
                  <motion.div layoutId="nav-glow" className="absolute bottom-0.5 w-1 h-1 rounded-full bg-aura-glow shadow-[0_0_10px_var(--color-aura-glow)]" />
                )}
              </button>

              <button 
                onClick={() => setActiveTab('system')}
                className={cn(
                  "flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all relative z-10",
                  activeTab === 'system' ? "text-aura-glow bg-white/5 shadow-[inset_0_0_15px_rgba(var(--primary-glow-rgb),0.1)]" : "text-white/40 hover:text-white/60"
                )}
              >
                <SettingsIcon className="w-4 h-4" />
                <span className="text-[9px] font-bold uppercase tracking-widest">System</span>
                {activeTab === 'system' && (
                  <motion.div layoutId="nav-glow" className="absolute bottom-0.5 w-1 h-1 rounded-full bg-aura-glow shadow-[0_0_10px_var(--color-aura-glow)]" />
                )}
              </button>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>

      {/* Floating Add Button */}
      <AnimatePresence>
        {activeTab === 'protocols' && !isAnyCardExpanded && !isModalOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0, opacity: 0, y: 20 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => { setEditingHabit(null); setIsModalOpen(true); }}
            className="fixed bottom-32 right-6 w-14 h-14 bg-aura-glow text-black rounded-full flex items-center justify-center shadow-[0_0_30px_var(--color-aura-glow)] z-[60]"
          >
            <Plus className="w-8 h-8" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {celebrationHabit && (
          <CelebrationOverlay 
            habitName={celebrationHabit.name} 
            onComplete={() => setCelebrationHabit(null)} 
          />
        )}
      </AnimatePresence>

      <HUDModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleSaveHabit}
        initialHabit={editingHabit}
      />

      {/* Exit Toast */}
      <AnimatePresence>
        {showExitToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-[10px] font-bold uppercase tracking-widest text-white/80"
          >
            Press back again to exit
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
