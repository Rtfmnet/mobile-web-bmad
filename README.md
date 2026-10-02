# Лист — заметки

Минимальный адаптивный сайт заметок. Войдите с одного аккаунта на телефоне и компьютере: заметки хранятся в Cloud Firestore и синхронизируются между устройствами. Android Studio не требуется.

## Стек

- React, TypeScript и Vite — интерфейс и сборка статического сайта.
- Firebase Authentication — регистрация и вход по email/паролю.
- Cloud Firestore — заметки; `firestore.rules` разрешает доступ только владельцу.
- Firebase Hosting — публикация сайта.

Firebase Web API key и остальные значения Web App config не являются серверными секретами. Доступ к заметкам защищают Authentication и Firestore Rules. Не добавляйте service-account credentials в браузер или репозиторий.

## Подготовка Firebase

1. Создайте Firebase project на плане Spark. Не подключайте Cloud Billing и не переходите на Blaze для этого проекта.
2. В **Authentication → Sign-in method** включите **Email/Password**.
3. Создайте базу в **Firestore Database** в режиме Production. Выберите регион рядом с пользователями.
4. Установите Firebase CLI и войдите:

   ```powershell
   npx firebase-tools login
   npx firebase-tools use --add
   ```

   Выберите созданный проект. Команда создаст `.firebaserc` с его идентификатором.
5. В **Project settings → Your apps** создайте Web App. Скопируйте `apiKey`, `authDomain`, `projectId` и `appId` в локальный `.env.local`:

   ```dotenv
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project
   VITE_FIREBASE_APP_ID=...
   ```

   `.env.local` игнорируется Git. Не отправляйте конфигурацию вместе с паролями от аккаунтов.
6. Опубликуйте правила и запустите сайт:

   ```powershell
   npm install
   npx firebase-tools deploy --only firestore:rules
   npm run dev
   ```

   Откройте URL, показанный Vite, зарегистрируйтесь и создайте заметку.

## Публикация

Для ручной публикации выполните:

```powershell
npm run build
npx firebase-tools deploy --only hosting,firestore:rules
```

Для автоматической публикации из GitHub подключите репозиторий в Firebase Hosting или запустите `npx firebase-tools init hosting:github` и следуйте подсказкам CLI. Деплой из GitHub потребует авторизации в вашей учётной записи.

Spark — бесплатный план с ограничениями: у Firestore 1 GiB хранения, 50 000 чтений, 20 000 записей и 20 000 удалений в день; у Hosting — 10 GB хранения файлов и 10 GB трафика в месяц. При превышении лимита на Spark соответствующий сервис может быть отключён до сброса квоты. Проверяйте текущие условия в Firebase Console.

## Проверки

```powershell
npm test
npm run test:rules
npm run build
```

Тесты правил запускают локальный Firestore Emulator через Firebase CLI. При пустой Firebase-конфигурации приложение показывает страницу настройки, а не имитирует синхронизацию.