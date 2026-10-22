# SOUMYADIP.dev portfolio

The site includes a small Node.js server, a SQLite content database, and a password-protected editor. It needs **Node.js 24 or newer**; no npm packages are required.

## Run it locally

1. Copy `.env.example` to `.env`.
2. Set private `ADMIN_PASSWORD` and `INBOX_PASSWORD` values in `.env`. Do not publish `.env` or reuse passwords from other accounts.
3. Run `npm start`, then open <http://localhost:3000>. Opening `index.html` directly as a `file://` page will not work because the editor requires the server.
4. On desktop, type your numeric admin passcode to sign in; the hidden shortcut submits after you pause typing, or immediately if you press Enter. On a phone, press and hold a non-interactive area for about 2.2 seconds, then enter the passcode in the sign-in form. After successful sign-in, the animated “Hello, Boss!” welcome appears and the editor opens automatically.

The editor lets you update the profile text and photo, skills/arsenal sections, timeline entries, and projects. Changes are saved to SQLite and are served to visitors immediately. Uploaded photos are stored in `uploads/`.

## Private collaboration inbox

Valid collaboration form submissions are saved in the local SQLite database, including when automatic email delivery fails. The form tells visitors that messages are stored for follow-up. On desktop, type your four-digit inbox passcode to open the private inbox; the hidden shortcut submits after you pause typing, or immediately if you press Enter. On a phone, open the admin panel with a press-and-hold and select **Open private inbox**, then enter the passcode. The inbox shows sender names, email addresses, messages, and submission times. Select **Delete message** and confirm to permanently remove a message. Use **Lock inbox** to end the inbox session.

Inbox access uses an HTTP-only session cookie and is rate-limited. Messages are stored in `data/portfolio.sqlite` and remain there until the database is removed or the messages are otherwise managed.

## Enable collaboration email

The contact form sends submissions through the Node server to Web3Forms. The previous page had a placeholder access key, so it could never deliver messages. To activate delivery:

1. Create or sign in to a Web3Forms account and create a form/access key whose notification recipient is `soumyadipghara27@gmail.com`. Verify that address if Web3Forms asks.
2. Copy `.env.example` to `.env` in the project root and replace the blank `WEB3FORMS_ACCESS_KEY` with the real key from Web3Forms. On a hosted site, add the key as a secret/environment variable in the hosting dashboard instead. Never commit or share the key.
3. Restart/redeploy the server. The contact section shows whether a key is configured. Without one, submitting the form offers a link to open a prefilled Gmail draft in a separate tab; the visitor must sign in and press Send. If the API or email provider is unavailable, the form stays on the page and keeps the message available for retry or fallback.

Web3Forms sends notifications to the recipient configured for that access key; the site cannot choose or verify the mailbox by itself. “Inbox” means the recipient's Gmail inbox. If a successful submission does not show up there, also check Spam and Promotions, confirm the access key's recipient in Web3Forms, and verify any required email activation.

The access key is kept server-side; it is not sent to visitors' browsers. The server validates fields, rejects cross-origin submissions, applies a basic request limit, and reports delivery failures instead of showing false success.

## Deploy on a Node or Docker host

Use a host that supports Node.js 24 (or the included Dockerfile), and configure these environment variables in the host dashboard:

- `ADMIN_PASSWORD`: set a unique, private password of at least 12 characters.
- `INBOX_PASSWORD`: set a different unique, private password of at least 12 characters.
- `NODE_ENV`: `production`.
- `PORT`: the port supplied by your host, if it requires one.
- `DATABASE_PATH`: optional; defaults to `./data/portfolio.sqlite`. With Docker, the image defaults to `/data/portfolio.sqlite`.
- `WEB3FORMS_ACCESS_KEY`: required to enable collaboration-form email delivery. Store the real key as a hosting secret; do not commit it.

For Docker, build the image from this folder and mount a **persistent volume** at `/data`. Keep the app behind the host's HTTPS reverse proxy. The SQLite database and uploaded profile image must both survive restarts; mount persistent storage for `/data` and `/app/uploads` (or use a host with persistent application storage). Back up both.

Example local Docker run (after creating a private `.env` as described above):

```sh
docker build -t soumyadip-portfolio .
docker volume create portfolio-data
docker volume create portfolio-uploads
docker run -d --name portfolio -p 3000:3000 --env-file .env \
  -e NODE_ENV=production -e DATABASE_PATH=/data/portfolio.sqlite \
  -v portfolio-data:/data -v portfolio-uploads:/app/uploads \
  soumyadip-portfolio
```

Static-only services such as GitHub Pages cannot run this editor or preserve SQLite changes. A host that deletes local files on redeploy also needs persistent storage configured. Keep both passwords in the hosting provider's secret/environment settings, never in browser JavaScript or a committed file.
