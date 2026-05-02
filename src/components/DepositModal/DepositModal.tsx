import React, { useState } from "react";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { beginCell, toNano } from "@ton/core";
import "./DepositModal.css";

const STATIC_DEPOSIT_ADDRESS =
  "0QBfaGzc2PsHLs9VGVl3jUzLz5FM446CEQ--QWXenQQ1Rk44";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  depositAddress?: string | null;
  depositId?: string | null;
  depositMemo?: string | null;
  isDepositAddressLoading?: boolean;
  onDepositSent?: (depositId: string) => void;
  onSuccess?: (amount: number) => void;
}

const DepositModal: React.FC<DepositModalProps> = ({
  isOpen,
  onClose,
  depositId,
  depositMemo,
  onDepositSent,
  onSuccess,
}) => {
  const [amount, setAmount] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localDepositMemo, setLocalDepositMemo] = useState<string>("");
  const wallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();
  const paymentAddress = STATIC_DEPOSIT_ADDRESS;
  const transactionMemo = depositMemo || localDepositMemo;

  React.useEffect(() => {
    if (isOpen) {
      setLocalDepositMemo(crypto.randomUUID());
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDeposit = async () => {
    setError(null);

    if (!wallet) {
      setError("Кошелек не подключен");
      return;
    }

    if (!paymentAddress) {
      setError("Адрес депозита еще не готов");
      return;
    }

    if (!transactionMemo) {
      setError("MEMO депозита еще не готов");
      return;
    }

    const depositAmount = parseFloat(amount);

    if (isNaN(depositAmount) || depositAmount <= 0) {
      setError("Введите корректную сумму");
      return;
    }

    try {
      setIsLoading(true);

      const payload = beginCell()
        .storeUint(0, 32)
        .storeStringTail(transactionMemo)
        .endCell()
        .toBoc()
        .toString("base64");

      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [
          {
            address: paymentAddress,
            amount: toNano(depositAmount).toString(),
            payload,
          },
        ],
      };

      const result = await tonConnectUI.sendTransaction(transaction);

      if (result) {
        if (depositId) {
          onDepositSent?.(depositId);
        }
        onSuccess?.(depositAmount);
        setAmount("");
        onClose();
      }
    } catch (err) {
      console.error("Deposit error:", err);
      setError(
        err instanceof Error ? err.message : "Ошибка при отправке транзакции",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setError(null);
    }
  };

  return (
    <div className="deposit-modal-overlay" onClick={onClose}>
      <div className="deposit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="deposit-modal-header">
          <h2 className="deposit-modal-title">Пополнить баланс</h2>
          <button className="deposit-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="deposit-modal-content">
          {!wallet ? (
            <div className="deposit-connect-wallet">
              <p className="deposit-connect-text">
                Для пополнения баланса необходимо подключить кошелек
              </p>
              <div className="deposit-connect-button-wrapper">
                <button
                  className="deposit-connect-button"
                  onClick={() => tonConnectUI.openModal()}
                >
                  Подключить кошелек
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="deposit-form-group">
                <label className="deposit-label">Сумма (TON)</label>
                <input
                  type="text"
                  className="deposit-input"
                  placeholder="0.0"
                  value={amount}
                  onChange={handleAmountChange}
                  disabled={isLoading}
                />
              </div>

              {error && <div className="deposit-error">{error}</div>}

              <div className="deposit-info">
                <p className="deposit-info-text">
                  Транзакция будет отправлена на адрес депозита
                </p>
                <p className="deposit-address">
                  {paymentAddress.slice(0, 10)}...{paymentAddress.slice(-10)}
                </p>
                {transactionMemo && (
                  <p className="deposit-address">MEMO: {transactionMemo}</p>
                )}
              </div>

              <div className="deposit-actions">
                <button
                  className="deposit-cancel-btn"
                  onClick={onClose}
                  disabled={isLoading}
                >
                  Отмена
                </button>
                <button
                  className="deposit-submit-btn"
                  onClick={handleDeposit}
                  disabled={
                    isLoading || !transactionMemo || !amount || parseFloat(amount) <= 0
                  }
                >
                  {isLoading ? "Отправка..." : "Отправить"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DepositModal;
