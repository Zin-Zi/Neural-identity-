/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Smile
} from 'lucide-react';

const ICON_MAP: Record<string, any> = {
  Activity, Zap, Brain, Target, Heart, Code, Book, Music, Camera, Coffee, Moon, Sun,
  Dumbbell, Flame, Droplets, Utensils, Laptop, Palette, Gamepad2, Bike, Timer, Cloud, Star, Smile
};
import { useLiveQuery } from 'dexie-react-hooks';
import { format, startOfToday, subDays, eachDayOfInterval, isSameDay, parseISO, isBefore, startOfDay } from 'date-fns';
import { db, type Habit, type HabitLog } from './db';
import { cn, hexToRgb } from './lib/utils';

// --- Streak Utility ---
const calculateStreak = (habit: Habit, logs: HabitLog[]) => {
  let count = 0;
  let current = startOfToday();
  const todayStr = format(current, 'yyyy-MM-dd');
  const todayLogEntry = logs.find(l => l.date === todayStr);
  
  // If today is not completed, we start checking from yesterday
  if (todayLogEntry?.status !== 'completed') {
    // If strict mode and today is skipped, streak is already broken
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
        break; // Strict mode: skip breaks streak
      } else {
        current = subDays(current, 1); // Normal mode: skip preserves streak but doesn't increment
      }
    } else {
      // No log found for this day
      // Check if it's before the habit was created
      if (isBefore(current, startOfDay(habit.createdAt))) break;
      
      // If it's a missing day, streak breaks regardless of mode
      break;
    }
  }
  return count;
};

// --- Sound Utility ---
const FREQUENCY_MAP: Record<number, number> = {
  1: 200,
  2: 400,
  3: 800,
  4: 1600,
  5: 3200,
  6: 6400
};

