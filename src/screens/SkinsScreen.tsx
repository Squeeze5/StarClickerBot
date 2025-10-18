import { useEffect, useState } from 'react';
import { db } from '../db';
import { id } from '@instantdb/react';
import { SKINS, getSkin, userOwnsSkin, getSkinCategories } from '../config/skins';
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
      setBalance(Number(user.balance) || 0);
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

      window.Telegram?.WebApp?.HapticFeedback?.selectionChanged();
    } catch (error) {
      console.error('Error equipping skin:', error);
    }
  };

  const handlePurchase = async (skinId: string) => {
    const skin = getSkin(skinId);

    if (balance < skin.cost) {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error');
      return;
    }

    if (userOwnsSkin(ownedSkins, skinId)) return;

    setPurchasing(skinId);

    try {
      const newBalance = balance - skin.cost;
      const newOwnedSkins = [...ownedSkins, skinId];
      const activityId = id();

      await db.transact([
        db.tx.users[userId].update({
          balance: newBalance,
          ownedSkins: newOwnedSkins,
          currentSkin: skinId
        }),
        // @ts-ignore - activities entity exists in schema
        db.tx.activities[activityId].update({
          userId: userId,
          type: 'skin',
          description: `Purchased ${skin.name}`,
          amount: -skin.cost,
          timestamp: Date.now(),
          metadata: { skinId: skinId, skinName: skin.name }
        })
      ]);

      setBalance(newBalance);
      setOwnedSkins(newOwnedSkins);
      setCurrentSkin(skinId);

      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    } catch (error) {
      console.error('Error purchasing skin:', error);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error');
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
                const nextEl = e.currentTarget.nextElementSibling as HTMLElement;
                if (nextEl) nextEl.style.display = 'block';
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
                  <img src={`${import.meta.env.BASE_URL}icons/star.png`} alt="Star" className="button-icon" />
                  {skin.cost.toLocaleString()}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  const categories = getSkinCategories();

  return (
    <div className="skins-screen">
      <div className="skins-header">
        <h2 className="skins-title">Skins</h2>
        <div className="balance-display">
          <img src={`${import.meta.env.BASE_URL}icons/star.png`} alt="Balance" className="balance-icon" />
          <span className="balance-amount">{Math.floor(Number(balance) || 0).toLocaleString()}</span>
        </div>
      </div>

      {/* Default Skin - Always shown first */}
      <div className="skin-category">
        <h3 className="category-title">Default Skin</h3>
        <div className="skins-grid">
          {renderSkinCard(SKINS.default)}
        </div>
      </div>

      {/* Categorized Skins */}
      {categories.map(category => {
        if (category.skins.length === 0) return null;

        return (
          <div key={category.name} className="skin-category">
            <h3 className="category-title">{category.displayName}</h3>
            <div className="skins-grid">
              {category.skins.map(skin => renderSkinCard(skin))}
            </div>
          </div>
        );
      })}

      <div className="skins-tip">
        <p>🎨 Customize your clicker with unique skins!</p>
      </div>
    </div>
  );
};

export default SkinsScreen;
