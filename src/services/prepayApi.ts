export interface DepositDetails {
  id: string;
  address: string;
  memo: string;
  user_id: string;
  currency: "TON";
}

export interface DepositStatus {
  id: string;
  user_id?: string;
  address?: string;
  memo?: string;
  currency?: "TON";
  status: "pending" | "confirmed" | "not_found";
  amount?: string;
  tx_hash?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DepositBalance {
  balance: string;
  amount: number;
  currency: "TON";
  memo: string;
  user_id: string;
}

const getApiUrl = (): string => {
  const apiUrl = import.meta.env.VITE_API_URL;

  if (apiUrl) {
    return apiUrl.replace(/\/$/, "");
  }

  return "";
};

const request = async <T>(
  path: string,
  options: RequestInit = {},
): Promise<T> => {
  const response = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Prepay API error: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  return response.json();
};

export const prepayApi = {
  getDepositDetails(userId: string): Promise<DepositDetails> {
    return request<DepositDetails>("/api/deposits", {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    });
  },

  getDepositStatuses(ids: string[]): Promise<{ deposits: DepositStatus[] }> {
    const params = new URLSearchParams({ ids: ids.join(",") });
    return request<{ deposits: DepositStatus[] }>(
      `/api/deposits/statuses?${params.toString()}`,
    );
  },

  getDepositBalance(userId: string): Promise<DepositBalance> {
    const params = new URLSearchParams({ user_id: userId });
    return request<DepositBalance>(`/api/deposit/balance?${params.toString()}`);
  },
};
