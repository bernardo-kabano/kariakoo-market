<?php
header('X-Powered-By: PHP Kariakoo Backend');
?>
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Kariakoo Market</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <div id="root">Loading Kariakoo Market…</div>
    <script>
      window.addEventListener('error', (event) => {
        const root = document.getElementById('root')
        if (root) {
          root.innerHTML = `
            <div style="padding: 2rem; font-family: Inter, system-ui, sans-serif; color: #b91c1c; background: #fef2f2; border-radius: 18px;">
              <h1 style="margin-top:0;">Application error</h1>
              <p>${event.message}</p>
              <pre style="white-space: pre-wrap;">${event.filename}:${event.lineno}:${event.colno}</pre>
            </div>
          `
        }
      })
      window.addEventListener('unhandledrejection', (event) => {
        const root = document.getElementById('root')
        if (root) {
          root.innerHTML = `
            <div style="padding: 2rem; font-family: Inter, system-ui, sans-serif; color: #b91c1c; background: #fef2f2; border-radius: 18px;">
              <h1 style="margin-top:0;">Unhandled promise rejection</h1>
              <p>${event.reason?.message || event.reason}</p>
            </div>
          `
        }
      })
    </script>
    <script type="module" src="app.js"></script>
  </body>
</html>
