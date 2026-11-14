// Servidor de produção: entrega o site já compilado (dist/) e a API de reservas.
//   npm run build && npm start

import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import { createApi } from './api.js'
import { dataDir, ROOT } from './store.js'

const dist = path.join(ROOT, 'dist')
const indexHtml = path.join(dist, 'index.html')

if (!fs.existsSync(indexHtml)) {
  console.error('Não encontrei dist/index.html. Rode "npm run build" antes de "npm start".')
  process.exit(1)
}

const app = createApi()

app.use((_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
  })
  next()
})

app.use(express.static(dist, { index: false, maxAge: '7d', immutable: false }))

// Qualquer outra rota GET (ex.: /admin) cai no app React.
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next()
  res.set('Cache-Control', 'no-cache')
  res.sendFile(indexHtml)
})

const port = Number(process.env.PORT) || 3000
app.listen(port, () => {
  console.log(`La Dolce Luz no ar na porta ${port}`)
  console.log(`Reservas gravadas em: ${path.join(dataDir(), 'reservas.json')}`)
  if (process.env.RAILWAY_ENVIRONMENT && !process.env.DATA_DIR && !process.env.RAILWAY_VOLUME_MOUNT_PATH) {
    console.log('ATENÇÃO: nenhum volume conectado — as reservas serão APAGADAS a cada novo deploy.')
  }
  if (!process.env.ADMIN_KEY) console.log('Aviso: ADMIN_KEY não definida — a página /admin está desativada.')
})
