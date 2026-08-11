# Kariakoo

A plain HTML/CSS/JavaScript frontend with Firebase and Google Maps integration, backed by PHP for configuration and backend access.

## Setup

1. Create a Firebase project and enable Firestore.
2. Copy the values into existing `.env`.
3. Run a PHP server from the project root, e.g.:
   - `php -S localhost:8000`
4. Open `http://localhost:8000` in the browser.

## Local PHP backend

- `index.php` - main frontend entrypoint
- `api/config.php` - serves Firebase and Google Maps configuration from `.env`

## Frontend files

- `app.js` - plain JavaScript app logic and screen navigation
- `firebase.js` - Firebase client setup and Firestore helpers
- `styles.css` - UI styling
- `src/data.js` - seed data for shops and products

## Notes

- The app keeps the same marketplace logic, vendor/customer flows, and map integration.
- `Firebase` is used only for Firestore, Authentication, and Analytics.
- The website is served locally from the device via PHP, not hosted by Firebase.
- `Firebase` settings are read from `.env` via the PHP backend.
- `Google Maps` uses the API key from the backend config.
