(function () {
  'use strict';

  const MESSAGES = {
    submitting: 'Sending',
    idle: 'Notify me',
    invalidEmail: 'That address does not look right.',
    invalidPhone: 'Enter a mobile number including country code.',
    network: 'Could not reach the store. Try again in a moment.'
  };

  /**
   * Progressive enhancement for the cabin-notify-form snippet.
   * Handles channel toggling, tag composition, inline validation and
   * async submission to Shopify's native /contact customer endpoint.
   */
  class CabinWaitlist {
    constructor(root) {
      this.root = root;
      this.form = root.querySelector('form');
      if (!this.form) return;
      this.tags = this.form.querySelector('[data-notify-tags]');
      this.baseTags = this.tags ? this.tags.value : '';
      this.email = this.form.querySelector('input[type="email"]');
      this.phoneField = this.form.querySelector('[data-notify-sms-field]');
      this.phone = this.form.querySelector('[data-notify-phone]');
      this.channels = Array.from(this.form.querySelectorAll('[data-notify-channel]'));
      this.submit = this.form.querySelector('[data-notify-submit]');
      this.submitLabel = this.form.querySelector('[data-notify-submit-label]');
      this.error = this.form.querySelector('[data-notify-state="error"]');
      this.messages = Object.assign({}, MESSAGES, window.CabinConfig && window.CabinConfig.waitlist);

      this.channels.forEach((radio) => radio.addEventListener('change', () => this.syncChannel()));
      this.form.addEventListener('submit', (event) => this.onSubmit(event));
      this.syncChannel();
    }

    get channel() {
      const checked = this.channels.find((radio) => radio.checked);
      return checked ? checked.value : 'email';
    }

    syncChannel() {
      const sms = this.channel === 'sms';
      if (this.phoneField) this.phoneField.hidden = !sms;
      if (this.phone) this.phone.required = sms;
      if (this.tags) this.tags.value = `${this.baseTags}, channel:${this.channel}`;
      this.showError('');
    }

    validate() {
      if (!this.email.value || !this.email.checkValidity()) {
        this.email.setAttribute('aria-invalid', 'true');
        this.email.focus();
        return this.messages.invalidEmail;
      }
      this.email.removeAttribute('aria-invalid');

      if (this.channel === 'sms' && this.phone) {
        const digits = this.phone.value.replace(/[^0-9+]/g, '');
        if (digits.length < 9 || !this.phone.checkValidity()) {
          this.phone.setAttribute('aria-invalid', 'true');
          this.phone.focus();
          return this.messages.invalidPhone;
        }
        this.phone.removeAttribute('aria-invalid');
      }
      return '';
    }

    showError(message) {
      if (!this.error) return;
      this.error.textContent = message;
      this.error.hidden = !message;
    }

    setBusy(busy) {
      this.root.classList.toggle('is-submitting', busy);
      if (this.submit) this.submit.disabled = busy;
      if (this.submitLabel) this.submitLabel.textContent = busy ? this.messages.submitting : this.messages.idle;
    }

    async onSubmit(event) {
      if (!window.fetch) return;
      event.preventDefault();

      const problem = this.validate();
      if (problem) {
        this.showError(problem);
        return;
      }

      this.setBusy(true);
      this.showError('');

      try {
        const response = await fetch(this.form.action, {
          method: 'POST',
          body: new FormData(this.form),
          headers: { Accept: 'text/html' },
          redirect: 'follow',
          credentials: 'same-origin'
        });

        const posted = response.ok && (response.redirected || response.url.includes('customer_posted=true'));
        if (!posted) {
          const html = await response.text();
          const match = html.match(/class="notify__state notify__state--error"[^>]*>\s*([^<]+)</);
          throw new Error(match ? match[1].trim() : this.messages.network);
        }

        this.renderSuccess();
      } catch (err) {
        this.setBusy(false);
        this.showError(err && err.message ? err.message : this.messages.network);
        throw err;
      }
    }

    renderSuccess() {
      const success = this.root.dataset.notifySuccess || (window.CabinConfig && window.CabinConfig.waitlist && window.CabinConfig.waitlist.success) || 'Noted. We will write once, when it is ready.';
      const state = document.createElement('div');
      state.className = 'notify__state notify__state--success';
      state.setAttribute('role', 'status');
      state.tabIndex = -1;
      state.innerHTML = '<span class="notify__tick" aria-hidden="true"></span><p class="cabin-serif cabin-serif--md"></p>';
      state.querySelector('p').textContent = success;

      this.form.replaceChildren(state);
      this.root.classList.remove('is-submitting');
      state.focus({ preventScroll: true });
      this.root.dispatchEvent(new CustomEvent('cabin-waitlist:success', {
        bubbles: true,
        detail: { key: this.root.dataset.notifyKey, channel: this.channel }
      }));
    }
  }

  const init = (scope) => {
    scope.querySelectorAll('[data-notify]:not([data-notify-ready])').forEach((root) => {
      root.setAttribute('data-notify-ready', '');
      new CabinWaitlist(root);
    });
  };

  init(document);
  document.addEventListener('shopify:section:load', (event) => init(event.target));

  window.CabinWaitlist = CabinWaitlist;
})();
