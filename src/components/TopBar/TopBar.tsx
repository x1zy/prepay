import React from 'react';
import type { Balance, User } from '../../types';
import tonSymbol from '../../assets/images/ton_symbol.svg';
import scrollIcon from '../../assets/icons/scroll.svg';
import './TopBar.css';
import { TonConnectButton } from '@tonconnect/ui-react';

interface TopBarProps {
  balance: Balance;
  user?: User;
}

const TopBar: React.FC<TopBarProps> = ({ balance, user }) => {
  return (
    <div className="top-bar">
      <div className="balance-section">
        <div className="balance-display">
          <img src={tonSymbol} alt="TON" className="balance-icon-img" />
          <span className="balance-amount">{balance.amount}</span>
          <img src={scrollIcon} alt="dropdown" className="balance-dropdown-img" />
        </div>
        <div className="balance-controls">
          <button 
            className="balance-btn add-btn"
            aria-label="Add balance"
          >
            +
          </button>
          <button 
            className="balance-btn subtract-btn"
            aria-label="Subtract balance"
          >
            −
          </button>
        </div>
      </div>
      
      <div className="user-section">
        {user && (
          <img 
            src={user.avatar} 
            alt={user.username}
            className="user-avatar"
          />
        )}
        <TonConnectButton />
      </div>
    </div>
  );
};

export default TopBar;
