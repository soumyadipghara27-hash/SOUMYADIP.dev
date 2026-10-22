const { createHash, randomBytes, scryptSync, timingSafeEqual } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const root = __dirname;
const port = Number(process.env.PORT || 3000);
const databasePath = path.resolve(process.env.DATABASE_PATH || path.join(root, 'data', 'portfolio.sqlite'));
const uploadDirectory = path.resolve(root, process.env.UPLOAD_DIRECTORY || 'uploads');
const isProduction = process.env.NODE_ENV === 'production';
const adminPassword = process.env.ADMIN_PASSWORD;
const inboxPassword = process.env.INBOX_PASSWORD;

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a valid TCP port.');
}
if (!adminPassword?.trim()) {
  throw new Error('Set ADMIN_PASSWORD to a non-empty admin password.');
}
if (!inboxPassword?.trim()) {
  throw new Error('Set INBOX_PASSWORD to a non-empty inbox password.');
}
if (isProduction && (adminPassword.length < 12 || inboxPassword.length < 12)) {
  throw new Error('Production admin and inbox passwords must each be at least 12 characters.');
}

fs.mkdirSync(path.dirname(databasePath), { recursive: true });
fs.mkdirSync(uploadDirectory, { recursive: true });

const database = new DatabaseSync(databasePath);
database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS site_content (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    content TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS inbox_sessions (
    token_hash TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS contact_messages (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    submitted_at TEXT NOT NULL
  );
`);

const initialContent = JSON.parse(
  fs.readFileSync(path.join(root, 'data', 'site-content.json'), 'utf8')
);
database.prepare(`
  INSERT OR IGNORE INTO site_content (id, content, updated_at)
  VALUES (1, ?, ?)
`).run(JSON.stringify(initialContent), new Date().toISOString());
const previousDefaultTimeline = [
  {
    date: 'ACADEMIC STREAM',
    title: 'Bachelor of Computer Applications (BCA)',
    description: 'Focusing on core computer science, C programming, algorithmic logic, and modern web architecture.'
  },
  {
    date: 'HACKATHON R&D // TEAM CRIMSON ECLIPSE',
    title: 'Smart India Hackathon (SIH) Innovator',
    description: 'Architected CyberTrace AI (SIH26106) for automated email threat detection, geolocation, and forensic analysis.'
  }
];
const savedContentRow = database.prepare('SELECT content FROM site_content WHERE id = 1').get();
const savedContent = JSON.parse(savedContentRow.content);
if (JSON.stringify(savedContent.timeline) === JSON.stringify(previousDefaultTimeline)) {
  savedContent.timeline = initialContent.timeline;
  database.prepare('UPDATE site_content SET content = ?, updated_at = ? WHERE id = 1')
    .run(JSON.stringify(savedContent), new Date().toISOString());
}

const adminPasswordSalt = randomBytes(16);
const adminPasswordHash = scryptSync(adminPassword, adminPasswordSalt, 64);
const sessionLifetime = 12 * 60 * 60 * 1000;
const sessionCookie = isProduction ? '__Host-portfolio_session' : 'portfolio_session';
const inboxSessionCookie = isProduction ? '__Host-portfolio_inbox_session' : 'portfolio_inbox_session';
const loginAttempts = new Map();
const inboxLoginAttempts = new Map();
const contactAttempts = new Map();
const inboxPasswordSalt = randomBytes(16);
const inboxPasswordHash = scryptSync(inboxPassword, inboxPasswordSalt, 64);
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

function sendJson(response, status, value, headers = {}) {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...headers
  });
  response.end(JSON.stringify(value));
}

function readJson(request, limit = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > limit) {
        reject(Object.assign(new Error('Request body is too large.'), { status: 413 }));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(Object.assign(new Error('Request must contain valid JSON.'), { status: 400 }));
      }
    });
    request.on('error', reject);
  });
}

function getContent() {
  const row = database.prepare('SELECT content FROM site_content WHERE id = 1').get();
  return JSON.parse(row.content);
}

function validateText(value, name, maxLength, required = true) {
  if (typeof value !== 'string' || (required && !value.trim()) || value.length > maxLength) {
    throw Object.assign(new Error(`${name} is required and must be at most ${maxLength} characters.`), {
      status: 400
    });
  }
  return value.trim();
}

function validateStringList(value, name, maxItems, maxLength) {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw Object.assign(new Error(`${name} must be a list with at most ${maxItems} entries.`), {
      status: 400
    });
  }
  return value.map((item, index) => validateText(item, `${name} item ${index + 1}`, maxLength));
}

function validateContent(content) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    throw Object.assign(new Error('Invalid site content.'), { status: 400 });
  }
  const profile = content.profile;
  if (!profile || typeof profile !== 'object') {
    throw Object.assign(new Error('Profile details are missing.'), { status: 400 });
  }

  const photo = validateText(profile.photo, 'Profile photo path', 220);
  if (!/^profile\.(png|jpe?g|webp)$/.test(photo)
      && !/^\/uploads\/avatar\.(png|jpg|webp)(\?v=\d+)?$/.test(photo)) {
    throw Object.assign(new Error('Profile photo path is invalid.'), { status: 400 });
  }

  if (!Array.isArray(content.skills) || !Array.isArray(content.projects) || !Array.isArray(content.timeline)) {
    throw Object.assign(new Error('Skills, projects, and timeline must be lists.'), { status: 400 });
  }
  const skills = content.skills;
  const projects = content.projects;
  const timeline = content.timeline;
  if (skills.length > 20 || projects.length > 100 || timeline.length > 30) {
    throw Object.assign(new Error('Too many portfolio entries.'), { status: 400 });
  }

  const ids = new Set();
  const validatedProjects = projects.map((project, index) => {
    if (!project || typeof project !== 'object' || Array.isArray(project)) {
      throw Object.assign(new Error(`Project ${index + 1} is invalid.`), { status: 400 });
    }
    const id = validateText(project.id, `Project ${index + 1} ID`, 80);
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || ids.has(id)) {
      throw Object.assign(new Error('Project IDs must be unique letters, numbers, underscores, or hyphens.'), {
        status: 400
      });
    }
    ids.add(id);
    return {
      id,
      code: validateText(project.code, 'Project label', 120),
      title: validateText(project.title, 'Project title', 120),
      description: validateText(project.description, 'Project description', 1200),
      stack: validateStringList(project.stack, 'Project tools', 20, 60)
    };
  });

  return {
    profile: {
      name: validateText(profile.name, 'Name', 100),
      subtitle: validateText(profile.subtitle, 'Subtitle', 120),
      badge: validateText(profile.badge, 'Profile badge', 50),
      developerStatus: validateText(profile.developerStatus, 'Developer status', 120),
      heroDescription: validateText(profile.heroDescription, 'Introduction', 600),
      roles: validateStringList(profile.roles, 'Role titles', 12, 80),
      aboutParagraphs: validateStringList(profile.aboutParagraphs, 'About paragraphs', 8, 1200),
      baseLocation: validateText(profile.baseLocation, 'Base location', 180),
      focus: validateText(profile.focus, 'Areas of focus', 180),
      photo
    },
    skills: skills.map((group, index) => {
      if (!group || typeof group !== 'object' || Array.isArray(group)) {
        throw Object.assign(new Error(`Arsenal group ${index + 1} is invalid.`), { status: 400 });
      }
      return {
        id: validateText(group.id, `Arsenal group ${index + 1} ID`, 80),
        title: validateText(group.title, 'Arsenal group title', 120),
        items: validateStringList(group.items, 'Arsenal items', 40, 80)
      };
    }),
    timeline: timeline.map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw Object.assign(new Error(`Timeline entry ${index + 1} is invalid.`), { status: 400 });
      }
      return {
        date: validateText(item.date, `Timeline entry ${index + 1} label`, 120),
        title: validateText(item.title, `Timeline entry ${index + 1} title`, 160),
        description: validateText(item.description, `Timeline entry ${index + 1} details`, 800)
      };
    }),
    projects: validatedProjects
  };
}

function getCookies(request) {
  return Object.fromEntries((request.headers.cookie || '')
    .split(';')
    .map((part) => part.trim().split(/=(.*)/s).slice(0, 2))
    .filter(([name, value]) => name && value !== undefined));
}

function sessionTokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

function getSession(request) {
  const token = getCookies(request)[sessionCookie];
  if (!token) return false;
  const session = database.prepare(
    'SELECT expires_at FROM admin_sessions WHERE token_hash = ?'
  ).get(sessionTokenHash(token));
  if (!session || session.expires_at <= Date.now()) {
    if (session) database.prepare('DELETE FROM admin_sessions WHERE token_hash = ?')
      .run(sessionTokenHash(token));
    return false;
  }
  return true;
}

function getInboxSession(request) {
  const token = getCookies(request)[inboxSessionCookie];
  if (!token) return false;
  const tokenHash = sessionTokenHash(token);
  const session = database.prepare(
    'SELECT expires_at FROM inbox_sessions WHERE token_hash = ?'
  ).get(tokenHash);
  if (!session || session.expires_at <= Date.now()) {
    if (session) database.prepare('DELETE FROM inbox_sessions WHERE token_hash = ?').run(tokenHash);
    return false;
  }
  return true;
}

function clearSession(response) {
  response.setHeader('Set-Cookie',
    `${sessionCookie}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${isProduction ? '; Secure' : ''}`);
}

function clearInboxSession(response) {
  response.setHeader('Set-Cookie',
    `${inboxSessionCookie}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${isProduction ? '; Secure' : ''}`);
}

function requireSameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) {
    throw Object.assign(new Error('Origin header is required.'), { status: 403 });
  }
  const forwardedProto = request.headers['x-forwarded-proto']?.split(',')[0].trim();
  const expectedOrigin = `${isProduction ? 'https' : (forwardedProto || 'http')}://${request.headers.host}`;
  if (origin !== expectedOrigin) {
    throw Object.assign(new Error('Cross-origin requests are not allowed.'), { status: 403 });
  }
}

function requireAdmin(request) {
  if (!getSession(request)) {
    throw Object.assign(new Error('Please sign in again to edit the portfolio.'), { status: 401 });
  }
}

function requireInbox(request) {
  if (!getInboxSession(request)) {
    throw Object.assign(new Error('Enter the inbox passcode to continue.'), { status: 401 });
  }
}

function getLoginStatus(address) {
  const now = Date.now();
  const current = loginAttempts.get(address);
  if (!current || current.resetAt <= now) {
    return { count: 0, resetAt: now + 10 * 60 * 1000 };
  }
  return current;
}

function checkRateLimit(attempts, address, maximum, windowMs) {
  const now = Date.now();
  const current = attempts.get(address);
  if (!current || current.resetAt <= now) {
    const next = { count: 1, resetAt: now + windowMs };
    attempts.set(address, next);
    return next;
  }
  current.count += 1;
  return current;
}

function getImageExtension(mime, bytes) {
  if (mime === 'image/png' && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return '.png';
  }
  if (mime === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return '.jpg';
  }
  if (mime === 'image/webp'
      && bytes.subarray(0, 4).toString() === 'RIFF'
      && bytes.subarray(8, 12).toString() === 'WEBP') {
    return '.webp';
  }
  throw Object.assign(new Error('Choose a valid PNG, JPEG, or WebP photo.'), { status: 400 });
}

async function handleApi(request, response, url) {
  const method = request.method;
  if (method === 'GET' && url.pathname === '/api/content') {
    return sendJson(response, 200, getContent());
  }

  if (method === 'GET' && url.pathname === '/api/contact/status') {
    return sendJson(response, 200, { configured: Boolean(process.env.WEB3FORMS_ACCESS_KEY) });
  }

  if (method === 'POST' && url.pathname === '/api/contact') {
    requireSameOrigin(request);
    const address = request.socket.remoteAddress || 'unknown';
    const rateLimit = checkRateLimit(contactAttempts, address, 5, 10 * 60 * 1000);
    if (rateLimit.count > 5) {
      return sendJson(response, 429, { error: 'Too many messages were sent. Please try again in a few minutes.' });
    }

    const body = await readJson(request, 16 * 1024);
    if (typeof body.botcheck === 'string' && body.botcheck.trim()) {
      return sendJson(response, 400, { error: 'Message could not be accepted.' });
    }
    const name = validateText(body.name, 'Name', 120);
    const email = validateText(body.email, 'Email address', 254);
    const message = validateText(body.message, 'Message', 5000);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return sendJson(response, 400, { error: 'Enter a valid email address.' });
    }
    database.prepare(`
      INSERT INTO contact_messages (name, email, message, submitted_at)
      VALUES (?, ?, ?, ?)
    `).run(name, email, message, new Date().toISOString());
    if (!process.env.WEB3FORMS_ACCESS_KEY) {
      return sendJson(response, 503, {
        saved: true,
        error: 'Email delivery is not configured yet. Please use the direct email link instead.'
      });
    }

    let providerResponse;
    try {
      providerResponse = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          access_key: process.env.WEB3FORMS_ACCESS_KEY,
          name,
          email,
          message,
          subject: 'New Collaboration Message from SOUMYADIP.dev',
          from_name: 'SOUMYADIP.dev Portfolio'
        }),
        signal: AbortSignal.timeout(12_000)
      });
    } catch (error) {
      console.error('Contact delivery provider request failed:', error.name);
      return sendJson(response, 502, {
        saved: true,
        error: 'The email service is unreachable. Please use the direct email link.'
      });
    }
    const providerBody = await providerResponse.text();
    let providerResult;
    try {
      providerResult = JSON.parse(providerBody);
    } catch {
      console.error(
        'Contact delivery provider returned a non-JSON response:',
        providerResponse.status,
        providerResponse.headers.get('content-type') || 'unknown content type'
      );
      return sendJson(response, 502, {
        saved: true,
        error: 'The email service returned an invalid response. Please try again later.'
      });
    }
    if (!providerResponse.ok || providerResult.success !== true) {
      console.error('Contact delivery provider rejected a message:', providerResult.message || providerResponse.status);
      return sendJson(response, 502, {
        saved: true,
        error: 'The email service could not deliver your message. Please use the direct email link.'
      });
    }
    return sendJson(response, 200, { sent: true, message: 'Message sent successfully. Thank you for reaching out.' });
  }

  if (method === 'POST' && url.pathname === '/api/auth/login') {
    requireSameOrigin(request);
    const address = request.socket.remoteAddress || 'unknown';
    const status = getLoginStatus(address);
    if (status.count >= 8) {
      return sendJson(response, 429, { error: 'Too many sign-in attempts. Try again in a few minutes.' });
    }

    const body = await readJson(request, 4096);
    const password = typeof body.password === 'string' ? body.password : '';
    const candidate = scryptSync(password, adminPasswordSalt, 64);
    if (!timingSafeEqual(candidate, adminPasswordHash)) {
      status.count += 1;
      loginAttempts.set(address, status);
      return sendJson(response, 401, { error: 'Password not accepted.' });
    }

    loginAttempts.delete(address);
    const token = randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + sessionLifetime;
    database.prepare('INSERT INTO admin_sessions (token_hash, expires_at) VALUES (?, ?)')
      .run(sessionTokenHash(token), expiresAt);
    return sendJson(response, 200, { authenticated: true }, {
      'Set-Cookie': `${sessionCookie}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${sessionLifetime / 1000}${isProduction ? '; Secure' : ''}`
    });
  }

  if (method === 'GET' && url.pathname === '/api/auth/session') {
    return sendJson(response, 200, { authenticated: getSession(request) });
  }

  if (method === 'POST' && url.pathname === '/api/inbox/login') {
    requireSameOrigin(request);
    const address = request.socket.remoteAddress || 'unknown';
    const status = checkRateLimit(inboxLoginAttempts, address, 8, 10 * 60 * 1000);
    if (status.count > 8) {
      return sendJson(response, 429, { error: 'Too many inbox sign-in attempts. Try again in a few minutes.' });
    }

    const body = await readJson(request, 4096);
    const password = typeof body.password === 'string' ? body.password : '';
    const candidate = scryptSync(password, inboxPasswordSalt, 64);
    if (!timingSafeEqual(candidate, inboxPasswordHash)) {
      return sendJson(response, 401, { error: 'Inbox passcode not accepted.' });
    }

    inboxLoginAttempts.delete(address);
    const token = randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + sessionLifetime;
    database.prepare('INSERT INTO inbox_sessions (token_hash, expires_at) VALUES (?, ?)')
      .run(sessionTokenHash(token), expiresAt);
    return sendJson(response, 200, { authenticated: true }, {
      'Set-Cookie': `${inboxSessionCookie}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${sessionLifetime / 1000}${isProduction ? '; Secure' : ''}`
    });
  }

  if (method === 'GET' && url.pathname === '/api/inbox/messages') {
    requireInbox(request);
    const messages = database.prepare(`
      SELECT id, name, email, message, submitted_at AS submittedAt
      FROM contact_messages
      ORDER BY id DESC
    `).all();
    return sendJson(response, 200, { messages });
  }

  if (method === 'DELETE' && /^\/api\/inbox\/messages\/\d+$/.test(url.pathname)) {
    requireSameOrigin(request);
    requireInbox(request);
    const id = Number(url.pathname.split('/').at(-1));
    const result = database.prepare('DELETE FROM contact_messages WHERE id = ?').run(id);
    if (result.changes === 0) {
      return sendJson(response, 404, { error: 'Message not found.' });
    }
    return sendJson(response, 200, { deleted: true });
  }

  if (method === 'POST' && url.pathname === '/api/inbox/logout') {
    requireSameOrigin(request);
    const token = getCookies(request)[inboxSessionCookie];
    if (token) {
      database.prepare('DELETE FROM inbox_sessions WHERE token_hash = ?').run(sessionTokenHash(token));
    }
    clearInboxSession(response);
    return sendJson(response, 200, { authenticated: false });
  }

  if (method === 'POST' && url.pathname === '/api/auth/logout') {
    requireSameOrigin(request);
    const token = getCookies(request)[sessionCookie];
    if (token) {
      database.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(sessionTokenHash(token));
    }
    clearSession(response);
    return sendJson(response, 200, { authenticated: false });
  }

  if (method === 'PUT' && url.pathname === '/api/content') {
    requireSameOrigin(request);
    requireAdmin(request);
    const body = await readJson(request);
    const content = validateContent(body);
    database.prepare('UPDATE site_content SET content = ?, updated_at = ? WHERE id = 1')
      .run(JSON.stringify(content), new Date().toISOString());
    return sendJson(response, 200, { saved: true, content });
  }

  if (method === 'POST' && url.pathname === '/api/profile-image') {
    requireSameOrigin(request);
    requireAdmin(request);
    const body = await readJson(request, 8 * 1024 * 1024);
    if (typeof body.data !== 'string' || body.data.length > 7 * 1024 * 1024) {
      throw Object.assign(new Error('Photo must be smaller than 5 MB.'), { status: 413 });
    }
    const bytes = Buffer.from(body.data, 'base64');
    if (!bytes.length || bytes.length > 5 * 1024 * 1024) {
      throw Object.assign(new Error('Photo must be smaller than 5 MB.'), { status: 413 });
    }
    const extension = getImageExtension(body.mime, bytes);
    const filename = `avatar${extension}`;
    for (const oldExtension of ['.png', '.jpg', '.webp']) {
      const oldPath = path.join(uploadDirectory, `avatar${oldExtension}`);
      if (oldExtension !== extension && fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    fs.writeFileSync(path.join(uploadDirectory, filename), bytes, { mode: 0o644 });
    return sendJson(response, 200, { path: `/uploads/${filename}?v=${Date.now()}` });
  }

  return sendJson(response, 404, { error: 'API route not found.' });
}

function serveStatic(request, response, url) {
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return sendJson(response, 400, { error: 'Invalid URL path.' });
  }

  if (pathname === '/') pathname = '/index.html';
  const topLevelAsset = ['/index.html', '/profile.png', '/profile.jpg'].includes(pathname);
  if (!topLevelAsset && !/^\/(css|js|uploads)\//.test(pathname)) {
    return sendJson(response, 404, { error: 'File not found.' });
  }
  const requestedPath = pathname.startsWith('/uploads/')
    ? path.resolve(uploadDirectory, pathname.slice('/uploads/'.length))
    : path.resolve(root, `.${pathname}`);
  const cssDirectory = path.join(root, 'css');
  const jsDirectory = path.join(root, 'js');
  const isUpload = requestedPath.startsWith(`${uploadDirectory}${path.sep}`);
  const isProfileUpload = /^\/uploads\/avatar\.(png|jpg|webp)$/.test(pathname);
  const isCssAsset = pathname.startsWith('/css/')
    && requestedPath.startsWith(`${cssDirectory}${path.sep}`);
  const isJavaScriptAsset = pathname.startsWith('/js/')
    && requestedPath.startsWith(`${jsDirectory}${path.sep}`);
  if (!topLevelAsset && !isCssAsset && !isJavaScriptAsset && !(isUpload && isProfileUpload)) {
    return sendJson(response, 404, { error: 'File not found.' });
  }
  if (!fs.existsSync(requestedPath) || !fs.statSync(requestedPath).isFile()) {
    return sendJson(response, 404, { error: 'File not found.' });
  }

  const extension = path.extname(requestedPath).toLowerCase();
  response.writeHead(200, {
    'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=3600',
    'Content-Length': fs.statSync(requestedPath).size,
    'Content-Type': mimeTypes[extension] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'"
    ].join('; ')
  });
  if (request.method === 'HEAD') return response.end();
  fs.createReadStream(requestedPath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) {
      await handleApi(request, response, url);
    } else if (request.method === 'GET' || request.method === 'HEAD') {
      serveStatic(request, response, url);
    } else {
      sendJson(response, 405, { error: 'Method not allowed.' }, { Allow: 'GET, HEAD' });
    }
  } catch (error) {
    if (response.headersSent || response.destroyed) return;
    if (error.status && error.status < 500) {
      return sendJson(response, error.status, { error: error.message });
    }
    console.error('Request failed:', error);
    sendJson(response, 500, { error: 'The server could not complete this request.' });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Portfolio server listening on port ${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => {
      database.close();
      process.exit(0);
    });
  });
}
