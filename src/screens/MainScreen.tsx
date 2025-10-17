import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../db';
import { id } from '@instantdb/react';
import { calculateClickValue, calculateAutoClickerRate } from '../config/upgrades';
import { getSkin } from '../config/skins';
import './MainScreen.css';

interface MainScreenProps {
  userId: string;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  value: number;
}

const MainScreen = ({ userId }: MainScreenProps) => {
  const [balance, setBalance] = useState(0);
  const [totalClicks, setTotalClicks] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [particleId, setParticleId] = useState(0);

  // Upgrade states
  const [clickPower, setClickPower] = useState(0);
  const [multiplierLevel, setMultiplierLevel] = useState(0);
  const [autoClickerLevel, setAutoClickerLevel] = useState(0);

  // Skin state
  const [currentSkin, setCurrentSkin] = useState('default');

  // Performance optimization: batch updates
  const pendingUpdatesRef = useRef<{balance: number, clicks: number} | null>(null);
  const updateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoClickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Query user data
  const { data } = db.useQuery({
    users: {
      $: {
        where: { id: userId }
      }
    }
  });

  useEffect(() => {
    if (data?.users && data.users.length > 0) {
      const user = data.users[0];
      setBalance(user.balance || 0);
      setTotalClicks(user.totalClicks || 0);
      setClickPower(user.clickPower || 0);
      setMultiplierLevel(user.multiplierLevel || 0);
      setAutoClickerLevel(user.autoClickerLevel || 0);
      setCurrentSkin(user.currentSkin || 'default');
    }
  }, [data]);

  // Auto-clicker effect
  useEffect(() => {
    if (autoClickerLevel > 0) {
      const starsPerSecond = calculateAutoClickerRate(autoClickerLevel);

      // Clear existing interval
      if (autoClickerRef.current) {
        clearInterval(autoClickerRef.current);
      }

      // Auto-clicker runs every second
      autoClickerRef.current = setInterval(() => {
        setBalance(prev => {
          const newBalance = prev + starsPerSecond;

          // Schedule database update
          scheduleUpdate(newBalance, totalClicks);

          return newBalance;
        });
      }, 1000);

      return () => {
        if (autoClickerRef.current) {
          clearInterval(autoClickerRef.current);
        }
      };
    }
  }, [autoClickerLevel, totalClicks]);

  // Batch database updates for performance
  const scheduleUpdate = useCallback((newBalance: number, newClicks: number) => {
    pendingUpdatesRef.current = { balance: newBalance, clicks: newClicks };

    // Clear existing timer
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current);
    }

    // Schedule update after 500ms of inactivity
    updateTimerRef.current = setTimeout(async () => {
      const updates = pendingUpdatesRef.current;
      if (updates && userId) {
        try {
          await db.transact([
            db.tx.users[userId].update({
              balance: updates.balance,
              totalClicks: updates.clicks
            })
          ]);
          pendingUpdatesRef.current = null;
        } catch (error) {
          console.error('Error saving update:', error);
        }
      }
    }, 500);
  }, [userId]);

  const handleStarClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!userId) return;

    // Haptic feedback
    const tg = window.Telegram?.WebApp;
    if (tg?.HapticFeedback) {
      try {
        tg.HapticFeedback.impactOccurred('light');
      } catch (err) {
        // Ignore haptic errors
      }
    }

    // Get click position relative to the star container
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calculate click value
    const clickValue = calculateClickValue(clickPower, multiplierLevel);

    // Create particle at click position
    const newParticle: Particle = {
      id: particleId,
      x,
      y,
      value: clickValue
    };

    setParticles(prev => [...prev, newParticle]);
    setParticleId(prev => prev + 1);

    // Remove particle after animation
    setTimeout(() => {
      setParticles(prev => prev.filter(p => p.id !== newParticle.id));
    }, 1000);

    // Update balance immediately (optimistic update)
    const newBalance = balance + clickValue;
    const newTotalClicks = totalClicks + 1;
    setBalance(newBalance);
    setTotalClicks(newTotalClicks);

    // Schedule batched database update
    scheduleUpdate(newBalance, newTotalClicks);

    // Log click event (non-blocking)
    const clickId = id();
    db.transact([
      db.tx.clicks[clickId].update({
        userId: userId,
        amount: clickValue,
        timestamp: Date.now()
      })
    ]).catch(err => console.error('Error logging click:', err));

  }, [userId, balance, totalClicks, clickPower, multiplierLevel, particleId, scheduleUpdate]);

  // Get current skin data
  const skin = getSkin(currentSkin);

  return (
    <div className="main-screen">
      <div className="balance-container">
        <h1 className="balance">{Math.floor(balance).toLocaleString()}</h1>
        <p className="balance-label">Stars</p>
        {autoClickerLevel > 0 && (
          <p className="auto-clicker-info">
            +{calculateAutoClickerRate(autoClickerLevel)}/sec
          </p>
        )}
      </div>

      <div className="star-container" onClick={handleStarClick}>
        <motion.div
          className="star"
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          style={{
            filter: `drop-shadow(0 4px 20px ${skin.glow || 'rgba(255, 214, 10, 0.4)'})`
          }}
        >
          {/* Use image if available, fallback to emoji */}
          {skin.imageUrl ? (
            <img
              src={skin.imageUrl}
              alt={skin.name}
              className="star-image"
              onError={(e) => {
                // Fallback to emoji if image fails to load
                e.currentTarget.style.display = 'none';
                const nextEl = e.currentTarget.nextElementSibling as HTMLElement;
                if (nextEl) nextEl.style.display = 'block';
              }}
            />
          ) : null}
          <span className="star-emoji" style={{ display: skin.imageUrl ? 'none' : 'block' }}>
            {skin.emoji}
          </span>
        </motion.div>

        {/* Particle system */}
        <AnimatePresence>
          {particles.map(particle => (
            <motion.div
              key={particle.id}
              className="particle"
              initial={{
                opacity: 1,
                y: 0,
                x: particle.x - 25,
                top: particle.y - 15,
                scale: 1
              }}
              animate={{
                opacity: 0,
                y: -100,
                scale: 1.2
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, ease: 'easeOut' }}
            >
              <span className="particle-value">+{particle.value}</span>
              <img src={`${import.meta.env.BASE_URL}icons/star.png`} alt="" className="particle-star-icon" />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-label">Per Click</span>
          <span className="stat-value">{calculateClickValue(clickPower, multiplierLevel)}</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-label">Total Clicks</span>
          <span className="stat-value">{totalClicks.toLocaleString()}</span>
        </div>
      </div>

      <div className="bottom-info">
        <p className="tap-hint">Tap the star to earn!</p>
      </div>
    </div>
  );
};

export default MainScreen;
