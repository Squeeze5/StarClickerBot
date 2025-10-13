import { useState, useEffect } from 'react';
import { db } from './db';
import MainScreen from './screens/MainScreen';
import ProfileScreen from './screens/ProfileScreen';
import EarnScreen from './screens/EarnScreen';
import BottomNav from './components/BottomNav';
import './App.css';
import { id } from '@instantdb/react';

// Declare Telegram WebApp type
declare global {
  interface Window {
    Telegram?: {
      WebApp: any;
    };
  }
}

type Screen = 'main' | 'profile' | 'earn';

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('main');
  const [userId, setUserId] = useState<string>('');
  const [telegramUser, setTelegramUser] = useState<any>(null);
  const [telegramId, setTelegramId] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState(false);

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

  useEffect(() => {
    // Initialize Telegram WebApp
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      tg.setHeaderColor('#000000');
      tg.setBackgroundColor('#000000');

      const user = tg.initDataUnsafe?.user;
      if (user) {
        console.log('Telegram user:', user);
        setTelegramUser(user);
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

      await db.transact([
        db.tx.users[newUserId].update({
          telegramId: Number(tgUser.id),
          username: tgUser.username || '',
          firstName: tgUser.first_name || '',
          lastName: tgUser.last_name || '',
          photoUrl: tgUser.photo_url || '',
          balance: 0,
          totalClicks: 0,
          referralCode: referralCode,
          referredBy: '',
          createdAt: Date.now()
        })
      ]);

      console.log('New user created:', newUserId);
      setUserId(newUserId);
      setIsInitialized(true);
    } catch (error) {
      console.error('Error creating user:', error);
      const tempId = `temp_${Date.now()}`;
      setUserId(tempId);
      setIsInitialized(true);
    }
  };

  const generateReferralCode = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
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
      case 'earn':
        return <EarnScreen userId={userId} />;
      default:
        return <MainScreen userId={userId} />;
    }
  };

  return (
    <div className="app">
      <div className="screen-container">
        {renderScreen()}
      </div>
      <BottomNav currentScreen={currentScreen} onScreenChange={setCurrentScreen} />
    </div>
  );
}

export default App;
