// ==========================================
// 1. SYSTEM PRELOADER
// ==========================================
let progress = 0;
const bar = document.getElementById('loader-bar');
const txt = document.getElementById('loader-text');
const preloader = document.getElementById('preloader');

const loadInterval = setInterval(() => {
  progress += Math.floor(Math.random() * 18) + 8;
  if (progress >= 100) {
    progress = 100;
    clearInterval(loadInterval);
    setTimeout(() => preloader.classList.add('hidden'), 350);
  }
  bar.style.width = progress + '%';
  txt.textContent = `INITIALIZING SYSTEM PROTOCOLS · ${progress}%`;
}, 90);

// ==========================================
// 2. TYPEWRITER ROLE ANIMATION
// ==========================================
let roles = [
  "3D WEB DEVELOPER",
  "CYBERSECURITY RESEARCHER",
  "HARDWARE PROTOTYPER",
  "BCA UNDERGRADUATE"
];
let roleIdx = 0;
let charIdx = 0;
let deleting = false;
const typedEl = document.getElementById('typed-role');

function typeLoop() {
  const current = roles[roleIdx];
  typedEl.textContent = current.substring(0, charIdx);

  if (!deleting && charIdx < current.length) {
    charIdx++;
    setTimeout(typeLoop, 85);
  } else if (deleting && charIdx > 0) {
    charIdx--;
    setTimeout(typeLoop, 40);
  } else {
    deleting = !deleting;
    if (!deleting) roleIdx = (roleIdx + 1) % roles.length;
    setTimeout(typeLoop, deleting ? 1400 : 300);
  }
}
typeLoop();

// ==========================================
// 3. LIVE IST CLOCK
// ==========================================
function updateClock() {
  const now = new Date();
  const options = {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  };
  document.getElementById('live-clock').textContent =
    'IST ' + now.toLocaleTimeString('en-GB', options);
}
setInterval(updateClock, 1000);
updateClock();

// ==========================================
// 4. SCROLL PROGRESS & SECTION REVEALS
// ==========================================
const scrollProgress = document.getElementById('scroll-progress');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let scrollTicking = false;

function updateScrollProgress() {
  const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollableHeight > 0 ? window.scrollY / scrollableHeight : 0;
  scrollProgress.style.transform = `scaleX(${Math.min(Math.max(progress, 0), 1)})`;
  scrollTicking = false;
}

window.addEventListener('scroll', () => {
  if (!scrollTicking) {
    window.requestAnimationFrame(updateScrollProgress);
    scrollTicking = true;
  }
}, { passive: true });
window.addEventListener('resize', updateScrollProgress);
updateScrollProgress();

const timeline = document.getElementById('timeline-list');
let timelineObserver;
let timelineScrollTicking = false;

function updateTimelineEnergy(progress) {
  const energyBar = timeline.querySelector('.timeline-energy');
  if (!energyBar) return;
  const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const railTop = rootFontSize * 1.4;
  const railHeight = Math.max(0, timeline.clientHeight - railTop * 2);
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const energyHeight = railHeight * clampedProgress;
  const energyHead = railTop + energyHeight;
  energyBar.style.height = `${railHeight}px`;
  energyBar.style.transform = `scaleY(${clampedProgress})`;

  let activeEntry = -1;
  [...timeline.querySelectorAll('.timeline-item')].forEach((entry, index) => {
    const marker = getComputedStyle(entry, '::before');
    const markerCenter = entry.offsetTop + parseFloat(marker.top) + parseFloat(marker.height) / 2;
    const reached = energyHead >= markerCenter;
    entry.classList.toggle('energy-reached', reached);
    entry.classList.remove('energy-current');
    if (reached) activeEntry = index;
  });
  if (activeEntry >= 0) {
    timeline.querySelectorAll('.timeline-item')[activeEntry]?.classList.add('energy-current');
  }
}

function updateTimelineProgressFromScroll() {
  const bounds = timeline.getBoundingClientRect();
  const timelineTop = bounds.top + window.scrollY;
  const start = timelineTop - window.innerHeight * 0.78;
  const end = timelineTop + timeline.offsetHeight - window.innerHeight * 0.24;
  const progress = end > start ? (window.scrollY - start) / (end - start) : 0;
  updateTimelineEnergy(progress);
  timelineScrollTicking = false;
}

