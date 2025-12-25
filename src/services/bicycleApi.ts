/**
 * Bicycle API Client
 * 
 * Документация: https://gobicycle.github.io/bicycle/
 */

// Интерфейсы для запросов и ответов Bicycle API
export interface BicycleNewAddressRequest {
  currency: string;
  user_id?: string;
}

export interface BicycleNewAddressResponse {
  address: string;
  user_id?: string;
}

export interface BicycleDepositIncome {
  comment: string;
  amount: string; // в nanoTONs
  tx_hash: string;
  deposit_address: string;
  source_address?: string;
  time: number; // Unix timestamp
}

export interface BicycleDepositHistoryResponse {
  incomes: BicycleDepositIncome[];
  total_incomes?: number;
}

export interface BicycleDepositIncomeByTxHashResponse {
  currency: string;
  amount: string; // в nanoTONs
  source_address?: string;
  deposit_address: string;
  comment?: string;
}

export interface BicycleWithdrawalRequest {
  destination: string;
  amount: string; // в nanoTONs
  comment?: string;
  user_id?: string;
  binary_comment?: string; // hex формат
}

export interface BicycleWithdrawalResponse {
  id: number;
  memo?: string;
}

export interface BicycleWithdrawalStatusResponse {
  status: 'pending' | 'processing' | 'processed' | 'failed';
  tx_hash?: string;
  user_id?: string;
  query_id?: string;
}

export interface BicycleBalanceResponse {
  balance: string; // в nanoTONs
  currency: string;
  total_processing_amount?: string;
  total_pending_amount?: string;
  status?: 'active' | 'uninit' | 'frozen' | 'non_exist';
}

export interface BicycleSystemSyncResponse {
  synced: boolean;
  last_block_utime: number;
}

// Singleton клиент
let bicycleClient: BicycleApiClient | null = null;

/**
 * Инициализирует Bicycle API клиент
 */
export function initBicycleClient(baseUrl: string, apiKey?: string): void {
  bicycleClient = new BicycleApiClient(baseUrl, apiKey);
}

/**
 * Получает экземпляр Bicycle API клиента
 */
export function getBicycleClient(): BicycleApiClient {
  if (!bicycleClient) {
    const baseUrl = import.meta.env.VITE_BICYCLE_API_URL || 'http://localhost:8081';
    const apiKey = import.meta.env.VITE_BICYCLE_API_KEY;
    bicycleClient = new BicycleApiClient(baseUrl, apiKey);
  }
  return bicycleClient;
}

/**
 * Bicycle API Client класс
 */
class BicycleApiClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl: string, apiKey?: string) {
    // Автоматически используем прокси для localhost в development
    if (baseUrl.includes('localhost:8081') || baseUrl.includes('127.0.0.1:8081')) {
      this.baseUrl = '/api/bicycle';
    } else {
      this.baseUrl = baseUrl.replace(/\/$/, '');
    }
    this.apiKey = apiKey;
  }

  /**
   * Выполняет HTTP запрос к Bicycle API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Bicycle API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return response.json();
  }

  /**
   * POST /v1/address/new
   * Создает новый адрес для депозита
   */
  async createNewAddress(
    currency: string = 'TON',
    userId?: string
  ): Promise<BicycleNewAddressResponse> {
    const body: BicycleNewAddressRequest = { currency };
    if (userId) {
      body.user_id = userId;
    }
    return this.request<BicycleNewAddressResponse>('/v1/address/new', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * GET /v1/address/all?user_id={userId}
   * Получает все адреса для пользователя
   */
  async getAllAddresses(userId: string): Promise<BicycleNewAddressResponse[]> {
    const params = new URLSearchParams({ user_id: userId });
    return this.request<BicycleNewAddressResponse[]>(
      `/v1/address/all?${params.toString()}`,
      { method: 'GET' }
    );
  }

  /**
   * GET /v1/deposit/history?user_id={userId}&currency={currency}&limit={limit}&offset={offset}&sort_order={sortOrder}
   * Получает историю депозитов
   */
  async getDepositHistory(
    userId: string,
    currency: string = 'TON',
    limit: number = 100,
    offset: number = 0,
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<BicycleDepositHistoryResponse> {
    const params = new URLSearchParams({
      user_id: userId,
      currency,
      limit: limit.toString(),
      offset: offset.toString(),
      sort_order: sortOrder,
    });
    return this.request<BicycleDepositHistoryResponse>(
      `/v1/deposit/history?${params.toString()}`,
      { method: 'GET' }
    );
  }

  /**
   * GET /v1/deposit/income?tx_hash={txHash}
   * Получает информацию о депозите по хешу транзакции
   */
  async getDepositIncomeByTxHash(
    txHash: string
  ): Promise<BicycleDepositIncomeByTxHashResponse> {
    const params = new URLSearchParams({ tx_hash: txHash });
    return this.request<BicycleDepositIncomeByTxHashResponse>(
      `/v1/deposit/income?${params.toString()}`,
      { method: 'GET' }
    );
  }

  /**
   * POST /v1/withdrawal/send
   * Отправляет запрос на вывод средств
   */
  async sendWithdrawal(
    request: BicycleWithdrawalRequest
  ): Promise<BicycleWithdrawalResponse> {
    return this.request<BicycleWithdrawalResponse>('/v1/withdrawal/send', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * GET /v1/withdrawal/status?id={id}
   * Получает статус вывода средств
   */
  async getWithdrawalStatus(
    id: number
  ): Promise<BicycleWithdrawalStatusResponse> {
    const params = new URLSearchParams({ id: id.toString() });
    return this.request<BicycleWithdrawalStatusResponse>(
      `/v1/withdrawal/status?${params.toString()}`,
      { method: 'GET' }
    );
  }

  /**
   * GET /v1/balance?currency={currency}&address={address}
   * Получает баланс
   */
  async getBalance(
    currency: string = 'TON',
    address?: string
  ): Promise<BicycleBalanceResponse> {
    const params = new URLSearchParams({ currency });
    if (address) {
      params.append('address', address);
    }
    return this.request<BicycleBalanceResponse>(
      `/v1/balance?${params.toString()}`,
      { method: 'GET' }
    );
  }

  /**
   * GET /v1/system/sync
   * Получает статус синхронизации
   */
  async getSystemSync(): Promise<BicycleSystemSyncResponse> {
    return this.request<BicycleSystemSyncResponse>('/v1/system/sync', {
      method: 'GET',
    });
  }
}

