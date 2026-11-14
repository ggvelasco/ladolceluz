import config from '../../shared/config.json'

// Layout do ônibus, gerado a partir do total de poltronas em shared/config.json.
//
// Numeração padrão de ônibus rodoviário: cada fileira tem 4 poltronas —
// 1 e 2 do lado do motorista (janela, corredor), 3 e 4 do lado da porta (janela, corredor).
// Se o total não for múltiplo de 4, a última fileira fica só com o lado do motorista.

export const TOTAL_SEATS: number = config.totalSeats
export const BLOCKED_SEATS = new Set<number>(config.blockedSeats as number[])
export const ROWS = Math.ceil(TOTAL_SEATS / 4)

export interface SeatPosition {
  seat: number
  /** Fileira, 1 = primeira atrás do motorista. */
  row: number
  /** Faixa de 1 a 5 (3 é o corredor): 1 = janela do lado da porta … 5 = janela do lado do motorista. */
  lane: 1 | 2 | 4 | 5
}

const LANES = [5, 4, 1, 2] as const

export const SEATS: SeatPosition[] = Array.from({ length: TOTAL_SEATS }, (_, index) => ({
  seat: index + 1,
  row: Math.floor(index / 4) + 1,
  lane: LANES[index % 4],
}))

export const formatSeat = (seat: number) => String(seat).padStart(2, '0')
