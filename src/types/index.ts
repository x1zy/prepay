export interface User {
  id: string;
  username: string;
  avatar: string;
  rating: number;
  reviews: number;
  tenure: string; // e.g., "3 года", "11 мес."
}

export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  seller: User;
  region?: string;
  features?: string[];
  isNew?: boolean;
  isAutoIssue?: boolean;
}

export interface Balance {
  amount: number;
  currency: string;
  symbol: string; // e.g., "💎" for diamond
}

export interface NavigationItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  isActive?: boolean;
}

export interface AppState {
  balance: Balance;
  listings: Listing[];
  currentUser?: User;
  activeTab: string;
}
