// Armazenamento das reservas em um arquivo JSON.
//
// Para ~50 poltronas e um único processo Node isso é o suficiente: o estado fica
// em memória, toda alteração é síncrona (logo, sem disputa entre duas reservas da
// mesma poltrona) e cada gravação é atômica (arquivo temporário + rename).

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// No Railway, o volume persistente fica em RAILWAY_VOLUME_MOUNT_PATH; DATA_DIR, se definido, tem prioridade.
export const dataDir = () => {
  const dir = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH
  return dir ? path.resolve(dir) : path.join(ROOT, 'data')
}
const dataFile = () => path.join(dataDir(), 'reservas.json')

let state = null

function load() {
  if (state) return state
  let raw
  try {
    raw = fs.readFileSync(dataFile(), 'utf8')
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
    state = { reservations: [] }
    return state
  }
  const parsed = JSON.parse(raw) // arquivo corrompido derruba o servidor de propósito: melhor do que sobrescrever
  if (!parsed || !Array.isArray(parsed.reservations)) {
    throw new Error(`Arquivo de reservas em formato inesperado: ${dataFile()}`)
  }
  state = parsed
  return state
}

function persist() {
  fs.mkdirSync(dataDir(), { recursive: true })
  const tmp = `${dataFile()}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2))
  fs.renameSync(tmp, dataFile())
}

/** Aplica uma mudança e grava; se a gravação falhar, desfaz a mudança em memória. */
function commit(mutate) {
  const snapshot = JSON.stringify(load())
  try {
    const result = mutate(state)
    persist()
    return result
  } catch (err) {
    state = JSON.parse(snapshot)
    throw err
  }
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function newCode(existing) {
  for (;;) {
    let code = 'LDL-'
    for (const byte of crypto.randomBytes(5)) code += CODE_ALPHABET[byte % CODE_ALPHABET.length]
    if (!existing.has(code)) return code
  }
}

export function listReservations() {
  return load().reservations
}

export function listPassengers() {
  return load().reservations.flatMap((reservation) =>
    reservation.passengers.map((passenger) => ({ ...passenger, code: reservation.code })),
  )
}

export function findByCpf(cpf) {
  return load().reservations.find((reservation) => reservation.passengers.some((p) => p.cpf === cpf)) ?? null
}

/**
 * Cria a reserva se (e somente se) todas as poltronas estiverem livres e nenhum CPF
 * já tiver reserva. Retorna { ok: true, reservation } ou { ok: false, error, ... }.
 */
export function createReservation(passengers) {
  const current = listPassengers()

  const cpfs = new Set(current.map((p) => p.cpf))
  const repeated = passengers.find((p) => cpfs.has(p.cpf))
  if (repeated) return { ok: false, error: 'cpf_exists', role: repeated.role }

  const taken = new Set(current.map((p) => p.seat))
  const seats = passengers.map((p) => p.seat).filter((seat) => taken.has(seat))
  if (seats.length) return { ok: false, error: 'seat_taken', seats }

  const reservation = commit((draft) => {
    const created = {
      code: newCode(new Set(draft.reservations.map((r) => r.code))),
      createdAt: new Date().toISOString(),
      passengers,
    }
    draft.reservations.push(created)
    return created
  })
  return { ok: true, reservation }
}

/** Cancela a reserva inteira (titular + acompanhante). */
export function removeReservation(code) {
  if (!load().reservations.some((r) => r.code === code)) return false
  commit((draft) => {
    draft.reservations = draft.reservations.filter((r) => r.code !== code)
  })
  return true
}

/** Remove só o acompanhante de uma reserva, liberando a poltrona dele. */
export function removeCompanion(code) {
  const reservation = load().reservations.find((r) => r.code === code)
  if (!reservation || !reservation.passengers.some((p) => p.role === 'acompanhante')) return false
  commit((draft) => {
    const target = draft.reservations.find((r) => r.code === code)
    target.passengers = target.passengers.filter((p) => p.role !== 'acompanhante')
  })
  return true
}
