# 🚀 Deployment Guide

## Архитектура деплоя

Приложение состоит из двух частей:
- **Frontend** (React + Vite) - деплоится на GitHub Pages (статический хостинг)
- **Backend** (Bicycle API в Docker) - должен быть развернут отдельно, так как GitHub Pages не поддерживает Docker

## Деплой Frontend на GitHub Pages

### Автоматический деплой через GitHub Actions

Workflow уже настроен в `.github/workflows/deploy.yml`. Он автоматически:
1. Собирает приложение при push в `main` или `master`
2. Использует переменные окружения из GitHub Secrets
3. Деплоит на GitHub Pages

### Настройка GitHub Pages

1. **Включите GitHub Pages в настройках репозитория:**
   - Перейдите в `Settings` → `Pages`
   - Source: выберите `GitHub Actions`

2. **Добавьте Secrets в настройках репозитория:**
   - Перейдите в `Settings` → `Secrets and variables` → `Actions`
   - Добавьте следующие secrets:
     - `VITE_BICYCLE_API_URL` - URL вашего Bicycle API бэкенда (например: `https://api.yourdomain.com`)
     - `VITE_BICYCLE_API_KEY` - API ключ для Bicycle API (если требуется)

### Ручной деплой (опционально)

Если нужно задеплоить вручную:
```bash
npm run build
npm run deploy
```

## Деплой Backend (Bicycle API в Docker)

GitHub Pages не может запускать Docker контейнеры, поэтому бэкенд нужно развернуть отдельно. Вот несколько вариантов:

### Вариант 1: VPS с Docker (рекомендуется для production)

1. **Арендуйте VPS** (например, на DigitalOcean, Hetzner, или другом провайдере)

2. **Установите Docker и Docker Compose:**
   ```bash
   # На Ubuntu/Debian
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   ```

3. **Запустите Bicycle API:**
   ```bash
   docker run -d -p 8081:8081 your-bicycle-image
   ```

4. **Настройте Nginx как reverse proxy** (опционально, для HTTPS):
   ```nginx
   server {
       listen 80;
       server_name api.yourdomain.com;
       
       location / {
           proxy_pass http://localhost:8081;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

5. **Настройте SSL** (например, через Let's Encrypt с Certbot)

### Вариант 2: Railway.app

Railway поддерживает Docker и может автоматически деплоить из Dockerfile:

1. Создайте аккаунт на [Railway.app](https://railway.app)
2. Создайте новый проект
3. Подключите репозиторий с Dockerfile или загрузите Docker образ
4. Railway автоматически предоставит URL (например: `https://your-app.railway.app`)
5. Используйте этот URL в `VITE_BICYCLE_API_URL`

### Вариант 3: Render.com

1. Создайте аккаунт на [Render.com](https://render.com)
2. Создайте новый Web Service
3. Подключите Dockerfile или Docker Compose
4. Render предоставит URL для вашего сервиса

### Вариант 4: Локальный бэкенд с туннелем (для тестирования)

Если бэкенд работает локально, можно использовать туннель:

1. **Используйте ngrok:**
   ```bash
   ngrok http 8081
   ```
   Получите публичный URL (например: `https://abc123.ngrok.io`)

2. **Или используйте Cloudflare Tunnel:**
   ```bash
   cloudflared tunnel --url http://localhost:8081
   ```

3. **Временно используйте этот URL** в `VITE_BICYCLE_API_URL` для тестирования

⚠️ **Важно:** Туннели не подходят для production, так как URL может меняться.

## Настройка переменных окружения

### Development (локально)

Создайте файл `.env.local`:
```env
VITE_BICYCLE_API_URL=http://localhost:8081
VITE_BICYCLE_API_KEY=your-api-key
```

В development режиме Vite proxy автоматически перенаправляет запросы к `/api/bicycle` на `localhost:8081`.

### Production (GitHub Pages)

Переменные окружения настраиваются через GitHub Secrets:
- `VITE_BICYCLE_API_URL` - публичный URL вашего бэкенда
- `VITE_BICYCLE_API_KEY` - API ключ (если требуется)

Эти переменные используются при сборке приложения в GitHub Actions.

## Проверка деплоя

После деплоя проверьте:

1. **Frontend доступен:** `https://x1zy.github.io/prepay/`

2. **Проверьте консоль браузера:**
   - Откройте DevTools (F12)
   - Перейдите на вкладку Network
   - Проверьте, что запросы к API идут на правильный URL
   - Если видите ошибки CORS - настройте CORS на бэкенде

3. **Проверьте работу API:**
   - Убедитесь, что бэкенд доступен по публичному URL
   - Проверьте, что API ключ (если используется) правильный

## Решение проблем

### CORS ошибки

Если видите ошибки CORS в консоли, настройте CORS на бэкенде:
```go
// Пример для Go
c.Header("Access-Control-Allow-Origin", "https://x1zy.github.io")
c.Header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
```

### 404 ошибки на API запросы

- Убедитесь, что `VITE_BICYCLE_API_URL` правильно настроен в GitHub Secrets
- Проверьте, что бэкенд доступен по указанному URL
- Проверьте логи GitHub Actions - возможно, переменные окружения не подставились при сборке

### Бэкенд недоступен

- Проверьте, что Docker контейнер запущен
- Проверьте firewall настройки на сервере
- Убедитесь, что порт 8081 открыт (или другой порт, который вы используете)

