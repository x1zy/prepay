import type { Listing, User, Balance, NavigationItem } from "./types";
import TopBar from "./components/TopBar/TopBar";
import BottomNavigation from "./components/BottomNavigation/BottomNavigation";
import HomePage from "./pages/HomePage/HomePage";
import SearchPage from "./pages/SearchPage/SearchPage";
import { useAppState } from "./hooks/useAppState";
import CreatePage from "./pages/CreatePage/CreatePage";
import MessagesPage from "./pages/MessagesPage/MessagesPage";
import type { ConversationPreview } from "./pages/MessagesPage/MessagesPage";
import animeImage from "./assets/images/anime.jpg";
import eyeImage from "./assets/images/eye.jpg";
import jabaImage from "./assets/images/jaba.jpg";
import "./App.css";
import OrdersPage from "./pages/OrdersPage/OrdersPage";
import { useEffect, useCallback, useMemo, useState } from "react";
import {
  THEME,
  TonConnectUIProvider,
  useTonWallet,
} from "@tonconnect/ui-react";
import { getBicycleClient } from "./services/bicycleApi";
import {
  getTelegramMiniAppUser,
  initTelegramMiniApp,
} from "./services/telegramMiniApp";

const mockListings: Listing[] = [
  {
    id: "1",
    title: "Аккаунт Spotify с регионом Нигерия ✔ Без VPN",
    description: "Полный доступ к Spotify Premium с регионом Нигерия",
    price: 0.43,
    currency: "TON",
    seller: {
      id: "1",
      username: "dadaenq",
      avatar: animeImage,
      rating: 35209,
      reviews: 35209,
      tenure: "3 года",
    },
    region: "Нигерия",
    features: ["Без VPN", "Полный доступ"],
  },
  {
    id: "2",
    title: "SPOTIFY • НОВЫЙ АККАУНТ • АВТОВЫДАЧА • Швеция",
    description: "Новый аккаунт Spotify с автовыдачей",
    price: 0.72,
    currency: "TON",
    seller: {
      id: "2",
      username: "f1rsoff",
      avatar: jabaImage,
      rating: 610,
      reviews: 610,
      tenure: "11 мес.",
    },
    region: "Швеция",
    features: ["Новый", "Автовыдача"],
    isNew: true,
    isAutoIssue: true,
  },
  {
    id: "3",
    title: "SPOTIFY • НОВЫЙ АККАУНТ • АВТОВЫДАЧА • Канада",
    description: "Новый аккаунт Spotify с автовыдачей",
    price: 0.81,
    currency: "TON",
    seller: {
      id: "2",
      username: "f1rsoff",
      avatar: eyeImage,
      rating: 610,
      reviews: 610,
      tenure: "11 мес.",
    },
    region: "Канада",
    features: ["Новый", "Автовыдача"],
    isNew: true,
    isAutoIssue: true,
  },
];

const mockUser: User = {
  id: "current-user",
  username: "user123",
  rating: 0,
  reviews: 0,
  tenure: "0 дней",
};

const mockBalance: Balance = {
  amount: 0,
  currency: "TON",
  symbol: "",
};

const DEPOSIT_HISTORY_PAGE_SIZE = 100;

const mockConversations: ConversationPreview[] = [
  {
    id: "c1",
    user: {
      id: "1",
      username: "dadaenq",
      avatar: animeImage,
      rating: 35209,
      reviews: 35209,
      tenure: "3 года",
    },
    lastMessage: "Здравствуйте! Интересует подписка?",
    time: "12:30",
    unread: 2,
  },
  {
    id: "c2",
    user: {
      id: "2",
      username: "f1rsoff",
      avatar: jabaImage,
      rating: 610,
      reviews: 610,
      tenure: "11 мес.",
    },
    lastMessage: "Готов выдать аккаунт сразу после оплаты",
    time: "Вчера",
  },
  {
    id: "c3",
    user: {
      id: "3",
      username: "support",
      avatar: eyeImage,
      rating: 0,
      reviews: 0,
      tenure: "—",
    },
    lastMessage: "Напомню о правилах безопасной сделки",
    time: "21.10",
  },
];

const navigationItems: NavigationItem[] = [
  { id: "home", label: "Главная", icon: "home", path: "/" },
  { id: "search", label: "Поиск", icon: "search", path: "/search" },
  { id: "create", label: "Создать", icon: "create", path: "/create" },
  { id: "messages", label: "Сообщения", icon: "messages", path: "/messages" },
  { id: "orders", label: "Заказы", icon: "profile", path: "/orders" },
];

const sumNanoTonDeposits = (amounts: string[]): number => {
  const totalNano = amounts.reduce((total, amount) => {
    try {
      return total + BigInt(amount);
    } catch {
      return total;
    }
  }, 0n);

  return Number(totalNano) / 1_000_000_000;
};

