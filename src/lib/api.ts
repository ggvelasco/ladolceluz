export type Role = 'titular' | 'acompanhante'

export interface PassengerData {
  nome: string
  cpf: string
  emergenciaNome: string
  emergenciaTelefone: string
  hospital: string
  convenio: string
  temAlergia: boolean
  alergias: string
  temNecessidade: boolean
  necessidade: string
}

export interface TakenSeat {
  seat: number
  nome?: string
}

export interface SeatsResponse {
  total: number
  blocked: number[]
  taken: TakenSeat[]
}

export interface Ticket {
  role: Role
  nome: string
  seat: number
}

export interface Reservation {
  code: string
  tickets: Ticket[]
}

export interface AdminPassenger extends PassengerData {
  role: Role
  seat: number
}

export interface AdminReservation {
  code: string
  createdAt: string
  passengers: AdminPassenger[]
}

export interface AdminResponse {
  total: number
  blocked: number[]
  reservations: AdminReservation[]
}

interface ErrorBody {
  error?: string
  message?: string
  fields?: Record<string, string>
  seats?: number[]
  role?: Role
}

export class ApiError extends Error {
  status: number
  code: string
  fields: Record<string, string>
  seats: number[]
  role?: Role

  constructor(status: number, body: ErrorBody) {
    super(body.message ?? 'Algo deu errado. Tente de novo.')
    this.status = status
    this.code = body.error ?? 'error'
    this.fields = body.fields ?? {}
    this.seats = body.seats ?? []
    this.role = body.role
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
    })
  } catch {
    throw new ApiError(0, {
      error: 'network',
      message: 'Não consegui falar com o servidor. Confira sua conexão e tente de novo.',
    })
  }
  const body = (await response.json().catch(() => null)) as (T & ErrorBody) | null
  if (!response.ok || body === null) throw new ApiError(response.status, body ?? {})
  return body
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })

export const api = {
  seats: () => request<SeatsResponse>('/seats'),

  reserve: (payload: {
    titular: PassengerData
    acompanhante: PassengerData | null
    seats: { titular: number; acompanhante?: number }
  }) => request<Reservation>('/reservations', post(payload)),

  lookup: (cpf: string) => request<Reservation>('/tickets/lookup', post({ cpf })),

  sync: (codes: string[]) => request<{ reservations: Reservation[] }>('/tickets/sync', post({ codes })),

  admin: {
    list: (key: string) => request<AdminResponse>('/admin/reservations', { headers: { 'x-admin-key': key } }),
    cancel: (key: string, code: string) =>
      request<{ ok: true }>(`/admin/reservations/${encodeURIComponent(code)}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': key },
      }),
    removeCompanion: (key: string, code: string) =>
      request<{ ok: true }>(`/admin/reservations/${encodeURIComponent(code)}/companion`, {
        method: 'DELETE',
        headers: { 'x-admin-key': key },
      }),
  },
}
