import React, { useMemo, useState } from 'react';
import type { Listing, User } from '../../types';
import './CreatePage.css';

interface CreatePageProps {
  currentUser?: User;
  onCreate: (listing: Listing) => void;
}

const AVAILABLE_FEATURES = ['Полный доступ', 'Без VPN', 'Новый', 'Автовыдача'];

const CreatePage: React.FC<CreatePageProps> = ({ currentUser, onCreate }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [currency, setCurrency] = useState<'TON' | 'USDT'>('TON');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState('');

  const canSubmit = useMemo(() => {
    return title.trim().length > 0 && price !== '' && Number(price) >= 0;
  }, [title, price]);

  const toggleFeature = (feature: string) => {
    setSelectedFeatures(prev => (
      prev.includes(feature) ? prev.filter(f => f !== feature) : [...prev, feature]
    ));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const listing: Listing = {
      id: Math.random().toString(36).slice(2, 10),
      title: title.trim(),
      description: description.trim(),
      price: Number(price),
      currency,
      features: selectedFeatures,
      seller: currentUser || {
        id: 'me',
        username: 'me',
        avatar: imageUrl || '',
        rating: 0,
        reviews: 0,
        tenure: '—'
      }
    };

    onCreate(listing);
  };

  return (
    <div className="create-page">
      <form className="create-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="label">Заголовок</label>
          <input
            className="input"
            placeholder="Название объявления"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="label">Описание</label>
          <textarea
            className="textarea"
            placeholder="Краткое описание"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="label">Фильтры</label>
          <div className="filters">
            {AVAILABLE_FEATURES.map((feature) => (
              <button
                type="button"
                key={feature}
                className={`filter-chip ${selectedFeatures.includes(feature) ? 'active' : ''}`}
                onClick={() => toggleFeature(feature)}
              >
                {feature}
              </button>
            ))}
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="label">Цена</label>
            <input
              className="input"
              placeholder="0.00"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>

          <div className="form-group">
            <label className="label">Валюта</label>
            <div className="currency-toggle">
              <button
                type="button"
                className={`currency-btn ${currency === 'TON' ? 'active' : ''}`}
                onClick={() => setCurrency('TON')}
              >
                TON
              </button>
              <button
                type="button"
                className={`currency-btn ${currency === 'USDT' ? 'active' : ''}`}
                onClick={() => setCurrency('USDT')}
              >
                USDT
              </button>
            </div>
          </div>
        </div>

        <div className="actions">
          <button className="submit-btn" type="submit" disabled={!canSubmit}>Создать</button>
        </div>
      </form>
    </div>
  );
};

export default CreatePage;


