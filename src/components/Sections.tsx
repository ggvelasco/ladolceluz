import { useRef } from 'react'
import { EVENT } from '../config/event'
import { cx } from '../lib/format'
import { gsap, MOTION, ScrollTrigger, scrollToElement, useGSAP } from '../lib/gsap'
import { Illus, type IllusName } from './Art'
import './Sections.css'

const DRAWABLE = 'path:not(.tint):not([stroke-dasharray]):not([fill="currentColor"]), circle:not([fill="currentColor"])'

/* ───────────── Roteiro: data, saída, local e retorno em "placas" ───────────── */

const PLACAS: Array<{ icon: IllusName; label: string; value: string; note?: string; long?: boolean }> = [
  { icon: 'sun', label: 'Data', value: EVENT.date, note: EVENT.weekday },
  { icon: 'bus', label: 'Saída da agência', value: EVENT.departure },
  { icon: 'palm', label: 'Local do evento', value: EVENT.venue, note: EVENT.address, long: true },
  { icon: 'sunset', label: 'Previsão de retorno', value: EVENT.returnTime },
]

export function Itinerary() {
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(MOTION, () => {
        gsap.utils.toArray<HTMLElement>('.placa').forEach((placa, index) => {
          const q = gsap.utils.selector(placa)
          gsap
            .timeline({ scrollTrigger: { trigger: placa, start: 'top 88%' }, defaults: { ease: 'power3.out' } })
            .from(placa, { y: 80, rotation: index % 2 ? 4 : -4, autoAlpha: 0, duration: 0.9 })
            .from(q('.placa__pill'), { scale: 0.86, duration: 0.9, ease: 'back.out(1.8)', clearProps: 'transform' }, 0.1)
            .from(q(DRAWABLE), { drawSVG: 0, duration: 0.9, stagger: 0.03, ease: 'power2.inOut' }, 0.25)
            .from(q('.placa__text > *'), { y: 18, autoAlpha: 0, stagger: 0.08, duration: 0.6 }, 0.35)
        })
      })
      return () => mm.revert()
    },
    { scope: root },
  )

  return (
    <section className="itinerary" ref={root} aria-labelledby="roteiro-titulo">
      <h2 className="eyebrow itinerary__title" id="roteiro-titulo">
        Seu roteiro
      </h2>
      <ul className="itinerary__grid">
        {PLACAS.map((placa) => (
          <li key={placa.label} className="placa tiles-bg">
            <div className={cx('placa__pill frame', placa.long && 'placa__pill--long')}>
              <Illus name={placa.icon} className="placa__icon" />
              <div className="placa__text">
                <span className="placa__label">{placa.label}</span>
                <strong className="placa__value display">{placa.value}</strong>
                {placa.note && <span className="placa__note serif">{placa.note}</span>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ───────────── Faixa corrida ───────────── */

const MARQUEE = [EVENT.name, EVENT.edition, 'Sol, drinks & piscina', 'Benvenuti', `Dia ${EVENT.date}`]

export function Marquee() {
  const root = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(MOTION, () => {
        const loop = gsap.to('.marquee__track', { xPercent: -50, duration: 36, ease: 'none', repeat: -1 })
        loop.totalTime(loop.duration() * 50) // folga para também rodar ao contrário

        // A faixa acelera (e inverte) conforme a velocidade e a direção do scroll.
        const trigger = ScrollTrigger.create({
          trigger: root.current,
          start: 'top bottom',
          end: 'bottom top',
          onUpdate(self) {
            const direction = self.direction >= 0 ? 1 : -1
            const boost = Math.min(7, Math.abs(self.getVelocity()) / 220)
            gsap.to(loop, { timeScale: direction * (1 + boost), duration: 0.2, overwrite: true })
            gsap.to(loop, { timeScale: direction, duration: 1.4, delay: 0.25 })
          },
        })
        return () => trigger.kill()
      })
      return () => mm.revert()
    },
    { scope: root },
  )

  const group = (hidden: boolean) => (
    <div className="marquee__group" aria-hidden={hidden || undefined}>
      {MARQUEE.map((item) => (
        <span key={item} className="marquee__item display">
          {item}
          <Illus name="orange" className="marquee__sep" />
        </span>
      ))}
    </div>
  )

  return (
    <div className="marquee" ref={root} aria-hidden="true">
      <div className="marquee__track">
        {group(false)}
        {group(true)}
      </div>
    </div>
  )
}

/* ───────────── Check-in em 3 passos ───────────── */

const STEPS: Array<{ icon: IllusName; text: string; aside?: string }> = [
  { icon: 'passport', text: 'Preencha os seus dados de embarque.' },
  {
    icon: 'cheers',
    text: 'Vai levar acompanhante? Cadastre os dados do seu convidado.',
    aside: 'Isso garante uma viagem segura e sem imprevistos para todos!',
  },
  { icon: 'ticket', text: 'Escolha as poltronas no mapa e receba seu ticket de confirmação.' },
]

export function Steps() {
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(MOTION, () => {
        gsap.from('.steps__head > *', {
          y: 40,
          autoAlpha: 0,
          stagger: 0.12,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: { trigger: '.steps__head', start: 'top 82%' },
        })

        // Cada selo é "carimbado" no lugar; o carimbo postal bate logo depois.
        gsap.utils.toArray<HTMLElement>('.postal').forEach((postal, index) => {
          const q = gsap.utils.selector(postal)
          gsap
            .timeline({ scrollTrigger: { trigger: postal, start: 'top 86%' }, delay: (index % 3) * 0.12 })
            .from(postal, { scale: 1.5, rotation: '+=14', autoAlpha: 0, duration: 0.55, ease: 'power3.in' })
            .to(postal, { scale: 0.96, duration: 0.08 })
            .to(postal, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.5)', clearProps: 'transform' })
            .from(q(DRAWABLE), { drawSVG: 0, duration: 0.8, stagger: 0.03, ease: 'power2.inOut' }, 0.45)
            .from(q('.postal__mark'), { scale: 2.2, autoAlpha: 0, duration: 0.3, ease: 'power3.in' }, 0.9)
        })

        gsap.to('.steps__water', {
          backgroundPositionX: '-=240px',
          duration: 14,
          ease: 'none',
          repeat: -1,
        })
      })
      return () => mm.revert()
    },
    { scope: root },
  )

  return (
    <section className="steps" ref={root} aria-labelledby="passos-titulo">
      <div className="steps__water" aria-hidden="true" />
      <div className="steps__head">
        <p className="eyebrow">Como embarcar</p>
        <h2 className="display steps__title" id="passos-titulo">
          Check-in em 3 passos
        </h2>
        <p className="steps__lead serif">Siga o roteiro abaixo para garantir o seu lugar no nosso transfer:</p>
      </div>

      <ol className="steps__list">
        {STEPS.map((step, index) => (
          <li key={step.icon} className="postal-wrap">
            <div className="postal">
              <div className="postal__inner">
                <div className="postal__top">
                  <span className="postal__num display">{index + 1}</span>
                  <span className="postal__tag">Passo</span>
                </div>
                <Illus name={step.icon} className="postal__icon" />
                <p className="postal__text">{step.text}</p>
                {step.aside && <p className="postal__aside serif">{step.aside}</p>}
              </div>
              <svg className="postal__mark" viewBox="0 0 120 80" aria-hidden="true">
                <circle cx="40" cy="40" r="30" />
                <circle cx="40" cy="40" r="23" />
                <path d="M62 24c8-5 14 5 22 0s14 5 22 0M66 36c8-5 14 5 22 0s14 5 22 0M66 48c8-5 14 5 22 0s14 5 22 0M62 60c8-5 14 5 22 0s14 5 22 0" />
                <text x="40" y="37" textAnchor="middle">
                  04·12
                </text>
                <text x="40" y="49" textAnchor="middle">
                  2026
                </text>
              </svg>
            </div>
          </li>
        ))}
      </ol>

      <a
        className="btn btn--blue steps__cta"
        href="#checkin"
        onClick={(event) => {
          event.preventDefault()
          scrollToElement(document.getElementById('checkin'))
        }}
      >
        Começar o check-in
      </a>
    </section>
  )
}
