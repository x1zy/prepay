import { useState, useCallback } from 'react';
import type { AppState, Listing, Balance } from '../types';

export const useAppState = (initialState: AppState) => {
  const [appState, setAppState] = useState<AppState>(initialState);

  const updateBalance = useCallback((newBalance: Balance) => {
    setAppState(prev => ({
      ...prev,
      balance: newBalance
    }));
  }, []);

  const adjustBalance = useCallback((type: 'add' | 'subtract', amount: number = 0.001) => {
    setAppState(prev => ({
      ...prev,
      balance: {
        ...prev.balance,
        amount: type === 'add' 
          ? prev.balance.amount + amount 
          : Math.max(0, prev.balance.amount - amount)
      }
    }));
  }, []);

  const updateListings = useCallback((newListings: Listing[]) => {
    setAppState(prev => ({
      ...prev,
      listings: newListings
    }));
  }, []);

  const setActiveTab = useCallback((tabId: string) => {
    setAppState(prev => ({
      ...prev,
      activeTab: tabId
    }));
  }, []);

  const addListing = useCallback((listing: Listing) => {
    setAppState(prev => ({
      ...prev,
      listings: [...prev.listings, listing]
    }));
  }, []);

  const removeListing = useCallback((listingId: string) => {
    setAppState(prev => ({
      ...prev,
      listings: prev.listings.filter(listing => listing.id !== listingId)
    }));
  }, []);

  return {
    appState,
    updateBalance,
    adjustBalance,
    updateListings,
    setActiveTab,
    addListing,
    removeListing
  };
};
