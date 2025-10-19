import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../db';
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
  angle: number; // Random angle for particle direction
  distance: number; // Random distance for particle travel
}

interface FloatingNumber {
  id: number;
  x: number;
  y: number;
  value: number;
}

const MainScreen = ({ userId }: MainScreenProps) => {
  const [balance, setBalance] = useState(0);
  const [totalClicks, setTotalClicks] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [floatingNumbers, setFloatingNumbers] = useState<FloatingNumber[]>([]);
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

      // CRITICAL FIX: Don't overwrite local state if we have pending updates
      // This prevents the "stars going down then back up" bug during fast clicking
      if (!pendingUpdatesRef.current) {
        // Only update if there are no pending changes
        setBalance(Number(user.balance) || 0);
        setTotalClicks(Number(user.totalClicks) || 0);
      }

      // These are safe to always update as they don't change during clicking
      setClickPower(Number(user.clickPower) || 0);
      setMultiplierLevel(Number(user.multiplierLevel) || 0);
      setAutoClickerLevel(Number(user.autoClickerLevel) || 0);
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

    // Schedule update after 300ms of inactivity (reduced from 500ms for better sync)
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
          // Retry once after 1 second if failed
          setTimeout(() => {
            if (pendingUpdatesRef.current) {
              db.transact([
                db.tx.users[userId].update({
                  balance: pendingUpdatesRef.current.balance,
                  totalClicks: pendingUpdatesRef.current.clicks
                })
              ]).catch(err => console.error('Retry failed:', err));
            }
          }, 1000);
        }
      }
    }, 300);
  }, [userId]);

  // Force sync on tab visibility change or before unload
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && pendingUpdatesRef.current && userId) {
        // Force immediate sync when tab becomes hidden
        db.transact([
          db.tx.users[userId].update({
            balance: pendingUpdatesRef.current.balance,
            totalClicks: pendingUpdatesRef.current.clicks
          })
        ]).catch(err => console.error('Force sync failed:', err));
      }
    };

    const handleBeforeUnload = () => {
      if (pendingUpdatesRef.current && userId) {
        // Synchronous last attempt to save
        navigator.sendBeacon?.('/api/save', JSON.stringify(pendingUpdatesRef.current));
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [userId]);

  // Get particle color based on current skin
  const getParticleColor = useCallback((skinId: string): string => {
    switch (skinId) {
      case 'pumpkin':
        return '#ff8c00'; // Orange
      case 'alien':
        return '#32cd32'; // Lime
      case 'default':
      case 'golden':
      case 'rainbow':
      default:
        return '#ffd700'; // Yellow/Gold
    }
  }, []);

  const handleStarClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!userId) return;

    e.preventDefault(); // Prevent any default behavior

    // Haptic feedback (optimized - no try/catch needed)
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');

    // Get click position relative to the star container
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calculate click value
    const clickValue = calculateClickValue(clickPower, multiplierLevel);

    // Create a static floating number at click position
    const floatingNumber: FloatingNumber = {
      id: particleId,
      x,
      y,
      value: clickValue
    };

    setFloatingNumbers(prev => [...prev, floatingNumber]);

    // Remove floating number after fade out
    setTimeout(() => {
      setFloatingNumbers(prev => prev.filter(fn => fn.id !== floatingNumber.id));
    }, 1000);

    // Create multiple mini particles that fly in different directions
    const numParticles = 5; // 5 mini stars per click
    const newParticles: Particle[] = [];

    for (let i = 0; i < numParticles; i++) {
      const angle = (Math.random() * 360) * (Math.PI / 180); // Random angle in radians
      const distance = 60 + Math.random() * 40; // Random distance 60-100px

      newParticles.push({
        id: particleId + i + 1,
        x,
        y,
        angle,
        distance
      });
    }

    setParticles(prev => [...prev, ...newParticles]);
    setParticleId(prev => prev + numParticles + 1);

    // Remove particles after animation
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.some(np => np.id === p.id)));
    }, 800);

    // Update balance immediately (optimistic update)
    const newBalance = balance + clickValue;
    const newTotalClicks = totalClicks + 1;
    setBalance(newBalance);
    setTotalClicks(newTotalClicks);

    // Schedule batched database update
    scheduleUpdate(newBalance, newTotalClicks);

    // REMOVED: Click logging to reduce database load and improve performance

  }, [userId, balance, totalClicks, clickPower, multiplierLevel, particleId, scheduleUpdate]);

  // Get current skin data for display
  const skin = getSkin(currentSkin);

  return (
    <div className="main-screen">
      <div className="balance-container">
        <h1 className="balance">{Math.floor(Number(balance) || 0).toLocaleString()}</h1>
        <p className="balance-label">Stars</p>
        {autoClickerLevel > 0 && (
          <p className="auto-clicker-info">
            +{calculateAutoClickerRate(Number(autoClickerLevel) || 0)}/sec
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
          {/* Use image only - no emoji fallback */}
          <img
            src={skin.imageUrl || `${import.meta.env.BASE_URL}icons/star.png`}
            alt={skin.name}
            className="star-image"
          />
        </motion.div>

        {/* Floating numbers - static position, fade out */}
        <AnimatePresence>
          {floatingNumbers.map(num => (
            <motion.div
              key={`num-${num.id}`}
              className="floating-number"
              initial={{
                opacity: 1,
                x: num.x,
                y: num.y - 30,
                scale: 1
              }}
              animate={{
                opacity: 0,
                y: num.y - 60,
                scale: 1.2
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                pointerEvents: 'none',
                color: '#ffd700',
                fontWeight: 'bold',
                fontSize: '24px',
                textShadow: '0 0 10px rgba(255, 215, 0, 0.8)',
                zIndex: 100
              }}
            >
              +{num.value}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Particle system - animated colored circles */}
        <AnimatePresence>
          {particles.map(particle => {
            const particleSize = 12;
            const halfSize = particleSize / 2;
            const endX = particle.x + Math.cos(particle.angle) * particle.distance;
            const endY = particle.y + Math.sin(particle.angle) * particle.distance;
            const particleColor = getParticleColor(currentSkin);

            return (
              <motion.div
                key={`particle-${particle.id}`}
                className="particle-circle"
                initial={{
                  opacity: 1,
                  x: particle.x - halfSize,
                  y: particle.y - halfSize,
                  scale: 1
                }}
                animate={{
                  opacity: 0,
                  x: endX - halfSize,
                  y: endY - halfSize,
                  scale: 0.3
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                style={{
                  position: 'absolute',
                  pointerEvents: 'none',
                  width: `${particleSize}px`,
                  height: `${particleSize}px`,
                  borderRadius: '50%',
                  backgroundColor: particleColor,
                  boxShadow: `0 0 8px ${particleColor}`
                }}
              />
            );
          })}
        </AnimatePresence>
      </div>

      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-label">Per Click</span>
          <span className="stat-value">{calculateClickValue(Number(clickPower) || 0, Number(multiplierLevel) || 0)}</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-label">Total Clicks</span>
          <span className="stat-value">{(Number(totalClicks) || 0).toLocaleString()}</span>
        </div>
      </div>

      <div className="bottom-info">
        <p className="tap-hint">Tap the star to earn!</p>
      </div>

      {/* Channel Banner */}
      <a
        href="https://t.me/starclickerchannel"
        target="_blank"
        rel="noopener noreferrer"
        className="channel-banner"
        onClick={(e) => {
          e.preventDefault();
          window.Telegram?.WebApp?.openTelegramLink('https://t.me/starclickerchannel');
        }}
      >
        <div className="banner-icon">
          <img src={`${import.meta.env.BASE_URL}icons/loudspeaker_3d.png`} alt="Loudspeaker" />
        </div>
        <div className="banner-content">
          <div className="banner-title">Join Our Channel!</div>
          <div className="banner-description">Get updates, tips & exclusive rewards</div>
        </div>
        <div className="banner-arrow">→</div>
      </a>
    </div>
  );
};

export default MainScreen;
