import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { loadOffice } from '../lib/storage.js'

const todoistFunctionUrl = 'https://pbwnzkmbcuoyyoojgnay.supabase.co/functions/v1/todoist-sync'

const bridgeCss = `
:root{
  --accent:#2456E8!important;
  --accent-rgb:36,86,232!important;
  --accent-soft:#EEF3FF!important;
}
.sidebar,.topbar{display:none!important}
.main,body.sidebar-collapsed .main{margin-left:0!important;min-height:100vh!important}
.content{padding:0!important;max-width:none!important}
#configuracoes{
  box-sizing:border-box!important;
  width:100%!important;
  max-width:1440px!important;
  min-height:100vh!important;
  margin:0 auto!important;
  padding:26px 30px 44px!important;
  background:#F7F9FC!important;
}
#configuracoes .toolbar.settings-heading{
  min-height:0!important;
  margin:0 0 20px!important;
  padding:0!important;
  align-items:flex-end!important;
}
#configuracoes .toolbar.settings-heading h2{
  margin:0!important;
  color:#111827!important;
  font-size:28px!important;
  line-height:1.15!important;
  letter-spacing:-.5px!important;
}
#configuracoes .toolbar.settings-heading p{
  margin:6px 0 0!important;
  color:#667085!important;
  font-size:12px!important;
}
#configuracoes .settings-version{
  flex:0 0 auto!important;
  padding:7px 10px!important;
  border:1px solid #DCE6FF!important;
  border-radius:999px!important;
  background:#EEF3FF!important;
  color:#2456E8!important;
  font-size:10px!important;
  font-weight:800!important;
}
#configuracoes .settings-layout{
  display:grid!important;
  grid-template-columns:220px minmax(0,1fr)!important;
  gap:20px!important;
  align-items:start!important;
}
#configuracoes .settings-nav{
  position:sticky!important;
  top:20px!important;
  display:grid!important;
  grid-template-columns:1fr!important;
  gap:4px!important;
  min-width:0!important;
  padding:8px!important;
  border:1px solid #E2E8F0!important;
  border-radius:16px!important;
  background:#FFF!important;
  box-shadow:0 8px 26px rgba(15,23,42,.06)!important;
}
#configuracoes .settings-tab{
  box-sizing:border-box!important;
  width:100%!important;
  min-width:0!important;
  padding:11px 12px!important;
  border:0!important;
  border-radius:10px!important;
  background:transparent!important;
  color:#344054!important;
  text-align:left!important;
}
#configuracoes .settings-tab span{
  display:block!important;
  color:inherit!important;
  font-size:12px!important;
  font-weight:750!important;
}
#configuracoes .settings-tab small{
  display:block!important;
  margin-top:3px!important;
  color:#98A2B3!important;
  font-size:9.5px!important;
  line-height:1.25!important;
}
#configuracoes .settings-tab:hover{background:#F7F9FC!important}
#configuracoes .settings-tab.active{
  background:#EEF3FF!important;
  color:#2456E8!important;
  box-shadow:inset 3px 0 0 #2456E8!important;
}
#configuracoes .settings-content{min-width:0!important}
#configuracoes .settings-panel{min-width:0!important}
#configuracoes .settings-panel-head{
  display:flex!important;
  align-items:flex-start!important;
  justify-content:space-between!important;
  gap:16px!important;
  margin:0 0 14px!important;
}
#configuracoes .settings-panel-head h3{
  margin:0!important;
  color:#111827!important;
  font-size:17px!important;
}
#configuracoes .settings-panel-head p{
  margin:4px 0 0!important;
  color:#667085!important;
  font-size:11px!important;
  line-height:1.45!important;
}
#configuracoes .card,
#configuracoes .settings-card,
#configuracoes .department-row{
  box-sizing:border-box!important;
  min-width:0!important;
  border:1px solid #E2E8F0!important;
  border-radius:15px!important;
  background:#FFF!important;
  box-shadow:0 8px 24px rgba(15,23,42,.05)!important;
  backdrop-filter:none!important;
}
#configuracoes .settings-card{padding:20px!important}
#configuracoes .form-grid{
  display:grid!important;
  grid-template-columns:repeat(2,minmax(0,1fr))!important;
  gap:15px!important;
}
#configuracoes .field{min-width:0!important}
#configuracoes .field label{
  display:block!important;
  margin-bottom:6px!important;
  color:#344054!important;
  font-size:10px!important;
  font-weight:750!important;
}
#configuracoes input,
#configuracoes select,
#configuracoes textarea{
  box-sizing:border-box!important;
  width:100%!important;
  max-width:100%!important;
  min-height:38px!important;
  border:1px solid #D0D5DD!important;
  border-radius:9px!important;
  background:#FFF!important;
  color:#101828!important;
  box-shadow:none!important;
}
#configuracoes input:focus,
#configuracoes select:focus,
#configuracoes textarea:focus{
  border-color:#2456E8!important;
  box-shadow:0 0 0 3px rgba(36,86,232,.12)!important;
  outline:none!important;
}
#configuracoes .identity-preview{
  min-width:210px!important;
  border:1px solid #1D2939!important;
  border-radius:13px!important;
  background:linear-gradient(135deg,#111827,#000)!important;
  color:#FFF!important;
  box-shadow:none!important;
}
#configuracoes .identity-preview small{color:#C7D2FE!important}
#configuracoes .btn-primary{
  border-color:#2456E8!important;
  background:#2456E8!important;
  color:#FFF!important;
  box-shadow:none!important;
}
#configuracoes .btn-light{
  border-color:#D0D5DD!important;
  background:#FFF!important;
  color:#344054!important;
  box-shadow:none!important;
}
#configuracoes .settings-actions{
  display:flex!important;
  align-items:center!important;
  justify-content:space-between!important;
  gap:12px!important;
  margin-top:18px!important;
  padding-top:16px!important;
  border-top:1px solid #EAECF0!important;
}
#configuracoes .department-list{display:grid!important;gap:10px!important}
#configuracoes .department-row{padding:14px 16px!important}
#configuracoes .grid{min-width:0!important}
#configuracoes .g2{grid-template-columns:repeat(2,minmax(0,1fr))!important}
#configuracoes .g3{grid-template-columns:repeat(3,minmax(0,1fr))!important}
#configuracoes .integration-card{
  display:grid!important;
  grid-template-columns:48px minmax(0,1fr) auto!important;
  gap:14px!important;
  align-items:center!important;
}
#configuracoes .integration-actions{display:flex!important;gap:8px!important;flex-wrap:wrap!important}
#configuracoes .todoist-integration-card{margin-top:14px!important}
#configuracoes .todoist-integration-icon{
  display:grid!important;
  place-items:center!important;
  width:42px!important;
  height:42px!important;
  border-radius:12px!important;
  background:#DC4C3E!important;
  color:#FFF!important;
  font-size:22px!important;
  font-weight:900!important;
}
#configuracoes .todoist-integration-copy{min-width:0!important}
#configuracoes .todoist-integration-copy strong{
  display:block!important;
  margin:0 0 4px!important;
  color:#101828!important;
  font-size:14px!important;
}
#configuracoes .todoist-integration-copy p{
  margin:0!important;
  color:#667085!important;
  font-size:11px!important;
  line-height:1.45!important;
}
#configuracoes .todoist-status{
  display:inline-flex!important;
  align-items:center!important;
  gap:6px!important;
  margin-top:7px!important;
  color:#16A34A!important;
  font-size:10px!important;
  font-weight:800!important;
}
#configuracoes .todoist-status::before{
  content:''!important;
  width:7px!important;
  height:7px!important;
  border-radius:999px!important;
  background:currentColor!important;
}
#configuracoes .todoist-status.is-checking{color:#667085!important}
#configuracoes .todoist-status.is-error{color:#DC2626!important}
#configuracoes .todoist-sync-note{
  grid-column:1/-1!important;
  margin:0!important;
  padding:10px 12px!important;
  border-radius:10px!important;
  background:#FFF5F3!important;
  color:#7A271A!important;
  font-size:10px!important;
  line-height:1.45!important;
}
#configuracoes .backup-action-card{min-height:165px!important}
@media(max-width:980px){
  #configuracoes{padding:22px 20px 36px!important}
  #configuracoes .settings-layout{grid-template-columns:1fr!important}
  #configuracoes .settings-nav{
    position:static!important;
    grid-template-columns:repeat(5,minmax(0,1fr))!important;
  }
  #configuracoes .settings-tab{padding:10px 8px!important;text-align:center!important}
  #configuracoes .settings-tab small{display:none!important}
  #configuracoes .settings-tab.active{box-shadow:inset 0 -3px 0 #2456E8!important}
  #configuracoes .g3{grid-template-columns:1fr!important}
}
@media(max-width:720px){
  body,body.sidebar-collapsed{padding-bottom:0!important}
  #configuracoes{padding:18px 14px 30px!important}
  #configuracoes .toolbar.settings-heading{align-items:flex-start!important;flex-direction:column!important}
  #configuracoes .settings-nav{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  #configuracoes .form-grid,
  #configuracoes .g2{grid-template-columns:1fr!important}
  #configuracoes .settings-panel-head{flex-direction:column!important}
  #configuracoes .identity-preview{width:100%!important;min-width:0!important}
  #configuracoes .settings-actions{align-items:stretch!important;flex-direction:column!important}
  #configuracoes .settings-actions .btn{width:100%!important}
  #configuracoes .integration-card{grid-template-columns:44px minmax(0,1fr)!important}
  #configuracoes .integration-actions{grid-column:1/-1!important}
  #configuracoes .integration-actions .btn{flex:1 1 auto!important}
}
`

