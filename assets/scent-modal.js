/**
 * CABIN-09 scent note modal and PDP fan reveal.
 *
 * Loaded deferred by sections/product-scent-hero.liquid. Plain script, no modules,
 * no dependencies. Every style lives in the `{% stylesheet %}` of
 * snippets/product-scent-fan.liquid; this file only builds DOM and manages state.
 *
 * 1. Note detail modal
 *    A singleton dialog, built lazily on first open and appended to <body>, that
 *    shows the detail carried by any element matching `[data-scent-note]`:
 *    tier + evaporation window, name, alias, "What it smells like" (profile),
 *    "Why it works in a cabin" (chemistry) and a molecular weight spec line.
 *    Empty fields collapse. Clicks are delegated, so notes rendered later
 *    (theme editor reloads, section rendering API) work without re-binding.
 *
 *    Accessibility: role="dialog" aria-modal="true" aria-labelledby; focus moves
 *    into the panel; Tab / Shift+Tab are trapped; Escape, the backdrop and the
 *    close button close it; focus returns to the note that opened it; the body
 *    receives `cabin-modal-open` while open (scroll lock lives in the tokens CSS).
 *
 *    Events, bubbling from the modal root: `scent-modal:open`, `scent-modal:close`
 *    (`event.detail.trigger` is the note element).
 *
 *    Labels can be overridden before this script runs:
 *      window.CabinConfig = {
 *        modalLabels: { close: 'Close', profile: '…', chemistry: '…', molecule: '…' }
 *      };
 *
 *    Public API: window.CabinScentModal.open(triggerElement) / .close().
 *
 * 2. PDP fan reveal
 *    Each `.scent-fan--pdp` is armed (collapsed behind the vessel) and revealed
 *    with `is-revealed` the first time 35% of it enters the viewport. Under
 *    prefers-reduced-motion, or without IntersectionObserver, it is revealed
 *    immediately. Without JavaScript the CSS leaves the fan open.
 */
