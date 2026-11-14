import { useId } from 'react'
import logoRaw from '../assets/martin-luz.svg?raw'
import wordmarkRaw from '../assets/wordmark.svg?raw'
import { cx } from '../lib/format'

// Peças gráficas reutilizadas no site inteiro: ilustrações em traço, logo e letreiro.
// Os SVGs entram inline (e não como <img>) para herdar a cor do texto e para o GSAP
// conseguir animar cada traço.

const files = import.meta.glob<string>('../assets/illus/*.svg', { query: '?raw', import: 'default', eager: true })

const illustrations: Record<string, string> = {}
for (const [path, raw] of Object.entries(files)) {
  illustrations[path.slice(path.lastIndexOf('/') + 1, -'.svg'.length)] = raw
}

export type IllusName =
  | 'umbrella'
  | 'lemons'
  | 'spritz'
  | 'sun'
  | 'bus'
  | 'palm'
  | 'sunset'
  | 'passport'
  | 'cheers'
  | 'ticket'
  | 'orange'
  | 'flipflops'
  | 'shell'
  | 'starfish'
  | 'sardines'
  | 'wheel'

interface IllusProps {
  name: IllusName
  className?: string
  /** Liga o efeito de "linha fervendo". */
  boil?: boolean
}

export function Illus({ name, className, boil }: IllusProps) {
  return (
    <span
      className={cx('illus', boil && 'illus--boil', className)}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: illustrations[name] }}
    />
  )
}

const logoSvg = logoRaw.replace(/fill="#[0-9a-fA-F]{6}"/g, 'fill="currentColor"')

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cx('logo', className)}
      role="img"
      aria-label="Martin Luz"
      dangerouslySetInnerHTML={{ __html: logoSvg }}
    />
  )
}

// Letreiro "LA DOLCE LUZ" do moodboard: o SVG tem uma <path> por letra, na ordem de leitura.
const LETTERS = [...wordmarkRaw.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((match) => match[1])
const WORDMARK_HEIGHT = 188.6

function WordmarkLine({ from, to, x, width }: { from: number; to: number; x: number; width: number }) {
  return (
    <svg className="wordmark__line" viewBox={`${x} 0 ${width} ${WORDMARK_HEIGHT}`} style={{ width: `${width / 6.85}%` }}>
      {LETTERS.slice(from, to).map((d, index) => (
        <path key={index} d={d} fill="currentColor" />
      ))}
    </svg>
  )
}

/**
 * `stacked` quebra em "LA DOLCE" / "LUZ" (como nas bolachas do moodboard), o que
 * deixa o letreiro bem maior em telas estreitas.
 */
export function Wordmark({ className, stacked }: { className?: string; stacked?: boolean }) {
  return (
    <span className={cx('wordmark', stacked && 'wordmark--stacked', className)} aria-hidden="true">
      {stacked ? (
        <>
          <WordmarkLine from={0} to={7} x={0} width={685} />
          <WordmarkLine from={7} to={10} x={738} width={262} />
        </>
      ) : (
        <svg className="wordmark__line" viewBox={`0 0 1000 ${WORDMARK_HEIGHT}`}>
          {LETTERS.map((d, index) => (
            <path key={index} d={d} fill="currentColor" />
          ))}
        </svg>
      )}
    </span>
  )
}

/** Filtros que dão ao traço vetorial a tremida de um desenho feito à mão. */
export function RoughFilters() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
      <defs>
        {[4, 11, 23].map((seed, index) => (
          <filter key={seed} id={`rough-${'abc'[index]}`} x="-6%" y="-6%" width="112%" height="112%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed={seed} result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.4" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        ))}
      </defs>
    </svg>
  )
}

/** Bolacha de chope com texto em círculo (o anel gira, o ícone fica parado). */
export function Coaster({ className, tone = 'blue' }: { className?: string; tone?: 'blue' | 'terracotta' }) {
  const pathId = useId()
  return (
    <div className={cx('coaster', `coaster--${tone}`, className)} aria-hidden="true">
      <svg className="coaster__ring" viewBox="0 0 200 200">
        <circle className="coaster__disc" cx="100" cy="100" r="98" />
        <circle cx="100" cy="100" r="91" fill="none" stroke="var(--cream)" strokeWidth="1" opacity="0.55" />
        <circle cx="100" cy="100" r="59" fill="none" stroke="var(--cream)" strokeWidth="1" opacity="0.55" />
        <path id={pathId} d="M100 100m-71 0a71 71 0 1 1 142 0a71 71 0 1 1-142 0" fill="none" />
        <text fill="var(--cream)" fontSize="12.4" fontWeight="600" letterSpacing="2">
          <textPath href={`#${pathId}`} textLength="438" lengthAdjust="spacing">
            MARTIN LUZ TRANSFORMATION AGENCY ✺ CONFRA 2026 ✺
          </textPath>
        </text>
      </svg>
      <Illus name="spritz" className="coaster__icon" />
    </div>
  )
}
