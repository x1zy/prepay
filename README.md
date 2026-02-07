# PrePay

[![.React ](https://img.shields.io/badge/-ReactJs-61DAFB?logo=react&logoColor=white&style=flat-square)](https://react.dev/)
[![.Vite ](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=Vite&logoColor=white)](https://https://vite.dev/)
[![.TypeScript ](https://shields.io/badge/TypeScript-3178C6?logo=TypeScript&logoColor=FFF&style=flat-square)](https://react.dev/)

## 📖 Documentation
Visit https://www.notion.so/C2C-26b669ba989280fe8fafed5405793e03 to view the full documentation.

## 🚀 Deployment

### Деплой на GitHub Pages

**Быстрая инструкция:** См. [GITHUB_PAGES_SETUP.md](./GITHUB_PAGES_SETUP.md) для пошаговой инструкции.

**Кратко:**
1. Включите GitHub Pages в Settings → Pages → Source: GitHub Actions
2. (Опционально) Добавьте Secrets: `VITE_BICYCLE_API_URL`, `VITE_BICYCLE_API_KEY`
3. Сделайте push в `main` - деплой произойдет автоматически

**Подробная документация:**
- [GITHUB_PAGES_SETUP.md](./GITHUB_PAGES_SETUP.md) - Пошаговая инструкция по деплою
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Полная документация по деплою и настройке бэкенда

### Быстрый старт для разработки

```bash
npm install
npm run dev
```

### Переменные окружения

- `VITE_API_URL` - URL бэкенд API сервера (для production)
- `VITE_BICYCLE_API_URL` - URL Bicycle API сервера
- `VITE_BICYCLE_API_KEY` - API ключ для Bicycle API