function scheduleTimelineProgress() {
  if (timelineScrollTicking || !timeline.isConnected) return;
  window.requestAnimationFrame(updateTimelineProgressFromScroll);
  timelineScrollTicking = true;
}

function setupTimelineMotion() {
  const entries = [...timeline.querySelectorAll('.timeline-item')];
  timelineObserver?.disconnect();
  timelineObserver = undefined;

  if (reduceMotion) {
    entries.forEach((entry) => {
      entry.classList.remove('scroll-reveal', 'is-visible');
      entry.style.removeProperty('opacity');
      entry.style.removeProperty('visibility');
      entry.style.removeProperty('transform');
    });
    updateTimelineEnergy(1);
    return;
  }

  entries.forEach((entry) => entry.classList.add('scroll-reveal'));
  if ('IntersectionObserver' in window) {
    timelineObserver = new IntersectionObserver((observed) => {
      observed.forEach((item) => {
        item.target.classList.toggle('is-visible', item.isIntersecting);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    entries.forEach((entry) => timelineObserver.observe(entry));
  } else {
    entries.forEach((entry) => entry.classList.add('is-visible'));
  }
  scheduleTimelineProgress();
}

window.addEventListener('scroll', () => {
  if (!reduceMotion) scheduleTimelineProgress();
}, { passive: true });
window.addEventListener('resize', () => {
  if (!reduceMotion) scheduleTimelineProgress();
});
if ('ResizeObserver' in window) {
  new ResizeObserver(() => {
    if (!reduceMotion) scheduleTimelineProgress();
  }).observe(timeline);
}
setupTimelineMotion();

const revealTargets = document.querySelectorAll(
  '.sec-header, .about-grid > *, .skills-grid > *, .projects-grid > *, .contact-grid > *'
);
const tickerTrack = document.getElementById('signal-ticker-track');

if (!reduceMotion && window.gsap && window.ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);

  ScrollTrigger.create({
    trigger: document.body,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.7,
    onUpdate: (trigger) => {
      if (window.setSceneScrollProgress) {
        window.setSceneScrollProgress(trigger.progress);
      }
    }
  });

  gsap.set(revealTargets, {
    autoAlpha: 0,
    y: 52,
    rotateX: 4,
    transformPerspective: 900,
    transformOrigin: 'center bottom'
  });

  ScrollTrigger.batch(revealTargets, {
    start: 'top 88%',
    once: true,
    onEnter: (targets) => gsap.to(targets, {
      autoAlpha: 1,
      y: 0,
      rotateX: 0,
      duration: 0.9,
      ease: 'power3.out',
      stagger: 0.11,
      overwrite: true
    })
  });

  document.documentElement.classList.add('gsap-ready');
  const tickerTween = gsap.to(tickerTrack, {
    xPercent: -50,
    duration: 28,
    ease: 'none',
    repeat: -1
  });
  const ticker = document.querySelector('.signal-ticker');
  ticker.addEventListener('mouseenter', () => tickerTween.pause());
  ticker.addEventListener('mouseleave', () => tickerTween.resume());
  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
} else if (!reduceMotion && 'IntersectionObserver' in window) {
  revealTargets.forEach((target) => target.classList.add('scroll-reveal'));

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  revealTargets.forEach((target) => revealObserver.observe(target));
}

// ==========================================
// 5. CURSOR GLOW FOLLOWER
// ==========================================
const glow = document.getElementById('cursor-glow');
window.addEventListener('mousemove', (e) => {
  glow.style.left = e.clientX + 'px';
  glow.style.top = e.clientY + 'px';
});

// ==========================================
// 6. BACKGROUND-ONLY BINARY RAIN
// ==========================================
function setupBinaryRain() {
  const image = document.querySelector('.avatar-box img');
  const canvas = document.querySelector('.binary-rain');
  const avatar = document.querySelector('.avatar-box');
  const context = canvas.getContext('2d');
  const maskCanvas = document.createElement('canvas');
  const maskContext = maskCanvas.getContext('2d', { willReadFrequently: true });
  const streams = [];
  const fontSize = 10;
  const lineHeight = 13;
  let width = 0;
  let height = 0;
  let animationFrame;
  let previousTime = 0;

  function makeStream(x) {
    const length = 9 + Math.floor(Math.random() * 5);
    return {
      x,
      y: Math.random() * height,
      speed: 24 + Math.random() * 24,
      bits: Array.from({ length }, () => Math.random() < 0.5 ? '0' : '1')
    };
  }

  function resize() {
    const bounds = avatar.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    width = bounds.width;
    height = bounds.height;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const sourceWidth = width / scale;
    const sourceHeight = height / scale;
    const sourceX = (image.naturalWidth - sourceWidth) / 2;
    const sourceY = (image.naturalHeight - sourceHeight) / 2;
    maskContext.drawImage(
      image,
      sourceX, sourceY, sourceWidth, sourceHeight,
      0, 0, maskCanvas.width, maskCanvas.height
    );

    const pixels = maskContext.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const red = pixels.data[index];
      const green = pixels.data[index + 1];
      const blue = pixels.data[index + 2];
      const brightest = Math.max(red, green, blue);
      const darkest = Math.min(red, green, blue);
      pixels.data[index + 3] = darkest > 232 && brightest - darkest < 22 ? 255 : 0;
    }
    maskContext.putImageData(pixels, 0, 0);

    streams.length = 0;
    for (let x = 12; x < width; x += 24) {
      streams.push(makeStream(x));
    }
  }

  function draw(time) {
    if (previousTime === 0) previousTime = time;
    const delta = Math.min((time - previousTime) / 1000, 0.05);
    previousTime = time;
    context.clearRect(0, 0, width, height);
    context.font = `500 ${fontSize}px 'JetBrains Mono', monospace`;
    context.textAlign = 'center';

    streams.forEach((stream) => {
      stream.y += stream.speed * delta;
      if (stream.y - stream.bits.length * lineHeight > height) {
        stream.y = -Math.random() * height * 0.65;
        stream.speed = 24 + Math.random() * 24;
        stream.bits = Array.from(stream.bits, () => Math.random() < 0.5 ? '0' : '1');
      }

      stream.bits.forEach((bit, index) => {
        const y = stream.y - index * lineHeight;
        const tailOpacity = 0.38 + (1 - index / stream.bits.length) * 0.3;
        context.fillStyle = index === 0
          ? 'rgba(8, 111, 75, 0.92)'
          : `rgba(10, 103, 73, ${tailOpacity})`;
        context.fillText(bit, stream.x, y);
      });
    });

    context.globalCompositeOperation = 'destination-in';
    context.drawImage(maskCanvas, 0, 0, width, height);
    context.globalCompositeOperation = 'source-over';

    if (!reduceMotion) animationFrame = window.requestAnimationFrame(draw);
  }

  function start() {
    if (!image.naturalWidth || animationFrame) return;
    resize();
    if (!width || !height) return;
    draw(performance.now());
  }

  function refresh() {
    if (!image.naturalWidth) return;
    window.cancelAnimationFrame(animationFrame);
    animationFrame = undefined;
    resize();
    draw(performance.now());
  }

  if (image.complete) {
    start();
  } else {
    image.addEventListener('load', start, { once: true });
  }
  image.addEventListener('load', refresh);

  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      refresh();
    }).observe(avatar);
  }
}