const playSyncSound = (preset: string = 'Cyber Chime', level: number = 3) => {
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  // Resume context if suspended (browser policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  const now = audioCtx.currentTime;
  const baseFreq = FREQUENCY_MAP[level] || 800;

  if (preset.includes('Starlink') || preset === 'Cyber Chime') {
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(baseFreq, now);
    oscillator.frequency.exponentialRampToValueAtTime(baseFreq * 2, now + 0.1);
    gainNode.gain.setValueAtTime(0.1, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    oscillator.start(now);
    oscillator.stop(now + 0.3);
  } else if (preset === 'Neural Beep' || preset === 'Orbital Ping') {
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(baseFreq * 1.5, now);
    gainNode.gain.setValueAtTime(0.05, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    oscillator.start(now);
    oscillator.stop(now + 0.1);
  } else {
    // Default fallback for other presets
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(baseFreq, now);
    gainNode.gain.setValueAtTime(0.05, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    oscillator.start(now);
    oscillator.stop(now + 0.2);
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
            className="flex-1 py-3 rounded-xl bg-white/5 font-bold text-[10px] uppercase tracking-widest hover:bg-white/10 transition-colors"
          >
            Abort
          </button>
          <button 
            onClick={onConfirm}
            className={cn(
              "flex-1 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-colors",
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
  "The foolish, of little intelligence, are their own worst enemies, for they do evil deeds which bear bitter fruit.",
  "As a solid rock is not shaken by the wind, even so the wise are not ruffled by praise or blame.",
  "Better than a thousand hollow words, is one word that brings peace.",
  "Victory breeds hatred. The defeated live in pain. Happily the peaceful live, giving up victory and defeat.",
  "There is no fire like passion, there is no shark like hatred, there is no snare like folly, there is no torrent like greed.",
  "Health is the greatest gift, contentment the greatest wealth, faithfulness the best relationship.",
  "Irrigators channel waters; fletchers straighten arrows; carpenters bend wood; the wise master themselves.",
  "The root of suffering is attachment.",
  "Whatever an enemy may do to an enemy, a far greater harm is done by a wrongly directed mind.",
  "One is one's own master, one's own refuge. Who else could be the master?",
  "A disciplined mind brings happiness.",
  "Radiate boundless love towards the entire world — above, below, and across — unhindered, without ill will, without enmity.",
  "The way is not in the sky. The way is in the heart.",
  "Purity and impurity depend on oneself; no one can purify another.",
  "To support mother and father, to cherish wife and children, and to be engaged in peaceful occupation — this is the greatest blessing.",
  "Do not dwell in the past, do not dream of the future, concentrate the mind on the present moment.",
  "Three things cannot be long hidden: the sun, the moon, and the truth.",
  "You, yourself, as much as anybody in the entire universe, deserve your love and affection.",
  "Peace comes from within. Do not seek it without.",
  "The only real failure in life is not to be true to the best one knows.",
  "To understand everything is to forgive everything.",
  "Believe nothing, no matter where you read it, or who said it, unless it agrees with your own reason and your own common sense.",
  "However many holy words you read, however many you speak, what good will they do you if you do not act upon them?",
  "The mind is everything. What you think you become.",
  "Work out your own salvation. Do not depend on others.",
  "An insincere and evil friend is more to be feared than a wild beast; a wild beast may wound your body, but an evil friend will wound your mind.",
  "In the end, only three things matter: how much you loved, how gently you lived, and how gracefully you let go of things not meant for you.",
  "If you find no generous advisor to accompany you, walk alone, like a king who has left his conquered kingdom behind.",
  "It is a man's own mind, not his enemy or foe, that lures him to evil ways.",
  "To be idle is a short road to death and to be diligent is a way of life; foolish people are idle, wise people are diligent.",
  "Whatever words we utter should be chosen with care for people will hear them and be influenced by them for good or ill.",
  "No one saves us but ourselves. No one can and no one may. We ourselves must walk the path.",
  "Thousands of candles can be lighted from a single candle, and the life of the candle will not be shortened. Happiness never decreases by being shared.",
  "The whole secret of existence is to have no fear. Never fear what will become of you, depend on no one. Only the moment you reject all help are you freed.",
  "Do not overrate what you have received, nor envy others. He who envies others does not obtain peace of mind.",
  "He who experiences the unity of life sees his own Self in all beings, and all beings in his own Self, and looks on everything with an impartial eye.",
  "The tongue like a sharp knife... Kills without drawing blood.",
  "Meditation brings wisdom; lack of meditation leaves ignorance. Know well what leads you forward and what holds you back, and choose the path that leads to wisdom.",
  "A jug fills drop by drop.",
  "Virtue is persecuted more by the wicked than it is loved by the good.",
  "Even as a solid rock is unshaken by the wind, so are the wise unshaken by praise or blame.",
  "There is nothing more dreadful than the habit of doubt. Doubt separates people. It is a poison that disintegrates friendships and breaks up pleasant relations.",
  "To live a pure unselfish life, one must count nothing as one's own in the midst of abundance.",
  "The secret of health for both mind and body is not to mourn for the past, worry about the future, or anticipate troubles, but to live in the present moment wisely and earnestly.",
  "To conquer oneself is a greater task than conquering others.",
  "Your work is to discover your world and then with all your heart give yourself to it.",
  "Those who are free of resentful thoughts surely find peace.",
  "If a man's mind becomes pure, his surroundings will also become pure.",
  "The world is afflicted by death and decay. But the wise do not grieve, having realized the nature of the world.",
  "One who acts on truth is happy in this world and beyond.",
  "Like a beautiful flower, full of color but without scent, are the well-spoken words of one who does not practice them.",
  "Like a beautiful flower, full of color and also fragrant, are the well-spoken words of one who practices them.",
  "The scent of flowers does not travel against the wind, but the fragrance of the good does.",
  "Long is the night to the sleepless; long is the mile to the weary; long is life to the foolish who do not know the true law.",
  "If a traveler does not meet with one who is his better, or his equal, let him firmly keep to his solitary journey; there is no companionship with a fool.",
  "The fool who knows his foolishness is wise at least so far. But a fool who thinks himself wise is called a fool indeed.",
  "Even if a fool associates with a wise man all his life, he will perceive the truth as little as a spoon perceives the taste of soup.",
  "If an intelligent man associates with a wise man for only a minute, he will soon perceive the truth, as the tongue perceives the taste of soup.",
  "Evil-doers are their own worst enemies.",
  "As long as the evil deed done does not bear fruit, the fool thinks it is like honey; but when it ripens, then the fool suffers grief.",
  "Let no man think lightly of evil, saying in his heart, 'It will not come near me.' Even by the falling of water-drops a water-pot is filled; the fool becomes full of evil, even if he gathers it little by little.",
  "Let no man think lightly of good, saying in his heart, 'It will not come near me.' Even by the falling of water-drops a water-pot is filled; the wise man becomes full of good, even if he gathers it little by little.",
  "Let a man avoid evil deeds, as a merchant, if he has few companions and carries much wealth, avoids a dangerous road; as a man who loves life avoids poison.",
  "He who has no wound on his hand, may touch poison with his hand; poison does not affect one who has no wound; nor is there evil for one who does not commit evil.",
  "Neither in the sky nor in the midst of the sea nor by entering into the clefts of the mountains is there known a place on earth where staying one may escape from evil deeds.",
  "All tremble at punishment; all fear death; remember that you are like unto them, and do not kill, nor cause slaughter.",
  "All tremble at punishment; all love life; remember that you are like unto them, and do not kill, nor cause slaughter.",
  "He who, seeking his own happiness, punishes or kills beings who also long for happiness, will not find happiness after death.",
  "Do not speak harshly to anyone; those who are spoken to will answer thee in the same way. Angry speech is painful, and retaliation will touch thee.",
  "If, like a shattered gong, thou utterest nothing, then thou hast reached Nirvana; anger is not known to thee.",
  "As a cowherd with his staff drives his cows into the stable, so do Age and Death drive the life of men.",
  "A fool does not know when he commits his evil deeds: but the wicked man burns by his own deeds, as if burnt by fire.",
  "He who inflicts pain on innocent and harmless persons, will soon come to one of these ten states: He will have cruel suffering, loss, injury of the body, heavy affliction, or loss of mind.",
  "Not nakedness, not platted hair, not dirt, not fasting, or lying on the earth, not rubbing with dust, not sitting motionless, can purify a mortal who has not overcome desires.",
  "He who is well-dressed, but who is also quiet, subdued, restrained, chaste, and has ceased to find fault with all other beings, he indeed is a Brahmana, an ascetic, a friar.",
  "Is there in this world any man so restrained by humility that he does not deserve blame, as a noble horse the whip?",
  "Like a noble horse, smarting under the whip, be ye strenuous and eager, and by faith, by virtue, by energy, by meditation, by discernment of the law ye shall overcome this great pain.",
  "If a man should conquer in battle a thousand times a thousand men, and another should conquer himself, he is the greatest of conquerors.",
  "One's own self conquered is better than all other people; not even a god could change into defeat the victory of a man who has vanquished himself.",
  "If a man for a hundred years sacrifice after month with a thousand, and if he but for one moment pay homage to a man whose self is grounded in knowledge, better is that homage than sacrifice for a hundred years.",
  "He who always greets and constantly reveres the aged, four things will increase to him: life, beauty, happiness, power.",
  "But he who lives a hundred years, vicious and unrestrained, a life of one day is better if a man is virtuous and reflecting.",
  "And he who lives a hundred years, ignorant and unrestrained, a life of one day is better if a man is wise and reflecting.",
  "And he who lives a hundred years, idle and weak, a life of one day is better if a man has attained firm strength.",
  "And he who lives a hundred years, not seeing beginning and end, a life of one day is better if a man sees beginning and end.",
  "And he who lives a hundred years, not seeing the immortal place, a life of one day is better if a man sees the immortal place.",
  "And he who lives a hundred years, not seeing the highest law, a life of one day is better if a man sees the highest law.",
  "Let a man hasten towards the good, and keep his thought away from evil; if a man does what is good slothfully, his mind delights in evil.",
  "If a man commits a sin, let him not do it again; let him not delight in sin: pain is the outcome of evil.",
  "If a man does what is good, let him do it again; let him delight in it: happiness is the outcome of good.",
  "Even a good man sees evil days, as long as his good deed has not ripened; but when his good deed has ripened, then does the good man see happy days.",
  "Let no man think lightly of evil, saying in his heart, It will not come near me. Even by the falling of water-drops a water-pot is filled; the fool becomes full of evil, even if he gathers it little by little.",
  "Let no man think lightly of good, saying in his heart, It will not come near me. Even by the falling of water-drops a water-pot is filled; the wise man becomes full of good, even if he gathers it little by little.",
  "A man who has no wound on his hand, may touch poison with his hand; poison does not affect one who has no wound; nor is there evil for one who does not commit evil.",
  "If a man offend a harmless, pure, and innocent person, the evil falls back upon that fool, like light dust thrown up against the wind.",
  "Some people are born again; evil-doers go to hell; righteous people go to heaven; those who are free from all worldly desires attain Nirvana."
];

const Typewriter = ({ text, className, speed = 150, delay = 2000 }: { text: string, className?: string, speed?: number, delay?: number }) => {
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

const HabitCard = ({ 
  habit, 
  onLog, 
  onEdit, 
  onDelete,
  onExpandChange,
  onKeyboardActive
}: { 
  key?: React.Key;
  habit: Habit; 
  onLog: (id: number, status: 'completed' | 'skipped', date?: Date) => Promise<void>;
  onEdit: (habit: Habit) => void;
  onDelete: (id: number) => Promise<void>;
  onExpandChange?: (expanded: boolean) => void;
  onKeyboardActive?: (active: boolean) => void;
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
      onLog(habit.id!, 'completed');
    } else if (info.offset.x < -100) {
      onLog(habit.id!, 'skipped');
    }
    setDragX(0);
  };

  const toggleExpand = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    onExpandChange?.(next);
  };

  return (
    <motion.div 
      layout
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDrag={(e, info) => setDragX(info.offset.x)}
      onDragEnd={handleDragEnd}
      className="glass-panel rounded-2xl p-4 mb-4 relative overflow-hidden group touch-none cursor-grab active:cursor-grabbing"
    >
      {/* Swipe Indicators */}
      <div className={cn(
        "absolute inset-y-0 left-0 w-20 flex items-center justify-center transition-opacity pointer-events-none",
        dragX > 20 ? "opacity-100" : "opacity-0"
      )}>
        <Check className="w-8 h-8 animate-pulse" style={{ color: habit.color || 'var(--color-aura-glow)' }} />
      </div>
      <div className={cn(
        "absolute inset-y-0 right-0 w-20 flex items-center justify-center transition-opacity pointer-events-none",
        dragX < -20 ? "opacity-100" : "opacity-0"
      )}>
        <X className="w-8 h-8 text-amber-500 animate-pulse" />
      </div>

      <motion.div 
        style={{ x: dragX }}
        className="relative z-10"
      >
        <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl overflow-hidden"
            style={{ 
              backgroundColor: `${habit.color || '#00ffcc'}20`,
              boxShadow: `0 0 15px ${habit.color || '#00ffcc'}30`
            }}
          >
            {habit.icon.startsWith('data:') ? (
              <img src={habit.icon} alt={habit.name} className="w-full h-full object-cover" />
            ) : IconComponent ? (
              <IconComponent className="w-5 h-5" style={{ color: habit.color || 'var(--color-aura-glow)' }} />
            ) : (
              <span>{habit.icon}</span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg leading-tight">{habit.name}</h3>
              {habit.isStrict && (
                <div className="px-1.5 py-0.5 rounded-md bg-red-500/20 border border-red-500/30 text-[6px] text-red-500 uppercase font-black tracking-widest">
                  Strict
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider opacity-50 font-mono">
              <span style={{ color: habit.color }}>Streak: {streak}d</span>
              <span>•</span>
              <span>Intensity: {habit.intensity}%</span>
            </div>
          </div>
        </div>
        <button 
          onClick={toggleExpand}
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
              ? "text-black" 
              : "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10"
          )}
          style={todayLog?.status === 'completed' ? { 
            backgroundColor: habit.color || 'var(--color-aura-glow)',
            boxShadow: `0 0 20px ${habit.color || '#00ffcc'}60`
          } : {}}
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
                    <label className="text-[8px] uppercase tracking-[0.2em] font-bold opacity-40">Neural Journal</label>
                    <button onClick={handleSaveNote} className={cn(
                      "text-[8px] uppercase font-bold flex items-center gap-1 transition-colors",
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
                  className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-aura-glow/60 hover:text-aura-glow"
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
  const [color, setColor] = useState(initialHabit?.color || '#00ffcc');
  const [intensity, setIntensity] = useState(initialHabit?.intensity || 50);
  const [goalDays, setGoalDays] = useState(initialHabit?.goalDays || 30);
  const [isStrict, setIsStrict] = useState(initialHabit?.isStrict || false);
  const [tab, setTab] = useState<'icons' | 'emojis' | 'custom'>('emojis');

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
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 100 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="glass-panel w-full max-w-sm rounded-[2rem] p-6 relative mb-auto sm:mb-0 mt-20"
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
              onFocus={(e) => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })}
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
                <button 
                  onClick={() => setTab('custom')}
                  className={cn("px-2 py-1 text-[8px] rounded-md font-bold uppercase", tab === 'custom' ? "bg-white/10 text-white" : "text-white/40")}
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
                    <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-center text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-colors">
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
            <label className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40">Aura Color</label>
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
                className="w-6 h-6 bg-transparent border-none cursor-pointer"
              />
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

          <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-aura-glow" />
                <span className="text-[10px] uppercase tracking-widest font-bold">Strict Protocol</span>
              </div>
              <p className="text-[7px] opacity-40 uppercase tracking-tighter">Zero-tolerance for skips. Streak resets on miss.</p>
            </div>
            <button 
              onClick={() => setIsStrict(!isStrict)}
              className={cn(
                "w-10 h-5 rounded-full transition-all relative",
                isStrict ? "bg-aura-glow" : "bg-white/10"
              )}
            >
              <div className={cn(
                "absolute top-0.5 w-4 h-4 rounded-full bg-black transition-all",
                isStrict ? "left-5.5" : "left-0.5"
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
  );
};

// --- Main Views ---

const ProtocolsView = ({ 
  onEdit, 
  onExpandChange, 
  onKeyboardActive,
  onCelebration
}: { 
  onEdit: (habit: Habit) => void, 
  onExpandChange: (id: number, expanded: boolean) => void, 
  onKeyboardActive: (active: boolean) => void,
  onCelebration: (habit: Habit) => void
}) => {
  const habits = useLiveQuery(() => db.habits.toArray());
  const settings = useLiveQuery(() => db.settings.toCollection().first());
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const handleLog = async (habitId: number, status: 'completed' | 'skipped', date?: Date) => {
    const dateStr = format(date || startOfToday(), 'yyyy-MM-dd');
    const existing = await db.logs.where('[habitId+date]').equals([habitId, dateStr]).first();
    
    if (existing) {
      if (existing.status === status) {
        await db.logs.delete(existing.id!);
      } else {
        await db.logs.update(existing.id!, { status });
        if (status === 'completed') {
          playSyncSound(settings?.soundPreset, settings?.frequencyLevel);
          checkMilestone(habitId);
        }
      }
    } else {
      await db.logs.add({ habitId, status, date: dateStr });
      if (status === 'completed') {
        playSyncSound(settings?.soundPreset, settings?.frequencyLevel);
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
            onDelete={async (id) => setDeleteId(id)}
            onExpandChange={(expanded) => onExpandChange(habit.id!, expanded)}
            onKeyboardActive={onKeyboardActive}
          />
        ))}
      </AnimatePresence>

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
};

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

  const weeklyStats = useMemo(() => {
    if (!logs) return [];
    const days = eachDayOfInterval({ start: subDays(startOfToday(), 6), end: startOfToday() });
    return days.map(d => {
      const dateStr = format(d, 'yyyy-MM-dd');
      const completed = logs.filter(l => l.date === dateStr && l.status === 'completed').length;
      const skipped = logs.filter(l => l.date === dateStr && l.status === 'skipped').length;
      return { date: dateStr, completed, skipped };
    });
  }, [logs]);

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

        <div className="grid grid-cols-3 gap-3 w-full">
          <div className="bg-white/5 rounded-2xl p-3">
            <div className="text-xl font-bold">{habits?.length || 0}</div>
            <div className="text-[7px] uppercase tracking-widest opacity-40">Nodes</div>
          </div>
          <div className="bg-white/5 rounded-2xl p-3">
            <div className="text-xl font-bold text-aura-glow">{totalCompleted}</div>
            <div className="text-[7px] uppercase tracking-widest opacity-40">Syncs</div>
          </div>
          <div className="bg-white/5 rounded-2xl p-3">
            <div className="text-xl font-bold text-amber-500">{totalSkipped}</div>
            <div className="text-[7px] uppercase tracking-widest opacity-40">Skips</div>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-3xl p-6 mb-6">
        <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40 mb-6">Weekly Pulse</h3>
        <div className="flex items-end justify-between h-32 gap-2">
          {weeklyStats.map((s, i) => {
            const max = Math.max(...weeklyStats.map(x => x.completed + x.skipped), 1);
            const completedHeight = (s.completed / max) * 100;
            const skippedHeight = (s.skipped / max) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex flex-col-reverse h-full bg-white/5 rounded-t-sm overflow-hidden">
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: `${completedHeight}%` }}
                    className="w-full bg-aura-glow/40 border-t border-aura-glow"
                  />
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: `${skippedHeight}%` }}
                    className="w-full bg-amber-500/20 border-t border-amber-500/40"
                  />
                </div>
                <span className="text-[8px] font-mono opacity-30 uppercase">{format(parseISO(s.date), 'EEE')}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="glass-panel rounded-3xl p-6">
        <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40 mb-4">Neural Heatmap</h3>
        <div className="grid grid-cols-7 gap-1">
          {heatmapData.map((d, i) => {
            const total = d.completed + d.skipped;
            return (
              <div 
                key={i}
                className="aspect-square rounded-sm transition-all"
                style={{ 
                  backgroundColor: d.completed > 0 
                    ? `rgba(var(--primary-glow-rgb), ${Math.min(d.completed * 0.25, 1)})` 
                    : d.skipped > 0 
                      ? 'rgba(245, 158, 11, 0.2)' 
                      : 'rgba(255,255,255,0.05)',
                  boxShadow: d.completed > 0 
                    ? `0 0 10px rgba(var(--primary-glow-rgb), ${d.completed * 0.1})` 
                    : 'none'
                }}
                title={`${d.date}: ${d.completed} completed, ${d.skipped} skipped`}
              />
            );
          })}
        </div>
        <div className="flex justify-between mt-2 text-[8px] font-mono opacity-30 uppercase">
          <span>35 Days Ago</span>
          <span>Today</span>
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

  return (
    <div className="px-6 pb-32 pt-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tighter uppercase mb-0.5">System</h1>
          <p className="text-[8px] font-mono uppercase tracking-widest opacity-40">Core Configuration</p>
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
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-aura-glow" />
            <h3 className="text-[10px] uppercase tracking-widest font-bold">Neural Identity</h3>
          </div>
          <input 
            value={settings?.userName || ''}
            onChange={(e) => updateUserName(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:border-aura-glow/50 transition-colors font-medium text-sm"
            placeholder="Enter Name"
          />
        </div>

        <div className="glass-panel rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-aura-glow" />
              <h3 className="text-[10px] uppercase tracking-widest font-bold">Neural Sync</h3>
            </div>
            <button 
              onClick={toggleNeuralSync}
              className={cn(
                "w-10 h-5 rounded-full transition-all relative",
                settings?.neuralSyncEnabled ? "bg-aura-glow" : "bg-white/10"
              )}
            >
              <div className={cn(
                "absolute top-0.5 w-4 h-4 rounded-full bg-black transition-all",
                settings?.neuralSyncEnabled ? "left-5.5" : "left-0.5"
              )} />
            </button>
          </div>
          <p className="text-[7px] uppercase tracking-widest opacity-30 leading-relaxed">
            Enables high-frequency audio feedback and haptic synchronization.
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-4 h-4 text-aura-glow" />
            <h3 className="text-[10px] uppercase tracking-widest font-bold">Aura Spectrum</h3>
          </div>
          
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
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 font-mono text-[10px] uppercase"
              placeholder="#HEX"
            />
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Volume2 className="w-4 h-4 text-aura-glow" />
            <h3 className="text-[10px] uppercase tracking-widest font-bold">Audio Feedback</h3>
          </div>
          
          <div className="space-y-4">
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
                <span className="text-[8px] uppercase tracking-widest opacity-40 font-bold">Frequency Level</span>
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
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-4 h-4 text-aura-glow" />
            <h3 className="text-[10px] uppercase tracking-widest font-bold">Glassmorphism Preset</h3>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {['Aura', 'Frosted', 'Crystal', 'Obsidian', 'Cyber'].map(p => (
              <button 
                key={p}
                onClick={() => updateGlass(p)}
                className={cn(
                  "py-2 rounded-xl text-[8px] uppercase font-bold tracking-widest transition-all border",
                  settings?.glassPreset === p 
                    ? "bg-aura-glow/20 border-aura-glow text-aura-glow" 
                    : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <button 
          onClick={() => setIsResetting(true)}
          className="w-full py-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/20 transition-all"
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
          <p className="text-[8px] font-mono uppercase tracking-[0.4em]">Aura OS v1.0.5 // Neuralink Certified</p>
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
  const [expandedHabits, setExpandedHabits] = useState<Set<number>>(new Set());

  const isAnyCardExpanded = expandedHabits.size > 0;

  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex(prev => (prev + 1) % QUOTES.length);
    }, 8000);
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
  }, [activeTab]);
  
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
    
    if (settings?.glassPreset) {
      const presets = {
        Aura: { bg: 'rgba(255, 255, 255, 0.05)', blur: '24px', border: 'rgba(255, 255, 255, 0.1)' },
        Frosted: { bg: 'rgba(255, 255, 255, 0.1)', blur: '10px', border: 'rgba(255, 255, 255, 0.2)' },
        Crystal: { bg: 'rgba(255, 255, 255, 0.02)', blur: '40px', border: 'rgba(255, 255, 255, 0.05)' },
        Obsidian: { bg: 'rgba(0, 0, 0, 0.6)', blur: '20px', border: 'rgba(255, 255, 255, 0.05)' },
        Cyber: { bg: 'rgba(var(--primary-glow-rgb), 0.03)', blur: '15px', border: 'rgba(var(--primary-glow-rgb), 0.2)' }
      };
      const p = presets[settings.glassPreset] || presets.Aura;
      document.documentElement.style.setProperty('--glass-bg', p.bg);
      document.documentElement.style.setProperty('--glass-blur', p.blur);
      document.documentElement.style.setProperty('--glass-border', p.border);
    }
  }, [settings]);

  const [showStats, setShowStats] = useState(false);
  const [isSyncDismissed, setIsSyncDismissed] = useState(false);
  const dismissTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isSyncActive) {
      setIsSyncDismissed(false);
    }
  }, [isSyncActive]);

  const handleSyncClick = () => {
    setShowStats(prev => !prev);
    
    // Clear any existing timeout
    if (dismissTimeoutRef.current) {
      clearTimeout(dismissTimeoutRef.current);
    }

    if (isSyncActive) {
      dismissTimeoutRef.current = setTimeout(() => {
        setIsSyncDismissed(true);
        setShowStats(false);
      }, 3000);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
    };
  }, []);
  
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
      await db.habits.add({
        ...habitData as Habit,
        createdAt: new Date()
      });
    }
    setIsModalOpen(false);
    setEditingHabit(null);
  };

  const currentQuote = useMemo(() => {
    return QUOTES[quoteIndex];
  }, [quoteIndex]);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (activeTab !== 'protocols' || isModalOpen) {
        e.preventDefault();
        setActiveTab('protocols');
        setIsModalOpen(false);
        window.history.pushState(null, '', window.location.pathname);
      }
    };

    window.history.pushState(null, '', window.location.pathname);
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
            className="px-6 pt-8 pb-6 sticky top-0 z-40 bg-vantablack/80 backdrop-blur-md border-b border-white/5 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-aura-glow/20 flex items-center justify-center relative animate-supernova">
                  <Crown className="w-5 h-5 text-aura-glow" />
                </div>
                <div className="flex flex-col">
                  <Typewriter text={settings?.userName || "Thant Zin Aung"} className="text-sm opacity-80" />
                  <span className="text-[8px] font-mono uppercase tracking-widest opacity-40">Aura Level: Elite</span>
                </div>
              </div>
              <div className="flex items-center gap-2 relative">
                <AnimatePresence>
                  {isSyncActive && !isSyncDismissed && (
                    <motion.button 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20, filter: 'blur(10px)' }}
                      onClick={handleSyncClick}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-aura-glow animate-pulse shadow-[0_0_8px_var(--color-aura-glow)]" />
                      <span className="text-[7px] font-black tracking-[0.2em] uppercase text-aura-glow/80">
                        [ SYNC ]
                      </span>
                    </motion.button>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {showStats && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute top-full right-0 mt-2 w-48 glass-panel rounded-2xl p-4 z-50 shadow-2xl border border-aura-glow/20"
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[8px] uppercase tracking-widest opacity-40 font-bold">Total Protocols</span>
                          <span className="text-xs font-mono font-bold">{stats.total}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[8px] uppercase tracking-widest text-aura-glow font-bold">Synchronized</span>
                          <span className="text-xs font-mono font-bold text-aura-glow">{stats.completed}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[8px] uppercase tracking-widest text-amber-500 font-bold">Deferred</span>
                          <span className="text-xs font-mono font-bold text-amber-500">{stats.skipped}</span>
                        </div>
                        <div className="pt-2 border-t border-white/5">
                          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${(stats.completed / (stats.total || 1)) * 100}%` }}
                              className="h-full bg-aura-glow"
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
                <div className="line-clamp-2 leading-relaxed">
                  <Typewriter 
                    text={currentQuote} 
                    className="text-[9px] text-white/40 italic lowercase" 
                    speed={40} 
                    delay={3000}
                  />
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
                onEdit={(h) => { setEditingHabit(h); setIsModalOpen(true); }} 
                onExpandChange={handleExpandChange} 
                onKeyboardActive={setIsKeyboardActive}
                onCelebration={(h) => setCelebrationHabit(h)}
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
        {activeTab !== 'system' && !isKeyboardActive && (
          <motion.nav 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-48px)] max-w-sm z-50"
          >
            <div className="glass-panel rounded-[2rem] p-2 flex items-center justify-between relative overflow-hidden">
              <div className="absolute inset-0 bg-aura-glow/5 pointer-events-none" />
              
              <button 
                onClick={() => setActiveTab('protocols')}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl transition-all relative z-10",
                  activeTab === 'protocols' ? "text-aura-glow bg-white/5 shadow-[inset_0_0_20px_rgba(var(--primary-glow-rgb),0.1)]" : "text-white/40 hover:text-white/60"
                )}
              >
                <Activity className="w-5 h-5" />
                <span className="text-[8px] font-bold uppercase tracking-widest">Protocols</span>
                {activeTab === 'protocols' && (
                  <motion.div layoutId="nav-glow" className="absolute bottom-1 w-1 h-1 rounded-full bg-aura-glow shadow-[0_0_10px_var(--color-aura-glow)]" />
                )}
              </button>

              <button 
                onClick={() => setActiveTab('evolution')}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl transition-all relative z-10",
                  activeTab === 'evolution' ? "text-aura-glow bg-white/5 shadow-[inset_0_0_20px_rgba(var(--primary-glow-rgb),0.1)]" : "text-white/40 hover:text-white/60"
                )}
              >
                <Zap className="w-5 h-5" />
                <span className="text-[8px] font-bold uppercase tracking-widest">Evolution</span>
                {activeTab === 'evolution' && (
                  <motion.div layoutId="nav-glow" className="absolute bottom-1 w-1 h-1 rounded-full bg-aura-glow shadow-[0_0_10px_var(--color-aura-glow)]" />
                )}
              </button>

              <button 
                onClick={() => setActiveTab('system')}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl transition-all relative z-10",
                  activeTab === 'system' ? "text-aura-glow bg-white/5 shadow-[inset_0_0_20px_rgba(var(--primary-glow-rgb),0.1)]" : "text-white/40 hover:text-white/60"
                )}
              >
                <SettingsIcon className="w-5 h-5" />
                <span className="text-[8px] font-bold uppercase tracking-widest">System</span>
                {activeTab === 'system' && (
                  <motion.div layoutId="nav-glow" className="absolute bottom-1 w-1 h-1 rounded-full bg-aura-glow shadow-[0_0_10px_var(--color-aura-glow)]" />
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
    </div>
  );
}
