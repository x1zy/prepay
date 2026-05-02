import express from "express";
import cors from "cors";

const app = express();

const PORT = Number(process.env.PORT ?? 4000);
const BICYCLE_URL = process.env.BICYCLE_URL ?? "http://127.0.0.1:8081";
const BICYCLE_TOKEN = process.env.BICYCLE_TOKEN;
const BICYCLE_SHARED_DEPOSIT_USER_ID =
  process.env.BICYCLE_SHARED_DEPOSIT_USER_ID ?? "prepay-shared-deposit";
const SERVICE_WALLET_ADDRESS =
  process.env.SERVICE_WALLET_ADDRESS ??
  "0QBfaGzc2PsHLs9VGVl3jUzLz5FM446CEQ--QWXenQQ1Rk44";
const TONCENTER_API_URL =
  process.env.TONCENTER_API_URL ?? "https://testnet.toncenter.com/api/v3";
const TONCENTER_API_KEY = process.env.TONCENTER_API_KEY;
const DEPOSIT_HISTORY_PAGE_SIZE = 100;
const TONCENTER_TRANSACTIONS_LIMIT = 100;
const deposits = new Map();
const withdrawals = new Map();

if (!BICYCLE_TOKEN) {
  throw new Error("BICYCLE_TOKEN environment variable is required");
}

app.use(
  cors({
    origin: ["http://localhost:5174", "https://x1zy.github.io"],
  }),
);

app.use(express.json());
app.set("etag", false);

app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  next();
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

async function bicycleRequest(path, options = {}) {
  const response = await fetch(`${BICYCLE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BICYCLE_TOKEN}`,
      ...options.headers,
    },
  });
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = typeof body === "string" ? body : JSON.stringify(body);
    throw new Error(`Bicycle API error: ${response.status} ${message}`);
  }

  return body;
}

