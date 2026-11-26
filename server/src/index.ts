import { serve } from '@hono/node-server'
import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { db, transaction } from './db.ts'

const JELLYFIN_URL = (process.env.JELLYFIN_URL ?? '').replace(/\/+$/, '')
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN ?? 'https://maxgierlachowski.github.io').split(',')
const PORT = Number(process.env.PORT ?? 8787)

if (!JELLYFIN_URL) throw new Error('JELLYFIN_URL is required')

type User = { id: string; name: string }
type Draw = {
  id: string
  title: string
  owner_id: string
  owner_name: string
  item_type: string
  source_label: string
  starts_at: number
  ends_at: number
  ended_at: number | null
  created_at: number
}
type ItemInput = { key: string; source: string; id: string; type: string; title: string; year?: number; rating?: number; poster?: string }

// Identity comes from Jellyfin: the app's token is checked against /Users/Me and cached briefly.
const identities = new Map<string, { user: User; expires: number }>()

async function identify(authorization: string | undefined): Promise<User> {
  if (!authorization) throw new HTTPException(401, { message: 'Nicht angemeldet' })
  const cached = identities.get(authorization)
  if (cached && cached.expires > Date.now()) return cached.user

  const res = await fetch(`${JELLYFIN_URL}/Users/Me`, { headers: { Authorization: authorization } }).catch(() => null)
  if (!res) throw new HTTPException(502, { message: 'Jellyfin nicht erreichbar' })
  if (!res.ok) throw new HTTPException(401, { message: 'Jellyfin Anmeldung ungültig' })
  const me = (await res.json()) as { Id: string; Name: string }
  const user = { id: me.Id, name: me.Name }
  identities.set(authorization, { user, expires: Date.now() + 5 * 60_000 })
  return user
}

function status(draw: Draw, now = Date.now()) {
  if (draw.ended_at || now >= draw.ends_at) return 'ended'
  return now < draw.starts_at ? 'scheduled' : 'running'
}

function loadDraw(id: string, user: User) {
  const draw = db.prepare('SELECT * FROM draws WHERE id = ?').get(id) as Draw | undefined
  const member = db.prepare('SELECT 1 FROM participants WHERE draw_id = ? AND user_id = ?').get(id, user.id)
  if (!draw || !member) throw new HTTPException(404, { message: 'Auslosung nicht gefunden' })
  return draw
}

function summary(draw: Draw, user: User) {
  const participants = db
    .prepare(
      `SELECT p.user_id AS id, p.user_name AS name, COUNT(s.item_key) AS swiped
       FROM participants p LEFT JOIN swipes s ON s.draw_id = p.draw_id AND s.user_id = p.user_id
       WHERE p.draw_id = ? GROUP BY p.user_id ORDER BY p.user_name`,
    )
    .all(draw.id)
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM items WHERE draw_id = ?').get(draw.id) as { count: number }
  const posters = db
    .prepare('SELECT poster FROM items WHERE draw_id = ? AND poster IS NOT NULL ORDER BY rating DESC LIMIT 3')
    .all(draw.id)
    .map((row) => row.poster)
  return {
    id: draw.id,
    title: draw.title,
    owner: { id: draw.owner_id, name: draw.owner_name },
    isOwner: draw.owner_id === user.id,
    itemType: draw.item_type,
    sourceLabel: draw.source_label,
    startsAt: draw.starts_at,
    endsAt: draw.ended_at ?? draw.ends_at,
    status: status(draw),
    itemCount: count,
    posters,
    participants,
  }
}

const app = new Hono<{ Variables: { user: User } }>()

app.use('/api/*', cors({ origin: ALLOWED_ORIGINS, allowMethods: ['GET', 'POST', 'PUT', 'DELETE'] }))
app.get('/api/health', (c) => c.json({ ok: true }))
app.use('/api/*', async (c, next) => {
  c.set('user', await identify(c.req.header('Authorization')))
  await next()
})

app.get('/api/draws', (c) => {
  const user = c.get('user')
  const draws = db
    .prepare('SELECT d.* FROM draws d JOIN participants p ON p.draw_id = d.id WHERE p.user_id = ? ORDER BY d.starts_at DESC')
    .all(user.id) as Draw[]
  return c.json(draws.map((draw) => summary(draw, user)))
})

