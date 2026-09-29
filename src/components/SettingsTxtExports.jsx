import { useState } from 'react'
import { downloadTxtExport } from '../lib/txtExports.js'
import './settings-txt-exports.css'

const options = [
  {
    id: 'clients',
    title: 'Clientes',
    description: 'Cadastro, contatos, situação, atendimento, parceiros, honorários, Drive e observações.',
    count: office => Array.isArray(office.clients) ? office.clients.length : 0,
  },
  {
    id: 'processes',
    title: 'Processos',
    description: 'Cliente, status, prazos, etapas, responsáveis, protocolos, Drive e observações.',
    count: office => Array.isArray(office.processes) ? office.processes.length : 0,
  },
  {
    id: 'finance',
    title: 'Financeiro',
    description: 'Contas a receber, contas a pagar, movimentações, contas, categorias e históricos.',
    count: office => (Array.isArray(office.finance) ? office.finance.length : 0)
      + (Array.isArray(office.financePayables) ? office.financePayables.length : 0)
      + (Array.isArray(office.financeMovements) ? office.financeMovements.length : 0),
  },
]

export default function SettingsTxtExports({ office = {} }) {
  const [notice, setNotice] = useState('')

  function exportTxt(type) {
    try {
      downloadTxtExport(office, type)
      setNotice('Arquivo TXT gerado.')
      setTimeout(() => setNotice(''), 1800)
    } catch (error) {
      console.error(error)
      setNotice('Não foi possível gerar o arquivo.')
      setTimeout(() => setNotice(''), 2200)
    }
  }

  return <section className="settings-txt-tool" aria-label="Exportação de dados em TXT">
    <header>
      <div>
        <span>Dados</span>
        <h2>Exportar dados em TXT</h2>
        <p>Gere arquivos de texto organizados a partir dos dados atuais do escritório.</p>
      </div>
      {notice ? <strong className="settings-txt-notice" role="status">{notice}</strong> : null}
    </header>

    <div className="settings-txt-grid">
      {options.map(option => {
        const count = option.count(office)
        return <article key={option.id}>
          <div>
            <h3>{option.title}</h3>
            <span>{count} registro{count === 1 ? '' : 's'}</span>
          </div>
          <p>{option.description}</p>
          <button type="button" onClick={() => exportTxt(option.id)}>Exportar TXT</button>
        </article>
      })}
    </div>
  </section>
}
