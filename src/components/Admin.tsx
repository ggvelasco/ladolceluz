import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { EVENT } from '../config/event'
import { api, ApiError, type AdminPassenger, type AdminReservation, type AdminResponse } from '../lib/api'
import { formatSeat } from '../lib/bus'
import { maskCpf, maskPhone } from '../lib/format'
import { Logo } from './Art'
import './Admin.css'

// Lista de embarque do RH. A senha (ADMIN_KEY do servidor) fica só na sessão da aba.

const KEY_STORAGE = 'ladolceluz:admin'

interface Row extends AdminPassenger {
  code: string
  createdAt: string
  bookedBy: string
}

const toRows = (reservations: AdminReservation[]): Row[] =>
  reservations
    .flatMap((reservation) => {
      const titular = reservation.passengers.find((p) => p.role === 'titular')
      return reservation.passengers.map((passenger) => ({
        ...passenger,
        code: reservation.code,
        createdAt: reservation.createdAt,
        bookedBy: titular?.nome ?? '',
      }))
    })
    .sort((a, b) => a.seat - b.seat)

/** Texto de célula seguro para planilhas (aspas escapadas; nada começa com =, +, - ou @). */
const cell = (value: string | number) => {
  const text = String(value)
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return `"${safe.replace(/"/g, '""')}"`
}

