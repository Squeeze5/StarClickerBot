import './BottomNav.css';

interface BottomNavProps {
  currentScreen: 'main' | 'profile' | 'earn';
  onScreenChange: (screen: 'main' | 'profile' | 'earn') => void;
}

const BottomNav = ({ currentScreen, onScreenChange }: BottomNavProps) => {
  const handleNavClick = (screen: 'main' | 'profile' | 'earn') => {
    // Trigger Telegram vibration
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.HapticFeedback.selectionChanged();
    }
    onScreenChange(screen);
  };

  return (
    <nav className="bottom-nav">
      <button
        className={`nav-item ${currentScreen === 'main' ? 'active' : ''}`}
        onClick={() => handleNavClick('main')}
      >
        <span className="nav-icon">⭐</span>
        <span className="nav-label">Main</span>
      </button>

      <button
        className={`nav-item ${currentScreen === 'profile' ? 'active' : ''}`}
        onClick={() => handleNavClick('profile')}
      >
        <span className="nav-icon">👤</span>
        <span className="nav-label">Profile</span>
      </button>

      <button
        className={`nav-item ${currentScreen === 'earn' ? 'active' : ''}`}
        onClick={() => handleNavClick('earn')}
      >
        <span className="nav-icon">💰</span>
        <span className="nav-label">Earn</span>
      </button>
    </nav>
  );
};

export default BottomNav;