async function toncenterRequest(path) {
  const headers = {
    Accept: "application/json",
  };

  if (TONCENTER_API_KEY) {
    headers["X-API-Key"] = TONCENTER_API_KEY;
  }

  const response = await fetch(`${TONCENTER_API_URL}${path}`, {
    method: "GET",
    headers,
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(
      `TON Center API error: ${response.status} ${JSON.stringify(body)}`,
    );
  }

  return body;
}

async function getSharedDepositAddress() {
  return SERVICE_WALLET_ADDRESS;
}

function toNanoTon(amount) {
  const value = String(amount ?? "")
    .trim()
    .replace(",", ".");

  if (!/^\d+(\.\d{1,9})?$/.test(value)) {
    throw new Error(
      "amount must be a positive TON value with up to 9 decimals",
    );
  }

  const [whole, fractional = ""] = value.split(".");
  const nano =
    BigInt(whole) * 1_000_000_000n + BigInt(fractional.padEnd(9, "0"));

  if (nano <= 0n) {
    throw new Error("amount must be greater than zero");
  }

  return nano;
}

function getConfirmedDepositTotal(userId) {
  return [...deposits.values()]
    .filter(
      (deposit) => deposit.user_id === userId && deposit.status === "confirmed",
    )
    .reduce((total, deposit) => {
      try {
        return total + BigInt(deposit.amount);
      } catch {
        return total;
      }
    }, 0n);
}

function getReservedWithdrawalTotal(userId) {
  return [...withdrawals.values()]
    .filter(
      (withdrawal) =>
        withdrawal.user_id === userId &&
        !["failed", "rejected"].includes(withdrawal.status),
    )
    .reduce((total, withdrawal) => total + BigInt(withdrawal.amount), 0n);
}

function getProcessedWithdrawalTotal(userId) {
  return [...withdrawals.values()]
    .filter(
      (withdrawal) =>
        withdrawal.user_id === userId && withdrawal.status === "processed",
    )
    .reduce((total, withdrawal) => total + BigInt(withdrawal.amount), 0n);
}

function readToncenterComment(message) {
  const decoded = message?.message_content?.decoded;

  if (typeof decoded?.comment === "string") {
    return decoded.comment;
  }

  if (typeof decoded === "string") {
    return decoded;
  }

  return null;
}

function readToncenterValue(message) {
  const value = message?.value ?? message?.amount;

  if (value === undefined || value === null) {
    return null;
  }

  return String(value);
}

function readToncenterTransactionHash(transaction) {
  return (
    transaction?.hash ??
    transaction?.transaction_id?.hash ??
    transaction?.account_state_hash_after ??
    null
  );
}

async function syncDepositStatusesFromToncenter(pendingDeposits) {
  if (pendingDeposits.length === 0) {
    return;
  }

  const pendingMemos = new Set(pendingDeposits.map((deposit) => deposit.memo));
  const params = new URLSearchParams({
    account: SERVICE_WALLET_ADDRESS,
    limit: TONCENTER_TRANSACTIONS_LIMIT.toString(),
    sort: "desc",
  });
  const earliestCreatedAt = pendingDeposits.reduce((earliest, deposit) => {
    const createdAt = Date.parse(deposit.created_at);
    return Number.isFinite(createdAt) ? Math.min(earliest, createdAt) : earliest;
  }, Date.now());

  if (Number.isFinite(earliestCreatedAt)) {
    params.set(
      "start_utime",
      Math.floor((earliestCreatedAt - 5 * 60 * 1000) / 1000).toString(),
    );
  }

  const transactionsResponse = await toncenterRequest(
    `/transactions?${params.toString()}`,
  );
  const transactions = Array.isArray(transactionsResponse)
    ? transactionsResponse
    : (transactionsResponse.transactions ?? []);

  for (const transaction of transactions) {
    const incomingMessage = transaction.in_msg;
    const comment = readToncenterComment(incomingMessage);

    if (!comment || !pendingMemos.has(comment)) {
      continue;
    }

    const deposit = deposits.get(comment);
    const amount = readToncenterValue(incomingMessage);

    if (!deposit || !amount) {
      continue;
    }

    deposits.set(deposit.id, {
      ...deposit,
      status: "confirmed",
      amount,
      tx_hash: readToncenterTransactionHash(transaction),
      updated_at: new Date().toISOString(),
    });
  }
}

async function syncWithdrawalStatuses(userId) {
  const userWithdrawals = [...withdrawals.values()].filter(
    (withdrawal) =>
      withdrawal.user_id === userId &&
      withdrawal.bicycle_withdrawal_id &&
      ["pending", "processing"].includes(withdrawal.status),
  );

  await Promise.all(
    userWithdrawals.map(async (withdrawal) => {
      try {
        const params = new URLSearchParams({
          id: String(withdrawal.bicycle_withdrawal_id),
        });
        const status = await bicycleRequest(
          `/v1/withdrawal/status?${params.toString()}`,
          { method: "GET" },
        );

        withdrawals.set(withdrawal.id, {
          ...withdrawal,
          status: status.status ?? withdrawal.status,
          tx_hash: status.tx_hash ?? withdrawal.tx_hash,
          updated_at: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Withdrawal status sync error:", error);
      }
    }),
  );
}

async function getUserBalance(userId) {
  const userDepositIds = [...deposits.values()]
    .filter((deposit) => deposit.user_id === userId)
    .map((deposit) => deposit.id);

  await syncDepositStatuses(userDepositIds);
  await syncWithdrawalStatuses(userId);

  const confirmedDeposits = getConfirmedDepositTotal(userId);
  const reservedWithdrawals = getReservedWithdrawalTotal(userId);
  const processedWithdrawals = getProcessedWithdrawalTotal(userId);
  const availableNano = confirmedDeposits - reservedWithdrawals;

  return {
    confirmedDeposits,
    reservedWithdrawals,
    processedWithdrawals,
    availableNano: availableNano > 0n ? availableNano : 0n,
  };
}

app.get("/api/deposit/details", async (req, res) => {
  try {
    const userId = String(req.query.user_id ?? "");

    if (!userId) {
      return res.status(400).json({ error: "user_id is required" });
    }

    const address = await getSharedDepositAddress();
    const depositId = crypto.randomUUID();
    const deposit = {
      id: depositId,
      user_id: userId,
      address,
      memo: depositId,
      currency: "TON",
      status: "pending",
      amount: "0",
      tx_hash: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    deposits.set(depositId, deposit);

    return res.json({
      address,
      id: depositId,
      memo: depositId,
      user_id: userId,
      currency: "TON",
    });
  } catch (error) {
    console.error("Deposit details error:", error);
    return res.status(500).json({ error: "Failed to load deposit details" });
  }
});

app.post("/api/deposits", async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "user_id is required" });
    }

    const address = await getSharedDepositAddress();
    const depositId = crypto.randomUUID();
    const deposit = {
      id: depositId,
      user_id,
      address,
      memo: depositId,
      currency: "TON",
      status: "pending",
      amount: "0",
      tx_hash: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    deposits.set(depositId, deposit);

    return res.status(201).json(deposit);
  } catch (error) {
    console.error("Create deposit error:", error);
    return res.status(500).json({ error: "Failed to create deposit" });
  }
});