async function invokeTodoist(body) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  const accessToken = sessionData?.session?.access_token
  if (!accessToken) throw new Error('Sessão inválida. Entre novamente.')

  const response = await fetch(todoistFunctionUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  let data = {}
  try { data = await response.json() } catch { /* response without JSON body */ }
  if (!response.ok) throw new Error(data?.error || data?.message || `Todoist respondeu ${response.status}.`)
  return data || {}
}

function updateTodoistCard(card, { status = 'Verificando Todoist…', note = 'Projeto Meu Escritório Digital · sincronização segura por tarefa.', state = 'checking', busy = false } = {}) {
  const statusNode = card?.querySelector('[data-todoist-status]')
  const noteNode = card?.querySelector('[data-todoist-note]')
  const syncButton = card?.querySelector('[data-todoist-sync]')
  const verifyButton = card?.querySelector('[data-todoist-verify]')
  if (statusNode) {
    statusNode.textContent = status
    statusNode.classList.toggle('is-checking', state === 'checking')
    statusNode.classList.toggle('is-error', state === 'error')
  }
  if (noteNode) noteNode.textContent = note
  if (syncButton) {
    syncButton.disabled = busy
    syncButton.textContent = busy ? 'Sincronizando…' : 'Sincronizar agora'
  }
  if (verifyButton) verifyButton.disabled = busy
}

