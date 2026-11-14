// API de reservas. É a mesma aplicação Express em desenvolvimento (montada dentro
// do Vite) e em produção (server/index.js).

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import * as store from './store.js'
import { isValidCpf, onlyDigits, parsePassenger, publicName } from './validate.js'

try {
  process.loadEnvFile(path.join(store.ROOT, '.env'))
} catch {
  // sem .env: segue com as variáveis do ambiente
}

const config = JSON.parse(fs.readFileSync(path.join(store.ROOT, 'shared', 'config.json'), 'utf8'))
const TOTAL_SEATS = Number(config.totalSeats)
const BLOCKED = new Set(config.blockedSeats ?? [])

const isBookableSeat = (seat) => Number.isInteger(seat) && seat >= 1 && seat <= TOTAL_SEATS && !BLOCKED.has(seat)

function rateLimit({ windowMs, max }) {
  const hits = new Map()
  return (req, res, next) => {
    const now = Date.now()
    const key = req.ip || req.socket?.remoteAddress || 'anon'
    let entry = hits.get(key)
    if (!entry || entry.reset < now) {
      entry = { count: 0, reset: now + windowMs }
      hits.set(key, entry)
    }
    entry.count += 1
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (v.reset < now) hits.delete(k)
    }
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.reset - now) / 1000)))
      return res.status(429).json({
        error: 'rate_limited',
        message: 'Muitas tentativas seguidas. Espere um minutinho e tente de novo.',
      })
    }
    next()
  }
}

function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_KEY
  if (!expected) {
    return res.status(503).json({
      error: 'admin_disabled',
      message: 'Painel desativado: defina ADMIN_KEY no arquivo .env do servidor.',
    })
  }
  const hash = (value) => crypto.createHash('sha256').update(String(value)).digest()
  if (!crypto.timingSafeEqual(hash(req.get('x-admin-key') ?? ''), hash(expected))) {
    return res.status(401).json({ error: 'unauthorized', message: 'Senha incorreta.' })
  }
  next()
}

const ticketsOf = (reservation) => ({
  code: reservation.code,
  tickets: reservation.passengers.map((p) => ({ role: p.role, nome: p.nome, seat: p.seat })),
})

