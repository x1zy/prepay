import React, { useMemo, useState } from 'react';
import type { Listing } from '../../types';
import ListingCard from '../../components/ListingCard/ListingCard';
import './SearchPage.css';

interface SearchPageProps {
  listings: Listing[];
  onPurchase: (listingId: string) => void;
}

const AVAILABLE_FEATURES = ['Полный доступ', 'Без VPN', 'Новый', 'Автовыдача'];

const SearchPage: React.FC<SearchPageProps> = ({ listings, onPurchase }) => {
  const [query, setQuery] = useState('');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);

  const toggleFeature = (feature: string) => {
    setSelectedFeatures(prev => (
      prev.includes(feature)
        ? prev.filter(f => f !== feature)
        : [...prev, feature]
    ));
  };

  const filtered = useMemo(() => {
    return listings.filter(item => {
      const byQuery = query.trim().length === 0
        || item.title.toLowerCase().includes(query.toLowerCase())
        || (item.description || '').toLowerCase().includes(query.toLowerCase());

      const byFeatures = selectedFeatures.length === 0
        || (item.features || []).some(f => selectedFeatures.includes(f));

      return byQuery && byFeatures;
    });
  }, [listings, query, selectedFeatures]);

  return (
    <div className="search-page">
      <div className="search-bar">
        <input
          className="search-input"
          placeholder="Поиск объявлений"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="filters">
        {AVAILABLE_FEATURES.map((feature) => (
          <button
            key={feature}
            className={`filter-chip ${selectedFeatures.includes(feature) ? 'active' : ''}`}
            onClick={() => toggleFeature(feature)}
          >
            {feature}
          </button>
        ))}
      </div>

      <div className="results">
        {filtered.map(listing => (
          <ListingCard key={listing.id} listing={listing} onPurchase={onPurchase} />)
        )}
        {filtered.length === 0 && (
          <div className="empty">Ничего не найдено</div>
        )}
      </div>
    </div>
  );
};

export default SearchPage;