async function syncDepositStatuses(depositIds = []) {
  let pendingDeposits = depositIds
    .map((id) => deposits.get(id))
    .filter((deposit) => deposit && deposit.status === "pending");

  if (pendingDeposits.length === 0) {
    return;
  }

  const pendingMemos = new Set(pendingDeposits.map((deposit) => deposit.memo));
  let offset = 0;
  let totalIncomes;

  do {
    const params = new URLSearchParams({
      user_id: BICYCLE_SHARED_DEPOSIT_USER_ID,
      currency: "TON",
      limit: DEPOSIT_HISTORY_PAGE_SIZE.toString(),
      offset: offset.toString(),
      sort_order: "desc",
    });
    const history = await bicycleRequest(
      `/v1/deposit/history?${params.toString()}`,
      { method: "GET" },
    );
    const incomes = history.incomes ?? [];

    totalIncomes = history.total_incomes;

    for (const income of incomes) {
      if (!pendingMemos.has(income.comment)) {
        continue;
      }

      const deposit = deposits.get(income.comment);
      if (!deposit) {
        continue;
      }

      deposits.set(deposit.id, {
        ...deposit,
        status: "confirmed",
        amount: income.amount,
        tx_hash: income.tx_hash,
        updated_at: new Date().toISOString(),
      });
    }

    offset += incomes.length;

    if (incomes.length < DEPOSIT_HISTORY_PAGE_SIZE) {
      break;
    }
  } while (totalIncomes === undefined || offset < totalIncomes);

  pendingDeposits = depositIds
    .map((id) => deposits.get(id))
    .filter((deposit) => deposit && deposit.status === "pending");

  try {
    await syncDepositStatusesFromToncenter(pendingDeposits);
  } catch (error) {
    console.error("TON Center deposit sync error:", error);
  }
}

