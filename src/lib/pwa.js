const INSTALL_DISMISS_KEY = 'med_pwa_install_dismissed_until'
const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000
let deferredInstallPrompt = null
let initialized = false

export function isStandaloneMode() {
  if (typeof window === 'undefined') return false
  return Boolean(window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone === true)
}

function canOfferInstall() {
  if (isStandaloneMode()) return false
  const dismissedUntil = Number(localStorage.getItem(INSTALL_DISMISS_KEY) || 0)
  return !dismissedUntil || dismissedUntil <= Date.now()
}

function removeInstallBanner() {
  document.getElementById('med-pwa-install')?.remove()
}

function dismissInstallBanner() {
  localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now() + DISMISS_FOR_MS))
  removeInstallBanner()
}

async function requestInstall() {
  if (!deferredInstallPrompt) return false
  const prompt = deferredInstallPrompt
  deferredInstallPrompt = null
  await prompt.prompt()
  const choice = await prompt.userChoice.catch(() => null)
  if (choice?.outcome === 'accepted') removeInstallBanner()
  return choice?.outcome === 'accepted'
}

function showInstallBanner() {
  if (!deferredInstallPrompt || !canOfferInstall() || document.getElementById('med-pwa-install')) return

  const banner = document.createElement('aside')
  banner.id = 'med-pwa-install'
  banner.className = 'med-pwa-install'
  banner.setAttribute('role', 'dialog')
  banner.setAttribute('aria-label', 'Instalar Meu Escritório Digital')
  banner.innerHTML = `
    <div class="med-pwa-install__icon" aria-hidden="true">MED</div>
    <div class="med-pwa-install__copy">
      <strong>Instalar Meu Escritório Digital</strong>
      <span>Abra o MED como aplicativo, em uma janela própria e com acesso rápido pelo Windows.</span>
    </div>
    <div class="med-pwa-install__actions">
      <button type="button" data-pwa-install>Instalar</button>
      <button type="button" class="secondary" data-pwa-dismiss>Agora não</button>
    </div>
  `

  banner.querySelector('[data-pwa-install]')?.addEventListener('click', async event => {
    const button = event.currentTarget
    button.disabled = true
    button.textContent = 'Abrindo…'
    try {
      const accepted = await requestInstall()
      if (!accepted) {
        button.disabled = false
        button.textContent = 'Instalar'
      }
    } catch {
      button.disabled = false
      button.textContent = 'Instalar'
    }
  })
  banner.querySelector('[data-pwa-dismiss]')?.addEventListener('click', dismissInstallBanner)
  document.body.appendChild(banner)
}

async function registerAppWorker() {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/push-sw.js', { scope: '/' })
  } catch (error) {
    console.warn('MED PWA: não foi possível registrar o service worker.', error)
    return null
  }
}

export function initPwaRuntime() {
  if (initialized || typeof window === 'undefined' || typeof document === 'undefined') return
  initialized = true

  if (isStandaloneMode()) document.documentElement.dataset.pwa = 'standalone'

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault()
    deferredInstallPrompt = event
    window.setTimeout(showInstallBanner, 1200)
  })

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null
    localStorage.removeItem(INSTALL_DISMISS_KEY)
    document.documentElement.dataset.pwa = 'standalone'
    removeInstallBanner()
  })

  if (document.readyState === 'complete') registerAppWorker()
  else window.addEventListener('load', registerAppWorker, { once: true })
}
