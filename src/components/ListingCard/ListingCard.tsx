import React from 'react';
import type { Listing } from '../../types';
import './ListingCard.css';
import tonSymbol2 from '../../assets/icons/ton_symbol_2.svg';

interface ListingCardProps {
  listing: Listing;
  onPurchase: (listingId: string) => void;
}

const ListingCard: React.FC<ListingCardProps> = ({ listing, onPurchase }) => {
  return (
    <div className="listing-card">
      <div className="listing-content">
        <h3 className="listing-title">{listing.title}</h3>
        {listing.description && (
          <p className="listing-description">{listing.description}</p>
        )}
        
        {listing.features && listing.features.length > 0 && (
          <div className="listing-features">
            {listing.features.map((feature, index) => (
              <span key={index} className="feature-tag">
                {feature}
              </span>
            ))}
          </div>
        )}
        
        <div className="seller-info">
          <img 
            src={listing.seller.avatar} 
            alt={listing.seller.username}
            className="seller-avatar"
          />
          <div className="seller-details">
            <span className="seller-username">{listing.seller.username}</span>
            <div className="seller-rating">
              <span className="rating-stars">⭐</span>
              <span className="rating-text">
                {listing.seller.rating} | {listing.seller.tenure}
              </span>
            </div>
          </div>
        </div>
        
        <button 
          className="purchase-button"
          onClick={() => onPurchase(listing.id)}
        >
          <span className="price">{listing.price}</span>
          <img src={tonSymbol2} alt="TON" className="currency-img" />
        </button>
      </div>
    </div>
  );
};

export default ListingCard;
