import { useEffect, useState } from 'react';
import { db } from '../db';
import { SKINS, getSkin, userOwnsSkin, getPurchasableSkins } from '../config/skins';
import './SkinsScreen.css';

interface SkinsScreenProps {
  userId: string;
}

const SkinsScreen = ({ userId }: SkinsScreenProps) => {
  const [balance, setBalance] = useState(0);
  const [currentSkin, setCurrentSkin] = useState('default');
  const [ownedSkins, setOwnedSkins] = useState<string[]>(['default']);
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
      setCurrentSkin(user.currentSkin || 'default');
      setOwnedSkins(user.ownedSkins || ['default']);
    }
  }, [data]);

  const handleEquip = async (skinId: string) => {
    if (!userOwnsSkin(ownedSkins, skinId)) return;

    try {
      await db.transact([
        db.tx.users[userId].update({
          currentSkin: skinId
        })
      ]);

      // Haptic feedback
      const tg = window.Telegram?.WebApp;
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.selectionChanged();
      }

    } catch (error) {
      console.error('Error equipping skin:', error);
    }
  };

  const handlePurchase = async (skinId: string) => {
    const skin = getSkin(skinId);

    if (balance < skin.cost) {
      // Not enough balance
      const tg = window.Telegram?.WebApp;
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('error');
      }
      return;
    }

    if (userOwnsSkin(ownedSkins, skinId)) {
      // Already owned
      return;
    }

    setPurchasing(skinId);

    try {
      const newBalance = balance - skin.cost;
      const newOwnedSkins = [...ownedSkins, skinId];

      await db.transact([
        db.tx.users[userId].update({
          balance: newBalance,
          ownedSkins: newOwnedSkins,
          currentSkin: skinId // Auto-equip after purchase
        })
      ]);

      // Haptic success feedback
      const tg = window.Telegram?.WebApp;
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('success');
      }

    } catch (error) {
      console.error('Error purchasing skin:', error);

      // Haptic error feedback
      const tg = window.Telegram?.WebApp;
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('error');
      }
    } finally {
      setPurchasing(null);
    }
  };

  const renderSkinCard = (skin: any) => {
    const owned = userOwnsSkin(ownedSkins, skin.id);
    const equipped = currentSkin === skin.id;
    const canAfford = balance >= skin.cost;

    return (
      <div
        key={skin.id}
        className={`skin-card ${equipped ? 'equipped' : ''} ${!owned && !canAfford ? 'locked' : ''}`}
      >
        <div className="skin-preview">
          {skin.imageUrl ? (
            <img
              src={skin.imageUrl}
              alt={skin.name}
              className="skin-image"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling!.style.display = 'block';
              }}
            />
          ) : null}
          <span className="skin-emoji" style={{ display: skin.imageUrl ? 'none' : 'block' }}>
            {skin.emoji}
          </span>

          {equipped && (
            <div className="equipped-badge">✓ Equipped</div>
          )}
        </div>

        <div className="skin-info">
          <h3 className="skin-name">{skin.name}</h3>
          <p className="skin-description">{skin.description}</p>
        </div>

        <div className="skin-footer">
          {skin.isDefault ? (
            <button
              className="skin-button default"
              onClick={() => handleEquip(skin.id)}
              disabled={equipped}
            >
              {equipped ? 'Equipped' : 'Equip'}
            </button>
          ) : owned ? (
            <button
              className="skin-button owned"
              onClick={() => handleEquip(skin.id)}
              disabled={equipped}
            >
              {equipped ? 'Equipped' : 'Equip'}
            </button>
          ) : (
            <button
              className={`skin-button purchase ${canAfford ? 'can-afford' : 'locked'}`}
              onClick={() => handlePurchase(skin.id)}
              disabled={!canAfford || purchasing === skin.id}
            >
              {purchasing === skin.id ? 'Purchasing...' : (
                <>
                  <img src="/icons/star.png" alt="Star" className="button-icon" onError={(e) => e.currentTarget.style.display = 'none'} />
                  <span className="button-star">⭐</span>
                  {skin.cost.toLocaleString()}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="skins-screen">
      <div className="skins-header">
        <h2 className="skins-title">Skins</h2>
        <div className="balance-display">
          <img src="/icons/star.png" alt="Balance" className="balance-icon" onError={(e) => e.currentTarget.style.display = 'none'} />
          <span className="balance-emoji">⭐</span>
          <span className="balance-amount">{Math.floor(balance).toLocaleString()}</span>
        </div>
      </div>

      <div className="skins-grid">
        {/* Show default skin first */}
        {renderSkinCard(SKINS.default)}

        {/* Show all other skins */}
        {getPurchasableSkins().map(skin => renderSkinCard(skin))}
      </div>

      <div className="skins-tip">
        <p>🎨 Customize your clicker with unique skins!</p>
      </div>
    </div>
  );
};

export default SkinsScreen;
