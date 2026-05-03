import express from "express";
import cors from "cors";
import { initializeDatabase, pool, requireDatabase } from "./db.js";

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
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL =
  process.env.TELEGRAM_API_URL ?? "https://api.telegram.org";
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
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  next();
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/users", requireDatabase, async (req, res) => {
  try {
    const user = await upsertUser(req.body);
    return res.status(201).json(user);
  } catch (error) {
    console.error("Upsert user error:", error);
    return res.status(400).json({ error: error.message });
  }
});

app.get("/api/listings", requireDatabase, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        l.*,
        u.username AS seller_username,
        u.avatar AS seller_avatar,
        u.rating AS seller_rating,
        u.reviews AS seller_reviews,
        u.tenure AS seller_tenure
      FROM listings l
      JOIN users u ON u.id = l.seller_id
      WHERE l.status = 'active'
      ORDER BY l.created_at DESC;
    `);

    return res.json({ listings: result.rows.map(mapListing) });
  } catch (error) {
    console.error("Load listings error:", error);
    return res.status(500).json({ error: "Failed to load listings" });
  }
});

app.post("/api/listings", requireDatabase, async (req, res) => {
  try {
    const {
      seller_id,
      seller,
      title,
      description,
      price,
      currency = "TON",
      region,
      features = [],
      isNew = false,
      isAutoIssue = false,
    } = req.body;
    const sellerId = String(seller_id ?? seller?.id ?? "").trim();
    const trimmedTitle = String(title ?? "").trim();
    const numericPrice = Number(price);

    if (!sellerId) {
      return res.status(400).json({ error: "seller_id is required" });
    }

    if (!trimmedTitle) {
      return res.status(400).json({ error: "title is required" });
    }

    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return res.status(400).json({ error: "price must be zero or greater" });
    }

    await upsertUser({
      id: sellerId,
      username: seller?.username ?? sellerId,
      avatar: seller?.avatar,
    });

    const listingId = crypto.randomUUID();
    const result = await pool.query(
      `
        INSERT INTO listings (
          id,
          seller_id,
          title,
          description,
          price,
          currency,
          region,
          features,
          is_new,
          is_auto_issue
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
        RETURNING
          listings.*,
          (SELECT username FROM users WHERE id = seller_id) AS seller_username,
          (SELECT avatar FROM users WHERE id = seller_id) AS seller_avatar,
          (SELECT rating FROM users WHERE id = seller_id) AS seller_rating,
          (SELECT reviews FROM users WHERE id = seller_id) AS seller_reviews,
          (SELECT tenure FROM users WHERE id = seller_id) AS seller_tenure;
      `,
      [
        listingId,
        sellerId,
        trimmedTitle,
        String(description ?? "").trim(),
        numericPrice,
        String(currency),
        region ? String(region) : null,
        JSON.stringify(Array.isArray(features) ? features : []),
        Boolean(isNew),
        Boolean(isAutoIssue),
      ],
    );

    return res.status(201).json(mapListing(result.rows[0]));
  } catch (error) {
    console.error("Create listing error:", error);
    return res.status(500).json({ error: "Failed to create listing" });
  }
});

async function loadOrdersForUser(userId) {
  const result = await pool.query(
    `
      SELECT
        o.*,
        buyer.username AS buyer_username
      FROM orders o
      JOIN users buyer ON buyer.id = o.buyer_id
      WHERE o.buyer_id = $1 OR o.seller_id = $1
      ORDER BY o.created_at DESC;
    `,
    [userId],
  );

  return result.rows.map(mapOrder);
}

app.post("/api/orders", requireDatabase, async (req, res) => {
  const client = await pool.connect();

  try {
    const { buyer_id, buyer, listing_id } = req.body;
    const buyerId = String(buyer_id ?? buyer?.id ?? "").trim();
    const listingId = String(listing_id ?? "").trim();

    if (!buyerId) {
      return res.status(400).json({ error: "buyer_id is required" });
    }

    if (!listingId) {
      return res.status(400).json({ error: "listing_id is required" });
    }

    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1));", [
      buyerId,
    ]);

    const buyerUser = await upsertUser(
      {
        id: buyerId,
        username: buyer?.username ?? buyerId,
        avatar: buyer?.avatar,
      },
      client,
    );

    const listingResult = await client.query(
      `
        SELECT l.*, u.username AS seller_username
        FROM listings l
        JOIN users u ON u.id = l.seller_id
        WHERE l.id = $1 AND l.status = 'active'
        FOR UPDATE OF l;
      `,
      [listingId],
    );

    if (listingResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Listing not found" });
    }

    const listing = listingResult.rows[0];

    if (listing.seller_id === buyerId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "You cannot buy your own listing" });
    }

    if (listing.currency !== "TON") {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ error: "Only TON listings can be purchased" });
    }

    const priceNano = toNanoTon(listing.price);
    const balance = await getUserBalance(buyerId, client);

    if (priceNano > balance.availableNano) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "Insufficient balance",
        available: balance.availableNano.toString(),
        required: priceNano.toString(),
      });
    }

    const orderId = crypto.randomUUID();
    const orderResult = await client.query(
      `
        INSERT INTO orders (
          id,
          buyer_id,
          seller_id,
          listing_id,
          listing_title,
          listing_description,
          price,
          currency,
          features,
          seller_username,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, 'paid')
        RETURNING *;
      `,
      [
        orderId,
        buyerId,
        listing.seller_id,
        listing.id,
        listing.title,
        listing.description ?? "",
        Number(listing.price),
        listing.currency,
        JSON.stringify(Array.isArray(listing.features) ? listing.features : []),
        listing.seller_username,
      ],
    );

    await client.query("COMMIT");

    await sendOrderPaidNotificationsWithProfileLinks({
      orderId,
      buyerId,
      sellerId: listing.seller_id,
      buyerUsername: buyerUser.username,
      sellerUsername: listing.seller_username,
    });

    return res.status(201).json(mapOrder(orderResult.rows[0]));
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Create order rollback error:", rollbackError);
    }

    console.error("Create order error:", error);
    return res.status(500).json({ error: "Failed to create order" });
  } finally {
    client.release();
  }
});

async function updateOrderStatus(req, res, nextStatus, allowedRoles) {
  const client = await pool.connect();

  try {
    const orderId = String(req.params.id ?? "").trim();
    const userId = String(req.body.user_id ?? "").trim();

    if (!orderId) {
      return res.status(400).json({ error: "order id is required" });
    }

    if (!userId) {
      return res.status(400).json({ error: "user_id is required" });
    }

    await client.query("BEGIN");

    const orderResult = await client.query(
      `
        SELECT *
        FROM orders
        WHERE id = $1
        FOR UPDATE;
      `,
      [orderId],
    );

    if (orderResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orderResult.rows[0];

    const isBuyer = order.buyer_id === userId;
    const isSeller = order.seller_id === userId;
    const canUpdate =
      (allowedRoles.includes("buyer") && isBuyer) ||
      (allowedRoles.includes("seller") && isSeller);

    if (!canUpdate) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "You cannot update this order" });
    }

    if (order.status !== "paid") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "Order status cannot be changed",
        status: order.status,
      });
    }

    const updatedOrder = await client.query(
      `
        UPDATE orders
        SET status = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING *;
      `,
      [orderId, nextStatus],
    );

    await client.query("COMMIT");

    return res.json(mapOrder(updatedOrder.rows[0]));
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Update order rollback error:", rollbackError);
    }

    console.error("Update order status error:", error);
    return res.status(500).json({ error: "Failed to update order status" });
  } finally {
    client.release();
  }
}

app.post("/api/orders/:id/complete", requireDatabase, (req, res) =>
  updateOrderStatus(req, res, "completed", ["buyer"]),
);

app.post("/api/orders/:id/dispute", requireDatabase, (req, res) =>
  updateOrderStatus(req, res, "disputed", ["buyer", "seller"]),
);

app.get("/api/orders", requireDatabase, async (req, res) => {
  try {
    const userId = String(req.query.user_id ?? "").trim();

    if (!userId) {
      return res.status(400).json({ error: "user_id is required" });
    }

    return res.json({ orders: await loadOrdersForUser(userId) });
  } catch (error) {
    console.error("Load orders error:", error);
    return res.status(500).json({ error: "Failed to load orders" });
  }
});

app.get("/api/getOrders", requireDatabase, async (req, res) => {
  try {
    const userId = String(
      req.query.user_id ?? req.query.telegram_id ?? "",
    ).trim();

    if (!userId) {
      return res.status(400).json({ error: "user_id is required" });
    }

    return res.json({ orders: await loadOrdersForUser(userId) });
  } catch (error) {
    console.error("Load getOrders error:", error);
    return res.status(500).json({ error: "Failed to load orders" });
  }
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

async function getOrderAccountingTotals(userId, dbClient = pool) {
  if (!dbClient) {
    return {
      purchaseDebits: 0n,
      saleCredits: 0n,
    };
  }

  const result = await dbClient.query(
    `
      SELECT
        COALESCE(
          SUM((price * 1000000000)::numeric(40, 0))
            FILTER (
              WHERE buyer_id = $1
                AND status IN ('paid', 'completed', 'disputed')
            ),
          0
        )::text AS purchase_debits,
        COALESCE(
          SUM((price * 1000000000)::numeric(40, 0))
            FILTER (WHERE seller_id = $1 AND status = 'completed'),
          0
        )::text AS sale_credits
      FROM orders
      WHERE (buyer_id = $1 OR seller_id = $1)
        AND currency = 'TON';
    `,
    [userId],
  );

  return {
    purchaseDebits: BigInt(result.rows[0]?.purchase_debits ?? "0"),
    saleCredits: BigInt(result.rows[0]?.sale_credits ?? "0"),
  };
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

function parseTelegramId(userId) {
  const match = String(userId ?? "").match(/^telegram:(\d+)$/);
  return match ? Number(match[1]) : null;
}

function normalizeUsername(username, userId) {
  const value = String(username ?? "").trim();

  if (!value) {
    return String(userId);
  }

  const cleanUsername = value.replace(/^@/, "");

  if (/^[A-Za-z0-9_]{5,32}$/.test(cleanUsername)) {
    return `@${cleanUsername}`;
  }

  return value;
}

function getShortOrderNumber(orderId) {
  return String(orderId).slice(0, 8).toUpperCase();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getTelegramContactHtml(userId, username) {
  const telegramId = parseTelegramId(userId);
  const cleanUsername = String(username ?? "")
    .trim()
    .replace(/^@/, "");

  if (/^[A-Za-z0-9_]{5,32}$/.test(cleanUsername)) {
    return `<a href="https://t.me/${encodeURIComponent(cleanUsername)}">@${escapeHtml(cleanUsername)}</a>`;
  }

  if (telegramId) {
    return `<a href="tg://user?id=${telegramId}">профиль</a>`;
  }

  return escapeHtml(username || userId);
}

async function sendTelegramMessage(chatId, text, options = {}) {
  if (!TELEGRAM_BOT_TOKEN || !chatId) {
    return;
  }

  try {
    const response = await fetch(
      `${TELEGRAM_API_URL}/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: options.parseMode,
          disable_web_page_preview: true,
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Telegram Bot API error: ${response.status} ${body}`);
    }
  } catch (error) {
    console.error("Telegram message error:", error);
  }
}

async function sendOrderPaidNotifications({
  orderId,
  buyerId,
  sellerId,
  buyerUsername,
  sellerUsername,
}) {
  const shortOrderNumber = getShortOrderNumber(orderId);
  const buyerChatId = parseTelegramId(buyerId);
  const sellerChatId = parseTelegramId(sellerId);

  await Promise.all([
    sendTelegramMessage(
      sellerChatId,
      `Заказ ${shortOrderNumber} был оплачен, свяжитесь с ${buyerUsername} для выполнения заказа.`,
    ),
    sendTelegramMessage(
      buyerChatId,
      `Заказ был успешно оплачен. Свяжитесь с ${sellerUsername} для получения товара/услуги.`,
    ),
  ]);
}

async function sendOrderPaidNotificationsWithProfileLinks({
  orderId,
  buyerId,
  sellerId,
  buyerUsername,
  sellerUsername,
}) {
  const shortOrderNumber = getShortOrderNumber(orderId);
  const buyerChatId = parseTelegramId(buyerId);
  const sellerChatId = parseTelegramId(sellerId);
  const buyerContact = getTelegramContactHtml(buyerId, buyerUsername);
  const sellerContact = getTelegramContactHtml(sellerId, sellerUsername);

  await Promise.all([
    sendTelegramMessage(
      sellerChatId,
      `Заказ ${shortOrderNumber} был оплачен, свяжитесь с ${buyerContact} для выполнения заказа.`,
      { parseMode: "HTML" },
    ),
    sendTelegramMessage(
      buyerChatId,
      `Заказ был успешно оплачен. Свяжитесь с ${sellerContact} для получения товара/услуги.`,
      { parseMode: "HTML" },
    ),
  ]);
}

function mapUser(row) {
  return {
    id: row.id,
    username: row.username,
    avatar: row.avatar ?? undefined,
    rating: Number(row.rating ?? 0),
    reviews: Number(row.reviews ?? 0),
    tenure: row.tenure ?? "0 days",
  };
}

function mapListing(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    price: Number(row.price),
    currency: row.currency,
    region: row.region ?? undefined,
    features: Array.isArray(row.features) ? row.features : [],
    isNew: row.is_new,
    isAutoIssue: row.is_auto_issue,
    seller: mapUser({
      id: row.seller_id,
      username: row.seller_username,
      avatar: row.seller_avatar,
      rating: row.seller_rating,
      reviews: row.seller_reviews,
      tenure: row.seller_tenure,
    }),
    created_at: row.created_at,
  };
}

function mapOrder(row) {
  return {
    id: row.id,
    orderId: row.id,
    listingId: row.listing_id,
    title: row.listing_title,
    description: row.listing_description ?? "",
    price: Number(row.price),
    currency: row.currency,
    features: Array.isArray(row.features) ? row.features : [],
    status: row.status,
    createdAt: row.created_at,
    seller: {
      id: row.seller_id,
      username: row.seller_username,
    },
    buyer: {
      id: row.buyer_id,
      username: row.buyer_username ?? row.buyer_id,
    },
  };
}

async function upsertUser(
  { id, telegram_id, username, avatar },
  dbClient = pool,
) {
  const userId = String(id ?? "").trim();

  if (!userId) {
    throw new Error("id is required");
  }

  const telegramId = telegram_id ?? parseTelegramId(userId);
  const normalizedUsername = normalizeUsername(username, userId);

  const result = await dbClient.query(
    `
      INSERT INTO users (id, telegram_id, username, avatar)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET
        telegram_id = COALESCE(EXCLUDED.telegram_id, users.telegram_id),
        username = EXCLUDED.username,
        avatar = COALESCE(EXCLUDED.avatar, users.avatar),
        updated_at = NOW()
      RETURNING *;
    `,
    [userId, telegramId, normalizedUsername, avatar ?? null],
  );

  return mapUser(result.rows[0]);
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
    return Number.isFinite(createdAt)
      ? Math.min(earliest, createdAt)
      : earliest;
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

async function getUserBalance(userId, dbClient = pool) {
  const userDepositIds = [...deposits.values()]
    .filter((deposit) => deposit.user_id === userId)
    .map((deposit) => deposit.id);

  await syncDepositStatuses(userDepositIds);
  await syncWithdrawalStatuses(userId);

  const confirmedDeposits = getConfirmedDepositTotal(userId);
  const reservedWithdrawals = getReservedWithdrawalTotal(userId);
  const processedWithdrawals = getProcessedWithdrawalTotal(userId);
  const orderTotals = await getOrderAccountingTotals(userId, dbClient);
  const availableNano =
    confirmedDeposits +
    orderTotals.saleCredits -
    orderTotals.purchaseDebits -
    reservedWithdrawals;

  return {
    confirmedDeposits,
    purchaseDebits: orderTotals.purchaseDebits,
    saleCredits: orderTotals.saleCredits,
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
      purchase_debits: balance.purchaseDebits.toString(),
      sale_credits: balance.saleCredits.toString(),
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

initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend started on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Database initialization failed:", error);
    process.exit(1);
  });