(function () {
  'use strict';

  /** Elements that open the modal. */
  var TRIGGER_SELECTOR = '[data-scent-note]';

  /** Fans that are revealed on first intersection. */
  var PDP_FAN_SELECTOR = '.scent-fan--pdp';

  /** Grid fans are decorative; their notes never open the modal. */
  var GRID_FAN_SELECTOR = '.scent-fan--grid';

  var FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  /** Share of the fan that must be on screen before it reveals. */
  var REVEAL_THRESHOLD = 0.35;

  /** Safety net for the close transition, a little over --cabin-dur-base (350ms). */
  var CLOSE_FALLBACK_MS = 450;

  var TITLE_ID = 'scent-modal-title';

  var DEFAULT_LABELS = {
    close: 'Close',
    profile: 'What it smells like',
    chemistry: 'Why it works in a cabin',
    molecule: 'Molecular weight',
  };

  var CLOSE_ICON =
    '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.25" aria-hidden="true" focusable="false">' +
    '<path d="M1 1l12 12M13 1L1 13"/>' +
    '</svg>';

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /**
   * Create an element with a class name and optional attributes.
   *
   * @param {string} tagName
   * @param {string} [className]
   * @param {Object<string, string>} [attributes]
   * @returns {HTMLElement}
   */
  function createElement(tagName, className, attributes) {
    var element = document.createElement(tagName);

    if (className) {
      element.className = className;
    }

    if (attributes) {
      Object.keys(attributes).forEach(function (name) {
        element.setAttribute(name, attributes[name]);
      });
    }

    return element;
  }

  /**
   * Singleton note detail dialog.
   */
  class ScentNoteModal {
    /**
     * @param {Object<string, string>} [labels] - Overrides for DEFAULT_LABELS
     */
    constructor(labels) {
      this.labels = Object.assign({}, DEFAULT_LABELS, labels || {});
      this.root = null;
      this.panel = null;
      this.fields = {};
      this.lastTrigger = null;
      this.isOpen = false;
      this.closeTimer = 0;
      this.pendingClose = null;

      this.onKeydown = this.onKeydown.bind(this);
      this.onDocumentClick = this.onDocumentClick.bind(this);

      document.addEventListener('click', this.onDocumentClick);
    }

    /**
     * Build the dialog DOM once and append it to <body>.
     */
    build() {
      if (this.root) return;

      var labels = this.labels;

      var root = createElement('div', 'scent-modal');
      root.hidden = true;

      var backdrop = createElement('div', 'scent-modal__backdrop');
      backdrop.dataset.close = '';

      var panel = createElement('div', 'scent-modal__panel', {
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': TITLE_ID,
        tabindex: '-1',
      });

      var closeButton = createElement('button', 'scent-modal__close', {
        type: 'button',
        'aria-label': labels.close,
      });
      closeButton.dataset.close = '';
      closeButton.innerHTML = CLOSE_ICON;

      var eyebrow = createElement('p', 'scent-modal__eyebrow');
      var tier = createElement('span');
      var window_ = createElement('span');
      eyebrow.append(tier, window_);

      var title = createElement('h2', 'scent-modal__title', { id: TITLE_ID });
      var alias = createElement('p', 'scent-modal__alias');
      var rule = createElement('hr', 'scent-modal__rule');

      var profileSection = createElement('section', 'scent-modal__section');
      var profileHeading = createElement('h3');
      profileHeading.textContent = labels.profile;
      var profile = createElement('p');
      profileSection.append(profileHeading, profile);

      var chemistrySection = createElement('section', 'scent-modal__section');
      var chemistryHeading = createElement('h3');
      chemistryHeading.textContent = labels.chemistry;
      var chemistry = createElement('p');
      chemistrySection.append(chemistryHeading, chemistry);

      var spec = createElement('div', 'scent-modal__spec');
      var specLabel = createElement('span');
      specLabel.textContent = labels.molecule;
      var molecule = createElement('b');
      spec.append(specLabel, molecule);

      panel.append(closeButton, eyebrow, title, alias, rule, profileSection, chemistrySection, spec);
      root.append(backdrop, panel);
      document.body.appendChild(root);

      this.root = root;
      this.panel = panel;
      this.fields = {
        tier: tier,
        window: window_,
        name: title,
        alias: alias,
        profile: profile,
        profileSection: profileSection,
        chemistry: chemistry,
        chemistrySection: chemistrySection,
        molecule: molecule,
        spec: spec,
      };

      root.querySelectorAll('[data-close]').forEach(
        function (element) {
          element.addEventListener('click', this.close.bind(this));
        }.bind(this)
      );
    }

    /**
     * Fill the dialog from a trigger's data-note-* attributes. Empty fields collapse.
     *
     * @param {HTMLElement} trigger
     */
    populate(trigger) {
      var data = trigger.dataset;
      var fields = this.fields;

      fields.tier.textContent = data.noteTier || '';
      fields.window.textContent = data.noteWindow || '';
      fields.window.hidden = !data.noteWindow;

      fields.name.textContent = data.noteName || '';

      fields.alias.textContent = data.noteAlias || '';
      fields.alias.hidden = !data.noteAlias;

      fields.profile.textContent = data.noteProfile || '';
      fields.profileSection.hidden = !data.noteProfile;

      fields.chemistry.textContent = data.noteChemistry || '';
      fields.chemistrySection.hidden = !data.noteChemistry;

      fields.molecule.textContent = data.noteMolecule || '';
      fields.spec.hidden = !data.noteMolecule;
    }

    /**
     * Open the dialog populated from a trigger element.
     *
     * @param {HTMLElement} trigger - The note element (carries the data-note-* attributes)
     */
    open(trigger) {
      if (!trigger) return;

      this.build();
      this.populate(trigger);

      if (this.lastTrigger && this.lastTrigger !== trigger) {
        this.resetTrigger(this.lastTrigger);
      }

      this.lastTrigger = trigger;
      trigger.classList.add('is-active');

      // A close may still be waiting on its transition; drop it so it cannot hide the new open.
      this.cancelPendingClose();
      this.root.hidden = false;
      document.body.classList.add('cabin-modal-open');
      document.addEventListener('keydown', this.onKeydown);
      this.isOpen = true;

      this.panel.scrollTop = 0;
      this.panel.focus({ preventScroll: true });

      // Two frames so the entrance transition runs from the hidden state.
      var root = this.root;
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          root.classList.add('is-open');
        });
      });

      this.root.dispatchEvent(
        new CustomEvent('scent-modal:open', {
          bubbles: true,
          detail: { trigger: trigger },
        })
      );
    }

    /**
     * Close the dialog and return focus to the note that opened it.
     */
    close() {
      if (!this.isOpen) return;

      this.isOpen = false;
      this.root.classList.remove('is-open');
      document.removeEventListener('keydown', this.onKeydown);
      document.body.classList.remove('cabin-modal-open');

      var trigger = this.lastTrigger;
      if (trigger) {
        this.resetTrigger(trigger);
      }

      var self = this;
      var root = this.root;
      var panel = this.panel;
      var finished = false;

      var finish = function () {
        if (finished) return;
        finished = true;

        self.cancelPendingClose();
        root.hidden = true;

        if (trigger && document.contains(trigger)) {
          trigger.focus({ preventScroll: true });
        }

        root.dispatchEvent(
          new CustomEvent('scent-modal:close', {
            bubbles: true,
            detail: { trigger: trigger },
          })
        );
      };

      if (reducedMotion.matches) {
        finish();
        return;
      }

      // Only the panel's own transition counts: transitionend bubbles from the close
      // button and the sections, which would end the fade early.
      var onTransitionEnd = function (event) {
        if (event.target !== panel) return;
        finish();
      };

      this.pendingClose = onTransitionEnd;
      panel.addEventListener('transitionend', onTransitionEnd);
      this.closeTimer = window.setTimeout(finish, CLOSE_FALLBACK_MS);
    }

    /**
     * Detach a close that is still waiting on its transition, and clear its fallback timer.
     */
    cancelPendingClose() {
      window.clearTimeout(this.closeTimer);
      this.closeTimer = 0;

      if (this.pendingClose && this.panel) {
        this.panel.removeEventListener('transitionend', this.pendingClose);
      }
      this.pendingClose = null;
    }

    /**
     * Clear the open state from a trigger.
     *
     * @param {HTMLElement} trigger
     */
    resetTrigger(trigger) {
      trigger.classList.remove('is-active');
    }

    /**
     * Escape closes; Tab and Shift+Tab cycle inside the panel.
     *
     * @param {KeyboardEvent} event
     */
    onKeydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.close();
        return;
      }

      if (event.key !== 'Tab') return;

      var focusable = Array.prototype.filter.call(this.panel.querySelectorAll(FOCUSABLE_SELECTOR), function (element) {
        return element.offsetParent !== null;
      });

      if (focusable.length === 0) {
        event.preventDefault();
        this.panel.focus();
        return;
      }

      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      var active = document.activeElement;
      var outside = !this.panel.contains(active);

      if (event.shiftKey && (active === first || active === this.panel || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    }

    /**
     * Delegated click handler: any [data-scent-note] outside a grid fan opens the dialog.
     *
     * @param {MouseEvent} event
     */
    onDocumentClick(event) {
      // Synthetic clicks dispatched at the document itself have no Element target.
      var target = event.target;
      if (!target || typeof target.closest !== 'function') return;

      var trigger = target.closest(TRIGGER_SELECTOR);

      if (!trigger) return;
      if (trigger.closest(GRID_FAN_SELECTOR)) return;
      if (trigger.getAttribute('aria-hidden') === 'true') return;

      event.preventDefault();
      this.open(trigger);
    }
  }

  /* ------------------------------------------------------------------------
     PDP fan reveal
     ------------------------------------------------------------------------ */

  /** @type {IntersectionObserver|null} */
  var revealObserver = null;

  /**
   * @param {Element} fan
   */
  function revealFan(fan) {
    fan.classList.add('is-revealed');
  }

  /**
   * Lazily create the shared observer.
   *
   * @returns {IntersectionObserver}
   */
  function getRevealObserver() {
    if (revealObserver) return revealObserver;

    revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;

          revealObserver.unobserve(entry.target);

          // Next frame, so the armed (collapsed) state has painted and the reveal animates.
          window.requestAnimationFrame(function () {
            revealFan(entry.target);
          });
        });
      },
      { threshold: REVEAL_THRESHOLD }
    );

    return revealObserver;
  }

  /**
   * Arm every unrevealed PDP fan inside `root` and reveal it on first intersection.
   *
   * @param {ParentNode} [root] - Defaults to the whole document
   */
  function initFans(root) {
    var scope = root && typeof root.querySelectorAll === 'function' ? root : document;
    var fans = scope.querySelectorAll(PDP_FAN_SELECTOR + ':not(.is-revealed)');

    if (!fans.length) return;

    var revealImmediately = reducedMotion.matches || !('IntersectionObserver' in window);

    fans.forEach(function (fan) {
      if (revealImmediately) {
        revealFan(fan);
        return;
      }

      // Already armed and observed by an earlier pass.
      if (fan.classList.contains('is-armed')) return;

      fan.classList.add('is-armed');
      getRevealObserver().observe(fan);
    });
  }

  /* ------------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------------ */

  // The script may be included by more than one section, and each execution defines
  // its own ScentNoteModal class, so guard on the global itself rather than instanceof.
  if (!window.CabinScentModal) {
    var config = window.CabinConfig && window.CabinConfig.modalLabels;
    var modal = new ScentNoteModal(config);

    /** Expose the reveal so other scripts can arm fans they render. */
    modal.revealFans = initFans;

    window.CabinScentModal = modal;

    document.addEventListener('shopify:section:load', function (event) {
      initFans(event.target);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      function () {
        initFans(document);
      },
      { once: true }
    );
  } else {
    initFans(document);
  }
})();
