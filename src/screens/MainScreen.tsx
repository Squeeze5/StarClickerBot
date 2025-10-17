import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../db';
import { id } from '@instantdb/react';
import { calculateClickValue, calculateAutoClickerRate } from '../config/upgrades';
import { SKINS, getSkin, userOwnsSkin, getPurchasableSkins } from '../config/skins';
import './MainScreen.css';

interface MainScreenProps {
  userId: string;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  value: number;
  angle: number; // Random angle for particle direction
  distance: number; // Random distance for particle travel
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
  const [ownedSkins, setOwnedSkins] = useState<string[]>(['default']);
  const [purchasing, setPurchasing] = useState<string | null>(null);

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
      // Ensure all values are numbers, not functions
      setBalance(Number(user.balance) || 0);
      setTotalClicks(Number(user.totalClicks) || 0);
      setClickPower(Number(user.clickPower) || 0);
      setMultiplierLevel(Number(user.multiplierLevel) || 0);
      setAutoClickerLevel(Number(user.autoClickerLevel) || 0);
      setCurrentSkin(user.currentSkin || 'default');
      setOwnedSkins(user.ownedSkins || ['default']);
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

    // Create multiple mini particles that fly in different directions
    const numParticles = 5; // 5 mini stars per click
    const newParticles: Particle[] = [];

    for (let i = 0; i < numParticles; i++) {
      const angle = (Math.random() * 360) * (Math.PI / 180); // Random angle in radians
      const distance = 60 + Math.random() * 40; // Random distance 60-100px

      newParticles.push({
        id: particleId + i,
        x,
        y,
        value: i === 0 ? clickValue : 0, // Only first particle shows value
        angle,
        distance
      });
    }

    setParticles(prev => [...prev, ...newParticles]);
    setParticleId(prev => prev + numParticles);

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

  // Skin handlers
  const handleEquip = useCallback(async (skinId: string) => {
    if (!userOwnsSkin(ownedSkins, skinId) || !userId) return;

    try {
      await db.transact([
        db.tx.users[userId].update({
          currentSkin: skinId
        })
      ]);
      window.Telegram?.WebApp?.HapticFeedback?.selectionChanged();
    } catch (error) {
      console.error('Error equipping skin:', error);
    }
  }, [ownedSkins, userId]);

  const handlePurchase = useCallback(async (skinId: string) => {
    if (!userId) return;
    const skin = getSkin(skinId);

    if (balance < skin.cost) {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error');
      return;
    }

    if (userOwnsSkin(ownedSkins, skinId)) return;

    setPurchasing(skinId);

    try {
      const newBalance = balance - skin.cost;
      const newOwnedSkins = [...ownedSkins, skinId];
      const activityId = id();

      await db.transact([
        db.tx.users[userId].update({
          balance: newBalance,
          ownedSkins: newOwnedSkins,
          currentSkin: skinId
        }),
        // Log activity - will be added when schema is pushed
        // @ts-ignore - activities entity will exist after schema update
        db.tx.activities[activityId].update({
          userId: userId,
          type: 'skin',
          description: `Purchased ${skin.name}`,
          amount: -skin.cost,
          timestamp: Date.now(),
          metadata: { skinId: skinId, skinName: skin.name }
        })
      ]);

      setBalance(newBalance);
      setOwnedSkins(newOwnedSkins);
      setCurrentSkin(skinId);

      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    } catch (error) {
      console.error('Error purchasing skin:', error);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error');
    } finally {
      setPurchasing(null);
    }
  }, [userId, balance, ownedSkins]);

  // Get current skin data
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

        {/* Particle system - falling mini stars */}
        <AnimatePresence>
          {particles.map(particle => {
            const endX = particle.x + Math.cos(particle.angle) * particle.distance;
            const endY = particle.y + Math.sin(particle.angle) * particle.distance;

            return (
              <motion.div
                key={particle.id}
                className="particle"
                initial={{
                  opacity: 1,
                  x: particle.x - 10,
                  y: particle.y - 10,
                  scale: 1,
                  rotate: 0
                }}
                animate={{
                  opacity: 0,
                  x: endX - 10,
                  y: endY - 10,
                  scale: 0.3,
                  rotate: 360
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                style={{ position: 'absolute', pointerEvents: 'none' }}
              >
                {particle.value > 0 && (
                  <span className="particle-value" style={{ position: 'absolute', top: -25, left: -10, whiteSpace: 'nowrap' }}>
                    +{particle.value}
                  </span>
                )}
                <img
                  src={`${import.meta.env.BASE_URL}icons/star.png`}
                  alt=""
                  className="particle-star-icon"
                  style={{ width: '20px', height: '20px' }}
                />
              </motion.div>
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

      {/* Skins Section */}
      <div className="skins-section-main">
        <div className="skins-header-compact">
          <h3 className="skins-title-compact">
            <img src={`${import.meta.env.BASE_URL}icons/artist_palette_3d.png`} alt="Skins" style={{width: '24px', height: '24px', marginRight: '8px'}} />
            Skins
          </h3>
        </div>
        <div className="skins-grid-compact">
          {[SKINS.default, ...getPurchasableSkins()].map(skinItem => {
            const owned = userOwnsSkin(ownedSkins, skinItem.id);
            const equipped = currentSkin === skinItem.id;
            const canAfford = balance >= skinItem.cost;

            return (
              <div
                key={skinItem.id}
                className={`skin-card-compact ${equipped ? 'equipped' : ''} ${!owned && !canAfford ? 'locked' : ''}`}
              >
                <div className="skin-preview-compact">
                  <img
                    src={skinItem.imageUrl || `${import.meta.env.BASE_URL}icons/star.png`}
                    alt={skinItem.name}
                    className="skin-image-compact"
                  />
                  {equipped && <div className="equipped-badge-compact">✓</div>}
                </div>
                <div className="skin-name-compact">{skinItem.name}</div>
                {skinItem.isDefault ? (
                  <button
                    className="skin-button-compact default"
                    onClick={() => handleEquip(skinItem.id)}
                    disabled={equipped}
                  >
                    {equipped ? 'Equipped' : 'Equip'}
                  </button>
                ) : owned ? (
                  <button
                    className="skin-button-compact owned"
                    onClick={() => handleEquip(skinItem.id)}
                    disabled={equipped}
                  >
                    {equipped ? 'Equipped' : 'Equip'}
                  </button>
                ) : (
                  <button
                    className={`skin-button-compact purchase ${canAfford ? 'can-afford' : 'locked'}`}
                    onClick={() => handlePurchase(skinItem.id)}
                    disabled={!canAfford || purchasing === skinItem.id}
                  >
                    {purchasing === skinItem.id ? '...' : (
                      <>
                        <img src={`${import.meta.env.BASE_URL}icons/star.png`} alt="Star" style={{width: '14px', height: '14px'}} />
                        {skinItem.cost >= 1000 ? `${(skinItem.cost/1000).toFixed(0)}K` : skinItem.cost}
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MainScreen;
