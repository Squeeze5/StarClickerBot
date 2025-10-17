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

  // Query user data and activities
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
    }
  });

  useEffect(() => {
    if (data?.users && data.users.length > 0) {
      setUserData(data.users[0]);
    }
    // @ts-ignore - activities will exist after schema update
    if (data?.activities) {
      // @ts-ignore
      setActivities(data.activities);
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
        {activities.length > 0 ? (
          <div className="activity-list">
            {activities.map((activity, index) => {
              // Determine icon based on activity type
              let icon = '📝';
              let amountColor = '';

              if (activity.type === 'upgrade') {
                icon = '⬆️';
                amountColor = 'expense';
              } else if (activity.type === 'skin') {
                icon = '🎨';
                amountColor = 'expense';
              } else if (activity.type === 'referral') {
                icon = '🎁';
                amountColor = 'income';
              }

              return (
                <div key={activity.id || index} className="activity-item">
                  <span className="activity-icon">{icon}</span>
                  <div className="activity-details">
                    <span className="activity-text">{activity.description}</span>
                    {activity.amount && (
                      <span className={`activity-amount ${amountColor}`}>
                        {activity.amount > 0 ? '+' : ''}{activity.amount.toLocaleString()} ⭐
                      </span>
                    )}
                  </div>
                  <span className="activity-time">
                    {formatDate(activity.timestamp)}
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
