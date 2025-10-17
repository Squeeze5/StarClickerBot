import { useEffect, useState } from 'react';
import { db } from '../db';
import { id } from '@instantdb/react';
import { UPGRADES, getUpgradeCost } from '../config/upgrades';
import './UpgradesScreen.css';

interface UpgradesScreenProps {
  userId: string;
}

const UpgradesScreen = ({ userId }: UpgradesScreenProps) => {
  const [balance, setBalance] = useState(0);
  const [clickPower, setClickPower] = useState(0);
  const [multiplierLevel, setMultiplierLevel] = useState(0);
  const [autoClickerLevel, setAutoClickerLevel] = useState(0);
  const [purchasing, setPurchasing] = useState<string | null>(null);

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
      setBalance(user.balance || 0);
      setClickPower(user.clickPower || 0);
      setMultiplierLevel(user.multiplierLevel || 0);
      setAutoClickerLevel(user.autoClickerLevel || 0);
    }
  }, [data]);

  const getLevelForUpgrade = (upgradeId: string): number => {
    switch (upgradeId) {
      case 'clickPower': return clickPower;
      case 'multiplier': return multiplierLevel;
      case 'autoClicker': return autoClickerLevel;
      default: return 0;
    }
  };

  const handlePurchase = async (upgradeId: string) => {
    const currentLevel = getLevelForUpgrade(upgradeId);
    const upgrade = UPGRADES[upgradeId];
    const cost = getUpgradeCost(upgradeId, currentLevel);

    if (balance < cost) {
      // Not enough balance
      const tg = window.Telegram?.WebApp;
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('error');
      }
      return;
    }

    if (currentLevel >= upgrade.maxLevel) {
      // Max level reached
      return;
    }

    setPurchasing(upgradeId);

    try {
      const newBalance = balance - cost;
      const newLevel = currentLevel + 1;

      // Prepare update object
      const updates: any = {
        balance: newBalance
      };

      // Update the specific upgrade level
      switch (upgradeId) {
        case 'clickPower':
          updates.clickPower = newLevel;
          break;
        case 'multiplier':
          updates.multiplierLevel = newLevel;
          break;
        case 'autoClicker':
          updates.autoClickerLevel = newLevel;
          break;
      }

      const activityId = id();

      await db.transact([
        db.tx.users[userId].update(updates),
        // Log activity - will be added when schema is pushed
        // @ts-ignore - activities entity will exist after schema update
        db.tx.activities[activityId].update({
          userId: userId,
          type: 'upgrade',
          description: `Upgraded ${upgrade.name} to Level ${newLevel}`,
          amount: -cost,
          timestamp: Date.now(),
          metadata: { upgradeId: upgradeId, upgradeName: upgrade.name, newLevel: newLevel }
        })
      ]);

      // Haptic success feedback
      const tg = window.Telegram?.WebApp;
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('success');
      }

    } catch (error) {
      console.error('Error purchasing upgrade:', error);

      // Haptic error feedback
      const tg = window.Telegram?.WebApp;
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('error');
      }
    } finally {
      setPurchasing(null);
    }
  };

  const renderUpgradeCard = (upgradeId: string) => {
    const upgrade = UPGRADES[upgradeId];
    const currentLevel = getLevelForUpgrade(upgradeId);
    const cost = getUpgradeCost(upgradeId, currentLevel);
    const canAfford = balance >= cost;
    const isMaxLevel = currentLevel >= upgrade.maxLevel;

    return (
      <div key={upgradeId} className={`upgrade-card ${!canAfford && !isMaxLevel ? 'locked' : ''}`}>
        <div className="upgrade-header">
          <div className="upgrade-icon">
            <img
              src={upgrade.icon}
              alt={upgrade.name}
              onError={(e) => {
                // Fallback to emoji
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <div className="upgrade-info">
            <h3 className="upgrade-name">{upgrade.name}</h3>
            <p className="upgrade-description">{upgrade.description}</p>
          </div>
        </div>

        <div className="upgrade-stats">
          <div className="upgrade-level">
            <span className="level-label">Level</span>
            <span className="level-value">{currentLevel}/{upgrade.maxLevel}</span>
          </div>
          <div className="upgrade-effect">
            <span className="effect-label">Effect</span>
            <span className="effect-value">
              {currentLevel === 0 ? upgrade.effectDescription(1) : upgrade.effectDescription(currentLevel)}
            </span>
          </div>
        </div>

        <div className="upgrade-footer">
          {isMaxLevel ? (
            <button className="upgrade-button max-level" disabled>
              MAX LEVEL
            </button>
          ) : (
            <button
              className={`upgrade-button ${canAfford ? 'can-afford' : 'locked'}`}
              onClick={() => handlePurchase(upgradeId)}
              disabled={!canAfford || purchasing === upgradeId}
            >
              {purchasing === upgradeId ? 'Purchasing...' : (
                <>
                  <img src={`${import.meta.env.BASE_URL}icons/star.png`} alt="Star" className="button-icon" />
                  {cost.toLocaleString()}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="upgrades-screen">
      <div className="upgrades-header">
        <h2 className="upgrades-title">Upgrades</h2>
        <div className="balance-display">
          <img src={`${import.meta.env.BASE_URL}icons/star.png`} alt="Balance" className="balance-icon" />
          <span className="balance-amount">{Math.floor(balance).toLocaleString()}</span>
        </div>
      </div>

      <div className="upgrades-list">
        {Object.keys(UPGRADES).map(upgradeId => renderUpgradeCard(upgradeId))}
      </div>

      <div className="upgrades-tip">
        <p>💡 Tip: Upgrades increase your earning potential!</p>
      </div>
    </div>
  );
};

export default UpgradesScreen;