async function verifyTodoistCard(card) {
  updateTodoistCard(card, { busy: true })
  try {
    const data = await invokeTodoist({ action: 'status' })
    if (!data?.configured) {
      updateTodoistCard(card, { status: 'Configuração pendente', note: 'O token do Todoist ainda não está disponível no Supabase.', state: 'error' })
      return
    }
    updateTodoistCard(card, { status: data.connected ? 'Todoist conectado' : 'Todoist indisponível', note: 'Projeto Meu Escritório Digital · tarefas separadas do Meu Planner Digital.', state: data.connected ? 'connected' : 'error' })
  } catch (error) {
    updateTodoistCard(card, { status: 'Falha na conexão', note: error.message || 'Não foi possível verificar o Todoist.', state: 'error' })
  }
}

async function syncTodoistCard(card) {
  updateTodoistCard(card, { status: 'Sincronizando Todoist…', note: 'Enviando as tarefas atuais do Escritório sem propagar exclusões.', state: 'checking', busy: true })
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError
    const userId = sessionData?.session?.user?.id
    if (!userId) throw new Error('Sessão inválida. Entre novamente.')
    const office = loadOffice(userId)
    const tasks = Array.isArray(office.tasks) ? office.tasks : []
    const data = await invokeTodoist({ action: 'sync', tasks })
    const created = Number(data.created || 0)
    const pushed = Number(data.pushed || 0)
    const completed = Number(data.completedFromTodoist || 0)
    const detail = tasks.length
      ? `${tasks.length} tarefa${tasks.length === 1 ? '' : 's'} verificada${tasks.length === 1 ? '' : 's'} · ${created} criada${created === 1 ? '' : 's'} · ${pushed} atualizada${pushed === 1 ? '' : 's'}${completed ? ` · ${completed} concluída${completed === 1 ? '' : 's'} no Todoist` : ''}.`
      : 'Sincronização concluída. Não há tarefas cadastradas no Escritório para enviar agora.'
    updateTodoistCard(card, { status: 'Todoist sincronizado', note: detail, state: 'connected' })
  } catch (error) {
    updateTodoistCard(card, { status: 'Falha na sincronização', note: error.message || 'Não foi possível sincronizar com o Todoist.', state: 'error' })
  }
}