app.post('/api/draws', async (c) => {
  const user = c.get('user')
  const body = await c.req.json<{
    title: string
    itemType: string
    sourceLabel: string
    startsAt: number
    endsAt: number
    invitees: User[]
    items: ItemInput[]
  }>()
  if (!body.title?.trim()) throw new HTTPException(400, { message: 'Titel fehlt' })
  if (!(body.endsAt > body.startsAt)) throw new HTTPException(400, { message: 'Das Ende muss nach dem Start liegen' })
  if (!body.items?.length) throw new HTTPException(400, { message: 'Keine Titel ausgewählt' })

  const id = randomUUID()
  const people = [user, ...(body.invitees ?? []).filter((p) => p.id !== user.id)]
  transaction(() => {
    db.prepare('INSERT INTO draws VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)').run(
      id, body.title.trim(), user.id, user.name, body.itemType, body.sourceLabel, body.startsAt, body.endsAt, Date.now(),
    )
    const addPerson = db.prepare('INSERT OR IGNORE INTO participants VALUES (?, ?, ?)')
    for (const p of people) addPerson.run(id, p.id, p.name)
    const addItem = db.prepare('INSERT OR IGNORE INTO items VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    for (const i of body.items) addItem.run(id, i.key, i.source, i.id, i.type, i.title, i.year ?? null, i.rating ?? null, i.poster ?? null)
  })
  return c.json(summary(loadDraw(id, user), user), 201)
})

app.get('/api/draws/:id', (c) => {
  const user = c.get('user')
  const draw = loadDraw(c.req.param('id'), user)
  const items = db
    .prepare('SELECT item_key AS key, source, item_id AS id, type, title, year, rating, poster FROM items WHERE draw_id = ?')
    .all(draw.id)
  const mine = db.prepare('SELECT item_key, liked FROM swipes WHERE draw_id = ? AND user_id = ?').all(draw.id, user.id)
  // Votes stay hidden while the draw is running so nobody gets influenced.
  const results =
    status(draw) === 'ended'
      ? db
          .prepare('SELECT item_key AS key, SUM(liked) AS likes, COUNT(*) AS votes FROM swipes WHERE draw_id = ? GROUP BY item_key')
          .all(draw.id)
      : null
  return c.json({
    ...summary(draw, user),
    items,
    mySwipes: Object.fromEntries(mine.map((s) => [s.item_key, s.liked === 1])),
    results,
  })
})

function requireRunning(draw: Draw) {
  if (status(draw) !== 'running') throw new HTTPException(409, { message: 'Die Auslosung läuft gerade nicht' })
}

app.put('/api/draws/:id/swipes/:key', async (c) => {
  const user = c.get('user')
  const draw = loadDraw(c.req.param('id'), user)
  requireRunning(draw)
  const { like } = await c.req.json<{ like: boolean }>()
  db.prepare('INSERT OR REPLACE INTO swipes VALUES (?, ?, ?, ?, ?)').run(draw.id, user.id, c.req.param('key'), like ? 1 : 0, Date.now())
  return c.body(null, 204)
})

app.delete('/api/draws/:id/swipes/:key', (c) => {
  const user = c.get('user')
  const draw = loadDraw(c.req.param('id'), user)
  requireRunning(draw)
  db.prepare('DELETE FROM swipes WHERE draw_id = ? AND user_id = ? AND item_key = ?').run(draw.id, user.id, c.req.param('key'))
  return c.body(null, 204)
})

function requireOwner(draw: Draw, user: User) {
  if (draw.owner_id !== user.id) throw new HTTPException(403, { message: 'Nur der Ersteller darf das' })
}

app.post('/api/draws/:id/end', (c) => {
  const user = c.get('user')
  const draw = loadDraw(c.req.param('id'), user)
  requireOwner(draw, user)
  if (status(draw) !== 'ended') db.prepare('UPDATE draws SET ended_at = ? WHERE id = ?').run(Date.now(), draw.id)
  return c.body(null, 204)
})

app.delete('/api/draws/:id', (c) => {
  const user = c.get('user')
  const draw = loadDraw(c.req.param('id'), user)
  requireOwner(draw, user)
  db.prepare('DELETE FROM draws WHERE id = ?').run(draw.id)
  return c.body(null, 204)
})

app.get('/api/stats', (c) => {
  const user = c.get('user')
  const rows = db
    .prepare(
      `SELECT i.item_key AS key, MAX(i.source) AS source, MAX(i.item_id) AS id, MAX(i.type) AS type, MAX(i.title) AS title,
              MAX(i.year) AS year, MAX(i.rating) AS rating, MAX(i.poster) AS poster,
              SUM(s.liked) AS likes, COUNT(s.liked) AS votes, COUNT(DISTINCT i.draw_id) AS draws
       FROM items i
       JOIN participants p ON p.draw_id = i.draw_id AND p.user_id = ?
       JOIN draws d ON d.id = i.draw_id AND (d.ended_at IS NOT NULL OR d.ends_at <= ?)
       LEFT JOIN swipes s ON s.draw_id = i.draw_id AND s.item_key = i.item_key
       GROUP BY i.item_key HAVING votes > 0`,
    )
    .all(user.id, Date.now())
  return c.json(rows)
})

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ message: err.message }, err.status)
  console.error(err)
  return c.json({ message: 'Interner Fehler' }, 500)
})

serve({ fetch: app.fetch, port: PORT }, () => console.log(`BurrowCinema server on :${PORT}, Jellyfin at ${JELLYFIN_URL}`))
