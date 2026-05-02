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
import { prepayApi, type ApiOrder } from "./services/prepayApi";

const initialListings: Listing[] = [];

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
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const {
    appState,
    updateBalance,
    updateCurrentUser,
    setActiveTab,
    addListing,
    updateListings,
  } = useAppState({
    balance: mockBalance,
    listings: initialListings,
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

  const refreshListings = useCallback(async () => {
    try {
      const response = await prepayApi.getListings();
      updateListings(response.listings);
    } catch (error) {
      console.error("Failed to load listings:", error);
    }
  }, [updateListings]);

  const refreshOrders = useCallback(async () => {
    if (!bicycleUserId) {
      setOrders([]);
      return;
    }

    try {
      const response = await prepayApi.getOrders(bicycleUserId);
      setOrders(response.orders);
    } catch (error) {
      console.error("Failed to load orders:", error);
      setOrders([]);
    }
  }, [bicycleUserId]);

  useEffect(() => {
    void refreshListings();
  }, [refreshListings]);

  useEffect(() => {
    if (!bicycleUserId || !appState.currentUser) {
      return;
    }

    void prepayApi.upsertUser({
      id: bicycleUserId,
      telegram_id: Number(bicycleUserId.replace("telegram:", "")),
      username: appState.currentUser.username,
      avatar: appState.currentUser.avatar,
    });
  }, [appState.currentUser, bicycleUserId]);

  useEffect(() => {
    void refreshOrders();
  }, [refreshOrders]);

  const createDeposit = useCallback(
    async (force = false) => {
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
    },
    [bicycleUserId, depositId],
  );

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
  }, [createDeposit, pendingDepositId, refreshDepositBalance]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
  };

  const handlePurchase = async (listingId: string) => {
    if (!bicycleUserId || !appState.currentUser) {
      console.error("Telegram user is required to create an order");
      return;
    }

    try {
      await prepayApi.createOrder({
        buyer_id: bicycleUserId,
        buyer: appState.currentUser,
        listing_id: listingId,
      });
      await refreshOrders();
      setActiveTab("orders");
    } catch (error) {
      console.error("Failed to create order:", error);
    }
  };

  const handleBalanceUpdate = () => {
    void refreshDepositBalance();
  };

  const renderCurrentPage = () => {
    if (appState.activeTab === "orders") {
      return (
        <OrdersPage
          username={appState.currentUser?.username ?? "user"}
          orders={orders}
        />
      );
    }

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
            onCreate={async (listing) => {
              if (!bicycleUserId || !appState.currentUser) {
                throw new Error("Откройте приложение через Telegram");
              }

              const createdListing = await prepayApi.createListing({
                seller_id: bicycleUserId,
                seller: appState.currentUser,
                title: listing.title,
                description: listing.description,
                price: listing.price,
                currency: listing.currency,
                features: listing.features ?? [],
              });

              addListing(createdListing);
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
        withdrawUserId={bicycleUserId}
        onBalanceUpdate={handleBalanceUpdate}
        onWithdrawSuccess={handleBalanceUpdate}
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
