import { useEffect, useState } from 'react';
import { db } from '../db';
import './LeaderboardScreen.css';

interface LeaderboardScreenProps {
  userId: string;
}

interface LeaderboardEntry {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  balance: number;
  totalClicks: number;
  photoUrl?: string;
}

const LeaderboardScreen = ({ userId }: LeaderboardScreenProps) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [currentUserRank, setCurrentUserRank] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'balance' | 'clicks'>('balance');

  // Query all users for leaderboard
  const { data } = db.useQuery({
    users: {}
  });

  useEffect(() => {
    if (data?.users) {
      // Sort users by selected criteria
      const sorted = [...data.users].sort((a, b) => {
        if (sortBy === 'balance') {
          return (b.balance || 0) - (a.balance || 0);
        } else {
          return (b.totalClicks || 0) - (a.totalClicks || 0);
        }
      });

      setLeaderboard(sorted);

      // Find current user's rank
      const rank = sorted.findIndex(user => user.id === userId);
      setCurrentUserRank(rank + 1); // +1 because index starts at 0
    }
  }, [data, userId, sortBy]);

  const getRankEmoji = (rank: number): string => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  return (
    <div className="leaderboard-screen">
      <div className="leaderboard-header">
        <h2 className="leaderboard-title">Leaderboard</h2>
        <div className="sort-buttons">
          <button
            className={`sort-button ${sortBy === 'balance' ? 'active' : ''}`}
            onClick={() => setSortBy('balance')}
          >
            <img src={`${import.meta.env.BASE_URL}icons/money-bag.png`} alt="Stars" className="sort-icon" onError={(e) => e.currentTarget.style.display = 'none'} />
            <span className="sort-emoji">⭐</span>
            Stars
          </button>
          <button
            className={`sort-button ${sortBy === 'clicks' ? 'active' : ''}`}
            onClick={() => setSortBy('clicks')}
          >
            👆 Clicks
          </button>
        </div>
      </div>

      {currentUserRank > 0 && (
        <div className="user-rank-card">
          <span className="your-rank-label">Your Rank:</span>
          <span className="your-rank-value">{getRankEmoji(currentUserRank)}</span>
        </div>
      )}

      <div className="leaderboard-list">
        {leaderboard.slice(0, 100).map((user, index) => {
          const rank = index + 1;
          const isCurrentUser = user.id === userId;

          return (
            <div
              key={user.id}
              className={`leaderboard-entry ${isCurrentUser ? 'current-user' : ''} ${rank <= 3 ? 'top-three' : ''}`}
            >
              <div className="entry-rank">
                {rank <= 3 ? (
                  <span className="rank-medal">{getRankEmoji(rank)}</span>
                ) : (
                  <span className="rank-number">#{rank}</span>
                )}
              </div>

              <div className="entry-user">
                {user.photoUrl ? (
                  <img
                    src={user.photoUrl}
                    alt={user.firstName}
                    className="user-avatar"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const nextEl = e.currentTarget.nextElementSibling as HTMLElement;
                      if (nextEl) nextEl.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div className="user-avatar-placeholder" style={{ display: user.photoUrl ? 'none' : 'flex' }}>
                  <img src={`${import.meta.env.BASE_URL}icons/user.png`} alt="User" onError={(e) => e.currentTarget.textContent = '👤'} />
                </div>
                <div className="user-info">
                  <div className="user-name">
                    {user.firstName} {user.lastName}
                    {isCurrentUser && <span className="you-badge">You</span>}
                  </div>
                  {user.username && (
                    <div className="user-username">@{user.username}</div>
                  )}
                </div>
              </div>

              <div className="entry-stats">
                {sortBy === 'balance' ? (
                  <>
                    <img src={`${import.meta.env.BASE_URL}icons/star.png`} alt="Stars" className="stat-icon" onError={(e) => e.currentTarget.style.display = 'none'} />
                    <span className="stat-emoji">⭐</span>
                    <span className="stat-value">{formatNumber(user.balance || 0)}</span>
                  </>
                ) : (
                  <>
                    <span className="stat-emoji">👆</span>
                    <span className="stat-value">{formatNumber(user.totalClicks || 0)}</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {leaderboard.length === 0 && (
        <div className="empty-leaderboard">
          <p>No players yet. Be the first!</p>
        </div>
      )}
    </div>
  );
};

export default LeaderboardScreen;
