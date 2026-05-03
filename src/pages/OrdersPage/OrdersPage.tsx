import React from "react";
import type { ApiOrder } from "../../services/prepayApi";
import "./OrdersPage.css";

type DisplayOrder = Partial<Omit<ApiOrder, "seller" | "buyer" | "status">> & {
  id?: string;
  orderId: string;
  title: string;
  price: number;
  currency: string;
  features?: string[];
  createdAt: string;
  status: ApiOrder["status"] | string;
  seller?: {
    id?: string;
    username: string;
  };
  buyer?: {
    id?: string;
    username: string;
  };
};

interface OrdersPageProps {
  orders: DisplayOrder[];
  username: string;
  currentUserId?: string | null;
  processingOrderId?: string | null;
  onCompleteOrder?: (orderId: string) => Promise<void> | void;
  onDisputeOrder?: (orderId: string) => Promise<void> | void;
}

const OrdersPage: React.FC<OrdersPageProps> = ({
  orders,
  username,
  currentUserId,
  processingOrderId,
  onCompleteOrder,
  onDisputeOrder,
}) => {
  return (
    <div className="orders-page">
      <h2 className="orders-title">Ваши заказы, {username}</h2>
      <div className="orders-list">
        {orders.map((order) => {
          const orderId = order.id ?? order.orderId;
          const isSellerView = Boolean(
            currentUserId && order.seller?.id === currentUserId,
          );
          const contactUser = isSellerView ? order.buyer : order.seller;
          const contactLabel = isSellerView ? "Покупатель" : "Продавец";
          const contactLink = getTelegramLink(
            contactUser?.username,
            contactUser?.id,
          );
          const isPaid = order.status === "paid";
          const isProcessing = processingOrderId === orderId;

          return (
            <div className="order-card" key={orderId}>
              <div className="order-main">
                <div className="order-header">
                  <span className="order-title">{order.title}</span>
                  <span
                    className={`order-status ${statusToClass(order.status)}`}
                  >
                    {statusToLabel(order.status)}
                  </span>
                </div>
                <div className="order-meta">
                  <span className="order-id">#{order.orderId.slice(0, 8)}</span>
                  <span className="order-date">
                    {new Date(order.createdAt).toLocaleDateString("ru-RU")}
                  </span>
                </div>
                <div className="order-meta">
                  <span>
                    {contactLabel}: {contactUser?.username ?? "не указан"}
                  </span>
                </div>
                <div className="order-price">
                  <span className="amount">{order.price}</span>
                  <span className="currency">{order.currency}</span>
                </div>
                {(order.features?.length ?? 0) > 0 && (
                  <div className="order-tags">
                    {order.features?.slice(0, 3).map((feature) => (
                      <span className="tag" key={feature}>
                        {feature}
                      </span>
                    ))}
                  </div>
                )}

                <div className="order-actions">
                  <a
                    className={`order-action contact ${contactLink ? "" : "disabled"}`}
                    href={contactLink ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    aria-disabled={!contactLink}
                    onClick={(event) => {
                      if (!contactLink) {
                        event.preventDefault();
                      }
                    }}
                  >
                    Связаться
                  </a>
                  {isPaid && !isSellerView && (
                    <button
                      className="order-action complete"
                      onClick={() => onCompleteOrder?.(orderId)}
                      disabled={isProcessing}
                    >
                      Подтвердить выполнение заказа
                    </button>
                  )}
                  {isPaid && (
                    <button
                      className="order-action dispute"
                      onClick={() => onDisputeOrder?.(orderId)}
                      disabled={isProcessing}
                    >
                      Оспорить
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {orders.length === 0 && <div className="empty">Заказов пока нет</div>}
      </div>
    </div>
  );
};

function getTelegramLink(username?: string, userId?: string): string | null {
  const cleanUsername = username?.trim().replace(/^@/, "");

  if (cleanUsername && /^[A-Za-z0-9_]{5,32}$/.test(cleanUsername)) {
    return `https://t.me/${encodeURIComponent(cleanUsername)}`;
  }

  const telegramId = userId?.match(/^telegram:(\d+)$/)?.[1];

  return telegramId ? `tg://user?id=${telegramId}` : null;
}

function statusToLabel(status: ApiOrder["status"] | string): string {
  switch (status) {
    case "paid":
      return "Оплачен";
    case "completed":
      return "Выполнен";
    case "disputed":
      return "Спор";
    case "pending":
      return "В обработке";
    case "canceled":
      return "Отменен";
    default:
      return status;
  }
}

function statusToClass(status: ApiOrder["status"] | string): string {
  switch (status) {
    case "paid":
      return "paid";
    case "completed":
      return "completed";
    case "disputed":
      return "disputed";
    case "pending":
      return "pending";
    case "canceled":
      return "canceled";
    default:
      return "";
  }
}

export default OrdersPage;
