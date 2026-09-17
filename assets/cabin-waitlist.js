/**
 * CABIN-09 · Waitlist
 *
 * Progressive enhancement for `snippets/cabin-notify-form.liquid`.
 *
 * Without this file the form still works: it is a native Shopify customer form
 * that posts to /contact and Shopify redirects back with `?customer_posted=true`.
 * With it, the form is validated inline, posted with `fetch`, and the success
 * state is swapped in place so the visitor never leaves the product page.
 *
 * Markup hooks (see the snippet):
 *   [data-notify]                    root, carries data-notify-key / data-notify-success
 *   [data-notify-email]              the email input
 *   [data-notify-submit]             the submit button
 *   [data-notify-submit-label]       the text span inside the button
 *   [data-notify-state="error"]      inline error, role="alert", hidden when empty
 *
 * Events (bubble from the root element):
 *   cabin-waitlist:success  detail: { key, email, form }
 *   cabin-waitlist:error    detail: { key, message, form }
 *
 * Copy can be overridden before this script runs:
 *   window.CabinConfig = { waitlist: { sending: '…', invalidEmail: '…', network: '…' } };
 */
(function () {
  'use strict';

  /** @type {Record<string, string>} */
  var DEFAULT_MESSAGES = {
    sending: 'Sending',
    invalidEmail: 'Enter a valid email address.',
    network: 'Could not reach the store. Try again in a moment.',
    success: 'Noted. We will write once, when it is ready.'
  };

  var READY_ATTRIBUTE = 'data-notify-ready';
  var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var CHALLENGE_PATTERN = /\/challenge(?:[?#]|$)/;

  /**
   * One instance per `[data-notify]` root.
   */
  class CabinWaitlist {
    /**
     * @param {HTMLElement} root The `[data-notify]` element.
     */
    constructor(root) {
      this.root = root;
      this.form = root.querySelector('form');
      if (!this.form) return;

      this.email = this.form.querySelector('[data-notify-email]') || this.form.querySelector('input[type="email"]');
      this.submit = this.form.querySelector('[data-notify-submit]');
      this.submitLabel = this.form.querySelector('[data-notify-submit-label]');
      this.error = this.form.querySelector('[data-notify-state="error"]');
      this.idleLabel = this.submitLabel ? this.submitLabel.textContent : '';
      this.nativeFallback = false;

      var config = window.CabinConfig && window.CabinConfig.waitlist;
      this.messages = Object.assign({}, DEFAULT_MESSAGES, config || {});

      this.onSubmit = this.onSubmit.bind(this);
      this.onInput = this.onInput.bind(this);
      this.form.addEventListener('submit', this.onSubmit);
      if (this.email) this.email.addEventListener('input', this.onInput);
    }

    /** @returns {string} The customer tag key this form is collecting for. */
    get key() {
      return this.root.getAttribute('data-notify-key') || '';
    }

    /** @returns {string} The message to show once the address is recorded. */
    get successMessage() {
      return this.root.getAttribute('data-notify-success') || this.messages.success;
    }

    /**
     * Clears a stale validation error as soon as the visitor edits the address.
     */
    onInput() {
      if (this.email.getAttribute('aria-invalid') === 'true') {
        this.markInvalid(false);
        this.showError('');
      }
    }

    /**
     * Light client-side check; the browser's own constraint validation runs first.
     * @returns {string} An error message, or an empty string when the address is fine.
     */
    validate() {
      if (!this.email) return '';
      var value = this.email.value.trim();
      if (!value || !EMAIL_PATTERN.test(value) || !this.email.checkValidity()) {
        this.markInvalid(true);
        this.email.focus();
        return this.messages.invalidEmail;
      }
      this.markInvalid(false);
      return '';
    }

    /**
     * @param {boolean} invalid
     */
    markInvalid(invalid) {
      if (!this.email) return;
      if (invalid) {
        this.email.setAttribute('aria-invalid', 'true');
        if (this.error && this.error.id) this.email.setAttribute('aria-describedby', this.error.id);
      } else {
        this.email.removeAttribute('aria-invalid');
        this.email.removeAttribute('aria-describedby');
      }
    }

    /**
     * Writes the inline error. The element carries role="alert", so filling it
     * announces the message; emptying it hides the element again.
     * @param {string} message
     */
    showError(message) {
      if (!this.error) return;
      this.error.textContent = message;
      this.error.hidden = !message;
    }

    /**
     * @param {boolean} busy
     */
    setBusy(busy) {
      this.root.classList.toggle('is-submitting', busy);
      if (this.submit) {
        this.submit.disabled = busy;
        this.submit.setAttribute('aria-busy', busy ? 'true' : 'false');
      }
      if (this.submitLabel) {
        this.submitLabel.textContent = busy ? this.messages.sending : this.idleLabel;
      }
    }

    /**
     * Intercepts the native submit and posts the form with fetch.
     * @param {SubmitEvent} event
     */
    async onSubmit(event) {
      // Let the browser handle it when fetch is unavailable or when we have
      // deliberately handed over to a native submit (bot challenge).
      if (this.nativeFallback || !window.fetch || !window.FormData) return;
      event.preventDefault();

      var problem = this.validate();
      if (problem) {
        this.showError(problem);
        return;
      }

      this.showError('');
      this.setBusy(true);

      var response;
      try {
        response = await fetch(this.form.action, {
          method: 'POST',
          body: new FormData(this.form),
          headers: { Accept: 'text/html' },
          redirect: 'follow',
          credentials: 'same-origin'
        });
      } catch (error) {
        this.fail(this.messages.network);
        return;
      }

      var finalUrl = response.url || '';

      // Shopify sends suspected bots to /challenge. Hand over to a full-page
      // submit so the visitor can complete it instead of showing a dead end.
      if (CHALLENGE_PATTERN.test(finalUrl)) {
        this.fallbackToNativeSubmit();
        return;
      }

      var posted = response.ok && (finalUrl.indexOf('customer_posted=true') !== -1 || response.redirected);
      if (posted) {
        this.renderSuccess();
        return;
      }

      // Not redirected: Shopify re-rendered the page with form.errors. Lift the
      // message out of the returned markup so the copy matches the no-JS flow.
      var message = await this.readServerError(response);
      this.fail(message);
    }

    /**
     * Finds the inline error Shopify rendered for this form in a full-page response.
     * @param {Response} response
     * @returns {Promise<string>}
     */
    async readServerError(response) {
      try {
        var html = await response.text();
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var scope = (this.form.id && doc.getElementById(this.form.id)) || doc;
        var node = scope.querySelector('[data-notify-state="error"]:not([hidden])');
        var text = node ? node.textContent.replace(/\s+/g, ' ').trim() : '';
        return text || this.messages.network;
      } catch (error) {
        return this.messages.network;
      }
    }

    /**
     * Shows an error, re-enables the form and lets listeners know.
     * @param {string} message
     */
    fail(message) {
      this.setBusy(false);
      this.showError(message);

      // Disabling the submit button while it was focused dropped focus to <body>;
      // put it back on the field the visitor needs to correct.
      if (this.email) {
        this.markInvalid(true);
        this.email.focus({ preventScroll: true });
      } else if (this.submit) {
        this.submit.focus({ preventScroll: true });
      }

      this.root.dispatchEvent(new CustomEvent('cabin-waitlist:error', {
        bubbles: true,
        detail: { key: this.key, message: message, form: this.form }
      }));
    }

    /**
     * Re-submits natively. `form.submit()` does not fire a submit event, so this
     * cannot loop back into onSubmit.
     */
    fallbackToNativeSubmit() {
      this.nativeFallback = true;
      this.setBusy(false);
      this.form.submit();
    }

    /**
     * Replaces the form contents with the success state and moves focus to it.
     * Mirrors the markup the snippet renders server-side after a redirect.
     */
    renderSuccess() {
      var email = this.email ? this.email.value.trim() : '';

      var state = document.createElement('div');
      state.className = 'notify__state notify__state--success';
      state.setAttribute('role', 'status');
      state.setAttribute('data-notify-state', 'success');
      state.tabIndex = -1;

      var tick = document.createElement('span');
      tick.className = 'notify__tick';
      tick.setAttribute('aria-hidden', 'true');

      var text = document.createElement('p');
      text.className = 'notify__success cabin-serif cabin-serif--md';
      text.textContent = this.successMessage;

      state.appendChild(tick);
      state.appendChild(text);

      while (this.form.firstChild) {
        this.form.removeChild(this.form.firstChild);
      }
      this.form.appendChild(state);

      this.root.classList.remove('is-submitting');
      this.root.classList.add('is-success');
      // The stylesheet only shows a success state on the form that was posted
      // (:target after Shopify's redirect, or this class after a fetch).
      this.form.classList.add('is-success');
      state.focus({ preventScroll: true });

      this.root.dispatchEvent(new CustomEvent('cabin-waitlist:success', {
        bubbles: true,
        detail: { key: this.key, email: email, form: this.form }
      }));
    }
  }

  /**
   * Instantiates every un-initialised `[data-notify]` root within `scope`.
   * @param {ParentNode} scope
   */
  function init(scope) {
    if (!scope || typeof scope.querySelectorAll !== 'function') return;
    var roots = scope.querySelectorAll('[data-notify]:not([' + READY_ATTRIBUTE + '])');
    Array.prototype.forEach.call(roots, function (root) {
      root.setAttribute(READY_ATTRIBUTE, '');
      new CabinWaitlist(root);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init(document);
    });
  } else {
    init(document);
  }

  // Theme editor: sections re-render when settings change.
  document.addEventListener('shopify:section:load', function (event) {
    init(event.target);
  });

  /**
   * Storefront: Horizon's variant picker fetches the whole product page on a
   * variant change, morphs only itself and resolves the bubbling
   * shopify:product:select event's promise with { detail: { html } }. This
   * section is rendered from the variant selected at page load, so it is
   * swapped for its copy in that document — visibility and the
   * notify:<handle>-<variant id> tag then follow the selected variant.
   */
  document.addEventListener('shopify:product:select', function (event) {
    var target = event.target;
    if (!target || typeof target.closest !== 'function') return;
    // Product cards and quick-add dialogs render their own product; ignore them.
    if (target.closest('product-card, quick-add-component, quick-add-dialog')) return;
    if (!event.promise || typeof event.promise.then !== 'function') return;

    event.promise
      .then(function (result) {
        var html = result && result.detail && result.detail.html;
        if (!html || typeof html.querySelectorAll !== 'function') return;
        swapSections(html);
      })
      .catch(function (error) {
        if (!error || error.name !== 'AbortError') {
          console.warn('[cabin-waitlist] product select promise rejected:', error);
        }
      });
  });

  /**
   * Replaces every waitlist section on the page with its counterpart from a
   * freshly fetched document. The marker is emitted whether or not the form
   * rendered, so hidden sections can appear and visible ones can disappear.
   * @param {Document} html
   */
  function swapSections(html) {
    var ids = {};
    var collect = function (doc) {
      var markers = doc.querySelectorAll('[data-notify-me-section]');
      Array.prototype.forEach.call(markers, function (marker) {
        ids[marker.getAttribute('data-notify-me-section')] = true;
      });
    };
    collect(document);
    collect(html);

    Object.keys(ids).forEach(function (id) {
      var current = document.getElementById('shopify-section-' + id);
      var next = html.getElementById('shopify-section-' + id);
      if (!current || !next) return;
      // Keep an in-flight or completed signup on screen.
      if (current.querySelector('.notify.is-submitting, .notify.is-success')) return;

      current.innerHTML = next.innerHTML;
      init(current);
    });
  }

  window.CabinWaitlist = CabinWaitlist;
})();
