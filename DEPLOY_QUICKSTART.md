# 🚀 Быстрый старт деплоя

## Шаг 1: Разверните бэкенд (Bicycle API)

Выберите один из вариантов:

### Вариант A: VPS с Docker
```bash
# На вашем VPS
docker run -d -p 8081:8081 your-bicycle-image
# Получите публичный URL (например: https://api.yourdomain.com)
```

### Вариант B: Railway.app
1. Зарегистрируйтесь на [railway.app](https://railway.app)
2. Создайте новый проект с Docker
3. Получите URL (например: `https://your-app.railway.app`)

### Вариант C: Render.com
1. Зарегистрируйтесь на [render.com](https://render.com)
2. Создайте Web Service с Docker
3. Получите URL

## Шаг 2: Настройте GitHub Secrets

1. Перейдите в ваш репозиторий на GitHub
2. `Settings` → `Secrets and variables` → `Actions`
3. Добавьте следующие secrets:
   - **`VITE_BICYCLE_API_URL`** - URL вашего бэкенда (например: `https://api.yourdomain.com`)
   - **`VITE_BICYCLE_API_KEY`** - API ключ (если требуется)

## Шаг 3: Включите GitHub Pages

1. `Settings` → `Pages`
2. Source: выберите **`GitHub Actions`**

## Шаг 4: Задеплойте

### Автоматический деплой (рекомендуется)
Просто сделайте push в ветку `main` или `master`:
```bash
git add .
git commit -m "Deploy to GitHub Pages"
git push origin main
```

GitHub Actions автоматически соберет и задеплоит приложение.

### Ручной деплой
```bash
npm run build
npm run deploy
```

## Шаг 5: Проверьте результат

1. Откройте `https://x1zy.github.io/prepay/`
2. Откройте DevTools (F12) → Network
3. Проверьте, что запросы к API идут на правильный URL

## Решение проблем

### CORS ошибки
Настройте CORS на бэкенде, разрешив запросы с `https://x1zy.github.io`

### 404 на API запросы
- Проверьте, что `VITE_BICYCLE_API_URL` правильно установлен в GitHub Secrets
- Убедитесь, что бэкенд доступен по указанному URL

### Бэкенд недоступен
- Проверьте, что Docker контейнер запущен
- Проверьте firewall настройки
- Убедитесь, что порт открыт

## Подробная документация

См. [DEPLOYMENT.md](./DEPLOYMENT.md) для детальной информации.



