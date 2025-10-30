import React from 'react';
import type { Listing } from '../types';
import ListingCard from '../components/ListingCard/ListingCard';
import './HomePage.css';

interface HomePageProps {
  listings: Listing[];
  onPurchase: (listingId: string) => void;
}

const HomePage: React.FC<HomePageProps> = ({ listings, onPurchase }) => {
  return (
    <div className="home-page">
      <div className="listings-container">
        {listings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            onPurchase={onPurchase}
          />
        ))}
      </div>
    </div>
  );
};

export default HomePage;
