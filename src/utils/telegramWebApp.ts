/**
 * Telegram WebApp API Utilities
 * 
 * Документация: https://core.telegram.org/bots/webapps
 * 
 * Для тестирования локально:
 * 1. Используйте ngrok: ngrok http 5174
 * 2. Или используйте локальный туннель
 * 3. Укажите URL в настройках бота через @BotFather
 */

// Типы для Telegram WebApp API
export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
      is_premium?: boolean;
      photo_url?: string;
    };
    chat?: {
      id: number;
      type: string;
      title?: string;
      username?: string;
      photo_url?: string;
    };
    auth_date: number;
    hash: string;
  };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
  };
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  BackButton: {
    isVisible: boolean;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
  };
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    setText: (text: string) => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
    setParams: (params: {
      text?: string;
      color?: string;
      text_color?: string;
      is_active?: boolean;
      is_visible?: boolean;
    }) => void;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  CloudStorage: {
    setItem: (key: string, value: string, callback?: (error: Error | null, success: boolean) => void) => void;
    getItem: (key: string, callback: (error: Error | null, value: string | null) => void) => void;
    getItems: (keys: string[], callback: (error: Error | null, values: Record<string, string>) => void) => void;
    removeItem: (key: string, callback?: (error: Error | null, success: boolean) => void) => void;
    removeItems: (keys: string[], callback?: (error: Error | null, success: boolean) => void) => void;
    getKeys: (callback: (error: Error | null, keys: string[]) => void) => void;
  };
  ready: () => void;
  expand: () => void;
  close: () => void;
  sendData: (data: string) => void;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink: (url: string) => void;
  openInvoice: (url: string, callback?: (status: string) => void) => void;
  showPopup: (params: {
    title?: string;
    message: string;
    buttons?: Array<{
      id?: string;
      type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
      text: string;
    }>;
  }, callback?: (buttonId: string) => void) => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  showScanQrPopup: (params: {
    text?: string;
  }, callback?: (text: string) => void) => void;
  closeScanQrPopup: () => void;
  readTextFromClipboard: (callback?: (text: string) => void) => void;
  requestWriteAccess: (callback?: (granted: boolean) => void) => void;
  requestContact: (callback?: (granted: boolean) => void) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

/**
 * Проверяет, запущено ли приложение в Telegram
 */
export function isTelegramWebApp(): boolean {
  return typeof window !== 'undefined' && 
         window.Telegram !== undefined && 
         window.Telegram.WebApp !== undefined;
}

/**
 * Получает экземпляр Telegram WebApp
 */
export function getTelegramWebApp(): TelegramWebApp | null {
  if (isTelegramWebApp()) {
    return window.Telegram!.WebApp;
  }
  return null;
}

/**
 * Получает user_id из Telegram WebApp
 * @returns user_id или null, если не в Telegram
 */
export function getTelegramUserId(): string | null {
  const webApp = getTelegramWebApp();
  if (webApp?.initDataUnsafe?.user?.id) {
    return String(webApp.initDataUnsafe.user.id);
  }
  return null;
}

/**
 * Получает полную информацию о пользователе из Telegram
 */
export function getTelegramUser(): TelegramWebApp['initDataUnsafe']['user'] | null {
  const webApp = getTelegramWebApp();
  return webApp?.initDataUnsafe?.user || null;
}

/**
 * Инициализирует Telegram WebApp (вызывает ready())
 */
export function initTelegramWebApp(): void {
  const webApp = getTelegramWebApp();
  if (webApp) {
    webApp.ready();
    webApp.expand();
    
    // Настраиваем тему
    if (webApp.colorScheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }
}

/**
 * Хук для использования Telegram WebApp в React компонентах
 */
export function useTelegramWebApp() {
  const webApp = getTelegramWebApp();
  const userId = getTelegramUserId();
  const user = getTelegramUser();
  
  return {
    webApp,
    userId,
    user,
    isTelegram: isTelegramWebApp(),
  };
}

