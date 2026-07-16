# Kariakoo

A converted Kariakoo marketplace web app with Firebase and Google Maps integration.

## Setup

1. Create a Firebase project and enable Firestore.
2. Copy the values into the existing `.env` file.
3. Run `npm install`.
4. Run `npm run dev` for local development.

## Commands

- `npm install` - install dependencies
- `npm run dev` - start local development server
- `npm run build` - build production assets
- `npm run preview` - preview production build

## App structure

- `src/App.tsx` - main screen navigation and UI
- `src/firebase.ts` - Firebase auth and Firestore access
- `src/data.ts` - initial shop and product seed data
- `src/types.ts` - shared TypeScript types
- `src/App.css` - app styling
- `src/index.css` - base global styles