setupBinaryRain();

// ==========================================
// 7. PROJECT MODAL SYSTEM
// ==========================================
let projectDetails = {};
let modalReturnFocus;

function openProjectModal(key) {
  const data = projectDetails[key];
  if (!data) return;
  modalReturnFocus = document.activeElement;
  document.getElementById('modal-code').textContent = data.code;
  document.getElementById('modal-title').textContent = data.title;
  document.getElementById('modal-desc').textContent = data.desc;
  const stack = document.getElementById('modal-stack');
  stack.replaceChildren(...data.stack.map((item) => {
    const tag = document.createElement('span');
    tag.textContent = item;
    return tag;
  }));
  const modal = document.getElementById('proj-modal');
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  modal.querySelector('.modal-close').focus();
}

function openSkillModal(card) {
  const title = card.querySelector('.skill-cat-title')?.textContent.trim();
  const skills = [...card.querySelectorAll('.skill-pill')].map((item) => item.textContent.trim());
  if (!title || skills.length === 0) return;
  modalReturnFocus = document.activeElement;

  document.getElementById('modal-code').textContent = 'ENGINEERING MAINFRAME // CAPABILITIES';
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-desc').textContent = 'Tools and areas covered in this engineering stack:';
  const stack = document.getElementById('modal-stack');
  stack.replaceChildren(...skills.map((item) => {
    const tag = document.createElement('span');
    tag.textContent = item;
    return tag;
  }));
  const modal = document.getElementById('proj-modal');
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  modal.querySelector('.modal-close').focus();
}

