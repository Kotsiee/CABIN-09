(function () {
  'use strict';

  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const TRIGGER = '[data-scent-note]';
  const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');

  const DEFAULT_LABELS = {
    close: 'Close',
    profile: 'What it smells like',
    chemistry: 'Why it works in a cabin',
    molecule: 'Molecular weight'
  };

  const STYLE = `
    .scent-modal{position:fixed;inset:0;z-index:var(--cabin-z-modal,1000);display:grid;place-items:center;padding:1rem}
    .scent-modal[hidden]{display:none}
    .scent-modal__backdrop{position:absolute;inset:0;background:rgba(11,11,12,.78);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;transition:opacity var(--cabin-dur-base,350ms) var(--cabin-ease-out)}
    .scent-modal__panel{position:relative;width:min(100%,32rem);max-height:calc(100vh - 2rem);overflow:auto;padding:clamp(1.5rem,4vw,2.5rem);background:var(--cabin-elevation,#141416);border:1px solid var(--cabin-border,#242428);border-radius:var(--cabin-radius-md,4px);box-shadow:var(--cabin-shadow-float);color:var(--cabin-text,#d6d6d6);opacity:0;transform:translateY(16px) scale(.98);transition:opacity var(--cabin-dur-base,350ms) var(--cabin-ease-out),transform var(--cabin-dur-base,350ms) var(--cabin-ease-out)}
    .scent-modal__panel::before{content:'';position:absolute;top:0;left:15%;right:15%;height:1px;background:linear-gradient(90deg,transparent,var(--cabin-brass,#b08d57),transparent)}
    .scent-modal.is-open .scent-modal__backdrop{opacity:1}
    .scent-modal.is-open .scent-modal__panel{opacity:1;transform:none}
    .scent-modal__close{position:absolute;top:.75rem;right:.75rem;width:2.5rem;height:2.5rem;display:grid;place-items:center;border:1px solid var(--cabin-border,#242428);border-radius:50%;background:transparent;color:var(--cabin-display,#f5f5f7);cursor:pointer;transition:border-color var(--cabin-dur-fast,180ms) var(--cabin-ease-out),color var(--cabin-dur-fast,180ms) var(--cabin-ease-out),transform var(--cabin-dur-fast,180ms) var(--cabin-ease-out)}
    .scent-modal__close:hover{border-color:var(--cabin-brass,#b08d57);color:var(--cabin-brass,#b08d57);transform:rotate(90deg)}
    .scent-modal__close:focus-visible{outline:2px solid var(--cabin-brass,#b08d57);outline-offset:3px}
    .scent-modal__close svg{width:14px;height:14px}
    .scent-modal__eyebrow{display:flex;gap:.6rem;align-items:baseline;margin:0 0 .75rem;font-family:var(--cabin-font-ui,Inter,sans-serif);font-size:var(--cabin-fs-xs,.6875rem);font-weight:500;letter-spacing:var(--cabin-track-label,.14em);text-transform:uppercase;color:var(--cabin-brass,#b08d57)}
    .scent-modal__eyebrow span+span{color:var(--cabin-text-muted);font-weight:400;letter-spacing:.04em;text-transform:none;font-family:var(--cabin-font-serif,serif);font-size:var(--cabin-fs-sm,.8125rem)}
    .scent-modal__title{margin:0;font-family:var(--cabin-font-serif,serif);font-weight:400;font-size:clamp(1.75rem,4vw,2.5rem);letter-spacing:var(--cabin-track-serif,.08em);line-height:1.1;color:var(--cabin-display,#f5f5f7)}
    .scent-modal__alias{margin:.35rem 0 0;font-family:var(--cabin-font-ui,Inter,sans-serif);font-size:var(--cabin-fs-sm,.8125rem);color:var(--cabin-text-muted)}
    .scent-modal__rule{width:2.5rem;height:1px;margin:1.25rem 0;background:var(--cabin-brass,#b08d57);border:0}
    .scent-modal__section{margin:0 0 1.25rem}
    .scent-modal__section:last-child{margin-bottom:0}
    .scent-modal__section h3{margin:0 0 .45rem;font-family:var(--cabin-font-display,Syne,sans-serif);font-size:var(--cabin-fs-xs,.6875rem);font-weight:600;letter-spacing:var(--cabin-track-display,.2em);text-transform:uppercase;color:var(--cabin-display,#f5f5f7)}
    .scent-modal__section p{margin:0;font-family:var(--cabin-font-ui,Inter,sans-serif);font-size:var(--cabin-fs-md,.9375rem);line-height:1.65;white-space:pre-line}
    .scent-modal__spec{display:flex;justify-content:space-between;gap:1rem;margin-top:1.25rem;padding-top:1rem;border-top:1px solid var(--cabin-border,#242428);font-family:var(--cabin-font-ui,Inter,sans-serif);font-size:var(--cabin-fs-xs,.6875rem);letter-spacing:var(--cabin-track-label,.14em);text-transform:uppercase;color:var(--cabin-text-muted)}
    .scent-modal__spec b{font-weight:500;color:var(--cabin-display,#f5f5f7)}
    .scent-modal__section{opacity:0;transform:translateY(8px);transition:opacity var(--cabin-dur-slow,600ms) var(--cabin-ease-out),transform var(--cabin-dur-slow,600ms) var(--cabin-ease-out)}
    .scent-modal.is-open .scent-modal__section{opacity:1;transform:none}
    .scent-modal.is-open .scent-modal__section:nth-of-type(2){transition-delay:80ms}
    @media (prefers-reduced-motion:reduce){.scent-modal__backdrop,.scent-modal__panel,.scent-modal__section,.scent-modal__close{transition:none}}
  `;

  const CLOSE_ICON = '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.25" aria-hidden="true"><path d="M1 1l12 12M13 1L1 13"/></svg>';

  /**
   * Singleton micro-modal for scent note "easter egg" detail.
   * Triggers: any element matching [data-scent-note] with data-note-* attributes.
   * Public API: window.CabinScentModal.open(triggerEl) / .close()
   */
  class ScentNoteModal {
    constructor(labels) {
      this.labels = Object.assign({}, DEFAULT_LABELS, labels || {});
      this.root = null;
      this.lastTrigger = null;
      this.isOpen = false;
      this.onKeydown = this.onKeydown.bind(this);
      this.onDocumentClick = this.onDocumentClick.bind(this);
      document.addEventListener('click', this.onDocumentClick);
    }

    build() {
      if (this.root) return;

      const style = document.createElement('style');
      style.textContent = STYLE;
      document.head.appendChild(style);

      const root = document.createElement('div');
      root.className = 'scent-modal';
      root.hidden = true;
      root.innerHTML = `
        <div class="scent-modal__backdrop" data-close></div>
        <div class="scent-modal__panel" role="dialog" aria-modal="true" aria-labelledby="scent-modal-title" tabindex="-1">
          <button type="button" class="scent-modal__close" data-close aria-label="${this.labels.close}">${CLOSE_ICON}</button>
          <p class="scent-modal__eyebrow"><span data-field="tier"></span><span data-field="window"></span></p>
          <h2 class="scent-modal__title" id="scent-modal-title" data-field="name"></h2>
          <p class="scent-modal__alias" data-field="alias"></p>
          <hr class="scent-modal__rule">
          <section class="scent-modal__section"><h3>${this.labels.profile}</h3><p data-field="profile"></p></section>
          <section class="scent-modal__section"><h3>${this.labels.chemistry}</h3><p data-field="chemistry"></p></section>
          <div class="scent-modal__spec" data-field="spec"><span>${this.labels.molecule}</span><b data-field="molecule"></b></div>
        </div>`;
      document.body.appendChild(root);

      this.root = root;
      this.panel = root.querySelector('.scent-modal__panel');
      this.fields = {};
      root.querySelectorAll('[data-field]').forEach((el) => {
        this.fields[el.dataset.field] = el;
      });
      root.querySelectorAll('[data-close]').forEach((el) => {
        el.addEventListener('click', () => this.close());
      });
    }

    populate(trigger) {
      const d = trigger.dataset;
      this.fields.tier.textContent = d.noteTier || '';
      this.fields.window.textContent = d.noteWindow || '';
      this.fields.name.textContent = d.noteName || '';
      this.fields.alias.textContent = d.noteAlias || '';
      this.fields.alias.hidden = !d.noteAlias;
      this.fields.profile.textContent = d.noteProfile || '';
      this.fields.profile.parentElement.hidden = !d.noteProfile;
      this.fields.chemistry.textContent = d.noteChemistry || '';
      this.fields.chemistry.parentElement.hidden = !d.noteChemistry;
      this.fields.molecule.textContent = d.noteMolecule || '';
      this.fields.spec.hidden = !d.noteMolecule;
    }

    /**
     * Open the modal populated from a trigger element's data-note-* attributes.
     * @param {HTMLElement} trigger
     */
    open(trigger) {
      this.build();
      this.populate(trigger);
      this.lastTrigger = trigger;
      trigger.classList.add('is-active');
      trigger.setAttribute('aria-expanded', 'true');

      this.root.hidden = false;
      document.body.classList.add('cabin-modal-open');
      document.addEventListener('keydown', this.onKeydown);
      this.isOpen = true;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.root.classList.add('is-open');
          this.panel.focus({ preventScroll: true });
        });
      });

      this.root.dispatchEvent(new CustomEvent('scent-modal:open', { bubbles: true, detail: { trigger } }));
    }

    /**
     * Close the modal and return focus to the opening trigger.
     */
    close() {
      if (!this.isOpen) return;
      this.isOpen = false;
      this.root.classList.remove('is-open');
      document.removeEventListener('keydown', this.onKeydown);
      document.body.classList.remove('cabin-modal-open');

      const trigger = this.lastTrigger;
      if (trigger) {
        trigger.classList.remove('is-active');
        trigger.setAttribute('aria-expanded', 'false');
      }

      const finish = () => {
        this.root.hidden = true;
        if (trigger && document.contains(trigger)) trigger.focus({ preventScroll: true });
        this.root.dispatchEvent(new CustomEvent('scent-modal:close', { bubbles: true, detail: { trigger } }));
      };

      if (REDUCED_MOTION.matches) {
        finish();
      } else {
        this.panel.addEventListener('transitionend', finish, { once: true });
        setTimeout(() => {
          if (!this.root.hidden && !this.isOpen) finish();
        }, 450);
      }
    }

    onKeydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.close();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = Array.from(this.panel.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) {
        event.preventDefault();
        this.panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === this.panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    onDocumentClick(event) {
      const trigger = event.target.closest(TRIGGER);
      if (!trigger) return;
      event.preventDefault();
      this.open(trigger);
    }
  }

  if (!window.CabinScentModal) {
    const config = window.CabinConfig && window.CabinConfig.modalLabels;
    window.CabinScentModal = new ScentNoteModal(config);
  }

  const fans = document.querySelectorAll('[data-scent-fan].scent-fan--pdp:not(.is-revealed)');
  if (!fans.length) return;

  if (!('IntersectionObserver' in window) || REDUCED_MOTION.matches) {
    fans.forEach((fan) => fan.classList.add('is-revealed'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      requestAnimationFrame(() => entry.target.classList.add('is-revealed'));
      io.unobserve(entry.target);
    });
  }, { threshold: 0.35 });
  fans.forEach((fan) => io.observe(fan));
})();
