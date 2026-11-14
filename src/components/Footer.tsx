import { useRef } from 'react'
import { EVENT } from '../config/event'
import { gsap, MOTION, useGSAP } from '../lib/gsap'
import { Coaster, Logo, Wordmark } from './Art'
import './Footer.css'

export function Footer() {
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(MOTION, () => {
        gsap.from('.footer__inner > *', {
          y: 40,
          autoAlpha: 0,
          stagger: 0.12,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: { trigger: '.footer__inner', start: 'top 85%' },
        })
        gsap.from('.footer__wordmark path', {
          yPercent: 110,
          stagger: 0.05,
          duration: 1,
          ease: 'power4.out',
          scrollTrigger: { trigger: '.footer__wordmark', start: 'top 96%' },
        })
      })
      return () => mm.revert()
    },
    { scope: root },
  )

  return (
    <footer className="footer" ref={root}>
      <div className="footer__tiles tiles-bg" aria-hidden="true" />

      <div className="footer__inner">
        <Coaster className="footer__coaster" tone="terracotta" />
        <h2 className="serif footer__title">Ficou com alguma dúvida ou precisa alterar algo?</h2>
        <p className="footer__text">
          Fale com o nosso <em>“concierge”</em> (o time de RH) via Chat ou e-mail.
        </p>
      </div>

      <Wordmark className="footer__wordmark" />

      <div className="footer__bar">
        <span>{EVENT.edition}</span>
        <Logo className="footer__logo" />
        <span>Martin Luz Transformation Agency</span>
      </div>
    </footer>
  )
}
