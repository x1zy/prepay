import React from 'react';
import type { Listing } from '../../types';
import './OrdersPage.css';

interface OrderItem extends Listing {
  orderId: string;
  createdAt: string;
  status: 'Оплачен' | 'В обработке' | 'Отменён';
}

interface OrdersPageProps {
  orders: OrderItem[];
}

const OrdersPage: React.FC<OrdersPageProps> = ({ orders }) => {
  return (
    <div className="orders-page">
      <h2 className="orders-title">История заказов</h2>
      <div className="orders-list">
        {orders.map((o) => (
          <div className="order-card" key={o.orderId}>
            <div className="order-main">
              <div className="order-header">
                <span className="order-title">{o.title}</span>
                <span className={`order-status ${statusToClass(o.status)}`}>{o.status}</span>
              </div>
              <div className="order-meta">
                <span className="order-id">#{o.orderId}</span>
                <span className="order-date">{o.createdAt}</span>
              </div>
              <div className="order-price">
                <span className="amount">{o.price}</span>
                <span className="currency">{o.currency}</span>
              </div>
              {o.features && o.features.length > 0 && (
                <div className="order-tags">
                  {o.features.slice(0, 3).map((f, i) => (
                    <span className="tag" key={i}>{f}</span>
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

function statusToClass(s: OrderItem['status']): string {
  switch (s) {
    case 'Оплачен':
      return 'paid';
    case 'В обработке':
      return 'pending';
    case 'Отменён':
      return 'canceled';
    default:
      return '';
  }
}

export default OrdersPage;


