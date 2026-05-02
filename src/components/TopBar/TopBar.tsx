import React, { useState } from "react";
import type { Balance, User } from "../../types";
import tonSymbol from "../../assets/images/ton_symbol.svg";
import "./TopBar.css";
import { TonConnectButton } from "@tonconnect/ui-react";
import DepositModal from "../DepositModal/DepositModal";

interface TopBarProps {
  balance: Balance;
  user?: User;
  depositAddress?: string | null;
  depositId?: string | null;
  depositMemo?: string | null;
  isDepositAddressLoading?: boolean;
  onDepositSent?: (depositId: string) => void;
  onBalanceUpdate?: (amount: number) => void;
}

const TopBar: React.FC<TopBarProps> = ({
  balance,
  user,
  depositAddress,
  depositId,
  depositMemo,
  isDepositAddressLoading = false,
  onDepositSent,
  onBalanceUpdate,
}) => {
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);

  const handleDepositSuccess = (amount: number) => {
    onBalanceUpdate?.(amount);
  };
  return (
    <div className="top-bar">
      <div className="balance-section">
        <div className="balance-display">
          <img src={tonSymbol} alt="TON" className="balance-icon-img" />
          <span className="balance-amount">{balance.amount}</span>
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
      </div>

      <div className="user-section">
        {user?.avatar && (
          <img src={user.avatar} alt={user.username} className="user-avatar" />
        )}
        <TonConnectButton />
      </div>

      <DepositModal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
        depositAddress={depositAddress}
        depositId={depositId}
        depositMemo={depositMemo}
        isDepositAddressLoading={isDepositAddressLoading}
        onDepositSent={onDepositSent}
        onSuccess={handleDepositSuccess}
      />
    </div>
  );
};

export default TopBar;
