import { Address } from "@ton/core";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import type { ChangeEvent, FC } from "react";
import { useEffect, useMemo, useState } from "react";
import { prepayApi } from "../../services/prepayApi";
import "../DepositModal/DepositModal.css";

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string | null;
  availableAmount: number;
  onSuccess?: () => void;
}

const formatWalletAddress = (
  address: string,
  chain?: string,
): string => {
  try {
    return Address.parse(address).toString({
      bounceable: false,
      testOnly: chain === "-3",
    });
  } catch {
    return address;
  }
};

const WithdrawModal: FC<WithdrawModalProps> = ({
  isOpen,
  onClose,
  userId,
  availableAmount,
  onSuccess,
}) => {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const wallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();

  const destinationAddress = useMemo(() => {
    if (!wallet?.account.address) {
      return null;
    }

    return formatWalletAddress(wallet.account.address, wallet.account.chain);
  }, [wallet?.account.address, wallet?.account.chain]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setAmount("");
    setError(null);
    setIsLoading(false);
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.replace(",", ".");

    if (value === "" || /^\d*\.?\d{0,9}$/.test(value)) {
      setAmount(value);
      setError(null);
    }
  };

  const handleWithdraw = async () => {
    setError(null);

    if (!wallet || !destinationAddress) {
      setError("Подключите кошелек через TON Connect.");
      return;
    }

    if (!userId) {
      setError("Пользователь Telegram не определен. Откройте приложение в Telegram.");
      return;
    }

    const withdrawAmount = Number(amount);

    if (!Number.isFinite(withdrawAmount) || withdrawAmount <= 0) {
      setError("Введите корректную сумму вывода.");
      return;
    }

    if (withdrawAmount > availableAmount) {
      setError("Сумма вывода больше доступного баланса.");
      return;
    }

    try {
      setIsLoading(true);
      await prepayApi.createWithdrawal({
        user_id: userId,
        destination: destinationAddress,
        amount,
      });
      onSuccess?.();
      onClose();
    } catch (withdrawError) {
      console.error("Withdrawal error:", withdrawError);
      setError(
        withdrawError instanceof Error
          ? withdrawError.message
          : "Не удалось создать заявку на вывод.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="deposit-modal-overlay" onClick={onClose}>
      <div className="deposit-modal" onClick={(event) => event.stopPropagation()}>
        <div className="deposit-modal-header">
          <h2 className="deposit-modal-title">Вывести TON</h2>
          <button className="deposit-modal-close" onClick={onClose}>
            x
          </button>
        </div>

        <div className="deposit-modal-content">
          {!wallet ? (
            <div className="deposit-connect-wallet">
              <p className="deposit-connect-text">
                Для вывода средств подключите кошелек через TON Connect.
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
                <label className="deposit-label">Сумма вывода (TON)</label>
                <input
                  type="text"
                  className="deposit-input"
                  placeholder="0.0"
                  value={amount}
                  onChange={handleAmountChange}
                  disabled={isLoading}
                />
              </div>

              <div className="deposit-info">
                <p className="deposit-info-text">Доступно к выводу</p>
                <p className="deposit-address">{availableAmount} TON</p>
                {destinationAddress && (
                  <>
                    <p className="deposit-info-text">Кошелек получателя</p>
                    <p className="deposit-address">
                      {destinationAddress.slice(0, 10)}...
                      {destinationAddress.slice(-10)}
                    </p>
                  </>
                )}
              </div>

              {error && <div className="deposit-error">{error}</div>}

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
                  onClick={handleWithdraw}
                  disabled={
                    isLoading ||
                    !amount ||
                    Number(amount) <= 0 ||
                    Number(amount) > availableAmount
                  }
                >
                  {isLoading ? "Создание..." : "Подтвердить"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default WithdrawModal;