function injectTodoistCard(frameDocument) {
  if (!frameDocument) return false
  let card = frameDocument.getElementById('todoist-integration-card')
  const integrationCards = Array.from(frameDocument.querySelectorAll('#configuracoes .integration-card'))
  const googleCard = integrationCards.find(node => /Google Tasks/i.test(node.textContent || '')) || integrationCards[0]
  if (!googleCard && !card) return false

  if (!card) {
    card = frameDocument.createElement('div')
    card.id = 'todoist-integration-card'
    card.className = 'settings-card integration-card todoist-integration-card'
    card.innerHTML = `
      <div class="todoist-integration-icon" aria-hidden="true">✓</div>
      <div class="todoist-integration-copy">
        <strong>Todoist</strong>
        <p>Tarefas do Escritório sincronizadas com o projeto Meu Escritório Digital, organizadas por departamento.</p>
        <span class="todoist-status is-checking" data-todoist-status>Verificando Todoist…</span>
      </div>
      <div class="integration-actions">
        <button type="button" class="btn btn-primary" data-todoist-sync>Sincronizar agora</button>
        <button type="button" class="btn btn-light" data-todoist-verify>Verificar conexão</button>
      </div>
      <p class="todoist-sync-note" data-todoist-note>Projeto separado do Meu Planner Digital. Exclusões não são propagadas automaticamente.</p>
    `
    googleCard.insertAdjacentElement('afterend', card)
    card.querySelector('[data-todoist-sync]')?.addEventListener('click', () => syncTodoistCard(card))
    card.querySelector('[data-todoist-verify]')?.addEventListener('click', () => verifyTodoistCard(card))
  }

  verifyTodoistCard(card)
  return true
}

function configureFrame(frame, view, record) {
  const frameWindow = frame?.contentWindow
  const frameDocument = frame?.contentDocument
  if (!frameWindow || !frameDocument) return false

  let style = frameDocument.getElementById('react-v11-bridge')
  if (!style) {
    style = frameDocument.createElement('style')
    style.id = 'react-v11-bridge'
    frameDocument.head.appendChild(style)
  }
  style.textContent = bridgeCss

  frameDocument.body.dataset.reactBridgeView = view || ''
  const activateView = () => {
    if (frameDocument.body.dataset.reactBridgeView !== (view || '')) return false
    if (typeof frameWindow.showView === 'function') {
      frameWindow.showView(view)
      return true
    }
    const target = frameDocument.getElementById(view)
    if (target?.classList.contains('active')) return true
    const button = frameDocument.querySelector(`[data-view="${view}"]`)
    if (button) {
      button.click()
      return true
    }
    if (target) {
      frameDocument.querySelectorAll('.view').forEach(node => node.classList.toggle('active', node === target))
      frameDocument.querySelectorAll('.nav-btn').forEach(node => node.classList.toggle('active', node.dataset.view === view))
      return true
    }
    return false
  }
  activateView()
  ;[60, 180, 420].forEach(delay => setTimeout(activateView, delay))

  if (view === 'configuracoes') {
    const version = frameDocument.querySelector('#configuracoes .settings-version')
    if (version) version.textContent = 'V11.1 · Nuvem'
    const ensureTodoistCard = () => injectTodoistCard(frameDocument)
    ensureTodoistCard()
    ;[120, 360, 800].forEach(delay => setTimeout(ensureTodoistCard, delay))
    frameDocument.querySelectorAll('#configuracoes .settings-tab').forEach(tab => {
      if (tab.dataset.todoistBridgeBound === '1') return
      tab.dataset.todoistBridgeBound = '1'
      tab.addEventListener('click', () => setTimeout(ensureTodoistCard, 30))
    })
  }

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