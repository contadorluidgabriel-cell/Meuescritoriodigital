const INSTALL_DISMISS_KEY = 'med_pwa_install_dismissed_until'
const STARTUP_CONFIRMED_KEY = 'med_pwa_startup_confirmed'
const STARTUP_DISMISS_KEY = 'med_pwa_startup_dismissed_until'
const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000
const STARTUP_DISMISS_FOR_MS = 24 * 60 * 60 * 1000
let deferredInstallPrompt = null
let initialized = false

export function isStandaloneMode() {
  if (typeof window === 'undefined') return false
  return Boolean(window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone === true)
}

export function isWindowsDevice() {
  if (typeof navigator === 'undefined') return false
  return /Windows/i.test(navigator.userAgent || '')
}

function browserFamily() {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent || ''
  if (/Edg\//i.test(ua)) return 'edge'
  if (/Chrome\//i.test(ua) || /Chromium\//i.test(ua)) return 'chrome'
  return 'other'
}

function startupGuide() {
  const family = browserFamily()
  if (family === 'edge') return {
    browser: 'Microsoft Edge',
    address: 'edge://apps',
    steps: [
      'Abra o Microsoft Edge e digite edge://apps na barra de endereço.',
      'No Meu Escritório Digital, abra as opções do aplicativo.',
      'Ative “Iniciar automaticamente ao entrar no dispositivo”.',
    ],
  }
  if (family === 'chrome') return {
    browser: 'Google Chrome',
    address: 'chrome://apps',
    steps: [
      'Abra o Google Chrome e digite chrome://apps na barra de endereço.',
      'Clique com o botão direito no Meu Escritório Digital.',
      'Ative “Iniciar app quando você fizer login”.',
    ],
  }
  return {
    browser: 'seu navegador',
    address: 'about://apps',
    steps: [
      'Abra a página de aplicativos instalados do navegador (about://apps).',
      'Localize o Meu Escritório Digital.',
      'Ative a opção de iniciar o aplicativo quando você entrar no computador, se disponível.',
    ],
  }
}

function canOfferInstall() {
  if (isStandaloneMode()) return false
  const dismissedUntil = Number(localStorage.getItem(INSTALL_DISMISS_KEY) || 0)
  return !dismissedUntil || dismissedUntil <= Date.now()
}

function canOfferStartupGuide() {
  if (!isStandaloneMode() || !isWindowsDevice()) return false
  if (localStorage.getItem(STARTUP_CONFIRMED_KEY) === '1') return false
  const dismissedUntil = Number(localStorage.getItem(STARTUP_DISMISS_KEY) || 0)
  return !dismissedUntil || dismissedUntil <= Date.now()
}

function removeInstallBanner() {
  document.getElementById('med-pwa-install')?.remove()
}

function removeStartupGuide() {
  document.getElementById('med-pwa-startup')?.remove()
}

function dismissInstallBanner() {
  localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now() + DISMISS_FOR_MS))
  removeInstallBanner()
}

function dismissStartupGuide() {
  localStorage.setItem(STARTUP_DISMISS_KEY, String(Date.now() + STARTUP_DISMISS_FOR_MS))
  removeStartupGuide()
}

function confirmStartupGuide() {
  localStorage.setItem(STARTUP_CONFIRMED_KEY, '1')
  localStorage.removeItem(STARTUP_DISMISS_KEY)
  removeStartupGuide()
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

  const startupNote = isWindowsDevice()
    ? ' Depois de instalar, marque a opção de iniciar automaticamente com o Windows quando o navegador oferecer.'
    : ''
  const banner = document.createElement('aside')
  banner.id = 'med-pwa-install'
  banner.className = 'med-pwa-install'
  banner.setAttribute('role', 'dialog')
  banner.setAttribute('aria-label', 'Instalar Meu Escritório Digital')
  banner.innerHTML = `
    <div class="med-pwa-install__icon" aria-hidden="true">MED</div>
    <div class="med-pwa-install__copy">
      <strong>Instalar Meu Escritório Digital</strong>
      <span>Abra o MED como aplicativo, em uma janela própria e com acesso rápido pelo Windows.${startupNote}</span>
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

async function copyStartupSteps(button) {
  const guide = startupGuide()
  const text = `Abrir o MED automaticamente com o Windows\n\n${guide.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}`
  try {
    await navigator.clipboard.writeText(text)
    const previous = button.textContent
    button.textContent = 'Passos copiados'
    window.setTimeout(() => { button.textContent = previous }, 1800)
  } catch {
    button.textContent = guide.address
  }
}

function showStartupGuide() {
  if (!canOfferStartupGuide() || document.getElementById('med-pwa-startup')) return
  const guide = startupGuide()
  const banner = document.createElement('aside')
  banner.id = 'med-pwa-startup'
  banner.className = 'med-pwa-startup'
  banner.setAttribute('role', 'dialog')
  banner.setAttribute('aria-label', 'Configurar abertura automática do MED')
  banner.innerHTML = `
    <div class="med-pwa-startup__icon" aria-hidden="true">↻</div>
    <div class="med-pwa-startup__copy">
      <strong>Abra o MED junto com o Windows</strong>
      <span>O ${guide.browser} exige uma confirmação sua para permitir a abertura automática no login.</span>
      <ol>${guide.steps.map(step => `<li>${step}</li>`).join('')}</ol>
    </div>
    <div class="med-pwa-startup__actions">
      <button type="button" data-pwa-startup-copy>Copiar passos</button>
      <button type="button" class="secondary" data-pwa-startup-done>Já ativei</button>
      <button type="button" class="tertiary" data-pwa-startup-later>Depois</button>
    </div>
  `
  banner.querySelector('[data-pwa-startup-copy]')?.addEventListener('click', event => copyStartupSteps(event.currentTarget))
  banner.querySelector('[data-pwa-startup-done]')?.addEventListener('click', confirmStartupGuide)
  banner.querySelector('[data-pwa-startup-later]')?.addEventListener('click', dismissStartupGuide)
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

  if (isStandaloneMode()) {
    document.documentElement.dataset.pwa = 'standalone'
    window.setTimeout(showStartupGuide, 1400)
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault()
    deferredInstallPrompt = event
    window.setTimeout(showInstallBanner, 1200)
  })

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null
    localStorage.removeItem(INSTALL_DISMISS_KEY)
    localStorage.removeItem(STARTUP_DISMISS_KEY)
    document.documentElement.dataset.pwa = 'standalone'
    removeInstallBanner()
  })

  if (document.readyState === 'complete') registerAppWorker()
  else window.addEventListener('load', registerAppWorker, { once: true })
}
