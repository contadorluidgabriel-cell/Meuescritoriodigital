import { useEffect, useRef, useState } from 'react'
function configureFrame(frame, view, record) {
  const frameWindow = frame?.contentWindow
  const frameDocument = frame?.contentDocument
  if (!frameWindow || !frameDocument) return false
  let style = frameDocument.getElementById('react-v11-bridge')
  if (!style) {
    style = frameDocument.createElement('style')
    style.id = 'react-v11-bridge'
    style.textContent = '.sidebar{display:none!important}.main,body.sidebar-collapsed .main{margin-left:0!important}@media(max-width:760px){body,body.sidebar-collapsed{padding-bottom:0!important}}'
    frameDocument.head.appendChild(style)
  }
  if (typeof frameWindow.showView === 'function') frameWindow.showView(view)
  if (record?.id && record.type === 'process' && typeof frameWindow.openProcessDetail === 'function') frameWindow.openProcessDetail(record.id)
  if (record?.id && record.type === 'obligation' && typeof frameWindow.openObClients === 'function') frameWindow.openObClients(record.id)
  return true
}

export default function LegacyModule({ view, record }) {
  const frameRef = useRef(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { if (loaded) configureFrame(frameRef.current, view, record) }, [loaded, record, view])
  function handleLoad() { configureFrame(frameRef.current, view, record); setLoaded(true) }
  return <section className="module-stage" aria-busy={!loaded}>
    {!loaded ? <div className="module-loading"><span>ED</span><b>Carregando módulo completo…</b></div> : null}
    <iframe ref={frameRef} className="module-frame" src="/legacy-v10-7.html" title={`Meu Escritório Digital — ${view}`} allow="clipboard-read; clipboard-write" onLoad={handleLoad} />
  </section>
}
