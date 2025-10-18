import { useState, useEffect, useRef } from 'react';
import { db } from './db';
import MainScreen from './screens/MainScreen';
import ProfileScreen from './screens/ProfileScreen';
import ShopScreen from './screens/ShopScreen';
import SkinsScreen from './screens/SkinsScreen';
import UpgradesScreen from './screens/UpgradesScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import './App.css';
import { id } from '@instantdb/react';
import { calculateAutoClickerRate } from './config/upgrades';

// Declare Telegram WebApp type
declare global {
  interface Window {
    Telegram?: {
      WebApp: any;
    };
  }
}

type Screen = 'main' | 'profile' | 'shop' | 'skins' | 'upgrades' | 'leaderboard';

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('main');
  const [userId, setUserId] = useState<string>('');
  const [telegramUser, setTelegramUser] = useState<any>(null);
  const [telegramId, setTelegramId] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState(false);

  // Auto-clicker state (global - works in all tabs)
  const [autoClickerLevel, setAutoClickerLevel] = useState(0);
  const autoClickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Query for existing user by telegramId (only when telegramId is set)
  const { data: userData } = db.useQuery({
    users: {
      $: {
        where: {
          telegramId: telegramId
        }
      }
    }
  });

  // Query for current user data to get auto-clicker level
  const { data: currentUserData } = db.useQuery({
    users: userId ? {
      $: {
        where: { id: userId }
      }
    } : {}
  });

  // Update auto-clicker level when user data changes
  useEffect(() => {
    if (currentUserData?.users && currentUserData.users.length > 0) {
      const user = currentUserData.users[0];
      // Ensure value is a number, not a function
      setAutoClickerLevel(Number(user.autoClickerLevel) || 0);
    }
  }, [currentUserData]);

  // Global auto-clicker effect (works in all tabs)
  useEffect(() => {
    if (!userId || autoClickerLevel === 0) {
      if (autoClickerRef.current) {
        clearInterval(autoClickerRef.current);
        autoClickerRef.current = null;
      }
      return;
    }

    const starsPerSecond = calculateAutoClickerRate(autoClickerLevel);

    // Clear existing interval
    if (autoClickerRef.current) {
      clearInterval(autoClickerRef.current);
    }

    // Auto-clicker runs every second
    autoClickerRef.current = setInterval(async () => {
      try {
        // Get current balance from the database
        if (currentUserData?.users && currentUserData.users.length > 0) {
          const currentBalance = Number(currentUserData.users[0].balance) || 0;
          const newBalance = currentBalance + starsPerSecond;

          await db.transact([
            db.tx.users[userId].update({
              balance: newBalance
            })
          ]);
        }
      } catch (error) {
        console.error('Auto-clicker error:', error);
      }
    }, 1000);

    return () => {
      if (autoClickerRef.current) {
        clearInterval(autoClickerRef.current);
      }
    };
  }, [userId, autoClickerLevel, currentUserData]);

  useEffect(() => {
    // Initialize Telegram WebApp
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      tg.setHeaderColor('#000000');
      tg.setBackgroundColor('#000000');

      const user = tg.initDataUnsafe?.user;
      const startParam = tg.initDataUnsafe?.start_param; // Get referral code from start_param

      if (user) {
        console.log('Telegram user:', user);
        console.log('Start param (referral code):', startParam);
        setTelegramUser({ ...user, referralCodeUsed: startParam || '' });
        setTelegramId(Number(user.id));
      } else {
        // Fallback for testing outside Telegram
        console.log('No Telegram user, using fallback');
        const fallbackUser = {
          id: Date.now(),
          first_name: 'Test',
          last_name: 'User',
          username: 'testuser'
        };
        setTelegramUser(fallbackUser);
        setTelegramId(Number(fallbackUser.id));
      }
    } else {
      // Fallback for development
      console.log('Telegram WebApp not available, using fallback');
      const fallbackUser = {
        id: Date.now(),
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser'
      };
      setTelegramUser(fallbackUser);
      setTelegramId(Number(fallbackUser.id));
    }
  }, []);

  // Handle user initialization when userData is loaded
  useEffect(() => {
    if (telegramId === 0 || !telegramUser || isInitialized) return;

    console.log('User data loaded:', userData);

    if (userData?.users && userData.users.length > 0) {
      // User exists, use their ID
      const existingUser = userData.users[0];
      console.log('Found existing user:', existingUser);
      setUserId(existingUser.id);
      setIsInitialized(true);
    } else if (userData !== undefined) {
      // Query completed and no user found, create new one
      console.log('Creating new user...');
      createNewUser(telegramUser);
    }
  }, [userData, telegramId, telegramUser, isInitialized]);

  const createNewUser = async (tgUser: any) => {
    try {
      const newUserId = id();
      const referralCode = generateReferralCode();
      const usedReferralCode = tgUser.referralCodeUsed || '';

      // Initial balance: 50 stars if referred, 0 otherwise
      const initialBalance = usedReferralCode ? 50 : 0;

      console.log('Creating user with referral code:', usedReferralCode);

      // Create the new user
      await db.transact([
        db.tx.users[newUserId].update({
          telegramId: Number(tgUser.id),
          username: tgUser.username || '',
          firstName: tgUser.first_name || '',
          lastName: tgUser.last_name || '',
          photoUrl: tgUser.photo_url || '',
          balance: initialBalance,
          totalClicks: 0,
          referralCode: referralCode,
          referredBy: usedReferralCode,
          createdAt: Date.now(),
          // Initialize upgrades
          clickPower: 1,
          autoClickerLevel: 0,
          multiplierLevel: 0,
          // Initialize skins
          currentSkin: 'default',
          ownedSkins: ['default']
        })
      ]);

      console.log('New user created:', newUserId);

      // If user was referred, award bonus to referrer
      if (usedReferralCode) {
        await awardReferralBonus(usedReferralCode, newUserId);
      }

      setUserId(newUserId);
      setIsInitialized(true);
    } catch (error) {
      console.error('Error creating user:', error);
      const tempId = `temp_${Date.now()}`;
      setUserId(tempId);
      setIsInitialized(true);
    }
  };

  const awardReferralBonus = async (referrerCode: string, newUserId: string) => {
    try {
      console.log('Processing referral with code:', referrerCode);

      // Find the user with this referral code
      const { data: referrerData } = await db.queryOnce({
        users: {
          $: {
            where: {
              referralCode: referrerCode
            },
            limit: 1
          }
        }
      });

      if (!referrerData?.users || referrerData.users.length === 0) {
        console.log('Referrer not found with code:', referrerCode);
        return;
      }

      const referrer = referrerData.users[0];
      const referralId = id();

      // Create referral record and award bonus to referrer
      await db.transact([
        db.tx.referrals[referralId].update({
          referrerId: referrer.id, // Store user ID, not code
          referredUserId: newUserId,
          reward: 100,
          timestamp: Date.now()
        }),
        // Award 100 stars to the referrer
        db.tx.users[referrer.id].update({
          balance: (Number(referrer.balance) || 0) + 100
        })
      ]);

      console.log('Referral bonus awarded! Referrer:', referrer.id, 'New user:', newUserId);
    } catch (error) {
      console.error('Error recording referral:', error);
    }
  };

  const generateReferralCode = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  };

  const handleNavClick = (screen: Screen) => {
    // Trigger Telegram vibration
    const tg = window.Telegram?.WebApp;
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.selectionChanged();
    }
    setCurrentScreen(screen);
  };

  const renderScreen = () => {
    if (!isInitialized || !userId) {
      return (
        <div className="loading">
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⭐</div>
            <div>Loading...</div>
          </div>
        </div>
      );
    }

    switch (currentScreen) {
      case 'main':
        return <MainScreen userId={userId} />;
      case 'profile':
        return <ProfileScreen userId={userId} telegramUser={telegramUser} />;
      case 'shop':
        return <ShopScreen userId={userId} />;
      case 'skins':
        return <SkinsScreen userId={userId} />;
      case 'upgrades':
        return <UpgradesScreen userId={userId} />;
      case 'leaderboard':
        return <LeaderboardScreen userId={userId} />;
      default:
        return <MainScreen userId={userId} />;
    }
  };

  return (
    <div className="app">
      <div className="screen-container">
        {renderScreen()}
      </div>

      {/* Modern 6-tab navigation with icons */}
      <nav className="bottom-nav" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
        <button
          className={`nav-item ${currentScreen === 'main' ? 'active' : ''}`}
          onClick={() => handleNavClick('main')}
        >
          <img src={`${import.meta.env.BASE_URL}icons/star.png`} alt="Main" className="nav-icon-img" />
          <span className="nav-label">Main</span>
        </button>

        <button
          className={`nav-item ${currentScreen === 'upgrades' ? 'active' : ''}`}
          onClick={() => handleNavClick('upgrades')}
        >
          <img src={`${import.meta.env.BASE_URL}icons/money-bag.png`} alt="Upgrades" className="nav-icon-img" />
          <span className="nav-label">Upgrades</span>
        </button>

        <button
          className={`nav-item ${currentScreen === 'leaderboard' ? 'active' : ''}`}
          onClick={() => handleNavClick('leaderboard')}
        >
          <img src={`${import.meta.env.BASE_URL}icons/trophy_3d.png`} alt="Leaderboard" className="nav-icon-img" />
          <span className="nav-label">Leaders</span>
        </button>

        <button
          className={`nav-item ${currentScreen === 'shop' ? 'active' : ''}`}
          onClick={() => handleNavClick('shop')}
        >
          <img src={`${import.meta.env.BASE_URL}icons/money-bag.png`} alt="Shop" className="nav-icon-img" />
          <span className="nav-label">Shop</span>
        </button>

        <button
          className={`nav-item ${currentScreen === 'skins' ? 'active' : ''}`}
          onClick={() => handleNavClick('skins')}
        >
          <img src={`${import.meta.env.BASE_URL}icons/artist_palette_3d.png`} alt="Skins" className="nav-icon-img" />
          <span className="nav-label">Skins</span>
        </button>

        <button
          className={`nav-item ${currentScreen === 'profile' ? 'active' : ''}`}
          onClick={() => handleNavClick('profile')}
        >
          <img src={`${import.meta.env.BASE_URL}icons/user.png`} alt="Profile" className="nav-icon-img" />
          <span className="nav-label">Profile</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