function openPhotoViewer() {
  const photo = document.getElementById('profile-photo');
  if (!photo.src || photo.style.display === 'none') return;
  modalReturnFocus = document.activeElement;
  const modal = document.getElementById('photo-modal');
  document.getElementById('photo-modal-image').src = photo.src;
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  document.getElementById('photo-modal-close').focus();
}

function createColoredWords(text, startingColor = 0) {
  const fragment = document.createDocumentFragment();
  let colorIndex = startingColor;
  text.match(/\s+|\S+/g)?.forEach((part) => {
    if (/^\s+$/.test(part)) {
      fragment.append(document.createTextNode(part));
      return;
    }
    const word = document.createElement('span');
    word.className = `protocol-word protocol-word-${colorIndex % 4}`;
    word.textContent = part;
    fragment.append(word);
    colorIndex += 1;
  });
  return fragment;
}

function renderPortfolioContent(content) {
  const { profile } = content;
  const setText = (selector, value) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  };

  setText('#profile-name', profile.name);
  setText('#footer-author', profile.name);
  setText('.gradient-name', profile.name.split(/\s+/)[0].toUpperCase());
  setText('#profile-subtitle', profile.subtitle);
  setText('#profile-badge', profile.badge);
  setText('#developer-status', profile.developerStatus);
  setText('#hero-description', profile.heroDescription);
  setText('#about-paragraph-1', profile.aboutParagraphs[0] || '');
  setText('#about-paragraph-2', profile.aboutParagraphs[1] || '');
  setText('#profile-location', profile.baseLocation);
  setText('#profile-focus', profile.focus);

  roles = profile.roles.length ? profile.roles : ['PORTFOLIO'];
  roleIdx = 0;
  charIdx = 0;
  deleting = false;

  const photo = document.getElementById('profile-photo');
  photo.src = profile.photo;
  photo.alt = `Portrait of ${profile.name}`;
  photo.style.display = 'block';
  document.getElementById('avatar-fallback').style.display = 'none';

  const timeline = document.getElementById('timeline-list');
  timeline.replaceChildren(
    Object.assign(document.createElement('span'), {
      className: 'timeline-energy',
      ariaHidden: 'true'
    }),
    ...content.timeline.map((item, index) => {
    const entry = document.createElement('div');
    entry.className = 'timeline-item';
    const date = document.createElement('div');
    date.className = 'tl-date';
    date.append(createColoredWords(item.date, index));
    const title = document.createElement('div');
    title.className = 'tl-title';
    title.append(createColoredWords(item.title, index + 1));
    const description = document.createElement('div');
    description.className = 'tl-desc';
    description.append(createColoredWords(item.description, index + 2));
    entry.append(date, title, description);
    return entry;
    })
  );
  setupTimelineMotion();

  const skillsGrid = document.getElementById('skills-grid');
  skillsGrid.replaceChildren(...content.skills.map((group) => {
    const panel = document.createElement('div');
    panel.className = 'glass-panel';
    panel.tabIndex = 0;
    panel.setAttribute('role', 'button');
    panel.setAttribute('aria-haspopup', 'dialog');
    panel.setAttribute('aria-label', `View details for ${group.title}`);
    const title = document.createElement('div');
    title.className = 'skill-cat-title';
    title.textContent = group.title;
    const tags = document.createElement('div');
    tags.className = 'skill-tags';
    group.items.forEach((item) => {
      const pill = document.createElement('span');
      pill.className = 'skill-pill';
      pill.textContent = item;
      tags.append(pill);
    });
    panel.append(title, tags);
    return panel;
  }));

  projectDetails = Object.fromEntries(content.projects.map((project) => [
    project.id,
    {
      code: project.code,
      title: project.title,
      desc: project.description,
      stack: project.stack
    }
  ]));
  const projectsGrid = document.getElementById('projects-grid');
  projectsGrid.replaceChildren(...content.projects.map((project) => {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-haspopup', 'dialog');
    card.setAttribute('aria-label', `View mission details for ${project.title}`);
    card.dataset.projectId = project.id;
    const details = document.createElement('div');
    const code = document.createElement('div');
    code.className = 'proj-code';
    code.textContent = project.code;
    const title = document.createElement('h3');
    title.textContent = project.title;
    const description = document.createElement('p');
    description.textContent = project.description;
    details.append(code, title, description);
    const stack = document.createElement('div');
    stack.className = 'proj-stack';
    project.stack.forEach((item) => {
      const tag = document.createElement('span');
      tag.textContent = item;
      stack.append(tag);
    });
    card.append(details, stack);
    return card;
  }));
}

