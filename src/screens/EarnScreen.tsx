import { useEffect, useState } from 'react';
import { db } from '../db';
import './EarnScreen.css';

interface EarnScreenProps {
  userId: string;
}

const EarnScreen = ({ userId }: EarnScreenProps) => {
  const [referralCode, setReferralCode] = useState('');
  const [referralLink, setReferralLink] = useState('');
  const [referrals, setReferrals] = useState<any[]>([]);
  const [totalEarned, setTotalEarned] = useState(0);
  const [copied, setCopied] = useState(false);

  // Query user data and referrals
  const { data } = db.useQuery({
    users: {
      $: {
        where: { id: userId }
      }
    },
    referrals: {
      $: {
        where: { referrerId: userId }
      }
    }
  });

  useEffect(() => {
    if (data?.users && data.users.length > 0) {
      const user = data.users[0];
      setReferralCode(user.referralCode || '');

      // Generate referral link with bot username
      const botUsername = 'thestarclickerbot';
      const link = `https://t.me/${botUsername}?start=${user.referralCode}`;
      setReferralLink(link);
    }

    if (data?.referrals) {
      setReferrals(data.referrals);
      const earned = data.referrals.reduce((sum, ref) => sum + (ref.reward || 0), 0);
      setTotalEarned(earned);
    }
  }, [data]);

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);

    // Trigger Telegram vibration
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.HapticFeedback.notificationOccurred('success');
    }

    setTimeout(() => setCopied(false), 2000);
  };

  const shareReferralLink = () => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      const message = `🌟 Join me in Stars Clicker! Use my referral link to get bonus stars: ${referralLink}`;
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(message)}`);
    }
  };

  return (
    <div className="earn-screen">
      <div className="earn-header">
        <h2 className="earn-title">Earn More Stars</h2>
        <p className="earn-subtitle">Invite friends and earn rewards!</p>
      </div>

      <div className="earnings-card">
        <div className="earnings-stat">
          <div className="earnings-value">{totalEarned.toLocaleString()}</div>
          <div className="earnings-label">Stars Earned</div>
        </div>
        <div className="earnings-stat">
          <div className="earnings-value">{referrals.length}</div>
          <div className="earnings-label">Referrals</div>
        </div>
      </div>

      <div className="referral-section">
        <h3 className="section-title">Your Referral Code</h3>
        <div className="referral-code-container">
          <div className="referral-code">{referralCode}</div>
        </div>

        <div className="referral-link-container">
          <input
            type="text"
            className="referral-link-input"
            value={referralLink}
            readOnly
          />
          <button className="copy-button" onClick={copyReferralLink}>
            {copied ? '✓ Copied!' : 'Copy'}
          </button>
        </div>

        <button className="share-button" onClick={shareReferralLink}>
          Share Link
        </button>
      </div>

      <div className="rewards-section">
        <h3 className="section-title">How It Works</h3>
        <div className="reward-item">
          <span className="reward-icon">👥</span>
          <div className="reward-text">
            <div className="reward-title">Invite Friends</div>
            <div className="reward-description">
              Share your referral link with friends
            </div>
          </div>
        </div>
        <div className="reward-item">
          <span className="reward-icon">⭐</span>
          <div className="reward-text">
            <div className="reward-title">Earn Rewards</div>
            <div className="reward-description">
              Get 100 stars for each friend who joins
            </div>
          </div>
        </div>
        <div className="reward-item">
          <span className="reward-icon">🎁</span>
          <div className="reward-text">
            <div className="reward-title">Bonus Stars</div>
            <div className="reward-description">
              Your friend gets 50 bonus stars too!
            </div>
          </div>
        </div>
      </div>

      {referrals.length > 0 && (
        <div className="referrals-list">
          <h3 className="section-title">Your Referrals</h3>
          {referrals.map((referral, index) => (
            <div key={referral.id || index} className="referral-item">
              <span className="referral-icon">👤</span>
              <span className="referral-info">
                Referral {index + 1}
              </span>
              <span className="referral-reward">+{referral.reward} ⭐</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EarnScreen;
