import express from "express";
import cors from "cors";

const app = express();

const PORT = Number(process.env.PORT ?? 4000);
const BICYCLE_URL = process.env.BICYCLE_URL ?? "http://127.0.0.1:8081";
const BICYCLE_TOKEN = process.env.BICYCLE_TOKEN;

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

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error("Deposit address error:", error);
    res.status(500).json({ error: "Failed to create deposit address" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend started on http://localhost:${PORT}`);
});
