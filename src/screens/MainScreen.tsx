import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../db';
import { id } from '@instantdb/react';
import './MainScreen.css';

interface MainScreenProps {
  userId: string;
}

interface ClickAnimation {
  id: number;
  x: number;
  y: number;
}

const MainScreen = ({ userId }: MainScreenProps) => {
  const [balance, setBalance] = useState(0);
  const [totalClicks, setTotalClicks] = useState(0);
  const [clickAnimations, setClickAnimations] = useState<ClickAnimation[]>([]);
  const [animationId, setAnimationId] = useState(0);

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
      console.log('User data loaded:', user);
    }
  }, [data]);

  const handleStarClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!userId) {
      console.log('No userId');
      return;
    }

    console.log('Star clicked!');

    // Trigger Telegram vibration
    const tg = window.Telegram?.WebApp;
    if (tg && tg.HapticFeedback) {
      try {
        tg.HapticFeedback.impactOccurred('light');
      } catch (err) {
        console.log('Haptic feedback not available');
      }
    }

    // Create click animation
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newAnimation: ClickAnimation = {
      id: animationId,
      x,
      y
    };

    setClickAnimations(prev => [...prev, newAnimation]);
    setAnimationId(prev => prev + 1);

    // Remove animation after it completes
    setTimeout(() => {
      setClickAnimations(prev => prev.filter(anim => anim.id !== newAnimation.id));
    }, 1000);

    // Update balance immediately for better UX
    const newBalance = balance + 1;
    const newTotalClicks = totalClicks + 1;
    setBalance(newBalance);
    setTotalClicks(newTotalClicks);

    try {
      // Update user balance and clicks in database
      await db.transact([
        db.tx.users[userId].update({
          balance: newBalance,
          totalClicks: newTotalClicks
        })
      ]);

      // Log individual click
      const clickId = id();
      await db.transact([
        db.tx.clicks[clickId].update({
          userId: userId,
          amount: 1,
          timestamp: Date.now()
        })
      ]);

      console.log('Click saved to database');
    } catch (error) {
      console.error('Error saving click:', error);
    }
  };

  return (
    <div className="main-screen">
      <div className="balance-container">
        <h1 className="balance">{balance.toLocaleString()}</h1>
        <p className="balance-label">Stars</p>
      </div>

      <div className="star-container" onClick={handleStarClick}>
        <motion.div
          className="star"
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        >
          ⭐
        </motion.div>

        <AnimatePresence>
          {clickAnimations.map(anim => (
            <motion.div
              key={anim.id}
              className="click-animation"
              initial={{ opacity: 1, y: 0, x: anim.x - 15, top: anim.y - 15 }}
              animate={{ opacity: 0, y: -80 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1 }}
            >
              +1
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="bottom-info">
        <p className="tap-hint">Tap the star to earn!</p>
      </div>
    </div>
  );
};

export default MainScreen;