app.get("/api/deposits/statuses", async (req, res) => {
  try {
    const ids = String(req.query.ids ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (ids.length === 0) {
      return res.status(400).json({ error: "ids query parameter is required" });
    }

    await syncDepositStatuses(ids);

    return res.json({
      deposits: ids.map(
        (id) => deposits.get(id) ?? { id, status: "not_found" },
      ),
    });
  } catch (error) {
    console.error("Deposit statuses error:", error);
    return res.status(500).json({ error: "Failed to load deposit statuses" });
  }
});

app.get("/api/users/wallets/history", async (req, res) => {
  const userId = String(req.query.user_id ?? "");
  const offset = Number(req.query.offset ?? 0);
  const limit = Number(req.query.limit ?? 30);

  if (!userId) {
    return res.status(400).json({ error: "user_id is required" });
  }

  const userDeposits = [...deposits.values()]
    .filter((deposit) => deposit.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return res.json({
    items: userDeposits.slice(offset, offset + limit),
    total: userDeposits.length,
  });
});

app.get("/api/deposit/balance", async (req, res) => {
  try {
    const userId = String(req.query.user_id ?? "");

    if (!userId) {
      return res.status(400).json({ error: "user_id is required" });
    }

    const balance = await getUserBalance(userId);

    return res.json({
      balance: balance.availableNano.toString(),
      amount: Number(balance.availableNano) / 1_000_000_000,
      confirmed_deposits: balance.confirmedDeposits.toString(),
      reserved_withdrawals: balance.reservedWithdrawals.toString(),
      processed_withdrawals: balance.processedWithdrawals.toString(),
      currency: "TON",
      user_id: userId,
    });
  } catch (error) {
    console.error("Deposit balance error:", error);
    return res.status(500).json({ error: "Failed to load deposit balance" });
  }
});

app.post("/api/withdrawals", async (req, res) => {
  try {
    const { user_id, destination, amount } = req.body;
    const userId = String(user_id ?? "");
    const destinationAddress = String(destination ?? "").trim();

    if (!userId) {
      return res.status(400).json({ error: "user_id is required" });
    }

    if (!destinationAddress) {
      return res.status(400).json({ error: "destination is required" });
    }

    let amountNano;
    try {
      amountNano = toNanoTon(amount);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    const balance = await getUserBalance(userId);

    if (amountNano > balance.availableNano) {
      return res.status(400).json({
        error: "Insufficient balance",
        available: balance.availableNano.toString(),
      });
    }

    const withdrawalId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const withdrawal = {
      id: withdrawalId,
      user_id: userId,
      destination: destinationAddress,
      amount: amountNano.toString(),
      currency: "TON",
      status: "pending",
      tx_hash: null,
      bicycle_withdrawal_id: null,
      memo: withdrawalId,
      created_at: createdAt,
      updated_at: createdAt,
    };

    withdrawals.set(withdrawalId, withdrawal);

    try {
      const bicycleWithdrawal = await bicycleRequest("/v1/withdrawal/send", {
        method: "POST",
        body: JSON.stringify({
          destination: destinationAddress,
          amount: amountNano.toString(),
          comment: withdrawalId,
          user_id: userId,
        }),
      });

      const updatedWithdrawal = {
        ...withdrawal,
        bicycle_withdrawal_id: bicycleWithdrawal.id,
        memo: bicycleWithdrawal.memo ?? withdrawal.memo,
        updated_at: new Date().toISOString(),
      };

      withdrawals.set(withdrawalId, updatedWithdrawal);

      return res.status(201).json(updatedWithdrawal);
    } catch (error) {
      withdrawals.set(withdrawalId, {
        ...withdrawal,
        status: "failed",
        updated_at: new Date().toISOString(),
      });
      throw error;
    }
  } catch (error) {
    console.error("Create withdrawal error:", error);
    return res.status(500).json({ error: "Failed to create withdrawal" });
  }
});

app.get("/api/withdrawals/status", async (req, res) => {
  try {
    const withdrawalId = String(req.query.id ?? "");

    if (!withdrawalId) {
      return res.status(400).json({ error: "id query parameter is required" });
    }

    const withdrawal = withdrawals.get(withdrawalId);

    if (!withdrawal) {
      return res.status(404).json({ error: "Withdrawal not found" });
    }

    await syncWithdrawalStatuses(withdrawal.user_id);

    return res.json(withdrawals.get(withdrawalId));
  } catch (error) {
    console.error("Withdrawal status error:", error);
    return res.status(500).json({ error: "Failed to load withdrawal status" });
  }
});

app.post("/api/deposit/address", async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "user_id is required" });
    }

    const response = await fetch(`${BICYCLE_URL}/v1/address/new`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BICYCLE_TOKEN}`,
      },
      body: JSON.stringify({
        user_id,
        currency: "TON",
      }),
    });

    const data = await response.json();

    return res.status(response.status).json(data);
  } catch (error) {
    console.error("Deposit address error:", error);
    return res.status(500).json({ error: "Failed to create deposit address" });
  }
});

app.use("/api/bicycle", async (req, res) => {
  try {
    const bicyclePath = req.originalUrl.replace(/^\/api\/bicycle/, "");
    const targetUrl = `${BICYCLE_URL}${bicyclePath}`;

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BICYCLE_TOKEN}`,
      },
      body: ["GET", "HEAD"].includes(req.method)
        ? undefined
        : JSON.stringify(req.body),
    });

    const contentType = response.headers.get("content-type");
    const responseBody = await response.text();

    if (contentType) {
      res.setHeader("content-type", contentType);
    }

    return res.status(response.status).send(responseBody);
  } catch (error) {
    console.error("Bicycle proxy error:", error);
    return res.status(500).json({ error: "Bicycle proxy request failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend started on http://localhost:${PORT}`);
});
