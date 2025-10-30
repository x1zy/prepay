import type { Listing, User, Balance, NavigationItem } from './types';
import TopBar from './components/TopBar/TopBar';
import BottomNavigation from './components/BottomNavigation/BottomNavigation';
import HomePage from './pages/HomePage';
import { useAppState } from './hooks/useAppState';
import animeImage from './assets/images/anime.jpg';
import dogImage from './assets/images/dog.jpg';
import eyeImage from './assets/images/eye.jpg';
import jabaImage from './assets/images/jaba.jpg';
import './App.css';
import { THEME, TonConnectUIProvider } from '@tonconnect/ui-react';

// Mock data
const mockListings: Listing[] = [
  {
    id: '1',
    title: 'Аккаунт Spotify с регионом Нигерия ✔ Без VPN',
    description: 'Полный доступ к Spotify Premium с регионом Нигерия',
    price: 0.43,
    currency: 'TON',
    seller: {
      id: '1',
      username: 'dadaenq',
      avatar: animeImage,
      rating: 35209,
      reviews: 35209,
      tenure: '3 года'
    },
    region: 'Нигерия',
    features: ['Без VPN', 'Полный доступ']
  },
  {
    id: '2',
    title: 'SPOTIFY • НОВЫЙ АККАУНТ • АВТОВЫДАЧА • Швеция',
    description: 'Новый аккаунт Spotify с автовыдачей',
    price: 0.72,
    currency: 'TON',
    seller: {
      id: '2',
      username: 'f1rsoff',
      avatar: jabaImage,
      rating: 610,
      reviews: 610,
      tenure: '11 мес.'
    },
    region: 'Швеция',
    features: ['Новый', 'Автовыдача'],
    isNew: true,
    isAutoIssue: true
  },
  {
    id: '3',
    title: 'SPOTIFY • НОВЫЙ АККАУНТ • АВТОВЫДАЧА • Канада',
    description: 'Новый аккаунт Spotify с автовыдачей',
    price: 0.81,
    currency: 'TON',
    seller: {
      id: '2',
      username: 'f1rsoff',
      avatar: eyeImage,
      rating: 610,
      reviews: 610,
      tenure: '11 мес.'
    },
    region: 'Канада',
    features: ['Новый', 'Автовыдача'],
    isNew: true,
    isAutoIssue: true
  }
];

const mockUser: User = {
  id: 'current-user',
  username: 'user123',
  avatar: dogImage,
  rating: 0,
  reviews: 0,
  tenure: '0 дней'
};

const mockBalance: Balance = {
  amount: 0.001,
  currency: 'TON',
  symbol: ''
};

const navigationItems: NavigationItem[] = [
  { id: 'home', label: 'Главная', icon: 'home', path: '/' },
  { id: 'search', label: 'Поиск', icon: 'search', path: '/search' },
  { id: 'create', label: 'Создать', icon: 'create', path: '/create' },
  { id: 'messages', label: 'Сообщения', icon: 'messages', path: '/messages' },
  { id: 'profile', label: 'Профиль', icon: 'profile', path: '/profile' }
];

function App() {
  const { appState, setActiveTab } = useAppState({
    balance: mockBalance,
    listings: mockListings,
    currentUser: mockUser,
    activeTab: 'home'
  });

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
  };

  const handlePurchase = (listingId: string) => {
    console.log('Purchasing listing:', listingId);
    // Here you would implement the purchase logic
  };

  const renderCurrentPage = () => {
    switch (appState.activeTab) {
      case 'home':
        return (
          <HomePage 
            listings={appState.listings}
            onPurchase={handlePurchase}
          />
        );
      default:
        return (
          <div className="coming-soon">
            
          </div>
        );
    }
  };

  return (
    <TonConnectUIProvider
    manifestUrl="https://prepay.ton.page/tonconnect-manifest.json"
    uiPreferences={ { theme: THEME.DARK }}
    actionsConfiguration={{
      twaReturnUrl: 'https://prepay.ton.page/return'
    }}
    >
      <div className="app">
        <TopBar
          balance={appState.balance}
          user={appState.currentUser}
        />
        
        <main className="main-content">
          {renderCurrentPage()}
        </main>
        
        <BottomNavigation
          items={navigationItems}
          activeTab={appState.activeTab}
          onTabChange={handleTabChange}
        />
      </div>
    </TonConnectUIProvider>
    
  );
}

export default App;
