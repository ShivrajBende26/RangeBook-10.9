'use strict';

const menuToggle = document.querySelector('.menu-toggle');
const primaryNavigation = document.querySelector('#primary-navigation');
const navigationItems = document.querySelectorAll('.nav-item');
const navigationDropdownToggles = document.querySelectorAll('.nav-dropdown-toggle');
const heroSlides = document.querySelectorAll('[data-hero-slide]');
const heroImages = document.querySelectorAll('[data-hero-image]');
const heroDots = document.querySelectorAll('.hero-dot');
const heroControlLabel = document.querySelector('.hero__control-label');
const showcaseTabs = document.querySelectorAll('.showcase-tab');
const showcaseImage = document.querySelector('#showcase-image');
const showcaseKicker = document.querySelector('#showcase-kicker');
const showcaseTitle = document.querySelector('#showcase-title');
const showcaseDescription = document.querySelector('#showcase-description');
const showcaseNumber = document.querySelector('#showcase-number');

const closeDropdowns = () => {
  navigationItems.forEach(item => {
    item.classList.remove('is-open');
    item.querySelector('.nav-dropdown-toggle')?.setAttribute('aria-expanded', 'false');
  });
};

const closeNavigation = () => {
  menuToggle?.setAttribute('aria-expanded', 'false');
  menuToggle?.setAttribute('aria-label', 'Open navigation');
  primaryNavigation?.classList.remove('is-open');
  closeDropdowns();
};

const setHeroSlide = index => {
  if (!heroSlides.length) return;
  const slideIndex = (index + heroSlides.length) % heroSlides.length;

  heroSlides.forEach((slide, i) => {
    const isActive = i === slideIndex;
    slide.classList.toggle('is-active', isActive);
    slide.setAttribute('aria-hidden', String(!isActive));
  });

  heroImages.forEach((image, i) => {
    const isActive = i === slideIndex;
    image.classList.toggle('is-active', isActive);
    image.setAttribute('aria-hidden', String(!isActive));
  });

  heroDots.forEach((dot, i) => {
    const isActive = i === slideIndex;
    dot.classList.toggle('is-active', isActive);
    dot.setAttribute('aria-pressed', String(isActive));
  });

  if (heroControlLabel) {
    heroControlLabel.textContent = `0${slideIndex + 1} / 0${heroSlides.length}`;
  }
};

const updateShowcase = index => {
  const tab = showcaseTabs[index];
  if (!tab || !showcaseImage || !showcaseKicker || !showcaseTitle || !showcaseDescription || !showcaseNumber) return;

  showcaseTabs.forEach((item, i) => {
    const isActive = i === index;
    item.classList.toggle('is-active', isActive);
    item.setAttribute('aria-pressed', String(isActive));
  });

  showcaseKicker.textContent = tab.dataset.kicker;
  showcaseTitle.textContent = tab.dataset.title;
  showcaseDescription.textContent = tab.dataset.description;
  showcaseImage.alt = tab.dataset.alt;
  showcaseImage.src = tab.dataset.image;
  showcaseNumber.textContent = `${String(index + 1).padStart(2, '0')} / ${String(showcaseTabs.length).padStart(2, '0')}`;
};

menuToggle?.addEventListener('click', () => {
  const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!isExpanded));
  menuToggle.setAttribute('aria-label', isExpanded ? 'Open navigation' : 'Close navigation');
  primaryNavigation?.classList.toggle('is-open', !isExpanded);
});

navigationDropdownToggles.forEach(toggle => {
  toggle.addEventListener('click', () => {
    const item = toggle.closest('.nav-item');
    const shouldOpen = !item.classList.contains('is-open');
    closeDropdowns();
    item.classList.toggle('is-open', shouldOpen);
    toggle.setAttribute('aria-expanded', String(shouldOpen));
  });
});

primaryNavigation?.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    const showcaseIndex = Number(link.dataset.showcase);
    if (Number.isInteger(showcaseIndex)) updateShowcase(showcaseIndex);
    closeNavigation();
  });
});

document.addEventListener('click', event => {
  if (!primaryNavigation?.contains(event.target)) closeDropdowns();
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;

  const openToggle = primaryNavigation?.querySelector('.nav-item.is-open .nav-dropdown-toggle');
  closeNavigation();
  openToggle?.focus();
});

document.querySelector('.hero-arrow--previous')?.addEventListener('click', () => {
  const current = [...heroSlides].findIndex(slide => slide.classList.contains('is-active'));
  setHeroSlide(current - 1);
});

document.querySelector('.hero-arrow--next')?.addEventListener('click', () => {
  const current = [...heroSlides].findIndex(slide => slide.classList.contains('is-active'));
  setHeroSlide(current + 1);
});

heroDots.forEach((dot, index) => {
  dot.addEventListener('click', () => setHeroSlide(index));
});

showcaseTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => updateShowcase(index));
});

document.querySelectorAll('[data-showcase]').forEach(link => {
  link.addEventListener('click', () => updateShowcase(Number(link.dataset.showcase)));
});

document.querySelectorAll('[data-contact-form]').forEach(form => {
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const status = form.querySelector('[data-form-status]');
    const submitButton = form.querySelector('[type="submit"]');
    const payload = Object.fromEntries(new FormData(form).entries());
    if (submitButton) submitButton.disabled = true;
    if (status) status.textContent = 'Submitting your enquiry…';

    try {
      const response = await fetch('/api/contact-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) {
        const error = new Error(result.error || 'Your enquiry could not be saved.');
        error.status = response.status;
        throw error;
      }
      form.reset();
      if (status) status.textContent = result.message;
    } catch (error) {
      if (status) {
        status.textContent = error.status === 503
          ? 'The contact form is temporarily unavailable because the database is not configured.'
          : error.status === 429
            ? 'Too many enquiries were sent from this connection. Please try again later.'
            : `${error.message} Please try again.`;
      }
      if (error.status === 503 || error.status === 429) {
        console.warn('Contact form submission unavailable:', error.message);
      } else {
        console.error('Unable to submit contact enquiry:', error.message);
      }
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
});

const currentYear = document.querySelector('#current-year');
if (currentYear) currentYear.textContent = new Date().getFullYear();
document.documentElement.classList.add('js-ready');

const revealTargets = document.querySelectorAll('.reveal');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if ('IntersectionObserver' in window && !reducedMotion) {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12 }
  );

  revealTargets.forEach(target => revealObserver.observe(target));
} else {
  revealTargets.forEach(target => target.classList.add('is-visible'));
}
