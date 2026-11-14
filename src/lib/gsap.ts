import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Draggable } from 'gsap/Draggable'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { InertiaPlugin } from 'gsap/InertiaPlugin'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, DrawSVGPlugin, Draggable, InertiaPlugin)

// A barra de endereço do celular aparecendo/sumindo não deve recalcular as animações de scroll.
ScrollTrigger.config({ ignoreMobileResize: true })

/** Consultas usadas com gsap.matchMedia(): animação completa x movimento reduzido. */
export const MOTION = '(prefers-reduced-motion: no-preference)'
export const REDUCED = '(prefers-reduced-motion: reduce)'

export const prefersReducedMotion = () => window.matchMedia(REDUCED).matches

/** Rola até um elemento com suavidade (sem `scroll-behavior: smooth`, que atrapalha o ScrollTrigger). */
export function scrollToElement(target: Element | null) {
  target?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
}

export { Draggable, gsap, ScrollTrigger, SplitText, useGSAP }
