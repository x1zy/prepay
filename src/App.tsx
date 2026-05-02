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
import { useEffect, useCallback, useMemo, useRef, useState } from "react";
import { THEME, TonConnectUIProvider } from "@tonconnect/ui-react";
import {
  getTelegramMiniAppUser,
  initTelegramMiniApp,
} from "./services/telegramMiniApp";
import { prepayApi } from "./services/prepayApi";

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

function AppContent() {
  const isCreatingDepositRef = useRef(false);
  const [depositId, setDepositId] = useState<string | null>(null);
  const [depositAddress, setDepositAddress] = useState<string | null>(null);
  const [depositMemo, setDepositMemo] = useState<string | null>(null);
  const [pendingDepositId, setPendingDepositId] = useState<string | null>(null);
  const [isDepositAddressLoading, setIsDepositAddressLoading] = useState(false);
  const {
    appState,
    updateBalance,
    updateCurrentUser,
    setActiveTab,
    addListing,
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

  const bicycleUserId = useMemo(
    () =>
      appState.currentUser?.id.startsWith("telegram:")
        ? appState.currentUser.id
        : null,
    [appState.currentUser?.id],
  );

  const createDeposit = useCallback(async (force = false) => {
    if (isCreatingDepositRef.current) {
      return;
    }

    if (!force && depositId) {
      return;
    }

    if (!bicycleUserId) {
      setDepositId(null);
      setDepositAddress(null);
      setDepositMemo(null);
      return;
    }

    isCreatingDepositRef.current = true;
    setIsDepositAddressLoading(true);

    try {
      const details = await prepayApi.getDepositDetails(bicycleUserId);
      setDepositId(details.id);
      setDepositAddress(details.address);
      setDepositMemo(details.memo);
    } catch (error) {
      console.error("Failed to load deposit address:", error);
      setDepositId(null);
      setDepositAddress(null);
      setDepositMemo(null);
    } finally {
      isCreatingDepositRef.current = false;
      setIsDepositAddressLoading(false);
    }
  }, [bicycleUserId, depositId]);

  useEffect(() => {
    void createDeposit();
  }, [createDeposit]);

  const refreshDepositBalance = useCallback(async () => {
    if (!bicycleUserId) {
      updateBalance({ ...mockBalance, amount: 0 });
      return;
    }

    try {
      const balance = await prepayApi.getDepositBalance(bicycleUserId);

      updateBalance({
        ...mockBalance,
        amount: balance.amount,
      });
    } catch (error) {
      console.error("Failed to load deposit history:", error);
      updateBalance({ ...mockBalance, amount: 0 });
    }
  }, [bicycleUserId, updateBalance]);

  useEffect(() => {
    void refreshDepositBalance();
  }, [refreshDepositBalance]);

  useEffect(() => {
    if (!pendingDepositId) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const statuses = await prepayApi.getDepositStatuses([pendingDepositId]);
        const deposit = statuses.deposits[0];

        if (deposit?.status === "confirmed") {
          window.clearInterval(intervalId);
          setPendingDepositId(null);
          void refreshDepositBalance();
          void createDeposit(true);
        }
      } catch (error) {
        console.error("Failed to load deposit status:", error);
      }
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [pendingDepositId, refreshDepositBalance]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
  };

  const handlePurchase = (listingId: string) => {
    console.log("Purchasing listing:", listingId);
    // Here you would implement the purchase logic
  };

  const handleBalanceUpdate = () => {
    void refreshDepositBalance();
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
        depositId={depositId}
        depositAddress={depositAddress}
        depositMemo={depositMemo}
        isDepositAddressLoading={isDepositAddressLoading}
        onDepositSent={setPendingDepositId}
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
