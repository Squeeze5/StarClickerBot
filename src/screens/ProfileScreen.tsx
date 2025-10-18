import { useEffect, useState } from 'react';
import { db } from '../db';
import './ProfileScreen.css';

interface ProfileScreenProps {
  userId: string;
  telegramUser: any;
}

const ProfileScreen = ({ userId, telegramUser }: ProfileScreenProps) => {
  const [userData, setUserData] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [referralCode, setReferralCode] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [isEditingCode, setIsEditingCode] = useState(false);
  const [referralLink, setReferralLink] = useState('');
  const [referrals, setReferrals] = useState<any[]>([]);
  const [totalEarned, setTotalEarned] = useState(0);
  const [copied, setCopied] = useState(false);

  // Query user data, activities, and referrals
  const { data } = db.useQuery({
    users: {
      $: {
        where: { id: userId }
      }
    },
    // @ts-ignore - activities entity will exist after schema update
    activities: {
      $: {
        where: { userId },
        limit: 15,
        order: {
          serverCreatedAt: 'desc'
        }
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
      setUserData(user);
      setReferralCode(user.referralCode || '');

      // Generate referral link with bot username
      const botUsername = 'thestarclickerbot';
      const link = `https://t.me/${botUsername}?start=${user.referralCode}`;
      setReferralLink(link);
    }
    // @ts-ignore - activities will exist after schema update
    if (data?.activities) {
      // @ts-ignore
      setActivities(data.activities);
    }
    if (data?.referrals) {
      setReferrals(data.referrals);
      const earned = data.referrals.reduce((sum: number, ref: any) => sum + (ref.reward || 0), 0);
      setTotalEarned(earned);
    }
  }, [data]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

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

  const handleUpdateCode = async () => {
    if (!customCode.trim() || customCode.trim().length < 4) {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error');
      alert('Referral code must be at least 4 characters long');
      return;
    }

    // Check if code contains only alphanumeric characters
    if (!/^[A-Za-z0-9]+$/.test(customCode.trim())) {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error');
      alert('Referral code can only contain letters and numbers');
      return;
    }

    try {
      const newCode = customCode.trim().toUpperCase();

      await db.transact([
        db.tx.users[userId].update({
          referralCode: newCode
        })
      ]);

      setReferralCode(newCode);
      setIsEditingCode(false);
      setCustomCode('');
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    } catch (error) {
      console.error('Error updating referral code:', error);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error');
      alert('Failed to update referral code. It might already be taken.');
    }
  };

  if (!userData) {
    return (
      <div className="profile-screen">
        <div className="loading">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="profile-screen">
      <div className="profile-header">
        <div className="avatar">
          {telegramUser?.photo_url ? (
            <img src={telegramUser.photo_url} alt="Avatar" />
          ) : (
            <div className="avatar-placeholder">
              {userData.firstName?.charAt(0) || '?'}
            </div>
          )}
        </div>
        <h2 className="username">
          {userData.firstName} {userData.lastName}
        </h2>
        {userData.username && (
          <p className="telegram-username">@{userData.username}</p>
        )}
        <p className="telegram-id">ID: {userData.telegramId}</p>
      </div>

      <div className="stats-container">
        <div className="stat-card">
          <div className="stat-value">{(Number(userData.balance) || 0).toLocaleString()}</div>
          <div className="stat-label">Total Stars</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{(Number(userData.totalClicks) || 0).toLocaleString()}</div>
          <div className="stat-label">Total Clicks</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {userData.createdAt ? formatDate(Number(userData.createdAt)) : 'N/A'}
          </div>
          <div className="stat-label">Member Since</div>
        </div>
      </div>

      {/* Referral Section */}
      <div className="referral-section">
        <h3 className="section-title">Invite Friends & Earn</h3>

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

        <div className="referral-code-section">
          <h4 className="subsection-title">Your Referral Code</h4>
          {!isEditingCode ? (
            <div className="referral-code-container">
              <div className="referral-code">{referralCode}</div>
              <button
                className="edit-code-button"
                onClick={() => {
                  setIsEditingCode(true);
                  setCustomCode(referralCode);
                }}
              >
                Edit
              </button>
            </div>
          ) : (
            <div className="edit-code-container">
              <input
                type="text"
                className="custom-code-input"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value)}
                placeholder="Enter custom code"
                maxLength={20}
              />
              <div className="edit-code-buttons">
                <button className="save-code-button" onClick={handleUpdateCode}>
                  Save
                </button>
                <button
                  className="cancel-code-button"
                  onClick={() => {
                    setIsEditingCode(false);
                    setCustomCode('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

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

        <div className="rewards-info">
          <h4 className="subsection-title">How It Works</h4>
          <div className="reward-item">
            <div className="reward-icon">
              <img src={`${import.meta.env.BASE_URL}icons/friends.png`} alt="Invite Friends" />
            </div>
            <div className="reward-text">
              <div className="reward-title">Invite Friends</div>
              <div className="reward-description">
                Share your referral link with friends
              </div>
            </div>
          </div>
          <div className="reward-item">
            <div className="reward-icon">
              <img src={`${import.meta.env.BASE_URL}icons/star.png`} alt="Earn Rewards" />
            </div>
            <div className="reward-text">
              <div className="reward-title">Earn Rewards</div>
              <div className="reward-description">
                Get 100 stars for each friend who joins
              </div>
            </div>
          </div>
          <div className="reward-item">
            <div className="reward-icon">
              <img src={`${import.meta.env.BASE_URL}icons/gift.png`} alt="Bonus Stars" />
            </div>
            <div className="reward-text">
              <div className="reward-title">Bonus Stars</div>
              <div className="reward-description">
                Your friend gets 50 bonus stars too!
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="info-section">
        <h3 className="section-title">Recent Activity</h3>
        {activities.length > 0 ? (
          <div className="activity-list">
            {activities.map((activity, index) => {
              // Determine icon based on activity type
              let iconSrc = `${import.meta.env.BASE_URL}icons/memo.png`;
              let amountColor = '';

              if (activity.type === 'upgrade') {
                iconSrc = `${import.meta.env.BASE_URL}icons/up_arrow_3d.png`;
                amountColor = 'expense';
              } else if (activity.type === 'skin') {
                iconSrc = `${import.meta.env.BASE_URL}icons/artist_palette_3d.png`;
                amountColor = 'expense';
              } else if (activity.type === 'referral') {
                iconSrc = `${import.meta.env.BASE_URL}icons/gift.png`;
                amountColor = 'income';
              }

              return (
                <div key={activity.id || index} className="activity-item">
                  <div className="activity-icon">
                    <img src={iconSrc} alt="" />
                  </div>
                  <div className="activity-details">
                    <span className="activity-text">{activity.description}</span>
                    {activity.amount && (
                      <span className={`activity-amount ${amountColor}`}>
                        {Number(activity.amount) > 0 ? '+' : ''}{(Number(activity.amount) || 0).toLocaleString()} ⭐
                      </span>
                    )}
                  </div>
                  <span className="activity-time">
                    {formatDate(Number(activity.timestamp) || Date.now())}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="no-activity">No activity yet. Start upgrading and collecting skins!</p>
        )}
      </div>
    </div>
  );
};

export default ProfileScreen;
