import React, { useState } from 'react';
import type { Balance, User } from '../../types';
import tonSymbol from '../../assets/images/ton_symbol.svg';
import scrollIcon from '../../assets/icons/scroll.svg';
import usdtIcon from '../../assets/icons/tether-usdt-logo.svg';
import './TopBar.css';
import { TonConnectButton } from '@tonconnect/ui-react';
import DepositModal from '../DepositModal/DepositModal';

interface TopBarProps {
  balance: Balance;
  user?: User;
  onBalanceUpdate?: (amount: number) => void;
}

const TopBar: React.FC<TopBarProps> = ({ balance, user, onBalanceUpdate }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [currency, setCurrency] = useState(balance.currency || 'TON');

  const currentIcon = currency === 'USDT' ? usdtIcon : tonSymbol;

  const toggleDropdown = () => setIsDropdownOpen(v => !v);
  const selectCurrency = (c: 'TON' | 'USDT') => {
    setCurrency(c);
    setIsDropdownOpen(false);
  };

  const handleDepositSuccess = (amount: number) => {
    onBalanceUpdate?.(amount);
  };
  return (
    <div className="top-bar">
      <div className="balance-section">
        <div className="balance-display" onClick={toggleDropdown}>
          <img src={currentIcon} alt={currency} className="balance-icon-img" />
          <span className="balance-amount">{balance.amount}</span>
          <img src={scrollIcon} alt="dropdown" className="balance-dropdown-img" />
        </div>
        <div className="balance-controls">
          <button 
            className="balance-btn add-btn"
            aria-label="Add balance"
            onClick={() => setIsDepositModalOpen(true)}
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
        {isDropdownOpen && (
          <div className="token-dropdown">
            {currency === 'USDT' ? (
              <button className="token-item" onClick={() => selectCurrency('TON')}>
                <img src={tonSymbol} alt="TON" className="balance-icon-img" />
                <span className="balance-amount">{balance.amount}</span>
              </button>
            ) : (
              <button className="token-item" onClick={() => selectCurrency('USDT')}>
                <img src={usdtIcon} alt="USDT" className="balance-icon-img" />
                <span className="balance-amount">{balance.amount}</span>
              </button>
            )}
          </div>
        )}
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

      <DepositModal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
        onSuccess={handleDepositSuccess}
      />
    </div>
  );
};

export default TopBar;