export function createApi() {
  const app = express()
  app.disable('x-powered-by')
  // Atrás do proxy do Railway (ou de outro, com TRUST_PROXY=1) o IP real vem no X-Forwarded-For.
  if (process.env.TRUST_PROXY || process.env.RAILWAY_ENVIRONMENT) app.set('trust proxy', 1)

  const api = express.Router()
  api.use(express.json({ limit: '20kb' }))
  api.use((_req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
    next()
  })

  // Health check da hospedagem: confirma que o arquivo de reservas pode ser lido.
  api.get('/health', (_req, res) => {
    store.listReservations()
    res.json({ ok: true })
  })

  // Mapa público: só número da poltrona e, opcionalmente, "Nome S." de quem ocupa.
  api.get('/seats', (_req, res) => {
    res.json({
      total: TOTAL_SEATS,
      blocked: [...BLOCKED],
      taken: store.listPassengers().map((p) => ({
        seat: p.seat,
        ...(config.showOccupantNames ? { nome: publicName(p.nome) } : {}),
      })),
    })
  })

  api.post('/reservations', rateLimit({ windowMs: 60_000, max: 12 }), (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {}
    const errors = {}

    const titular = parsePassenger(body.titular, 'titular', errors)
    const hasCompanion = body.acompanhante != null
    const acompanhante = hasCompanion ? parsePassenger(body.acompanhante, 'acompanhante', errors) : null

    const seatTitular = Number(body.seats?.titular)
    const seatAcompanhante = hasCompanion ? Number(body.seats?.acompanhante) : null
    if (!isBookableSeat(seatTitular)) errors['seats.titular'] = 'Escolha a sua poltrona.'
    if (hasCompanion && !isBookableSeat(seatAcompanhante)) {
      errors['seats.acompanhante'] = 'Escolha a poltrona do acompanhante.'
    } else if (hasCompanion && seatAcompanhante === seatTitular) {
      errors['seats.acompanhante'] = 'Cada pessoa precisa de uma poltrona diferente.'
    }
    if (acompanhante && acompanhante.cpf === titular.cpf && isValidCpf(titular.cpf)) {
      errors['acompanhante.cpf'] = 'O CPF do acompanhante precisa ser diferente do seu.'
    }

    if (Object.keys(errors).length) {
      return res.status(400).json({ error: 'validation', fields: errors, message: 'Confira os dados informados.' })
    }

    const passengers = [{ role: 'titular', seat: seatTitular, ...titular }]
    if (acompanhante) passengers.push({ role: 'acompanhante', seat: seatAcompanhante, ...acompanhante })

    const result = store.createReservation(passengers)
    if (!result.ok && result.error === 'seat_taken') {
      const plural = result.seats.length > 1
      const numbers = result.seats.map((seat) => String(seat).padStart(2, '0')).join(' e ')
      return res.status(409).json({
        error: 'seat_taken',
        seats: result.seats,
        message: `Ops! ${plural ? 'As poltronas' : 'A poltrona'} ${numbers} ${
          plural ? 'acabaram de ser reservadas' : 'acabou de ser reservada'
        }. Escolha outra.`,
      })
    }
    if (!result.ok) {
      return res.status(409).json({
        error: 'cpf_exists',
        role: result.role,
        message:
          result.role === 'titular'
            ? 'Este CPF já tem uma reserva. Consulte seus tickets ou fale com o RH para alterar.'
            : 'O CPF do acompanhante já tem uma reserva. Fale com o RH se precisar alterar.',
      })
    }

    res.status(201).json(ticketsOf(result.reservation))
  })

  // Consulta de tickets em outro aparelho: CPF vai no corpo, nunca na URL.
  api.post('/tickets/lookup', rateLimit({ windowMs: 60_000, max: 8 }), (req, res) => {
    const cpf = onlyDigits(req.body?.cpf)
    if (!isValidCpf(cpf)) return res.status(400).json({ error: 'validation', message: 'CPF inválido.' })
    const reservation = store.findByCpf(cpf)
    if (!reservation) {
      return res.status(404).json({ error: 'not_found', message: 'Não encontramos reserva para este CPF.' })
    }
    res.json(ticketsOf(reservation))
  })

  // Confere se os tickets salvos no aparelho ainda valem (o RH pode ter cancelado ou alterado).
  api.post('/tickets/sync', rateLimit({ windowMs: 60_000, max: 30 }), (req, res) => {
    const codes = Array.isArray(req.body?.codes) ? req.body.codes.slice(0, 10).map(String) : []
    const wanted = new Set(codes)
    res.json({ reservations: store.listReservations().filter((r) => wanted.has(r.code)).map(ticketsOf) })
  })

  const admin = express.Router()
  admin.use(rateLimit({ windowMs: 60_000, max: 60 }), requireAdmin)

  admin.get('/reservations', (_req, res) => {
    res.json({ total: TOTAL_SEATS, blocked: [...BLOCKED], reservations: store.listReservations() })
  })

  admin.delete('/reservations/:code', (req, res) => {
    if (!store.removeReservation(req.params.code)) {
      return res.status(404).json({ error: 'not_found', message: 'Reserva não encontrada.' })
    }
    res.json({ ok: true })
  })

  admin.delete('/reservations/:code/companion', (req, res) => {
    if (!store.removeCompanion(req.params.code)) {
      return res.status(404).json({ error: 'not_found', message: 'Acompanhante não encontrado nesta reserva.' })
    }
    res.json({ ok: true })
  })

  api.use('/admin', admin)

  api.use((_req, res) => {
    res.status(404).json({ error: 'not_found', message: 'Rota não encontrada.' })
  })

  api.use((err, _req, res, _next) => {
    if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') {
      return res.status(400).json({ error: 'bad_request', message: 'Requisição inválida.' })
    }
    console.error('[api]', err)
    res.status(500).json({ error: 'server_error', message: 'Algo deu errado do nosso lado. Tente de novo.' })
  })

  app.use('/api', api)
  return app
}
