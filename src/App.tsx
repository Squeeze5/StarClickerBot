import { useState, useEffect } from 'react';
import { db } from './db';
import MainScreen from './screens/MainScreen';
import ProfileScreen from './screens/ProfileScreen';
import EarnScreen from './screens/EarnScreen';
import BottomNav from './components/BottomNav';
import './App.css';

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

  useEffect(() => {
    // Initialize Telegram WebApp
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();

      const user = tg.initDataUnsafe?.user;
      if (user) {
        setTelegramUser(user);
        initializeUser(user);
      }
    }
  }, []);

  const initializeUser = async (tgUser: any) => {
    const telegramId = tgUser.id;

    // Query existing user
    const { data } = db.useQuery({
      users: {
        $: {
          where: { telegramId }
        }
      }
    });

    if (data?.users && data.users.length > 0) {
      setUserId(data.users[0].id);
    } else {
      // Create new user
      const newUserId = `user_${telegramId}`;
      const referralCode = generateReferralCode();

      await db.transact([
        db.tx.users[newUserId].update({
          telegramId,
          username: tgUser.username || '',
          firstName: tgUser.first_name || '',
          lastName: tgUser.last_name || '',
          photoUrl: tgUser.photo_url || '',
          balance: 0,
          totalClicks: 0,
          referralCode,
          createdAt: Date.now()
        })
      ]);

      setUserId(newUserId);
    }
  };

  const generateReferralCode = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  };

  const renderScreen = () => {
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
