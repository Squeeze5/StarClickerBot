import { useEffect, useState } from 'react';
import { db } from '../db';
import './ProfileScreen.css';

interface ProfileScreenProps {
  userId: string;
  telegramUser: any;
}

const ProfileScreen = ({ userId, telegramUser }: ProfileScreenProps) => {
  const [userData, setUserData] = useState<any>(null);
  const [clickHistory, setClickHistory] = useState<any[]>([]);

  // Query user data and clicks
  const { data } = db.useQuery({
    users: {
      $: {
        where: { id: userId }
      }
    },
    clicks: {
      $: {
        where: { userId },
        limit: 10,
        order: {
          serverCreatedAt: 'desc'
        }
      }
    }
  });

  useEffect(() => {
    if (data?.users && data.users.length > 0) {
      setUserData(data.users[0]);
    }
    if (data?.clicks) {
      setClickHistory(data.clicks);
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
          <div className="stat-value">{userData.balance?.toLocaleString() || 0}</div>
          <div className="stat-label">Total Stars</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{userData.totalClicks?.toLocaleString() || 0}</div>
          <div className="stat-label">Total Clicks</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {userData.createdAt ? formatDate(userData.createdAt) : 'N/A'}
          </div>
          <div className="stat-label">Member Since</div>
        </div>
      </div>

      <div className="info-section">
        <h3 className="section-title">Recent Activity</h3>
        {clickHistory.length > 0 ? (
          <div className="activity-list">
            {clickHistory.map((click, index) => (
              <div key={click.id || index} className="activity-item">
                <span className="activity-icon">⭐</span>
                <span className="activity-text">+{click.amount} Stars</span>
                <span className="activity-time">
                  {formatDate(click.timestamp)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="no-activity">No activity yet. Start clicking!</p>
        )}
      </div>
    </div>
  );
};

export default ProfileScreen;