function AppContent() {
  const wallet = useTonWallet();
  const [depositAddress, setDepositAddress] = useState<string | null>(null);
  const [isDepositAddressLoading, setIsDepositAddressLoading] = useState(false);
  const {
    appState,
    updateBalance,
    updateCurrentUser,
    setActiveTab,
    addListing,
    adjustBalance,
  } = useAppState({
    balance: mockBalance,
    listings: mockListings,
    currentUser: mockUser,
    activeTab: "home",
  });

  useEffect(() => {
    initTelegramMiniApp();

    const telegramUser = getTelegramMiniAppUser();
    if (!telegramUser) {
      return;
    }

    const fullName = [telegramUser.first_name, telegramUser.last_name]
      .filter(Boolean)
      .join(" ");

    const username = telegramUser.username
      ? `@${telegramUser.username}`
      : fullName || `tg_${telegramUser.id}`;

    updateCurrentUser({
      ...mockUser,
      id: `telegram:${telegramUser.id}`,
      username,
      avatar: telegramUser.photo_url,
    });
  }, [updateCurrentUser]);

  const bicycleUserId = useMemo(() => {
    if (appState.currentUser?.id.startsWith("telegram:")) {
      return appState.currentUser.id;
    }

    if (wallet) {
      return `wallet:${wallet.account.address}`;
    }

    return null;
  }, [appState.currentUser?.id, wallet]);

  const ensureDepositAddress = useCallback(async () => {
    if (!wallet || !bicycleUserId) {
      setDepositAddress(null);
      return;
    }

    setIsDepositAddressLoading(true);

    try {
      const client = getBicycleClient();
      const addresses = await client.getAllAddresses(bicycleUserId);
      const existingAddress = addresses.find(
        (address) => !address.currency || address.currency === "TON",
      );

      if (existingAddress) {
        setDepositAddress(existingAddress.address);
        return;
      }

      const newAddress = await client.createNewAddress("TON", bicycleUserId);
      setDepositAddress(newAddress.address);
    } catch (error) {
      console.error("Failed to load deposit address:", error);
      setDepositAddress(null);
    } finally {
      setIsDepositAddressLoading(false);
    }
  }, [bicycleUserId, wallet]);

  useEffect(() => {
    void ensureDepositAddress();
  }, [ensureDepositAddress]);

  const refreshDepositBalance = useCallback(async () => {
    if (!wallet || !bicycleUserId) {
      updateBalance({ ...mockBalance, amount: 0 });
      return;
    }

    try {
      const client = getBicycleClient();
      const depositAmounts: string[] = [];
      let offset = 0;
      let totalIncomes: number | undefined;

      do {
        const history = await client.getDepositHistory(
          bicycleUserId,
          "TON",
          DEPOSIT_HISTORY_PAGE_SIZE,
          offset,
        );

        totalIncomes = history.total_incomes;
        depositAmounts.push(...history.incomes.map((income) => income.amount));
        offset += history.incomes.length;

        if (history.incomes.length < DEPOSIT_HISTORY_PAGE_SIZE) {
          break;
        }
      } while (totalIncomes === undefined || offset < totalIncomes);

      const amount = sumNanoTonDeposits(depositAmounts);

      updateBalance({
        ...mockBalance,
        amount,
      });
    } catch (error) {
      console.error("Failed to load deposit history:", error);
      updateBalance({ ...mockBalance, amount: 0 });
    }
  }, [bicycleUserId, updateBalance, wallet]);

  useEffect(() => {
    void refreshDepositBalance();
  }, [refreshDepositBalance]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
  };

  const handlePurchase = (listingId: string) => {
    console.log("Purchasing listing:", listingId);
    // Here you would implement the purchase logic
  };

  const handleBalanceUpdate = (amount: number) => {
    adjustBalance("add", amount);
  };

  const renderCurrentPage = () => {
    switch (appState.activeTab) {
      case "home":
        return (
          <HomePage listings={appState.listings} onPurchase={handlePurchase} />
        );
      case "search":
        return (
          <SearchPage
            listings={appState.listings}
            onPurchase={handlePurchase}
          />
        );
      case "create":
        return (
          <CreatePage
            currentUser={appState.currentUser}
            onCreate={(listing) => {
              addListing(listing);
              setActiveTab("home");
            }}
          />
        );
      case "messages":
        return (
          <MessagesPage
            conversations={mockConversations}
            onOpenConversation={(id) => console.log("open conversation", id)}
          />
        );
      case "orders":
        return (
          <OrdersPage
            username={appState.currentUser?.username ?? "user"}
            orders={appState.listings.map((l, idx) => ({
              ...l,
              orderId: `ORD-${1000 + idx}`,
              createdAt: "Сегодня",
              status:
                idx % 3 === 0
                  ? "Оплачен"
                  : idx % 3 === 1
                    ? "В обработке"
                    : "Отменён",
            }))}
          />
        );
      default:
        return <div className="coming-soon"></div>;
    }
  };

  return (
    <div className="app">
      <TopBar
        balance={appState.balance}
        user={appState.currentUser}
        depositAddress={depositAddress}
        isDepositAddressLoading={isDepositAddressLoading}
        onBalanceUpdate={handleBalanceUpdate}
      />

      <main className="main-content">{renderCurrentPage()}</main>

      <BottomNavigation
        items={navigationItems}
        activeTab={appState.activeTab}
        onTabChange={handleTabChange}
      />
    </div>
  );
}

function App() {
  return (
    <TonConnectUIProvider
      manifestUrl="https://x1zy.github.io/prepay/tonconnect-manifest.json"
      uiPreferences={{ theme: THEME.DARK }}
      actionsConfiguration={{
        twaReturnUrl: "https://x1zy.github.io/prepay/return",
      }}
    >
      <AppContent />
    </TonConnectUIProvider>
  );
}

export default App;
