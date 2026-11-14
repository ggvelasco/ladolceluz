import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { EVENT } from '../config/event'
import { api, ApiError, type Reservation, type Role } from '../lib/api'
import { formatSeat, TOTAL_SEATS } from '../lib/bus'
import { cx, firstName, onlyDigits } from '../lib/format'
import { gsap, prefersReducedMotion, useGSAP } from '../lib/gsap'
import { Coaster, Illus, type IllusName } from './Art'
import {
  EMPTY_PASSENGER,
  PassengerFields,
  toPassengerData,
  validatePassenger,
  type PassengerErrors,
  type PassengerForm,
} from './PassengerFields'
import { SeatMap, type Selection } from './SeatMap'
import './Checkin.css'

type Step = 'dados' | 'acompanhante' | 'poltronas' | 'confirmado'

const ROUTE: Array<{ step: Step; label: string }> = [
  { step: 'dados', label: 'Seus dados' },
  { step: 'acompanhante', label: 'Acompanhante' },
  { step: 'poltronas', label: 'Poltronas' },
  { step: 'confirmado', label: 'Ticket' },
]

const NO_SEATS: Selection = { titular: null, acompanhante: null }
const POLL_MS = 6000

interface CheckinProps {
  /** Reservas já salvas neste aparelho. */
  reservations: Reservation[]
  onConfirmed: (reservation: Reservation) => void
  onShowTickets: () => void
}

/** Chuva de frutas cítricas na confirmação. */
function citrusBurst(container: HTMLElement) {
  const kinds = ['slice', 'slice', 'lemon', 'dot', 'dot', 'leaf']
  const { width } = container.getBoundingClientRect()
  for (let i = 0; i < 46; i++) {
    const piece = document.createElement('i')
    piece.className = `confetti confetti--${kinds[i % kinds.length]}`
    container.appendChild(piece)
    const spread = gsap.utils.random(-width * 0.48, width * 0.48)
    const rise = gsap.utils.random(120, 380)
    gsap.set(piece, { xPercent: -50, yPercent: -50, scale: gsap.utils.random(0.6, 1.3), rotation: gsap.utils.random(0, 360) })
    gsap
      .timeline({ onComplete: () => piece.remove() })
      .to(piece, { x: spread, duration: 2.6, ease: 'power1.out' }, 0)
      .to(piece, { y: -rise, duration: 0.75, ease: 'power2.out' }, 0)
      .to(piece, { y: gsap.utils.random(260, 560), duration: 1.7, ease: 'power2.in' }, 0.75)
      .to(piece, { rotation: `+=${gsap.utils.random(-540, 540)}`, duration: 2.6, ease: 'none' }, 0)
      .to(piece, { autoAlpha: 0, duration: 0.5 }, 2)
  }
}

