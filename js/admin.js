const adminModal = document.getElementById('admin-modal');
const adminLoginForm = document.getElementById('admin-login-form');
const adminLoginMessage = document.getElementById('admin-login-message');
const adminEditor = document.getElementById('admin-editor');
const adminWelcome = document.getElementById('admin-welcome');
const adminContent = document.getElementById('admin-editor-content');
const adminSaveMessage = document.getElementById('admin-save-message');
const inboxModal = document.getElementById('inbox-modal');
const inboxLoginForm = document.getElementById('inbox-login-form');
const inboxStatus = document.getElementById('inbox-status');
const inboxMessages = document.getElementById('inbox-messages');
const inboxLogout = document.getElementById('inbox-logout');
let editableContent;
let activeAdminTab = 'profile';
let holdStart;
let holdTimer;
let keyCodeBuffer = '';
let keyCodeTimer;

function escapeAdminText(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function showAdminModal({ requirePassword = false } = {}) {
  adminModal.classList.add('active');
  adminModal.setAttribute('aria-hidden', 'false');
  adminLoginMessage.textContent = '';
  adminSaveMessage.textContent = '';
  adminLoginForm.hidden = false;
  adminWelcome.hidden = true;
  adminEditor.hidden = true;
  document.getElementById('admin-password').value = '';

  if (location.protocol === 'file:') {
    adminLoginMessage.textContent = 'Start the site server first: run npm start, then open http://localhost:3000.';
    return;
  }

  if (requirePassword) {
    document.getElementById('admin-password').focus();
    return;
  }

  fetch('/api/auth/session', { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) throw new Error('Could not verify the admin session.');
      return response.json();
    })
    .then(async (result) => {
      if (result.authenticated) return showWelcome().catch(showEditorLoadError);
      document.getElementById('admin-password').focus();
    })
    .catch((error) => {
      adminLoginMessage.textContent = error.message;
    });
}

function closeAdminModal() {
  adminModal.classList.remove('active');
  adminModal.setAttribute('aria-hidden', 'true');
}

function closeInboxModal() {
  inboxModal.classList.remove('active');
  inboxModal.setAttribute('aria-hidden', 'true');
}

function renderInboxMessages(messages) {
  inboxMessages.replaceChildren();
  inboxStatus.textContent = messages.length
    ? `${messages.length} collaboration message${messages.length === 1 ? '' : 's'}`
    : 'No collaboration messages have been submitted yet.';

  messages.forEach((message) => {
    const article = document.createElement('article');
    article.className = 'inbox-message';
    const heading = document.createElement('h3');
    heading.textContent = message.name;
    const email = document.createElement('a');
    email.href = `mailto:${encodeURIComponent(message.email)}`;
    email.textContent = message.email;
    const date = document.createElement('time');
    date.dateTime = message.submittedAt;
    date.textContent = new Date(message.submittedAt).toLocaleString();
    const body = document.createElement('p');
    body.textContent = message.message;
    const deleteButton = document.createElement('button');
    deleteButton.className = 'inbox-delete-btn';
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete message';
    deleteButton.addEventListener('click', () => deleteInboxMessage(message.id, deleteButton));
    article.append(heading, email, date, body, deleteButton);
    inboxMessages.append(article);
  });

  inboxLoginForm.hidden = true;
  inboxMessages.hidden = false;
  inboxLogout.hidden = false;
}

