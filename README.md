# SOUMYADIP.dev portfolio

The site includes a small Node.js server, a SQLite content database, and a password-protected editor. It needs **Node.js 24 or newer**; no npm packages are required.

## Run it locally

1. Copy `.env.example` to `.env`.
2. Set private `ADMIN_PASSWORD` and `INBOX_PASSWORD` values in `.env`. Do not publish `.env` or reuse passwords from other accounts.
3. Run `npm start`, then open <http://localhost:3000>. Opening `index.html` directly as a `file://` page will not work because the editor requires the server.
4. On desktop, press **Ctrl/Cmd+Shift+E** to open the editor sign-in, then enter your admin password. The local numeric passcode shortcut also submits after you pause typing, or immediately if you press Enter. On a phone, press and hold a non-interactive area for about 2.2 seconds, then enter the password in the sign-in form. After successful sign-in, the animated “Hello, Boss!” welcome appears and the editor opens automatically.

The editor lets you update the profile text and photo, skills/arsenal sections, timeline entries, and projects. Changes are saved to SQLite and are served to visitors immediately. Uploaded photos are stored in `uploads/`.

## Private collaboration inbox

Valid collaboration form submissions are saved in the local SQLite database, including when automatic email delivery fails. The form tells visitors that messages are stored for follow-up. On desktop, sign in to the editor and select **Open private inbox**; on a phone, open the admin panel with a press-and-hold and select **Open private inbox**. Enter the inbox password when prompted. The inbox shows sender names, email addresses, messages, and submission times. Select **Delete message** and confirm to permanently remove a message. Use **Lock inbox** to end the inbox session.

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
- `UPLOAD_DIRECTORY`: optional; defaults to `./uploads`.
- `WEB3FORMS_ACCESS_KEY`: required to enable collaboration-form email delivery. Store the real key as a hosting secret; do not commit it.

For Docker, build the image from this folder and mount a **persistent volume** at `/data`. Keep the app behind the host's HTTPS reverse proxy. The SQLite database and uploaded profile image must both survive restarts; mount persistent storage for `/data` and `/app/uploads` (or use a host with persistent application storage). Back up both.

### Deploy the full app to Render

GitHub Pages only serves the static portfolio files; it cannot run this app's Node.js API, editor, private inbox, or SQLite database. To enable those features:

1. Sign in to Render with GitHub, choose **New → Blueprint**, and connect this repository.
2. Review the service settings from `render.yaml` and create the Blueprint. It configures a Node web service and a persistent disk for the database and uploaded profile photos. Persistent disks require a paid Render instance.
3. When prompted, enter different private `ADMIN_PASSWORD` and `INBOX_PASSWORD` values, each at least 12 characters. Keep them only in Render's environment settings; never put them in `render.yaml`, GitHub, or this README.
4. After deployment succeeds, open the Render service URL. Press **Ctrl/Cmd+Shift+E** to open editor sign-in. Sign in there, then select **Open private inbox** to access messages.

The GitHub Pages URL remains a static-only copy; share the Render service URL for the fully working app. Render starts with the checked-in `data/site-content.json` defaults. The ignored local SQLite database is not uploaded, so locally saved editor changes and inbox messages do not migrate; re-enter any desired portfolio edits through the deployed editor.

To enable automatic collaboration-email delivery, add `WEB3FORMS_ACCESS_KEY` as a private environment variable in the Render service settings, then redeploy. Without it, collaboration submissions can still be stored in the persistent inbox, but automatic email notifications are unavailable.

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
