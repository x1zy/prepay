import React from "react";
import type { ApiOrder } from "../../services/prepayApi";
import "./OrdersPage.css";

type DisplayOrder = Partial<Omit<ApiOrder, "seller" | "status">> & {
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
};

interface OrdersPageProps {
  orders: DisplayOrder[];
  username: string;
}

const OrdersPage: React.FC<OrdersPageProps> = ({ orders, username }) => {
  return (
    <div className="orders-page">
      <h2 className="orders-title">Ваши заказы, {username}</h2>
      <div className="orders-list">
        {orders.map((order) => (
          <div className="order-card" key={order.id ?? order.orderId}>
            <div className="order-main">
              <div className="order-header">
                <span className="order-title">{order.title}</span>
                <span className={`order-status ${statusToClass(order.status)}`}>
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
                <span>Продавец: {order.seller?.username ?? "не указан"}</span>
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
            </div>
          </div>
        ))}
        {orders.length === 0 && (
          <div className="empty">Заказов пока нет</div>
        )}
      </div>
    </div>
  );
};

function statusToLabel(status: ApiOrder["status"] | string): string {
  switch (status) {
    case "paid":
      return "Оплачен";
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
    case "pending":
      return "pending";
    case "canceled":
      return "canceled";
    default:
      return "";
  }
}

export default OrdersPage;