async function deleteInboxMessage(id, button) {
  if (!window.confirm('Delete this collaboration message permanently?')) return;
  button.disabled = true;
  inboxStatus.textContent = 'Deleting message...';
  try {
    const response = await fetch(`/api/inbox/messages/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not delete the message.');
    await loadInboxMessages();
  } catch (error) {
    inboxStatus.textContent = error.message;
    button.disabled = false;
  }
}

async function loadInboxMessages() {
  const response = await fetch('/api/inbox/messages', { cache: 'no-store' });
  const result = await response.json();
  if (response.status === 401) {
    inboxLoginForm.hidden = false;
    inboxMessages.hidden = true;
    inboxLogout.hidden = true;
    inboxStatus.textContent = '';
    document.getElementById('inbox-password').focus();
    return;
  }
  if (!response.ok) throw new Error(result.error || 'Could not load the private inbox.');
  renderInboxMessages(result.messages);
}

async function openInboxModal(passcode) {
  inboxModal.classList.add('active');
  inboxModal.setAttribute('aria-hidden', 'false');
  inboxLoginForm.hidden = true;
  inboxMessages.hidden = true;
  inboxLogout.hidden = true;
  inboxStatus.textContent = 'Checking inbox access...';
  try {
    if (passcode) {
      const response = await fetch('/api/inbox/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passcode })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Inbox sign-in failed.');
    }
    await loadInboxMessages();
  } catch (error) {
    inboxLoginForm.hidden = false;
    inboxStatus.textContent = error.message;
    document.getElementById('inbox-password').focus();
  }
}

async function showEditor() {
  const response = await fetch('/api/content', { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load the saved portfolio content.');
  editableContent = await response.json();
  adminLoginForm.hidden = true;
  adminWelcome.hidden = true;
  adminEditor.hidden = false;
  renderAdminTab();
}

async function showWelcome() {
  adminLoginForm.hidden = true;
  adminEditor.hidden = true;
  adminWelcome.hidden = false;
  adminWelcome.classList.remove('is-visible');
  void adminWelcome.offsetWidth;
  adminWelcome.classList.add('is-visible');
  await new Promise((resolve) => window.setTimeout(resolve, 1600));
  await showEditor();
}

function showEditorLoadError(error) {
  adminLoginForm.hidden = true;
  adminEditor.hidden = true;
  adminWelcome.hidden = false;
  adminWelcome.classList.remove('is-visible');
  adminWelcome.querySelector('.admin-welcome-eyebrow').textContent = 'ADMIN ACCESS // VERIFIED';
  adminWelcome.querySelector('h3').textContent = 'Access granted';
  adminWelcome.querySelector('p:last-child').textContent =
    `Signed in, but the editor could not load: ${error.message}`;
  adminWelcome.classList.add('is-visible');
}

async function authenticateAdmin(password) {
  if (location.protocol === 'file:') {
    adminWelcome.hidden = true;
    adminLoginForm.hidden = false;
    adminLoginMessage.textContent = 'This editor needs the server. Run npm start, then open http://localhost:3000.';
    return;
  }

  adminLoginForm.hidden = true;
  adminEditor.hidden = true;
  adminWelcome.hidden = false;
  adminWelcome.classList.remove('is-visible');
  adminWelcome.querySelector('.admin-welcome-eyebrow').textContent = 'VERIFYING ADMIN ACCESS...';
  adminWelcome.querySelector('h3').textContent = 'Checking passcode';
  adminWelcome.querySelector('.admin-welcome-orbit').hidden = true;

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Sign-in failed.');
    adminWelcome.querySelector('.admin-welcome-eyebrow').textContent = 'ADMIN ACCESS // VERIFIED';
    adminWelcome.querySelector('h3').textContent = 'Hello, Boss!';
    adminWelcome.querySelector('p:last-child').textContent = 'Welcome back to your admin section.';
    adminWelcome.querySelector('.admin-welcome-orbit').hidden = false;
  } catch (error) {
    adminWelcome.hidden = true;
    adminLoginForm.hidden = false;
    adminLoginMessage.textContent = error.message;
    document.getElementById('admin-password').focus();
    return;
  }

  try {
    await showWelcome();
  } catch (error) {
    showEditorLoadError(error);
  }
}

document.getElementById('admin-close').addEventListener('click', closeAdminModal);
document.getElementById('open-inbox').addEventListener('click', openInboxModal);
adminModal.addEventListener('click', (event) => {
  if (event.target === adminModal) closeAdminModal();
});
document.getElementById('inbox-close').addEventListener('click', closeInboxModal);
inboxModal.addEventListener('click', (event) => {
  if (event.target === inboxModal) closeInboxModal();
});

function submitHiddenPasscode() {
  const passcode = keyCodeBuffer;
  keyCodeBuffer = '';
  window.clearTimeout(keyCodeTimer);
  if (!/^(?:\d{4}|\d{6})$/.test(passcode)) return;

  if (passcode.length === 4) {
    openInboxModal(passcode);
  } else {
    adminModal.classList.add('active');
    adminModal.setAttribute('aria-hidden', 'false');
    adminLoginMessage.textContent = '';
    authenticateAdmin(passcode);
  }
}

window.addEventListener('keydown', (event) => {
  const isEditable = event.target instanceof HTMLElement
    && (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName));
  if (isEditable || event.metaKey || event.ctrlKey || event.altKey) return;
  if (/^\d$/.test(event.key)) {
    event.preventDefault();
    keyCodeBuffer = `${keyCodeBuffer}${event.key}`.slice(-6);
    window.clearTimeout(keyCodeTimer);
    keyCodeTimer = window.setTimeout(submitHiddenPasscode, 900);
  } else if (event.key === 'Enter') {
    submitHiddenPasscode();
  } else if (event.key === 'Escape') {
    keyCodeBuffer = '';
    window.clearTimeout(keyCodeTimer);
    if (inboxModal.classList.contains('active')) closeInboxModal();
    else if (adminModal.classList.contains('active')) closeAdminModal();
  } else {
    keyCodeBuffer = '';
    window.clearTimeout(keyCodeTimer);
  }
});

inboxLoginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = inboxLoginForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  inboxStatus.textContent = 'Checking inbox passcode...';
  try {
    const response = await fetch('/api/inbox/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: new FormData(inboxLoginForm).get('password') })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Inbox sign-in failed.');
    inboxLoginForm.reset();
    await loadInboxMessages();
  } catch (error) {
    inboxLoginForm.hidden = false;
    inboxStatus.textContent = error.message;
    document.getElementById('inbox-password').value = '';
    document.getElementById('inbox-password').focus();
  } finally {
    submit.disabled = false;
  }
});

inboxLogout.addEventListener('click', async () => {
  inboxLogout.disabled = true;
  try {
    const response = await fetch('/api/inbox/logout', { method: 'POST' });
    if (!response.ok) throw new Error('Could not lock the inbox.');
    inboxMessages.hidden = true;
    inboxLogout.hidden = true;
    inboxLoginForm.hidden = false;
    inboxStatus.textContent = 'Inbox locked.';
    document.getElementById('inbox-password').focus();
  } catch (error) {
    inboxStatus.textContent = error.message;
  } finally {
    inboxLogout.disabled = false;
  }
});

function isInteractiveTarget(target) {
  return target instanceof Element
    && Boolean(target.closest('input, textarea, select, button, a, [role="button"], .modal-backdrop'));
}

document.addEventListener('pointerdown', (event) => {
  if (event.pointerType !== 'touch' || isInteractiveTarget(event.target)) return;
  holdStart = { x: event.clientX, y: event.clientY };
  holdTimer = window.setTimeout(() => {
    holdStart = undefined;
    showAdminModal({ requirePassword: true });
  }, 2200);
});

function cancelHold(event) {
  if (!holdStart || typeof holdStart !== 'object') return;
  if (event.type === 'pointermove'
      && Math.hypot(event.clientX - holdStart.x, event.clientY - holdStart.y) < 12) return;
  window.clearTimeout(holdTimer);
  holdStart = undefined;
}

document.addEventListener('pointerup', cancelHold);
document.addEventListener('pointercancel', cancelHold);
document.addEventListener('pointermove', cancelHold);

adminLoginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = adminLoginForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  adminLoginMessage.textContent = 'Checking password...';
  try {
    await authenticateAdmin(new FormData(adminLoginForm).get('password'));
  } finally {
    submit.disabled = false;
  }
});

document.getElementById('admin-logout').addEventListener('click', async () => {
  try {
    const response = await fetch('/api/auth/logout', { method: 'POST' });
    if (!response.ok) throw new Error('Could not sign out.');
    closeAdminModal();
  } catch (error) {
    adminSaveMessage.textContent = error.message;
  }
});

document.querySelectorAll('[data-admin-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    readCurrentAdminTab();
    activeAdminTab = button.dataset.adminTab;
    renderAdminTab();
  });
});

function renderAdminTab() {
  document.querySelectorAll('[data-admin-tab]').forEach((button) => {
    const selected = button.dataset.adminTab === activeAdminTab;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-selected', String(selected));
  });
  if (activeAdminTab === 'profile') renderProfileForm();
  if (activeAdminTab === 'skills') renderSkillsForm();
  if (activeAdminTab === 'timeline') renderTimelineForm();
  if (activeAdminTab === 'projects') renderProjectsForm();
}

function editorActions() {
  return '<div class="admin-actions"><button class="btn-primary" type="submit">Save changes</button></div>';
}

function inputField(label, field, value, type = 'text') {
  return `<label class="admin-field">${escapeAdminText(label)}<input type="${type}" data-field="${field}" value="${escapeAdminText(value)}" required /></label>`;
}

function textareaField(label, field, value, hint = '') {
  return `<label class="admin-field">${escapeAdminText(label)}${hint ? `<small>${escapeAdminText(hint)}</small>` : ''}<textarea data-field="${field}" rows="3" required>${escapeAdminText(value)}</textarea></label>`;
}

function renderProfileForm() {
  const profile = editableContent.profile;
  adminContent.innerHTML = `
    <form class="admin-form" data-editor-form="profile">
      <div class="admin-form-grid">
        ${inputField('Display name', 'name', profile.name)}
        ${inputField('Subtitle', 'subtitle', profile.subtitle)}
        ${inputField('Profile badge', 'badge', profile.badge)}
        ${inputField('Developer status line', 'developerStatus', profile.developerStatus)}
        ${textareaField('Hero introduction', 'heroDescription', profile.heroDescription)}
        ${textareaField('Animated role titles', 'roles', profile.roles.join('\n'), 'Put one role on each line.')}
        ${textareaField('About paragraph 1', 'about-0', profile.aboutParagraphs[0] || '')}
        ${textareaField('About paragraph 2', 'about-1', profile.aboutParagraphs[1] || '')}
        ${textareaField('Base location', 'baseLocation', profile.baseLocation)}
        ${textareaField('Core focus', 'focus', profile.focus)}
      </div>
      <div class="admin-photo-editor">
        <img class="admin-photo-preview" data-photo-preview src="${escapeAdminText(profile.photo)}" alt="Current profile photo" />
        <label class="admin-field admin-upload">Change profile photo <small>Select a new PNG, JPEG, or WebP image (up to 5 MB), then press Save changes.</small><input type="file" data-field="photoFile" accept="image/png,image/jpeg,image/webp" /></label>
      </div>
      ${editorActions()}
    </form>`;
}

adminContent.addEventListener('change', (event) => {
  if (!event.target.matches('[data-field="photoFile"]')) return;
  const file = event.target.files[0];
  if (!file) return;
  const preview = adminContent.querySelector('[data-photo-preview]');
  if (preview.dataset.previewUrl) URL.revokeObjectURL(preview.dataset.previewUrl);
  const previewUrl = URL.createObjectURL(file);
  preview.src = previewUrl;
  preview.dataset.previewUrl = previewUrl;
});

function renderSkillsForm() {
  adminContent.innerHTML = `
    <form class="admin-form" data-editor-form="skills">
      <div class="admin-entry-list">${editableContent.skills.map((group, index) => `
        <article class="admin-entry" data-entry-index="${index}" data-entry-id="${escapeAdminText(group.id)}">
          ${inputField('Section title', 'title', group.title)}
          ${textareaField('Skills / tools', 'items', group.items.join('\n'), 'Put one skill on each line.')}
          <button type="button" class="admin-secondary" data-remove-entry>Remove section</button>
        </article>`).join('')}</div>
      <div class="admin-actions">
        <button type="button" class="admin-secondary" data-add-entry>Add arsenal section</button>
        <button class="btn-primary" type="submit">Save changes</button>
      </div>
    </form>`;
}

function renderTimelineForm() {
  adminContent.innerHTML = `
    <form class="admin-form" data-editor-form="timeline">
      <div class="admin-entry-list">${editableContent.timeline.map((item, index) => `
        <article class="admin-entry" data-entry-index="${index}">
          ${inputField('Label', 'date', item.date)}
          ${inputField('Title', 'title', item.title)}
          ${textareaField('Details', 'description', item.description)}
          <button type="button" class="admin-secondary" data-remove-entry>Remove entry</button>
        </article>`).join('')}</div>
      <div class="admin-actions">
        <button type="button" class="admin-secondary" data-add-entry>Add timeline entry</button>
        <button class="btn-primary" type="submit">Save changes</button>
      </div>
    </form>`;
}

function renderProjectsForm() {
  adminContent.innerHTML = `
    <form class="admin-form" data-editor-form="projects">
      <div class="admin-entry-list">${editableContent.projects.map((project, index) => `
        <article class="admin-entry" data-entry-index="${index}" data-entry-id="${escapeAdminText(project.id)}">
          ${inputField('Project title', 'title', project.title)}
          ${inputField('Mission label', 'code', project.code)}
          ${textareaField('Description', 'description', project.description)}
          ${inputField('Tools / tags', 'stack', project.stack.join(', '))}
          <button type="button" class="admin-secondary" data-remove-entry>Remove project</button>
        </article>`).join('')}</div>
      <div class="admin-actions">
        <button type="button" class="admin-secondary" data-add-entry>Add project</button>
        <button class="btn-primary" type="submit">Save changes</button>
      </div>
    </form>`;
}

function splitLines(value) {
  return value.split('\n').map((item) => item.trim()).filter(Boolean);
}

function splitTags(value) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function readCurrentAdminTab() {
  const form = adminContent.querySelector('[data-editor-form]');
  if (!form) return;
  const read = (field) => form.querySelector(`[data-field="${field}"]`)?.value.trim() || '';

  if (activeAdminTab === 'profile') {
    Object.assign(editableContent.profile, {
      name: read('name'),
      subtitle: read('subtitle'),
      badge: read('badge'),
      developerStatus: read('developerStatus'),
      heroDescription: read('heroDescription'),
      roles: splitLines(read('roles')),
      aboutParagraphs: [read('about-0'), read('about-1')],
      baseLocation: read('baseLocation'),
      focus: read('focus')
    });
  }
  if (activeAdminTab === 'skills') {
    editableContent.skills = [...form.querySelectorAll('.admin-entry')].map((entry) => ({
      id: entry.dataset.entryId || `arsenal-${crypto.randomUUID()}`,
      title: entry.querySelector('[data-field="title"]').value.trim(),
      items: splitLines(entry.querySelector('[data-field="items"]').value)
    }));
  }
  if (activeAdminTab === 'timeline') {
    editableContent.timeline = [...form.querySelectorAll('.admin-entry')].map((entry) => ({
      date: entry.querySelector('[data-field="date"]').value.trim(),
      title: entry.querySelector('[data-field="title"]').value.trim(),
      description: entry.querySelector('[data-field="description"]').value.trim()
    }));
  }
  if (activeAdminTab === 'projects') {
    editableContent.projects = [...form.querySelectorAll('.admin-entry')].map((entry) => ({
      id: entry.dataset.entryId || `project-${crypto.randomUUID()}`,
      title: entry.querySelector('[data-field="title"]').value.trim(),
      code: entry.querySelector('[data-field="code"]').value.trim(),
      description: entry.querySelector('[data-field="description"]').value.trim(),
      stack: splitTags(entry.querySelector('[data-field="stack"]').value)
    }));
  }
}

adminContent.addEventListener('click', (event) => {
  const form = event.target.closest('[data-editor-form]');
  if (!form) return;
  if (event.target.closest('[data-remove-entry]')) {
    readCurrentAdminTab();
    const index = Number(event.target.closest('.admin-entry').dataset.entryIndex);
    if (activeAdminTab === 'skills') editableContent.skills.splice(index, 1);
    if (activeAdminTab === 'timeline') editableContent.timeline.splice(index, 1);
    if (activeAdminTab === 'projects') editableContent.projects.splice(index, 1);
    renderAdminTab();
  }
  if (event.target.closest('[data-add-entry]')) {
    readCurrentAdminTab();
    if (activeAdminTab === 'skills') editableContent.skills.push({
      id: `arsenal-${crypto.randomUUID()}`,
      title: 'NEW ARSENAL SECTION',
      items: ['New skill']
    });
    if (activeAdminTab === 'timeline') editableContent.timeline.push({
      date: 'NEW ENTRY',
      title: 'New milestone',
      description: 'Add details about this milestone.'
    });
    if (activeAdminTab === 'projects') editableContent.projects.push({
      id: `project-${crypto.randomUUID()}`,
      code: 'MISSION // NEW PROJECT',
      title: 'New project',
      description: 'Describe your project.',
      stack: []
    });
    renderAdminTab();
  }
});

adminContent.addEventListener('submit', async (event) => {
  if (!event.target.matches('[data-editor-form]')) return;
  event.preventDefault();
  readCurrentAdminTab();
  const saveButton = event.target.querySelector('button[type="submit"]');
  saveButton.disabled = true;
  adminSaveMessage.textContent = 'Saving your changes...';

  try {
    if (activeAdminTab === 'profile') {
      const photoFile = event.target.querySelector('[data-field="photoFile"]').files[0];
      if (photoFile) {
        if (photoFile.size > 5 * 1024 * 1024) throw new Error('Photo must be smaller than 5 MB.');
        const photoBytes = new Uint8Array(await photoFile.arrayBuffer());
        let photoBinary = '';
        for (let offset = 0; offset < photoBytes.length; offset += 0x8000) {
          photoBinary += String.fromCharCode(...photoBytes.subarray(offset, offset + 0x8000));
        }
        const upload = await fetch('/api/profile-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mime: photoFile.type, data: btoa(photoBinary) })
        });
        const uploadResult = await upload.json();
        if (!upload.ok) throw new Error(uploadResult.error || 'Photo upload failed.');
        editableContent.profile.photo = uploadResult.path;
      }
    }

    const response = await fetch('/api/content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editableContent)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not save portfolio changes.');
    editableContent = result.content;
    await window.loadPortfolioContent();
    adminSaveMessage.textContent = 'Saved. Your public portfolio is updated.';
    renderAdminTab();
  } catch (error) {
    adminSaveMessage.textContent = error.message;
  } finally {
    const currentSaveButton = adminContent.querySelector('button[type="submit"]');
    if (currentSaveButton) currentSaveButton.disabled = false;
  }
});
