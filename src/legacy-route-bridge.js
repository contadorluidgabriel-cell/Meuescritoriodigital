function legacyViewFromFrame(frame) {
  const title = frame?.getAttribute('title') || ''
  const match = title.match(/—\s*([^—]+)$/)
  return match?.[1]?.trim() || ''
}

function activateLegacyView(frame) {
  const view = legacyViewFromFrame(frame)
  if (!view) return false

  try {
    const doc = frame.contentDocument
    if (!doc) return false

    const target = doc.getElementById(view)
    if (target?.classList.contains('active')) return true

    const button = doc.querySelector(`[data-view="${view}"]`)
    if (button) {
      button.click()
      return true
    }

    if (target) {
      doc.querySelectorAll('.view').forEach(node => node.classList.toggle('active', node === target))
      doc.querySelectorAll('.nav-btn').forEach(node => node.classList.toggle('active', node.dataset.view === view))
      return true
    }
  } catch {
    return false
  }

  return false
}

function bindLegacyFrame(frame) {
  if (!(frame instanceof HTMLIFrameElement) || !frame.classList.contains('module-frame')) return
  if (frame.dataset.routeBridgeBound === '1') return
  frame.dataset.routeBridgeBound = '1'

  const sync = () => {
    ;[0, 60, 180, 420].forEach(delay => setTimeout(() => activateLegacyView(frame), delay))
  }

  frame.addEventListener('load', sync)
  sync()
}

function scanLegacyFrames(root = document) {
  root.querySelectorAll?.('iframe.module-frame').forEach(bindLegacyFrame)
}

const observer = new MutationObserver(mutations => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (!(node instanceof Element)) continue
      if (node.matches?.('iframe.module-frame')) bindLegacyFrame(node)
      scanLegacyFrames(node)
    }
  }
})

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    scanLegacyFrames()
    observer.observe(document.documentElement, { childList: true, subtree: true })
  }, { once: true })
} else {
  scanLegacyFrames()
  observer.observe(document.documentElement, { childList: true, subtree: true })
}
