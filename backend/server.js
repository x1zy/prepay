import express from "express";
import cors from "cors";

const app = express();

const PORT = Number(process.env.PORT ?? 4000);
const BICYCLE_URL = process.env.BICYCLE_URL ?? "http://127.0.0.1:8081";
const BICYCLE_TOKEN = process.env.BICYCLE_TOKEN;
const BICYCLE_SHARED_DEPOSIT_USER_ID =
  process.env.BICYCLE_SHARED_DEPOSIT_USER_ID ?? "prepay-shared-deposit";
const DEPOSIT_HISTORY_PAGE_SIZE = 100;
const deposits = new Map();

if (!BICYCLE_TOKEN) {
  throw new Error("BICYCLE_TOKEN environment variable is required");
}

app.use(
  cors({
    origin: ["http://localhost:5174", "https://x1zy.github.io"],
  }),
);

app.use(express.json());

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

async function getSharedDepositAddress() {
  const params = new URLSearchParams({
    user_id: BICYCLE_SHARED_DEPOSIT_USER_ID,
  });
  const addressesResponse = await bicycleRequest(
    `/v1/address/all?${params.toString()}`,
    { method: "GET" },
  );
  const addresses = Array.isArray(addressesResponse)
    ? addressesResponse
    : (addressesResponse.addresses ?? []);
  const existingAddress = addresses.find(
    (address) => !address.currency || address.currency === "TON",
  );

  if (existingAddress) {
    return existingAddress.address;
  }

  const newAddress = await bicycleRequest("/v1/address/new", {
    method: "POST",
    body: JSON.stringify({
      user_id: BICYCLE_SHARED_DEPOSIT_USER_ID,
      currency: "TON",
    }),
  });

  return newAddress.address;
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
  const pendingDeposits = depositIds
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
      deposits: ids.map((id) => deposits.get(id) ?? { id, status: "not_found" }),
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

    const userDepositIds = [...deposits.values()]
      .filter((deposit) => deposit.user_id === userId)
      .map((deposit) => deposit.id);

    await syncDepositStatuses(userDepositIds);

    const balanceNano = [...deposits.values()]
      .filter(
        (deposit) =>
          deposit.user_id === userId && deposit.status === "confirmed",
      )
      .reduce((total, deposit) => {
      try {
        return total + BigInt(deposit.amount);
      } catch {
        return total;
      }
    }, 0n);

    return res.json({
      balance: balanceNano.toString(),
      amount: Number(balanceNano) / 1_000_000_000,
      currency: "TON",
      user_id: userId,
    });
  } catch (error) {
    console.error("Deposit balance error:", error);
    return res.status(500).json({ error: "Failed to load deposit balance" });
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