export function Checkin({ reservations, onConfirmed, onShowTickets }: CheckinProps) {
  const card = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const firstRender = useRef(true)

  const [step, setStep] = useState<Step>(() => (reservations.length ? 'confirmado' : 'dados'))
  const [confirmedCode, setConfirmedCode] = useState<string | null>(null)
  const [celebrate, setCelebrate] = useState(false)

  const [titular, setTitular] = useState<PassengerForm>(EMPTY_PASSENGER)
  const [companion, setCompanion] = useState<PassengerForm>(EMPTY_PASSENGER)
  const [hasCompanion, setHasCompanion] = useState<boolean | null>(null)
  const [titularErrors, setTitularErrors] = useState<PassengerErrors>({})
  const [companionErrors, setCompanionErrors] = useState<PassengerErrors>({})
  const [choiceError, setChoiceError] = useState(false)

  const [taken, setTaken] = useState<Map<number, string>>(() => new Map())
  const [seatsStatus, setSeatsStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [selection, setSelection] = useState<Selection>(NO_SEATS)
  const [active, setActive] = useState<Role>('titular')
  const [notice, setNotice] = useState<string | null>(null)
  const [cpfConflict, setCpfConflict] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // A reserva exibida na confirmação: a recém-feita ou, para quem volta ao site, a última salva.
  const current = reservations.find((r) => r.code === confirmedCode) ?? reservations[reservations.length - 1] ?? null
  // Se o RH cancelou a reserva salva, não há o que confirmar: volta para o formulário.
  const view: Step = step === 'confirmado' && !current ? 'dados' : step
  const roles: Role[] = hasCompanion ? ['titular', 'acompanhante'] : ['titular']
  const allChosen = roles.every((role) => selection[role] !== null)
  const freeSeats = TOTAL_SEATS - taken.size

  const selectionRef = useRef(selection)
  useEffect(() => {
    selectionRef.current = selection
  }, [selection])

  /* ── Mapa de poltronas: carrega ao entrar na etapa e atualiza sozinho ── */
  const refreshSeats = useCallback(async () => {
    try {
      const data = await api.seats()
      const map = new Map(data.taken.map((item) => [item.seat, item.nome ?? '']))
      setTaken(map)
      setSeatsStatus('ready')
      // Alguém confirmou antes uma poltrona que estava marcada aqui? Solta e avisa.
      const lost = (Object.keys(selectionRef.current) as Role[]).filter((role) => {
        const seat = selectionRef.current[role]
        return seat !== null && map.has(seat)
      })
      if (lost.length) {
        const seats = lost.map((role) => formatSeat(selectionRef.current[role]!)).join(' e ')
        setSelection((prev) => ({ ...prev, ...Object.fromEntries(lost.map((role) => [role, null])) }))
        setActive(lost[0])
        setNotice(`Ops! A poltrona ${seats} acabou de ser reservada por outra pessoa. Escolha outra.`)
      }
    } catch {
      setSeatsStatus((status) => (status === 'ready' ? status : 'error'))
    }
  }, [])

  useEffect(() => {
    if (view !== 'poltronas') return
    refreshSeats()
    const timer = window.setInterval(() => {
      if (!document.hidden) refreshSeats()
    }, POLL_MS)
    const onVisible = () => {
      if (!document.hidden) refreshSeats()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [view, refreshSeats])

  /* ── Troca de etapa com transição ── */
  const { contextSafe } = useGSAP(
    () => {
      if (firstRender.current) {
        firstRender.current = false
        return
      }
      const element = card.current
      if (!element) return
      // Traz o topo do cartão de volta à tela quando a etapa anterior era comprida.
      const top = element.getBoundingClientRect().top
      if (top < 0 || top > window.innerHeight * 0.45) {
        window.scrollTo({ top: window.scrollY + top - 20, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
      }
      if (prefersReducedMotion()) return
      gsap.fromTo(
        body.current,
        { autoAlpha: 0, y: 30 },
        { autoAlpha: 1, y: 0, duration: 0.55, ease: 'power3.out', clearProps: 'transform' },
      )
      // O ônibus da rota dá uma balançada ao partir para a próxima parada.
      gsap.fromTo('.route__bus .illus', { rotation: -9 }, { rotation: 0, duration: 1.3, ease: 'elastic.out(1, 0.3)' })
      if (view === 'confirmado' && celebrate) {
        gsap.from('.done > *', { y: 30, autoAlpha: 0, stagger: 0.09, duration: 0.7, ease: 'power3.out', delay: 0.1 })
        gsap.from('.done__seal', { scale: 0, rotation: -200, duration: 1.1, ease: 'back.out(1.6)' })
        citrusBurst(element)
      }
    },
    { scope: card, dependencies: [view] },
  )

  const go = contextSafe((next: Step) => {
    setNotice(null)
    if (!body.current || prefersReducedMotion()) {
      setStep(next)
      return
    }
    gsap.to(body.current, { autoAlpha: 0, y: -20, duration: 0.22, ease: 'power2.in', onComplete: () => setStep(next) })
  })

  const focusFirstError = () => {
    requestAnimationFrame(() => {
      const invalid = card.current?.querySelector<HTMLElement>('[aria-invalid="true"], .yesno--error input, .choice--error input')
      invalid?.focus({ preventScroll: true })
      invalid?.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    })
  }

  /* ── Etapa 1 ── */
  const submitTitular = (event: FormEvent) => {
    event.preventDefault()
    const errors = validatePassenger(titular)
    setTitularErrors(errors)
    if (Object.keys(errors).length) return focusFirstError()
    go('acompanhante')
  }

  /* ── Etapa 2 ── */
  const submitCompanion = (event: FormEvent) => {
    event.preventDefault()
    if (hasCompanion === null) {
      setChoiceError(true)
      return focusFirstError()
    }
    if (hasCompanion) {
      const errors = validatePassenger(companion)
      if (!errors.cpf && onlyDigits(companion.cpf) === onlyDigits(titular.cpf)) {
        errors.cpf = 'O CPF do acompanhante precisa ser diferente do seu.'
      }
      setCompanionErrors(errors)
      if (Object.keys(errors).length) return focusFirstError()
    } else {
      setSelection((prev) => ({ ...prev, acompanhante: null }))
      setActive('titular')
    }
    go('poltronas')
  }

  /* ── Etapa 3 ── */
  const pick = (seat: number) => {
    setNotice(null)
    const next = { ...selection }
    const owner = roles.find((role) => selection[role] === seat)
    if (owner) {
      next[owner] = null
      setActive(owner)
    } else {
      next[active] = seat
      const pending = roles.find((role) => next[role] === null)
      if (pending) setActive(pending)
    }
    setSelection(next)
  }

  const confirm = async () => {
    if (!allChosen || submitting) return
    setSubmitting(true)
    setNotice(null)
    setCpfConflict(false)
    try {
      const reservation = await api.reserve({
        titular: toPassengerData(titular),
        acompanhante: hasCompanion ? toPassengerData(companion) : null,
        seats: { titular: selection.titular!, ...(hasCompanion ? { acompanhante: selection.acompanhante! } : {}) },
      })
      onConfirmed(reservation)
      setConfirmedCode(reservation.code)
      setCelebrate(true)
      go('confirmado')
    } catch (error) {
      if (!(error instanceof ApiError)) {
        setNotice('Algo deu errado. Tente de novo.')
        return
      }
      setNotice(error.message)
      if (error.code === 'seat_taken') {
        const lost = roles.filter((role) => error.seats.includes(selection[role] ?? -1))
        setSelection((prev) => ({ ...prev, ...Object.fromEntries(lost.map((role) => [role, null])) }))
        if (lost.length) setActive(lost[0])
        refreshSeats()
      } else if (error.code === 'cpf_exists') {
        setCpfConflict(true)
      } else if (error.code === 'validation') {
        // O servidor recusou algum campo: volta para a etapa onde ele está.
        const pickErrors = (prefix: string): PassengerErrors =>
          Object.fromEntries(
            Object.entries(error.fields)
              .filter(([key]) => key.startsWith(`${prefix}.`))
              .map(([key, message]) => [key.slice(prefix.length + 1), message]),
          )
        const forTitular = pickErrors('titular')
        const forCompanion = pickErrors('acompanhante')
        setTitularErrors(forTitular)
        setCompanionErrors(forCompanion)
        if (Object.keys(forTitular).length) go('dados')
        else if (Object.keys(forCompanion).length) go('acompanhante')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const startOver = () => {
    setTitular(EMPTY_PASSENGER)
    setCompanion(EMPTY_PASSENGER)
    setHasCompanion(null)
    setTitularErrors({})
    setCompanionErrors({})
    setSelection(NO_SEATS)
    setActive('titular')
    setCelebrate(false)
    setCpfConflict(false)
    setConfirmedCode(null)
    go('dados')
  }

  const names: Record<Role, string> = {
    titular: firstName(titular.nome) || 'Você',
    acompanhante: firstName(companion.nome) || 'Acompanhante',
  }
  const progress = ROUTE.findIndex((stop) => stop.step === view) / (ROUTE.length - 1)

  return (
    <section className="checkin" id="checkin" aria-labelledby="checkin-titulo">
      <svg className="checkin__wave" viewBox="0 0 1440 70" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 0H1440V34C1320 70 1200 0 1080 34S840 70 720 34S480 0 360 34S120 70 0 34Z" />
      </svg>

      <div className="checkin__card frame" ref={card}>
        <ol className="route" style={{ '--progress': progress } as CSSProperties} aria-label="Etapas do check-in">
          <li className="route__track" aria-hidden="true">
            <span className="route__fill" />
            <span className="route__bus">
              <Illus name="bus" />
            </span>
          </li>
          {ROUTE.map((stop, index) => {
            const position = index / (ROUTE.length - 1)
            return (
              <li
                key={stop.step}
                className={cx('route__stop', position < progress && 'is-done', stop.step === view && 'is-current')}
                style={{ '--at': position } as CSSProperties}
                aria-current={stop.step === view ? 'step' : undefined}
              >
                <span className="route__dot">{index + 1}</span>
                <span className="route__label">{stop.label}</span>
              </li>
            )
          })}
        </ol>

        <div className="checkin__body" ref={body}>
          {view === 'dados' && (
            <form className="stepform" onSubmit={submitTitular} noValidate>
              <StepHead
                icon="passport"
                eyebrow="Passo 1"
                title="Seus dados"
                text="Informações essenciais para a nossa segurança durante a viagem e no evento."
              />
              <PassengerFields
                id="titular"
                value={titular}
                errors={titularErrors}
                self
                onChange={(next) => {
                  setTitular(next)
                  if (Object.keys(titularErrors).length) setTitularErrors(validatePassenger(next))
                }}
              />
              <div className="stepform__actions">
                <button type="submit" className="btn">
                  Continuar
                </button>
                {reservations.length === 0 && (
                  <button type="button" className="link" onClick={onShowTickets}>
                    Já reservou? Ver meus tickets
                  </button>
                )}
              </div>
            </form>
          )}

          {view === 'acompanhante' && (
            <form className="stepform" onSubmit={submitCompanion} noValidate>
              <StepHead
                icon="cheers"
                eyebrow="Passo 2"
                title="Acompanhante"
                text={`Vai levar mais uma pessoa para curtir a ${EVENT.name} com você?`}
              />
              <div
                className={cx('choice', choiceError && 'choice--error')}
                role="radiogroup"
                aria-label="Vai levar acompanhante?"
              >
                {(
                  [
                    [true, 'Sim', 'Vou acompanhado', 'cheers'],
                    [false, 'Não', 'Vou só eu', 'spritz'],
                  ] as Array<[boolean, string, string, IllusName]>
                ).map(([value, title, caption, icon]) => (
                  <label key={title} className="choice__option">
                    <input
                      type="radio"
                      name="tem-acompanhante"
                      checked={hasCompanion === value}
                      onChange={() => {
                        setHasCompanion(value)
                        setChoiceError(false)
                      }}
                    />
                    <span className="choice__card">
                      <Illus name={icon} className="choice__icon" />
                      <strong className="display">{title}</strong>
                      <small>{caption}</small>
                    </span>
                  </label>
                ))}
              </div>
              {choiceError && (
                <p className="field__error" role="alert">
                  Escolha uma das opções para continuar.
                </p>
              )}

              <div className={cx('reveal', hasCompanion === true && 'is-open')}>
                <div className="reveal__inner">
                  <h4 className="stepform__subtitle serif">Quem vai dividir essa experiência com você?</h4>
                  {hasCompanion === true && (
                    <PassengerFields
                      id="acompanhante"
                      value={companion}
                      errors={companionErrors}
                      onChange={(next) => {
                        setCompanion(next)
                        if (Object.keys(companionErrors).length) setCompanionErrors(validatePassenger(next))
                      }}
                    />
                  )}
                </div>
              </div>

              <div className="stepform__actions">
                <button type="submit" className="btn">
                  Continuar
                </button>
                <button type="button" className="link" onClick={() => go('dados')}>
                  Voltar
                </button>
              </div>
            </form>
          )}

          {view === 'poltronas' && (
            <div className="seatstep">
              <StepHead
                icon="ticket"
                eyebrow="Primeira classe"
                title="Escolha sua poltrona"
                text="Toque nos assentos livres no mapa do nosso transfer para reservar o seu lugar (e o do seu acompanhante, se houver)."
              />

              <div className="seatstep__grid">
                <div className="seatstep__map">
                  {seatsStatus === 'ready' && <SeatMap taken={taken} selection={selection} tags={names} onPick={pick} />}
                  {seatsStatus === 'loading' && (
                    <p className="seatstep__status" role="status">
                      Estacionando o ônibus…
                    </p>
                  )}
                  {seatsStatus === 'error' && (
                    <div className="seatstep__status" role="alert">
                      <p>Não consegui carregar o mapa de poltronas.</p>
                      <button type="button" className="btn btn--small btn--blue" onClick={refreshSeats}>
                        Tentar de novo
                      </button>
                    </div>
                  )}
                </div>

                <aside className="pick" aria-label="Poltronas selecionadas">
                  <h4 className="pick__title">Poltronas selecionadas</h4>
                  <ul className="pick__list">
                    {roles.map((role) => (
                      <li key={role}>
                        <button
                          type="button"
                          className={cx('pick__chip', active === role && 'is-active', selection[role] !== null && 'is-set')}
                          aria-pressed={active === role}
                          onClick={() => setActive(role)}
                        >
                          <span className="pick__who">
                            {names[role]}
                            <small>{role === 'titular' ? 'você' : 'acompanhante'}</small>
                          </span>
                          <strong className="pick__seat display">
                            {selection[role] !== null ? formatSeat(selection[role]) : '—'}
                          </strong>
                        </button>
                      </li>
                    ))}
                  </ul>

                  <p className="pick__hint" role="status">
                    {seatsStatus !== 'ready'
                      ? ' '
                      : freeSeats < roles.length && !allChosen
                        ? 'O ônibus lotou! Fale com o RH para entrar na lista de espera.'
                        : allChosen
                          ? 'Tudo certo! Para trocar, toque na poltrona marcada.'
                          : `Agora escolha a poltrona de ${names[active]}.`}
                  </p>

                  {notice && (
                    <p className="notice" role="alert">
                      {notice}
                    </p>
                  )}
                  {cpfConflict && (
                    <button type="button" className="link" onClick={onShowTickets}>
                      Consultar meus tickets
                    </button>
                  )}

                  <button type="button" className="btn pick__cta" disabled={!allChosen || submitting} onClick={confirm}>
                    {submitting ? 'Reservando…' : 'Confirmar meu lugar'}
                  </button>
                  <button type="button" className="link pick__back" onClick={() => go('acompanhante')}>
                    Voltar
                  </button>
                </aside>
              </div>
            </div>
          )}

          {view === 'confirmado' && current && (
            <div className="done">
              <Coaster className="done__seal" tone="terracotta" />
              <h3 className="display done__title" id="checkin-titulo">
                Reserva confirmada
              </h3>
              <p className="serif done__lead">
                {current.tickets.length > 1
                  ? `Seus lugares na ${EVENT.name} estão garantidos!`
                  : `Seu lugar na ${EVENT.name} está garantido!`}{' '}
                Agora é só separar a roupa de banho, os óculos de sol e o protetor solar.
              </p>
              <ul className="done__seats">
                {current.tickets.map((ticket) => (
                  <li key={ticket.seat}>
                    <span>{firstName(ticket.nome)}</span>
                    <strong className="display">{formatSeat(ticket.seat)}</strong>
                  </li>
                ))}
              </ul>
              <p className="done__text">Acesse suas reservas abaixo. Nos vemos no embarque!</p>
              <div className="stepform__actions stepform__actions--center">
                <button type="button" className="btn" onClick={onShowTickets}>
                  Ver meus tickets
                </button>
                <button type="button" className="link" onClick={startOver}>
                  Reservar para outra pessoa
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function StepHead({ icon, eyebrow, title, text }: { icon: IllusName; eyebrow: string; title: string; text: string }) {
  return (
    <header className="stephead">
      <Illus name={icon} className="stephead__icon" />
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h3 className="display stephead__title" id="checkin-titulo">
          {title}
        </h3>
      </div>
      <p className="stephead__text">{text}</p>
    </header>
  )
}
