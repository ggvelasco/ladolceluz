import { lazy, Suspense, useEffect, useState } from 'react'
import { Illus, RoughFilters } from './components/Art'
import { Checkin } from './components/Checkin'
import { Footer } from './components/Footer'
import { Hero } from './components/Hero'
import { Itinerary, Marquee, Steps } from './components/Sections'
import { TicketsModal } from './components/Tickets'
import { api, type Reservation } from './lib/api'
import { loadReservations, storeReservations, upsertReservation } from './lib/storage'

const Admin = lazy(() => import('./components/Admin'))

export function App() {
  const isAdmin = window.location.pathname.replace(/\/+$/, '') === '/admin'
  return isAdmin ? (
    <Suspense fallback={null}>
      <Admin />
    </Suspense>
  ) : (
    <Site />
  )
}

function Site() {
  const [reservations, setReservations] = useState<Reservation[]>(loadReservations)
  const [ticketsOpen, setTicketsOpen] = useState(false)

  const update = (next: Reservation[]) => {
    setReservations(next)
    storeReservations(next)
  }

  // Ao abrir o site, confere se os tickets salvos ainda valem (o RH pode ter alterado ou cancelado).
  useEffect(() => {
    const saved = loadReservations()
    if (!saved.length) return
    let active = true
    api
      .sync(saved.map((reservation) => reservation.code))
      .then(({ reservations: fresh }) => {
        if (!active) return
        setReservations(fresh)
        storeReservations(fresh)
      })
      .catch(() => {
        // sem conexão: mantém o que está salvo
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="site">
      <RoughFilters />

      {reservations.length > 0 && (
        <button type="button" className="mytickets" onClick={() => setTicketsOpen(true)}>
          <Illus name="ticket" className="mytickets__icon" />
          Meus tickets
        </button>
      )}

      <main>
        <Hero />
        <Itinerary />
        <Marquee />
        <Steps />
        <Checkin
          reservations={reservations}
          onConfirmed={(reservation) => update(upsertReservation(reservations, reservation))}
          onShowTickets={() => setTicketsOpen(true)}
        />
      </main>
      <Footer />

      <TicketsModal
        open={ticketsOpen}
        reservations={reservations}
        onClose={() => setTicketsOpen(false)}
        onFound={(reservation) => update(upsertReservation(reservations, reservation))}
      />
    </div>
  )
}
