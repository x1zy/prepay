import React, { useState } from "react";
import type { Balance, User } from "../../types";
import tonSymbol from "../../assets/images/ton_symbol.svg";
import "./TopBar.css";
import { TonConnectButton } from "@tonconnect/ui-react";
import DepositModal from "../DepositModal/DepositModal";
import WithdrawModal from "../WithdrawModal/WithdrawModal";

interface TopBarProps {
  balance: Balance;
  user?: User;
  depositAddress?: string | null;
  depositId?: string | null;
  depositMemo?: string | null;
  isDepositAddressLoading?: boolean;
  onDepositSent?: (depositId: string) => void;
  withdrawUserId?: string | null;
  onBalanceUpdate?: () => void;
  onWithdrawSuccess?: () => void;
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
  withdrawUserId,
  onWithdrawSuccess,
}) => {
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);

  const handleDepositSuccess = () => {
    onBalanceUpdate?.();
  };

  const handleWithdrawSuccess = () => {
    if (onWithdrawSuccess) {
      onWithdrawSuccess();
      return;
    }

    onBalanceUpdate?.();
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
            aria-label="Withdraw balance"
            onClick={() => setIsWithdrawModalOpen(true)}
          >
            -
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

      <WithdrawModal
        isOpen={isWithdrawModalOpen}
        onClose={() => setIsWithdrawModalOpen(false)}
        userId={withdrawUserId}
        availableAmount={balance.amount}
        onSuccess={handleWithdrawSuccess}
      />
    </div>
  );
};

export default TopBar;
