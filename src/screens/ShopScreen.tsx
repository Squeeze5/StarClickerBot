import { useEffect, useState } from 'react';
import { db } from '../db';
import './ShopScreen.css';

interface ShopScreenProps {
  userId: string;
}

const ShopScreen = ({ userId }: ShopScreenProps) => {
  const [hasVip, setHasVip] = useState(false);
  const [vipExpiryDate, setVipExpiryDate] = useState<number | null>(null);
  const [daysRemaining, setDaysRemaining] = useState(0);

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
      // @ts-ignore - VIP fields are optional in schema
      setHasVip(user.hasVip || false);
      // @ts-ignore - VIP fields are optional in schema
      setVipExpiryDate(user.vipExpiryDate || null);

      // Calculate days remaining
      // @ts-ignore - VIP fields are optional in schema
      if (user.vipExpiryDate) {
        const now = Date.now();
        // @ts-ignore - VIP fields are optional in schema
        const daysLeft = Math.max(0, Math.ceil((Number(user.vipExpiryDate) - now) / (1000 * 60 * 60 * 24)));
        setDaysRemaining(daysLeft);
      }
    }
  }, [data]);

  const handlePurchaseVIP = () => {
    // Open chat with bot to purchase VIP using Telegram Stars payment
    const tg = window.Telegram?.WebApp;

    if (!tg) {
      alert('Telegram WebApp not available');
      return;
    }

    // Trigger haptic feedback
    if (tg.HapticFeedback) {
      tg.HapticFeedback.notificationOccurred('success');
    }

    // Show instructions to user
    alert(
      '🌟 VIP Purchase Instructions:\n\n' +
      '1. You will be redirected to the bot chat\n' +
      '2. Send /vip command to the bot\n' +
      '3. Complete the payment with Telegram Stars\n' +
      '4. Your VIP will be activated automatically!\n\n' +
      'Price: 10 ⭐ for 30 days'
    );

    // Open chat with bot
    const botUsername = 'thestarclickerbot';
    tg.openTelegramLink(`https://t.me/${botUsername}`);
  };

  const formatExpiryDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="shop-screen">
      <div className="shop-header">
        <h2 className="shop-title">Shop</h2>
        <p className="shop-subtitle">Unlock exclusive benefits</p>
      </div>

      <div className="vip-card">
        <div className="vip-header">
          <div className="vip-badge">VIP</div>
          <div className="vip-price">10 ⭐</div>
        </div>

        <h3 className="vip-title">Premium Membership</h3>
        <p className="vip-description">
          Get 30 days of exclusive VIP benefits
        </p>

        <div className="vip-benefits">
          <div className="benefit-item">
            <span className="benefit-icon">✨</span>
            <span className="benefit-text">VIP badge in leaderboard</span>
          </div>
          <div className="benefit-item">
            <span className="benefit-icon">🎨</span>
            <span className="benefit-text">Access to exclusive skins</span>
          </div>
          <div className="benefit-item">
            <span className="benefit-icon">⚡</span>
            <span className="benefit-text">2x click multiplier bonus</span>
          </div>
          <div className="benefit-item">
            <span className="benefit-icon">🏆</span>
            <span className="benefit-text">Priority support</span>
          </div>
        </div>

        {hasVip ? (
          <div className="vip-active">
            <div className="vip-status-badge">
              <span className="status-icon">✓</span>
              VIP Active
            </div>
            <p className="vip-expiry">
              {daysRemaining > 0 ? (
                <>
                  <strong>{daysRemaining}</strong> days remaining
                  <br />
                  <span className="expiry-date">
                    Expires: {vipExpiryDate && formatExpiryDate(vipExpiryDate)}
                  </span>
                </>
              ) : (
                <>Your VIP has expired. Renew now!</>
              )}
            </p>
            {daysRemaining === 0 && (
              <button
                className="vip-button renew"
                onClick={handlePurchaseVIP}
              >
                Renew VIP
              </button>
            )}
          </div>
        ) : (
          <button
            className="vip-button purchase"
            onClick={handlePurchaseVIP}
          >
            Purchase VIP
          </button>
        )}
      </div>

      <div className="shop-note">
        <p>
          <strong>Note:</strong> VIP subscription will automatically expire after 30 days.
          You can renew anytime to continue enjoying the benefits!
        </p>
      </div>
    </div>
  );
};

export default ShopScreen;
