import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from 'react'
import { EVENT } from '../config/event'
import { api, ApiError, type Reservation, type Ticket } from '../lib/api'
import { formatSeat } from '../lib/bus'
import { isValidCpf, maskCpf } from '../lib/format'
import { gsap, prefersReducedMotion, useGSAP } from '../lib/gsap'
import { Illus, Wordmark } from './Art'
import './Tickets.css'

/** Barras decorativas derivadas do código da reserva (não é um código de barras de verdade). */
function barcode(code: string) {
  const widths: number[] = []
  for (const char of code.repeat(2)) {
    const n = char.charCodeAt(0)
    widths.push(1 + (n % 3), 1 + ((n >> 2) % 4))
  }
  return widths
}

function TicketCard({ ticket, code }: { ticket: Ticket; code: string }) {
  const card = useRef<HTMLElement>(null)

  useEffect(() => {
    const element = card.current
    return () => {
      gsap.killTweensOf(element)
    }
  }, [])

  // O ticket inclina seguindo o mouse, como um cartão na mão.
  const tilt = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'mouse' || prefersReducedMotion()) return
    const box = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - box.left) / box.width - 0.5
    const y = (event.clientY - box.top) / box.height - 0.5
    gsap.to(event.currentTarget, {
      rotationY: x * 12,
      rotationX: -y * 10,
      transformPerspective: 900,
      duration: 0.5,
      ease: 'power2.out',
    })
  }
  const settle = (event: PointerEvent<HTMLElement>) => {
    gsap.to(event.currentTarget, { rotationY: 0, rotationX: 0, duration: 0.9, ease: 'elastic.out(1, 0.5)' })
  }

  return (
    <article className="ticket" ref={card} onPointerMove={tilt} onPointerLeave={settle}>
      <div className="ticket__main">
        <header className="ticket__head">
          <span className="ticket__kind">Cartão de embarque</span>
          <Wordmark className="ticket__brand" />
        </header>

        <p className="ticket__label">{ticket.role === 'titular' ? 'Passageiro' : 'Passageiro · acompanhante'}</p>
        <p className="ticket__name serif">{ticket.nome}</p>

        <div className="ticket__route">
          <div>
            <span className="ticket__label">De</span>
            <strong>{EVENT.departureFrom}</strong>
          </div>
          <span className="ticket__path" aria-hidden="true">
            <Illus name="bus" />
          </span>
          <div>
            <span className="ticket__label">Para</span>
            <strong>{EVENT.venue}</strong>
          </div>
        </div>

        <dl className="ticket__meta">
          <div>
            <dt>Data</dt>
            <dd>{EVENT.date}</dd>
          </div>
          <div>
            <dt>Saída</dt>
            <dd>{EVENT.departure}</dd>
          </div>
          <div>
            <dt>Retorno</dt>
            <dd>{EVENT.returnTime}</dd>
          </div>
          <div>
            <dt>Classe</dt>
            <dd>Primeira</dd>
          </div>
        </dl>
      </div>

      <div className="ticket__stub">
        <span className="ticket__label">Poltrona</span>
        <strong className="ticket__seat display">{formatSeat(ticket.seat)}</strong>
        <div className="ticket__bars" aria-hidden="true">
          {barcode(code).map((width, index) => (
            <i key={index} style={{ width }} />
          ))}
        </div>
        <code className="ticket__code">{code}</code>
      </div>
    </article>
  )
}

interface TicketsModalProps {
  open: boolean
  reservations: Reservation[]
  onClose: () => void
  /** Reserva encontrada pela consulta de CPF: passa a ficar salva neste aparelho. */
  onFound: (reservation: Reservation) => void
}

export function TicketsModal({ open, reservations, onClose, onFound }: TicketsModalProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [cpf, setCpf] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)

  const total = reservations.reduce((sum, reservation) => sum + reservation.tickets.length, 0)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])

  useGSAP(
    () => {
      if (!open || prefersReducedMotion()) return
      gsap.from('.tickets__head > *, .lookup, .tickets__empty', { y: 24, autoAlpha: 0, stagger: 0.08, duration: 0.6, ease: 'power3.out' })
      gsap.from('.ticket', {
        y: 120,
        rotation: () => gsap.utils.random(-9, 9),
        autoAlpha: 0,
        stagger: 0.14,
        duration: 0.95,
        ease: 'back.out(1.3)',
        delay: 0.1,
      })
    },
    { scope: dialog, dependencies: [open, total] },
  )

  const lookup = async (event: FormEvent) => {
    event.preventDefault()
    if (!isValidCpf(cpf)) {
      setError('Confira o CPF: esse número não é válido.')
      return
    }
    setSearching(true)
    setError(null)
    try {
      onFound(await api.lookup(cpf))
      setCpf('')
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'Algo deu errado. Tente de novo.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <dialog
      className="tickets"
      ref={dialog}
      aria-labelledby="tickets-titulo"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="tickets__panel">
        <header className="tickets__head">
          <div>
            <p className="eyebrow">
              {EVENT.name} · {EVENT.edition}
            </p>
            <h2 className="display tickets__title" id="tickets-titulo">
              Seus tickets
            </h2>
          </div>
          <button type="button" className="tickets__close" onClick={onClose} aria-label="Fechar tickets">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 5l14 14M19 5L5 19" />
            </svg>
          </button>
        </header>

        {total > 0 ? (
          <ul className="tickets__list">
            {reservations.flatMap((reservation) =>
              reservation.tickets.map((ticket) => (
                <li key={`${reservation.code}-${ticket.seat}`}>
                  <TicketCard ticket={ticket} code={reservation.code} />
                </li>
              )),
            )}
          </ul>
        ) : (
          <p className="tickets__empty serif">Ainda não há tickets salvos neste aparelho.</p>
        )}

        <form className="lookup" onSubmit={lookup} noValidate>
          <label htmlFor="lookup-cpf">
            {total > 0 ? 'Procurando outra reserva? Consulte pelo CPF.' : 'Reservou em outro aparelho? Consulte pelo CPF.'}
          </label>
          <div className="lookup__row">
            <input
              id="lookup-cpf"
              value={cpf}
              onChange={(event) => setCpf(maskCpf(event.target.value))}
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'lookup-erro' : undefined}
            />
            <button type="submit" className="btn btn--small" disabled={searching}>
              {searching ? 'Buscando…' : 'Buscar'}
            </button>
          </div>
          {error && (
            <p className="lookup__error" id="lookup-erro" role="alert">
              {error}
            </p>
          )}
        </form>
      </div>
    </dialog>
  )
}
