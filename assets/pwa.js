(function (window, document) {
  'use strict';

  let deferredInstallPrompt = null;
  let installPanel = null;
  let installButton = null;
  let installStatus = null;
  let installHelp = null;

  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function setInstalledUI() {
    if (!installPanel) return;
    installPanel.classList.add('is-installed');
    if (installButton) {
      installButton.disabled = true;
      installButton.setAttribute('aria-disabled', 'true');
      installButton.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">check_circle</span><span>APP INSTALLED</span>';
    }
    if (installStatus) installStatus.textContent = 'Installed on this device. Open it from your Home Screen or app launcher.';
  }

  function openHelp(message) {
    if (!installHelp) return;
    const body = installHelp.querySelector('[data-install-help-body]');
    if (body) body.innerHTML = message;
    installHelp.hidden = false;
    installHelp.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => installHelp.classList.add('is-open'));
    const close = installHelp.querySelector('[data-install-help-close]');
    if (close) close.focus({preventScroll:true});
  }

  function closeHelp() {
    if (!installHelp) return;
    installHelp.classList.remove('is-open');
    installHelp.setAttribute('aria-hidden', 'true');
    setTimeout(() => { if (!installHelp.classList.contains('is-open')) installHelp.hidden = true; }, 180);
  }

  async function requestInstall() {
    if (isStandalone()) {
      setInstalledUI();
      return { installed: true, reason: 'standalone' };
    }
    if (deferredInstallPrompt) {
      const promptEvent = deferredInstallPrompt;
      deferredInstallPrompt = null;
      promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice && choice.outcome === 'accepted') {
        if (installStatus) installStatus.textContent = 'Installing NCLEX-RN…';
        if (window.PBXHaptics) window.PBXHaptics.confirm();
        return { installed: true, reason: 'accepted' };
      }
      if (installStatus) installStatus.textContent = 'Installation cancelled. You can install it whenever you are ready.';
      return { installed: false, reason: 'dismissed' };
    }

    if (isIOS()) {
      openHelp('<strong>Install on iPhone/iPad</strong><br>Tap the <b>Share</b> button in Safari, choose <b>Add to Home Screen</b>, then tap <b>Add</b>.');
      return { installed: false, reason: 'ios-help' };
    }

    openHelp('<strong>Install NCLEX-RN</strong><br>Open your browser menu and choose <b>Install app</b>, <b>Install NCLEX-RN</b>, or <b>Add to Home Screen</b>. If the option is not visible yet, reload this page after it has been served over HTTPS.');
    return { installed: false, reason: 'manual-help' };
  }

  function bindInstallUI() {
    installPanel = document.getElementById('pwaInstallPanel');
    installButton = document.getElementById('pwaInstallButton');
    installStatus = document.getElementById('pwaInstallStatus');
    installHelp = document.getElementById('pwaInstallHelp');
    if (!installPanel) return;

    if (isStandalone()) setInstalledUI();
    else if (installStatus) installStatus.textContent = 'Install once for a full-screen app experience and faster access.';

    if (installButton) installButton.addEventListener('click', requestInstall);
    if (installHelp) {
      installHelp.addEventListener('click', event => {
        if (event.target.matches('[data-install-help-backdrop], [data-install-help-close]') || event.target.closest('[data-install-help-close]')) closeHelp();
      });
    }
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeHelp(); });
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (installButton) installButton.disabled = false;
    if (installStatus && !isStandalone()) installStatus.textContent = 'Ready to install on this device.';
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    setInstalledUI();
    if (window.PBXHaptics) window.PBXHaptics.confirm();
  });

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (!/^https?:$/.test(location.protocol) || (location.protocol === 'http:' && !/^(localhost|127\\.0\\.0\\.1|\\[::1\\])$/.test(location.hostname))) return;
    try {
      const registration = await navigator.serviceWorker.register('./service-worker.js', {scope:'./'});
      registration.update().catch(() => {});
    } catch (error) {
      console.warn('PWA service worker registration failed.', error);
    }
  }

  window.PBXPWA = Object.freeze({ requestInstall, isStandalone });
  document.addEventListener('DOMContentLoaded', () => { bindInstallUI(); registerServiceWorker(); });
})(window, document);