document.getElementById('projects-grid').addEventListener('click', (event) => {
  const card = event.target.closest('[data-project-id]');
  if (card) openProjectModal(card.dataset.projectId);
});
document.getElementById('projects-grid').addEventListener('keydown', (event) => {
  const card = event.target.closest('[data-project-id]');
  if (card && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    openProjectModal(card.dataset.projectId);
  }
});

document.getElementById('skills-grid').addEventListener('click', (event) => {
  const card = event.target.closest('.glass-panel');
  if (card) openSkillModal(card);
});
document.getElementById('skills-grid').addEventListener('keydown', (event) => {
  const card = event.target.closest('.glass-panel[role="button"]');
  if (card && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    openSkillModal(card);
  }
});

async function loadPortfolioContent() {
  const response = await fetch('/api/content', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Portfolio content could not be loaded (${response.status}).`);
  renderPortfolioContent(await response.json());
}
window.loadPortfolioContent = loadPortfolioContent;

loadPortfolioContent().catch((error) => {
  console.error('Unable to load portfolio details:', error);
});

function closeModals() {
  ['proj-modal', 'cmd-modal', 'photo-modal'].forEach((id) => {
    const modal = document.getElementById(id);
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  });
  if (modalReturnFocus instanceof HTMLElement) modalReturnFocus.focus();
  modalReturnFocus = undefined;
}

const siteNav = document.getElementById('site-nav');
const menuToggle = document.getElementById('menu-toggle');

function setSiteNavOpen(isOpen) {
  siteNav.hidden = !isOpen;
  menuToggle.setAttribute('aria-expanded', String(isOpen));
  menuToggle.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
  menuToggle.classList.toggle('is-open', isOpen);
}

menuToggle.addEventListener('click', () => {
  setSiteNavOpen(siteNav.hidden);
});
siteNav.addEventListener('click', (event) => {
  if (event.target.closest('a')) setSiteNavOpen(false);
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.nav-container')) setSiteNavOpen(false);
});

const profilePhoto = document.getElementById('profile-photo');
profilePhoto.addEventListener('click', openPhotoViewer);
profilePhoto.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openPhotoViewer();
  }
});
document.getElementById('photo-modal-close').addEventListener('click', closeModals);
document.getElementById('photo-modal').addEventListener('click', (event) => {
  if (event.target === event.currentTarget) closeModals();
});

// ==========================================
// 7. COMMAND PALETTE (Ctrl+K / Cmd+K) & UTILITIES
// ==========================================
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    const commandModal = document.getElementById('cmd-modal');
    if (!commandModal.classList.contains('active')) modalReturnFocus = document.activeElement;
    commandModal.classList.toggle('active');
    document.getElementById('cmd-search').focus();
  }
  if (e.key === 'Escape') {
    setSiteNavOpen(false);
    closeModals();
  }
});

function jumpTo(hash) {
  closeModals();
  window.location.hash = hash;
}

function filterCmd(val) {
  const items = document.querySelectorAll('#cmd-list .cmd-item');
  items.forEach(item => {
    item.style.display = item.textContent.toLowerCase().includes(val.toLowerCase())
      ? 'flex'
      : 'none';
  });
}

function copyEmail() {
  const email = document.getElementById('email-text').textContent;
  navigator.clipboard.writeText(email);
  const badge = document.getElementById('copy-badge');
  badge.textContent = 'COPIED TO CLIPBOARD ✓';
  setTimeout(() => (badge.textContent = 'CLICK TO COPY'), 2000);
}

// ==========================================
// 8. COLLABORATION MESSAGE DELIVERY
// ==========================================
const contactForm = document.getElementById('contact-form');
const submitBtn = document.getElementById('submit-btn');
const formStatus = document.getElementById('form-status');
const contactConfigNote = document.getElementById('contact-config-note');
const contactSuccess = document.getElementById('contact-success');
const contactAnother = document.getElementById('contact-another');
let contactDeliveryConfigured = false;

function collaborationEmailUrl(data) {
  const subject = `Collaboration inquiry from ${data.name}`;
  const body = `Name: ${data.name}\nEmail: ${data.email}\n\n${data.message}`;
  const params = new URLSearchParams({ subject, body });
  params.set('to', 'soumyadipghara27@gmail.com');
  return `https://mail.google.com/mail/?view=cm&fs=1&${params}`;
}

function showContactDraftFallback(message, data) {
  formStatus.style.display = 'block';
  formStatus.style.color = '';
  formStatus.replaceChildren(document.createTextNode(message));

  const draftLink = document.createElement('a');
  draftLink.href = collaborationEmailUrl(data);
  draftLink.target = '_blank';
  draftLink.rel = 'noopener noreferrer';
  draftLink.textContent = 'Open a prefilled Gmail draft';
  formStatus.append(draftLink);
}

function rememberContactSuccess() {
  try {
    sessionStorage.setItem('contact-message-sent', 'true');
  } catch (error) {
    console.warn('Unable to remember contact form confirmation:', error);
  }
}

function hasContactSuccess() {
  try {
    return sessionStorage.getItem('contact-message-sent') === 'true';
  } catch (error) {
    console.warn('Unable to restore contact form confirmation:', error);
    return false;
  }
}

async function checkContactDeliveryStatus() {
  try {
    const response = await fetch('/api/contact/status', { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Email delivery status is unavailable.');
    contactDeliveryConfigured = result.configured === true;
    if (!contactDeliveryConfigured) {
      contactConfigNote.hidden = false;
      contactConfigNote.textContent = 'Automatic email delivery is not configured. Submissions are saved to the private inbox; use the Gmail draft link to send manually.';
    }
  } catch (error) {
    contactDeliveryConfigured = false;
    contactConfigNote.hidden = false;
    contactConfigNote.textContent = 'Email delivery status is unavailable. Submit to try delivery; if it fails, you can open a Gmail draft.';
    console.error('Unable to check contact delivery status:', error);
  }
}

const contactStatusPromise = checkContactDeliveryStatus();

contactForm.addEventListener('submit', async function (e) {
  e.preventDefault();
  if (!contactForm.reportValidity()) return;

  const originalBtnText = submitBtn.textContent;
  submitBtn.textContent = 'ENCRYPTING & SENDING...';
  submitBtn.disabled = true;
  formStatus.style.display = 'none';
  formStatus.textContent = '';

  const formData = new FormData(contactForm);
  const data = Object.fromEntries(formData);
  await contactStatusPromise;

  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok || result.sent !== true) {
      if (response.status >= 500) {
        const message = result.saved === true
          ? 'Your message was saved to the private inbox, but automatic email delivery failed. '
          : 'Automatic delivery failed, and the server could not confirm saving your message. ';
        showContactDraftFallback(message, data);
        return;
      }
      throw new Error(result.error || 'Your message could not be delivered. Please use the direct email link.');
    }
    if (result.sent) {
      rememberContactSuccess();
      contactForm.reset();
      contactForm.hidden = true;
      contactConfigNote.hidden = true;
      contactSuccess.hidden = false;
      contactSuccess.classList.remove('is-visible');
      void contactSuccess.offsetWidth;
      contactSuccess.classList.add('is-visible');
    }
  } catch (error) {
    if (error instanceof TypeError) {
      showContactDraftFallback('The contact API could not be reached. Your message is still here. ', data);
    } else {
      formStatus.style.display = 'block';
      formStatus.style.color = '#ef4444';
      formStatus.textContent = '✕ UPLINK ERROR: ' + error.message;
    }
  } finally {
    if (!contactForm.hidden) {
      submitBtn.textContent = originalBtnText;
      submitBtn.disabled = false;
    }
  }
});

if (hasContactSuccess()) {
  contactForm.hidden = true;
  contactSuccess.hidden = false;
  contactSuccess.classList.add('is-visible');
}

contactAnother.addEventListener('click', () => {
  try {
    sessionStorage.removeItem('contact-message-sent');
  } catch (error) {
    console.warn('Unable to clear contact form confirmation:', error);
  }
  contactSuccess.classList.remove('is-visible');
  contactSuccess.hidden = true;
  formStatus.style.display = 'none';
  formStatus.textContent = '';
  contactForm.hidden = false;
  submitBtn.textContent = 'Send Transmission →';
  submitBtn.disabled = false;
  contactForm.querySelector('[name="name"]').focus();
});