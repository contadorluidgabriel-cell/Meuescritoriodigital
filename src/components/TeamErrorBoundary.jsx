import { Component } from 'react'

export default class TeamErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('TeamManagement render failed', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return <section className="team-shell">
      <div className="team-panel team-access-state">
        <header>
          <div>
            <span>Equipe do escritório</span>
            <h2>Não foi possível abrir a Equipe</h2>
            <p>O restante do escritório continua disponível e nenhum dado foi apagado.</p>
          </div>
        </header>
        <div className="team-loading">
          <p>O módulo encontrou um erro ao montar esta tela.</p>
          <button type="button" onClick={() => window.location.reload()}>Recarregar sistema</button>
        </div>
      </div>
    </section>
  }
}
