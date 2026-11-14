import type { Reservation } from './api'

// Sem login, o "meus tickets" mora no próprio aparelho: guardamos só código,
// nome e poltrona (nada de CPF ou dados de saúde).

const KEY = 'ladolceluz:reservas:v1'

const isReservation = (value: unknown): value is Reservation => {
  const r = value as Reservation
  return !!r && typeof r.code === 'string' && Array.isArray(r.tickets)
}

export function loadReservations(): Reservation[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(isReservation) : []
  } catch {
    return []
  }
}

export function storeReservations(reservations: Reservation[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(reservations))
  } catch {
    // navegação privada ou armazenamento cheio: os tickets continuam valendo, só não ficam salvos aqui
  }
}

export function upsertReservation(list: Reservation[], reservation: Reservation) {
  return [...list.filter((item) => item.code !== reservation.code), reservation]
}
