import React, { useState, useEffect, useCallback } from 'react';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { beginCell, toNano, fromNano } from '@ton/core';
import { getBicycleClient } from '../../services/bicycleApi';
import { getTelegramUserId } from '../../utils/telegramWebApp';
import './DepositModal.css';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (amount: number) => void;
  user?: { id?: string };
}

const DepositModal: React.FC<DepositModalProps> = ({ isOpen, onClose, onSuccess, user }) => {
  const [amount, setAmount] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hotWalletAddress, setHotWalletAddress] = useState<string | null>(null);
  const [depositStatus, setDepositStatus] = useState<'pending' | 'confirmed' | 'failed' | null>(null);
  const [pendingDeposit, setPendingDeposit] = useState<{ memo: string; amount: number; userId: string; depositAddress: string } | null>(null);
  const wallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();

  // Кэш hot wallet адреса
  const [cachedHotWallet, setCachedHotWallet] = useState<string | null>(() => {
    return localStorage.getItem('bicycleHotWallet') || null;
  });

  // Получаем или создаем hot wallet адрес
  const getOrCreateHotWallet = useCallback(async (userId: string): Promise<string> => {
    if (cachedHotWallet) {
      console.log('Using cached hot wallet address:', cachedHotWallet);
      return cachedHotWallet;
    }
    try {
      const bicycle = getBicycleClient();
      const addressResponse = await bicycle.createNewAddress('TON', userId);
      const newHotWalletAddress = addressResponse.address;
      if (!newHotWalletAddress) {
        throw new Error('Bicycle не вернул адрес депозита');
      }
      localStorage.setItem('bicycleHotWallet', newHotWalletAddress);
      setCachedHotWallet(newHotWalletAddress);
      console.log('Created new hot wallet address:', newHotWalletAddress);
      return newHotWalletAddress;
    } catch (e) {
      console.error('Failed to get or create hot wallet address:', e);
      throw e;
    }
  }, [cachedHotWallet]);

  // Загружаем hot wallet адрес при открытии модального окна
  useEffect(() => {
    if (isOpen && wallet) {
      const loadHotWallet = async () => {
        try {
          // Приоритет получения user_id: Telegram → user.id → wallet address
          const telegramUserId = getTelegramUserId();
          const userId = telegramUserId || user?.id || wallet.account.address;
          
          if (!userId) {
            setError('Не удалось определить user_id для депозита');
            return;
          }

          const address = await getOrCreateHotWallet(userId);
          setHotWalletAddress(address);
        } catch (e) {
          console.error('Failed to load hot wallet:', e);
          setError('Не удалось получить адрес депозита');
        }
      };
      loadHotWallet();
    }
  }, [isOpen, wallet, user, getOrCreateHotWallet]);

  // Отслеживание статуса депозита
  useEffect(() => {
    if (!pendingDeposit || !pendingDeposit.userId) {
      if (!pendingDeposit) {
        setDepositStatus(null);
      }
      return;
    }

    let isActive = true;
    let pollCount = 0;
    const maxPolls = 120; // 10 минут
    setDepositStatus('pending');

    const checkDepositStatus = async () => {
      if (!isActive || !pendingDeposit) return;

      try {
        const bicycle = getBicycleClient();
        console.log(`[Deposit Check #${pollCount + 1}] Checking deposit status for memo: ${pendingDeposit.memo}`);

        const history = await bicycle.getDepositHistory(
          pendingDeposit.userId!,
          'TON',
          100,
          0,
          'desc'
        );

        console.log(`[Deposit Check #${pollCount + 1}] History received:`, {
          totalIncomes: history.incomes?.length || 0,
          incomes: history.incomes?.slice(0, 3).map(i => ({
            memo: i.comment,
            amount: i.amount,
            tx_hash: i.tx_hash,
            deposit_address: i.deposit_address
          }))
        });

        const matchingDeposit = history.incomes?.find(
          (income) => 
            income.comment === pendingDeposit.memo ||
            income.deposit_address === pendingDeposit.depositAddress
        );

        if (matchingDeposit) {
          const receivedAmount = Number(fromNano(BigInt(matchingDeposit.amount)));

          console.log('\n✅ ===== DEPOSIT CONFIRMED =====');
          console.log(`Amount: ${receivedAmount} TON`);
          console.log(`Expected: ${pendingDeposit.amount} TON`);
          console.log(`Memo: ${pendingDeposit.memo}`);
          console.log(`Transaction Hash: ${matchingDeposit.tx_hash}`);
          console.log('====================================\n');

          setDepositStatus('confirmed');
          onSuccess?.(pendingDeposit.amount);
          
          setTimeout(() => {
            setPendingDeposit(null);
            setDepositStatus(null);
            setAmount('');
            onClose();
          }, 3000);

          return;
        }

        pollCount++;
        console.log(`[Deposit Check #${pollCount}] Deposit not found yet. Polling will continue...`);

        if (pollCount >= maxPolls) {
          console.warn('⚠️ Deposit polling timeout. Stopping checks.');
          setDepositStatus('failed');
          setTimeout(() => {
            setPendingDeposit(null);
            setDepositStatus(null);
          }, 10000);
          return;
        }

        if (isActive) {
          setTimeout(checkDepositStatus, 5000);
        }
      } catch (e: any) {
        console.error(`[Deposit Check #${pollCount + 1}] Error checking deposit status:`, e);
        pollCount++;
        if (pollCount >= maxPolls) {
          console.warn('⚠️ Deposit polling timeout after errors. Stopping checks.');
          setDepositStatus('failed');
          setTimeout(() => {
            setPendingDeposit(null);
            setDepositStatus(null);
          }, 10000);
          return;
        }
        if (isActive) {
          setTimeout(checkDepositStatus, 10000);
        }
      }
    };

    const initialDelay = setTimeout(() => {
      checkDepositStatus();
    }, 3000);

    return () => {
      isActive = false;
      clearTimeout(initialDelay);
    };
  }, [pendingDeposit, onSuccess, onClose]);

  const handleDeposit = async () => {
    setError(null);
    
    if (!wallet) {
      setError('Кошелек не подключен');
      return;
    }

    if (!hotWalletAddress) {
      setError('Адрес депозита не загружен. Попробуйте еще раз.');
      return;
    }

    const depositAmount = parseFloat(amount);
    
    if (isNaN(depositAmount) || depositAmount <= 0) {
      setError('Введите корректную сумму');
      return;
    }

    try {
      setIsLoading(true);

      // Приоритет получения user_id: Telegram → user.id → wallet address
      const telegramUserId = getTelegramUserId();
      const userId = telegramUserId || user?.id || wallet.account.address;
      
      if (!userId) {
        throw new Error('Не удалось определить user_id для депозита');
      }

      // Создаем уникальный memo для отслеживания
      const memo = `DEP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Формируем payload с комментарием
      const payload = beginCell()
        .storeUint(0, 32) // op code для обычного перевода с комментарием
        .storeStringTail(memo)
        .endCell()
        .toBoc({ idx: false })
        .toString('base64');

      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 300, // 5 минут
        messages: [
          {
            address: hotWalletAddress,
            amount: toNano(depositAmount).toString(),
            payload: payload,
          },
        ],
      };

      // Отправляем транзакцию на подписание
      await tonConnectUI.sendTransaction(transaction);

      console.log('Deposit transaction sent', {
        amount: depositAmount,
        memo,
        hotWalletAddress,
        userId
      });

      // Сохраняем информацию о депозите для отслеживания
      setPendingDeposit({
        memo,
        amount: depositAmount,
        depositAddress: hotWalletAddress,
        userId: userId
      });

      // Не закрываем модальное окно, показываем статус
    } catch (err) {
      console.error('Deposit error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Ошибка при отправке транзакции';
      if (errorMessage.includes('User rejected') || errorMessage.includes('User cancelled') || errorMessage.includes('cancel')) {
        console.log('Transaction cancelled by user');
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Разрешаем только числа и точку
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setError(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="deposit-modal-overlay" onClick={onClose}>
      <div className="deposit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="deposit-modal-header">
          <h2 className="deposit-modal-title">Пополнить баланс</h2>
          <button className="deposit-modal-close" onClick={onClose}>×</button>
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

              {error && (
                <div className="deposit-error">{error}</div>
              )}

              {depositStatus === 'pending' && (
                <div className="deposit-status deposit-status-pending">
                  ⏳ Ожидание подтверждения транзакции...
                </div>
              )}

              {depositStatus === 'confirmed' && (
                <div className="deposit-status deposit-status-confirmed">
                  ✅ Депозит успешно подтвержден!
                </div>
              )}

              {depositStatus === 'failed' && (
                <div className="deposit-status deposit-status-failed">
                  ❌ Не удалось подтвердить депозит. Попробуйте еще раз.
                </div>
              )}

              {hotWalletAddress && (
                <div className="deposit-info">
                  <p className="deposit-info-text">
                    Транзакция будет отправлена на hot wallet адрес
                  </p>
                  <p className="deposit-address">
                    {hotWalletAddress.slice(0, 10)}...{hotWalletAddress.slice(-10)}
                  </p>
                </div>
              )}

              {!hotWalletAddress && !error && (
                <div className="deposit-info">
                  <p className="deposit-info-text">
                    Загрузка адреса депозита...
                  </p>
                </div>
              )}

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
                  disabled={isLoading || !amount || parseFloat(amount) <= 0}
                >
                  {isLoading ? 'Отправка...' : 'Отправить'}
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

