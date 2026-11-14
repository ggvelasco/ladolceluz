import { useEffect, useRef, type CSSProperties } from 'react'
import type { Role } from '../lib/api'
import { BLOCKED_SEATS, formatSeat, ROWS, SEATS } from '../lib/bus'
import { cx } from '../lib/format'
import { gsap, prefersReducedMotion, useGSAP } from '../lib/gsap'
import { Illus } from './Art'

export type Selection = Record<Role, number | null>

interface SeatMapProps {
  /** Poltronas já reservadas → nome público de quem ocupa ("Ana S."), se o servidor informar. */
  taken: Map<number, string>
  selection: Selection
  /** Etiqueta curta de cada passageiro, mostrada na poltrona escolhida. */
  tags: Record<Role, string>
  onPick: (seat: number) => void
}

const PARTICLE_COLORS = ['var(--orange)', 'var(--terracotta)', 'var(--sky)', 'var(--peach)']

/** Estouro de bolinhas quando uma poltrona é escolhida. */
function burst(seat: HTMLElement) {
  for (let i = 0; i < 9; i++) {
    const dot = document.createElement('i')
    dot.className = 'seat__spark'
    dot.style.background = PARTICLE_COLORS[i % PARTICLE_COLORS.length]
    seat.appendChild(dot)
    const angle = (i / 9) * Math.PI * 2 + Math.random() * 0.5
    const distance = 30 + Math.random() * 26
    gsap.to(dot, {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      scale: 0,
      duration: 0.6 + Math.random() * 0.25,
      ease: 'power2.out',
      onComplete: () => dot.remove(),
    })
  }
}

export function SeatMap({ taken, selection, tags, onPick }: SeatMapProps) {
  const root = useRef<HTMLDivElement>(null)
  const previous = useRef<Selection>(selection)

  // Entrada: o ônibus "chega" e as poltronas pipocam da frente para o fundo.
  useGSAP(
    () => {
      if (prefersReducedMotion()) return
      gsap.from('.bus', { xPercent: -12, autoAlpha: 0, duration: 0.9, ease: 'power3.out', clearProps: 'transform' })
      gsap.from('.seat', {
        scale: 0,
        autoAlpha: 0,
        duration: 0.5,
        ease: 'back.out(2.2)',
        stagger: { each: 0.014, from: 'start' },
        delay: 0.25,
        clearProps: 'transform,opacity,visibility',
      })
    },
    { scope: root },
  )

  // Poltrona recém-escolhida ganha um "pop" com faíscas.
  useEffect(() => {
    const before = new Set(Object.values(previous.current))
    previous.current = selection
    if (prefersReducedMotion()) return
    for (const seat of Object.values(selection)) {
      if (seat === null || before.has(seat)) continue
      const element = root.current?.querySelector<HTMLElement>(`[data-seat="${seat}"]`)
      if (!element) continue
      gsap.fromTo(element, { scale: 0.6 }, { scale: 1, duration: 0.9, ease: 'elastic.out(1, 0.42)', clearProps: 'transform' })
      burst(element)
    }
  }, [selection])

  const refuse = (element: HTMLElement) => {
    if (prefersReducedMotion()) return
    gsap.fromTo(element, { x: -6 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.25)', clearProps: 'transform' })
  }

  const ownerOf = (seat: number) => (Object.keys(selection) as Role[]).find((role) => selection[role] === seat)

  return (
    <div className="busmap" ref={root}>
      <div className="bus" style={{ '--rows': ROWS } as CSSProperties}>
        <span className="bus__tyre bus__tyre--a" aria-hidden="true" />
        <span className="bus__tyre bus__tyre--b" aria-hidden="true" />
        <span className="bus__tyre bus__tyre--c" aria-hidden="true" />
        <span className="bus__tyre bus__tyre--d" aria-hidden="true" />

        <div className="bus__nose" aria-hidden="true">
          <span className="bus__door">Porta</span>
          <span className="bus__front">Frente</span>
          <Illus name="wheel" className="bus__wheel" />
        </div>

        <div className="bus__seats" role="group" aria-label="Mapa de poltronas do ônibus">
          <span className="bus__aisle" aria-hidden="true">
            Corredor
          </span>
          {SEATS.map(({ seat, row, lane }) => {
            const owner = ownerOf(seat)
            const occupant = taken.get(seat)
            const unavailable = (taken.has(seat) && !owner) || BLOCKED_SEATS.has(seat)
            const number = formatSeat(seat)
            const label = owner
              ? `Poltrona ${number}, selecionada para ${tags[owner]} — toque para desmarcar`
              : unavailable
                ? `Poltrona ${number}, ocupada${occupant ? ` por ${occupant}` : ''}`
                : `Poltrona ${number}, livre`

            return (
              <button
                key={seat}
                type="button"
                data-seat={seat}
                className={cx('seat', owner && 'seat--mine', unavailable && 'seat--taken')}
                style={{ '--row': row, '--lane': lane } as CSSProperties}
                aria-label={label}
                aria-pressed={owner ? true : undefined}
                aria-disabled={unavailable || undefined}
                data-tip={unavailable ? `${number}${occupant ? ` · ${occupant}` : ' · ocupada'}` : undefined}
                onClick={(event) => (unavailable ? refuse(event.currentTarget) : onPick(seat))}
              >
                <span className="seat__num">{number}</span>
                {owner && (
                  <span className="seat__tag" aria-hidden="true">
                    {tags[owner].charAt(0).toUpperCase()}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <ul className="legend" aria-label="Legenda">
        <li>
          <i className="legend__swatch" /> Livre
        </li>
        <li>
          <i className="legend__swatch legend__swatch--mine" /> Selecionada
        </li>
        <li>
          <i className="legend__swatch legend__swatch--taken" /> Ocupada
        </li>
      </ul>
    </div>
  )
}
