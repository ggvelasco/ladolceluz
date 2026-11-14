import { Fragment, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { EVENT } from '../config/event'
import { Draggable, gsap, MOTION, REDUCED, scrollToElement, useGSAP } from '../lib/gsap'
import { Coaster, Illus, Logo, Wordmark } from './Art'
import './Hero.css'

// Texto de apoio do briefing; `true` marca os trechos em destaque.
const STATEMENT: Array<[text: string, highlight?: boolean]> = [
  ['Sua passagem para o nosso'],
  ['CLUB de verão', true],
  ['está liberada. Prepare-se para um'],
  ['dia de sol,', true],
  ['bons drinks à beira da piscina', true],
  ['e a melhor energia do time Martiniano. Reserve o seu lugar e o do seu acompanhante no nosso'],
  ['transfer exclusivo.', true],
]

interface Grid {
  cols: number
  rows: number
  size: number
}

/** Quantos azulejos cabem no hero (recalcula quando a janela muda de tamanho). */
function useTileGrid(ref: React.RefObject<HTMLElement | null>) {
  const [grid, setGrid] = useState<Grid>({ cols: 0, rows: 0, size: 0 })

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => {
      const { width, height } = element.getBoundingClientRect()
      const size = Math.round(Math.min(132, Math.max(78, width / 11)))
      const next = { size, cols: Math.ceil(width / size) + 1, rows: Math.ceil(height / size) + 1 }
      setGrid((prev) => (prev.cols === next.cols && prev.rows === next.rows && prev.size === next.size ? prev : next))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return grid
}

/**
 * Escala necessária para a moldura (um "estádio" de aw × ah centrado em cx, cy)
 * cobrir a tela inteira — é o que faz a transição de "portal" no scroll.
 */
function portalScale(hero: HTMLElement, arch: HTMLElement) {
  const h = hero.getBoundingClientRect()
  const a = arch.getBoundingClientRect()
  const cx = a.left - h.left + a.width / 2
  const cy = a.top - h.top + a.height / 2
  const dx = Math.max(cx, h.width - cx)
  const dy = Math.max(cy, h.height - cy)

  const covers = (scale: number) => {
    const w = a.width * scale
    const height = a.height * scale
    const radius = Math.min(w, height) / 2
    const straight = Math.abs(w - height) / 2
    const ex = w >= height ? Math.max(0, dx - straight) : dx
    const ey = w >= height ? dy : Math.max(0, dy - straight)
    return ex * ex + ey * ey <= radius * radius
  }

  let scale = 1
  while (!covers(scale) && scale < 40) scale += 0.1
  return scale * 1.1
}

export function Hero() {
  const root = useRef<HTMLElement>(null)
  const grid = useTileGrid(root)
  const ready = grid.cols > 0

  useGSAP(
    (_context, contextSafe) => {
      const hero = root.current
      if (!hero || !ready) return
      const q = gsap.utils.selector(hero)
      const mm = gsap.matchMedia()

      mm.add(REDUCED, () => {
        hero.classList.add('hero--static')
        return () => hero.classList.remove('hero--static')
      })

      mm.add(MOTION, () => {
        const arch = q('.arch')[0] as HTMLElement
        const stickers = q('.sticker')

        // ── Entrada: a parede é "azulejada", a moldura nasce do centro e o letreiro sobe letra a letra.
        gsap.set(q('.tilewall, .hero__stage, .hero__hint-pill'), { autoAlpha: 0 })
        let cancelled = false
        const intro = contextSafe!(() => {
          if (cancelled) return
          gsap.set(q('.tilewall, .hero__stage, .hero__hint-pill'), { autoAlpha: 1 })
          gsap
            .timeline({ defaults: { ease: 'power3.out' } })
            .from(q('.tilewall__tile'), {
              rotationY: -90,
              autoAlpha: 0,
              duration: 0.7,
              ease: 'power2.out',
              stagger: { grid: [grid.rows, grid.cols], from: 'center', amount: 0.9 },
            })
            .from(q('.arch__bg'), { scale: 0, duration: 1.2, ease: 'expo.out' }, 0.35)
            .from(q('.arch__line'), { scale: 0.7, autoAlpha: 0, duration: 1.1, ease: 'expo.out' }, 0.6)
            .from(q('.arch__side'), { autoAlpha: 0, duration: 0.8 }, 1.1)
            .from(q('.arch__eyebrow, .arch__welcome'), { y: 26, autoAlpha: 0, stagger: 0.09, duration: 0.8 }, 0.85)
            .from(q('.arch__illus .tint'), { autoAlpha: 0, duration: 0.8 }, 1.6)
            .from(
              q('.arch__illus path:not(.tint):not([stroke-dasharray]), .arch__illus circle'),
              { drawSVG: 0, duration: 1.1, stagger: 0.035, ease: 'power2.inOut' },
              0.9,
            )
            .from(q('.arch__illus [stroke-dasharray]'), { autoAlpha: 0, duration: 0.5 }, 1.7)
            .from(
              q('.arch__title path'),
              {
                yPercent: 70,
                rotation: 9,
                autoAlpha: 0,
                transformOrigin: '50% 100%',
                stagger: 0.045,
                duration: 0.95,
                ease: 'back.out(1.5)',
              },
              1.05,
            )
            .from(q('.arch__sub, .arch__cta, .arch__logo'), { y: 22, autoAlpha: 0, stagger: 0.1, duration: 0.8 }, 1.55)
            .from(
              q('.sticker__body'),
              { scale: 0, rotation: () => gsap.utils.random(-120, 120), duration: 1, ease: 'back.out(1.7)', stagger: 0.1 },
              1.35,
            )
            .from(q('.hero__hint-pill'), { autoAlpha: 0, y: -12, duration: 0.6 }, 2.1)
        })
        Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 1200))]).then(intro)

        // ── Scroll: a moldura cresce até virar a própria página (portal) e revela o texto de apoio.
        gsap
          .timeline({
            scrollTrigger: {
              trigger: hero,
              start: 'top top',
              end: '+=170%',
              pin: true,
              scrub: 0.5,
              anticipatePin: 1,
              invalidateOnRefresh: true,
            },
          })
          .to(q('.arch__content'), { autoAlpha: 0, y: -50, scale: 0.94, duration: 0.22, ease: 'power1.in' }, 0)
          .to(q('.sticker__float'), { scale: 0, autoAlpha: 0, duration: 0.22, stagger: 0.02, ease: 'back.in(1.4)' }, 0)
          .to(q('.hero__hint'), { autoAlpha: 0, duration: 0.08 }, 0)
          .to(q('.arch__portal'), { scale: () => portalScale(hero, arch), duration: 0.5, ease: 'power2.in' }, 0.06)
          .fromTo(
            q('.hero__statement .w'),
            { autoAlpha: 0, y: 26 },
            { autoAlpha: 1, y: 0, stagger: 0.012, duration: 0.14, ease: 'power2.out' },
            0.5,
          )
          .to({}, { duration: 0.12 })

        // ── Adesivos: arrastáveis (com inércia) e com leve paralaxe do mouse.
        const draggables = Draggable.create(stickers, {
          type: 'x,y',
          bounds: hero,
          inertia: true,
          edgeResistance: 0.75,
          onPress() {
            gsap.to(this.target, { scale: 1.1, duration: 0.2 })
          },
          onRelease() {
            gsap.to(this.target, { scale: 1, duration: 0.5, ease: 'back.out(3)' })
          },
        })

        const floats = q('.sticker__float').map((element) => ({
          depth: Number((element.parentElement as HTMLElement).dataset.depth ?? 1),
          x: gsap.quickTo(element, 'x', { duration: 0.9, ease: 'power3.out' }),
          y: gsap.quickTo(element, 'y', { duration: 0.9, ease: 'power3.out' }),
        }))
        const onMove = (event: PointerEvent) => {
          if (event.pointerType !== 'mouse') return
          const nx = event.clientX / window.innerWidth - 0.5
          const ny = event.clientY / window.innerHeight - 0.5
          for (const float of floats) {
            float.x(-nx * 46 * float.depth)
            float.y(-ny * 46 * float.depth)
          }
        }
        hero.addEventListener('pointermove', onMove)

        // ── Azulejos giram 90° ao passar o mouse (o desenho é simétrico, então o giro fecha perfeito).
        const onTile = (event: PointerEvent) => {
          const tile = event.target as HTMLElement
          if (event.pointerType !== 'mouse' || !tile.classList.contains('tilewall__tile')) return
          gsap.to(tile, { rotation: '+=90', duration: 0.7, ease: 'back.out(1.6)', overwrite: 'auto' })
        }
        hero.addEventListener('pointerover', onTile)

        const ring = gsap.to(q('.coaster__ring'), { rotation: 360, duration: 26, ease: 'none', repeat: -1, transformOrigin: '50% 50%' })

        return () => {
          cancelled = true
          ring.kill()
          draggables.forEach((draggable) => draggable.kill())
          hero.removeEventListener('pointermove', onMove)
          hero.removeEventListener('pointerover', onTile)
        }
      })

      return () => mm.revert()
    },
    { scope: root, dependencies: [ready] },
  )

  const tileStyle = {
    '--tile': `${grid.size}px`,
    gridTemplateColumns: `repeat(${grid.cols}, ${grid.size}px)`,
  } as CSSProperties

  return (
    <section className="hero" ref={root} aria-label={`${EVENT.name} — ${EVENT.edition}`}>
      <div className="tilewall" style={tileStyle} aria-hidden="true">
        {Array.from({ length: grid.cols * grid.rows }, (_, index) => (
          <i key={index} className="tilewall__tile" />
        ))}
      </div>

      <div className="hero__stage">
        <div className="arch">
          <div className="arch__portal">
            <div className="arch__bg" />
            <div className="arch__line" />
          </div>
          <span className="arch__side arch__side--left" aria-hidden="true">
            {EVENT.edition}
          </span>
          <span className="arch__side arch__side--right" aria-hidden="true">
            {EVENT.edition}
          </span>

          <div className="arch__content">
            <p className="arch__eyebrow serif">{EVENT.edition}</p>
            <p className="arch__welcome serif">Benvenuti a</p>
            <Illus name="umbrella" className="arch__illus" boil />
            <h1 className="arch__title">
              <span className="sr-only">{EVENT.name}</span>
              <Wordmark className="arch__wordmark arch__wordmark--wide" />
              <Wordmark className="arch__wordmark arch__wordmark--tall" stacked />
            </h1>
            <p className="arch__sub">O embarque já vai começar</p>
            <a
              className="btn arch__cta"
              href="#checkin"
              onClick={(event) => {
                event.preventDefault()
                scrollToElement(document.getElementById('checkin'))
              }}
            >
              Reservar meu lugar
            </a>
            <Logo className="arch__logo" />
          </div>
        </div>

        <div className="sticker sticker--coaster" data-depth="0.7">
          <div className="sticker__float">
            <div className="sticker__body">
              <Coaster />
            </div>
          </div>
        </div>
        <div className="sticker sticker--stamp" data-depth="1.1">
          <div className="sticker__float">
            <div className="sticker__body">
              <div className="stamp" aria-hidden="true">
                <div className="stamp__inner">
                  <Illus name="sun" className="stamp__icon" />
                  <strong className="display">04·12</strong>
                  <small>{EVENT.edition}</small>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="sticker sticker--lemons" data-depth="0.9">
          <div className="sticker__float">
            <div className="sticker__body">
              <div className="diecut">
                <Illus name="lemons" />
              </div>
            </div>
          </div>
        </div>
        <div className="sticker sticker--sardines" data-depth="1.3">
          <div className="sticker__float">
            <div className="sticker__body">
              <div className="diecut diecut--peach">
                <Illus name="sardines" />
              </div>
            </div>
          </div>
        </div>
        <div className="sticker sticker--orange" data-depth="1.6">
          <div className="sticker__float">
            <div className="sticker__body">
              <div className="diecut diecut--round diecut--orange">
                <Illus name="orange" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="hero__statement serif">
        <span className="hero__statement-text">
          {STATEMENT.flatMap(([text, highlight], segment) =>
            text.split(' ').map((word, index) => (
              <Fragment key={`${segment}-${index}`}>
                <span className={highlight ? 'w w--hi' : 'w'}>{word}</span>{' '}
              </Fragment>
            )),
          )}
        </span>
      </p>

      <p className="hero__hint" aria-hidden="true">
        <span className="hero__hint-pill">
          Role para embarcar
          <svg viewBox="0 0 12 16" width="10" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 1v13M1.5 9.500L6 14l4.500-4.500" />
          </svg>
        </span>
      </p>
    </section>
  )
}