function downloadCsv(rows: Row[]) {
  const header = [
    'Poltrona',
    'Nome',
    'CPF',
    'Tipo',
    'Reservado por',
    'Contato de emergência',
    'Telefone de emergência',
    'Hospital de referência',
    'Convênio médico',
    'Alergias',
    'Necessidade especial',
    'Código',
    'Reservado em',
  ]
  const lines = rows.map((row) =>
    [
      formatSeat(row.seat),
      row.nome,
      maskCpf(row.cpf),
      row.role === 'titular' ? 'Colaborador' : 'Acompanhante',
      row.bookedBy,
      row.emergenciaNome,
      maskPhone(row.emergenciaTelefone),
      row.hospital,
      row.convenio,
      row.temAlergia ? row.alergias : 'Não',
      row.temNecessidade ? row.necessidade : 'Não',
      row.code,
      new Date(row.createdAt).toLocaleString('pt-BR'),
    ]
      .map(cell)
      .join(';'),
  )
  // BOM + ponto e vírgula: abre direto no Excel em português com os acentos certos.
  const blob = new Blob([`﻿${[header.map(cell).join(';'), ...lines].join('\r\n')}`], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'la-dolce-luz-lista-de-embarque.csv'
  link.click()
  URL.revokeObjectURL(url)
}

export default function Admin() {
  const [key, setKey] = useState(() => sessionStorage.getItem(KEY_STORAGE) ?? '')
  const [draft, setDraft] = useState('')
  const [data, setData] = useState<AdminResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const load = useCallback(async (adminKey: string) => {
    setLoading(true)
    setError(null)
    try {
      setData(await api.admin.list(adminKey))
      sessionStorage.setItem(KEY_STORAGE, adminKey)
      setKey(adminKey)
    } catch (failure) {
      const unauthorized = failure instanceof ApiError && failure.status === 401
      if (unauthorized) {
        sessionStorage.removeItem(KEY_STORAGE)
        setKey('')
        setData(null)
      }
      setError(failure instanceof ApiError ? failure.message : 'Não consegui carregar a lista.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    document.title = `Lista de embarque · ${EVENT.name}`
    const saved = sessionStorage.getItem(KEY_STORAGE)
    if (saved) load(saved)
  }, [load])

  const rows = useMemo(() => (data ? toRows(data.reservations) : []), [data])
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((row) =>
      [row.nome, row.bookedBy, row.code, row.cpf, formatSeat(row.seat)].some((value) => value.toLowerCase().includes(term)),
    )
  }, [rows, search])

  const login = (event: FormEvent) => {
    event.preventDefault()
    if (draft.trim()) load(draft.trim())
  }

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action()
      await load(key)
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'Não consegui concluir a ação.')
    }
  }

  const remove = (row: Row) => {
    const companion = row.role === 'acompanhante'
    const message = companion
      ? `Remover ${row.nome} (acompanhante) e liberar a poltrona ${formatSeat(row.seat)}?`
      : `Cancelar a reserva ${row.code} de ${row.nome}? As poltronas do titular e do acompanhante (se houver) serão liberadas.`
    if (!window.confirm(message)) return
    run(() => (companion ? api.admin.removeCompanion(key, row.code) : api.admin.cancel(key, row.code)))
  }

  if (!data) {
    return (
      <main className="admin admin--login">
        <form className="admin__login" onSubmit={login}>
          <Logo className="admin__logo" />
          <h1 className="display">Lista de embarque</h1>
          <p>Área do RH. Informe a senha do painel para ver quem vai e em qual poltrona.</p>
          <label htmlFor="admin-key">Senha</label>
          <input
            id="admin-key"
            type="password"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            autoComplete="current-password"
            autoFocus
          />
          {error && (
            <p className="admin__error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn" disabled={loading || !draft.trim()}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </main>
    )
  }

  const companions = rows.filter((row) => row.role === 'acompanhante').length
  const free = data.total - data.blocked.length - rows.length

  return (
    <main className="admin">
      <header className="admin__head">
        <div>
          <Logo className="admin__logo" />
          <h1 className="display">Lista de embarque</h1>
          <p>
            {EVENT.name} · {EVENT.date} · saída {EVENT.departure}
          </p>
        </div>
        <ul className="admin__stats">
          <li>
            <strong className="display">{rows.length}</strong> {rows.length === 1 ? 'reservada' : 'reservadas'}
          </li>
          <li>
            <strong className="display">{free}</strong> {free === 1 ? 'livre' : 'livres'}
          </li>
          <li>
            <strong className="display">{companions}</strong> {companions === 1 ? 'acompanhante' : 'acompanhantes'}
          </li>
        </ul>
      </header>

      <div className="admin__tools">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nome, CPF, poltrona ou código"
          aria-label="Buscar na lista"
        />
        <button type="button" className="btn btn--small btn--ghost" onClick={() => load(key)} disabled={loading}>
          {loading ? 'Atualizando…' : 'Atualizar'}
        </button>
        <button type="button" className="btn btn--small btn--ghost" onClick={() => window.print()}>
          Imprimir
        </button>
        <button type="button" className="btn btn--small" onClick={() => downloadCsv(rows)} disabled={!rows.length}>
          Exportar CSV
        </button>
        <button
          type="button"
          className="link"
          onClick={() => {
            sessionStorage.removeItem(KEY_STORAGE)
            setKey('')
            setData(null)
            setDraft('')
          }}
        >
          Sair
        </button>
      </div>

      {error && (
        <p className="admin__error" role="alert">
          {error}
        </p>
      )}

      <div className="admin__table">
        <table>
          <thead>
            <tr>
              <th>Poltrona</th>
              <th>Passageiro</th>
              <th>CPF</th>
              <th>Emergência</th>
              <th>Saúde</th>
              <th>Reserva</th>
              <th className="admin__actions">Ações</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.seat}>
                <td>
                  <strong className="display admin__seat">{formatSeat(row.seat)}</strong>
                </td>
                <td>
                  <strong>{row.nome}</strong>
                  <small>{row.role === 'titular' ? 'Colaborador' : `Acompanhante de ${row.bookedBy}`}</small>
                </td>
                <td className="admin__mono">{maskCpf(row.cpf)}</td>
                <td>
                  {row.emergenciaNome}
                  <small className="admin__mono">{maskPhone(row.emergenciaTelefone)}</small>
                </td>
                <td>
                  <small>Hospital: {row.hospital || '—'}</small>
                  <small>Convênio: {row.convenio || '—'}</small>
                  {row.temAlergia && <small className="admin__flag">Alergias: {row.alergias}</small>}
                  {row.temNecessidade && <small className="admin__flag">Necessidade especial: {row.necessidade}</small>}
                </td>
                <td>
                  <span className="admin__mono">{row.code}</span>
                  <small>{new Date(row.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</small>
                </td>
                <td className="admin__actions">
                  <button type="button" className="link" onClick={() => remove(row)}>
                    {row.role === 'titular' ? 'Cancelar reserva' : 'Remover'}
                  </button>
                </td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={7} className="admin__empty">
                  {rows.length ? 'Nada encontrado para essa busca.' : 'Nenhuma reserva ainda.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
