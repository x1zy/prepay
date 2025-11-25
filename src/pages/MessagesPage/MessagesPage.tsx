import React from 'react';
import type { User } from '../../types';
import './MessagesPage.css';

export interface ConversationPreview {
  id: string;
  user: User;
  lastMessage: string;
  time: string;
  unread?: number;
}

interface MessagesPageProps {
  conversations: ConversationPreview[];
  onOpenConversation?: (conversationId: string) => void;
}

const MessagesPage: React.FC<MessagesPageProps> = ({ conversations, onOpenConversation }) => {
  return (
    <div className="messages-page">
      <h2 className="messages-title">Сообщения</h2>
      <div className="conversations">
        {conversations.map((c) => (
          <button
            key={c.id}
            className="conversation-item"
            onClick={() => onOpenConversation?.(c.id)}
          >
            <img src={c.user.avatar} alt={c.user.username} className="conv-avatar" />
            <div className="conv-main">
              <div className="conv-row">
                <span className="conv-username">{c.user.username}</span>
                <span className="conv-time">{c.time}</span>
              </div>
              <div className="conv-row">
                <span className="conv-last">{c.lastMessage}</span>
                {c.unread ? <span className="conv-unread">{c.unread}</span> : null}
              </div>
            </div>
          </button>
        ))}
        {conversations.length === 0 && (
          <div className="empty">Пока нет диалогов</div>
        )}
      </div>
    </div>
  );
};

export default MessagesPage;


