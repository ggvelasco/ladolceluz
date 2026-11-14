# La Dolce Luz — Confra 2026 Martin Luz

Site de reserva de poltronas do transfer da confraternização. Sem login e sem pagamento: cada pessoa preenche os dados de embarque, cadastra (ou não) um acompanhante, escolhe as poltronas no mapa do ônibus e recebe os tickets. O RH acompanha tudo em `/admin`.

- **Frontend:** React 19 + TypeScript + Vite, animações com GSAP (ScrollTrigger, DrawSVG, Draggable).
- **Backend:** uma API Express pequena que grava as reservas em um arquivo JSON.

## Rodando

Requer Node 20.12 ou mais novo.

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`. Em desenvolvimento a API roda dentro do próprio Vite (um comando, uma porta).

Para produção:

```bash
npm run build
npm start
```

O servidor sobe na porta definida em `PORT` (padrão 3000), entregando o site compilado e a API.

## Configuração

Copie `.env.example` para `.env` e ajuste:

| Variável      | Para que serve                                                                         |
| ------------- | -------------------------------------------------------------------------------------- |
| `ADMIN_KEY`   | Senha da página `/admin`. Sem ela o painel fica desativado.                            |
| `PORT`        | Porta do servidor em produção.                                                         |
| `DATA_DIR`    | Pasta onde `reservas.json` é gravado (padrão `./data`; no Railway, o volume).          |
| `TRUST_PROXY` | Defina `1` se o site ficar atrás de proxy reverso (no Railway já é automático).        |

O que muda com frequência fica em dois arquivos:

- `shared/config.json` — total de poltronas (`totalSeats`), poltronas bloqueadas (`blockedSeats`, por exemplo para guia ou equipe) e se o mapa mostra o nome de quem ocupa cada poltrona (`showOccupantNames`). O desenho do ônibus se ajusta sozinho ao total.
- `src/config/event.ts` — data, horários, local e endereço.

## Painel do RH (`/admin`)

Lista de embarque ordenada por poltrona, com busca, impressão e exportação em CSV (abre direto no Excel). Dá para cancelar uma reserva inteira ou remover só o acompanhante; a poltrona volta a ficar livre na hora.

Quem reservou vê a mudança na próxima vez que abrir o site: os tickets salvos no aparelho são conferidos com o servidor.

## Colocando no ar (Railway)

O site precisa de **um processo Node ligado o tempo todo e um disco que não apaga**, por isso não roda na Vercel/Netlify. No Railway isso é um serviço com um volume.

### 1. Subir o código para o GitHub

Crie um repositório **privado** e envie o projeto (o `.gitignore` já deixa de fora `node_modules`, `dist`, `.env` e as reservas).

### 2. Criar o serviço

1. Em [railway.com](https://railway.com), **New Project → Deploy from GitHub repo** e escolha o repositório.
2. O Railway detecta o Node sozinho e roda `npm run build` e depois `npm start`. Não precisa configurar comandos.

### 3. Conectar o volume (obrigatório)

1. No serviço, clique com o botão direito → **Attach Volume** (ou `Ctrl/⌘ + K` → "volume").
2. Mount path: `/data`.

O servidor encontra o volume sozinho. Confira em **Deployments → View logs**: deve aparecer `Reservas gravadas em: /data/reservas.json`. Se aparecer **"ATENÇÃO: nenhum volume conectado"**, as reservas vão sumir no próximo deploy — volte e conecte o volume.

### 4. Variáveis

Em **Variables**, adicione:

| Variável    | Valor                                                   |
| ----------- | ------------------------------------------------------- |
| `ADMIN_KEY` | uma senha forte para o RH (ex.: gerada num gerenciador) |

`PORT`, proxy e caminho do volume são automáticos no Railway.

### 5. Health check e domínio

- **Settings → Deploy → Healthcheck Path:** `/api/health`
- **Settings → Networking → Generate Domain** para ter um endereço `*.up.railway.app`, ou **Custom Domain** para usar algo como `confra.martinluz.com.br` (o Railway mostra o registro CNAME para criar no DNS). HTTPS vem pronto.

### 6. Testar antes de divulgar

1. Abra o site, faça uma reserva de teste e veja o ticket.
2. Entre em `/admin` com a `ADMIN_KEY` e confira a reserva.
3. Faça um **Redeploy** e confirme que a reserva continua lá (prova de que o volume está certo).
4. Cancele a reserva de teste pelo `/admin`.

### Bom saber

- **Uma instância só.** Volume não permite réplicas, e é isso que garante que duas pessoas não levem a mesma poltrona. Não aumente as réplicas.
- **Cada deploy tem alguns segundos de queda**, porque o Railway desliga a versão antiga antes de ligar a nova com o volume. Evite publicar mudanças nos horários de pico das reservas.
- **Backup:** exporte o CSV pelo `/admin` de vez em quando, principalmente perto do dia do evento.
- **Atualizações:** todo `git push` no branch principal publica uma nova versão automaticamente.

### Outra hospedagem

Qualquer servidor que rode Node 20.12+ com disco persistente serve (VPS com pm2/systemd, Render com disco pago, Fly.io com volume). Defina `DATA_DIR` apontando para o disco persistente e `TRUST_PROXY=1` se houver proxy reverso, e use HTTPS.

## Dados e privacidade

- O mapa público expõe apenas o número da poltrona e, se ligado, o primeiro nome com a inicial do sobrenome ("Ana S.").
- CPF, contato de emergência e dados de saúde só saem pela rota do painel, protegida por `ADMIN_KEY`.
- No navegador de quem reserva ficam salvos somente código, nome e poltrona (para o "Meus tickets").
- A consulta de tickets por CPF e a criação de reservas têm limite de tentativas por minuto.

## Estrutura

```
server/            API e servidor de produção
  api.js           rotas (/api/seats, /api/reservations, /api/tickets/*, /api/admin/*)
  store.js         leitura e gravação atômica de data/reservas.json
  validate.js      validação de CPF e dos campos
shared/config.json poltronas (lido pelo servidor e pelo site)
src/
  components/      Hero, Sections (roteiro, faixa, 3 passos), Checkin, SeatMap, Tickets, Footer, Admin
  assets/          logo e letreiro (vetores do moodboard), azulejo e ilustrações em traço
  config/event.ts  conteúdo do evento
  lib/             chamadas à API, máscaras, layout do ônibus, GSAP
```

## Observações

- O letreiro "LA DOLCE LUZ" e o logo da Martin Luz foram extraídos em vetor do PDF do moodboard. Os demais títulos usam a fonte Bigelow Rules, a mais próxima disponível com licença aberta.
- As ilustrações em traço e o azulejo são desenhos originais no estilo do moodboard; para trocar pelas artes finais basta substituir os SVGs em `src/assets/illus/` mantendo os nomes.
- Quem tem "reduzir movimento" ativado no sistema recebe o site sem animações de entrada e sem a transição presa ao scroll.
- O briefing menciona um e-mail de confirmação, mas o formulário não pede e-mail e não há serviço de envio configurado; a tela de confirmação não promete o e-mail.
