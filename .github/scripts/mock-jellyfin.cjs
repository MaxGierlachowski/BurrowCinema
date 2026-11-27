// Jellyfin stand in for the emulator smoke test. The emulator reaches it at http://10.0.2.2:8096.
// Serves the media from make-media.sh (MEDIA_DIR), records playback reports and prints them at GET /__report.
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const path = require('path')

const MEDIA = process.env.MEDIA_DIR || '/tmp/bc-media'
const TICKS = 10_000_000
const RUNTIME = 60 * TICKS
const PERSON = { Id: 'p0', Name: 'Anna Beispiel', Role: 'Hauptrolle', Type: 'Actor' }

const movies = ['Dune', 'Arrival', 'Her', 'Drive', 'Sicario', 'Whiplash'].map((Name, i) => ({
  Id: `m${i}`, Name, Type: 'Movie', MediaType: 'Video', ProductionYear: 2010 + i, CommunityRating: 7 + i / 10,
  Overview: 'Testfilm', Genres: ['Drama'], RunTimeTicks: RUNTIME, People: [PERSON], DateCreated: `2026-11-0${i + 1}T12:00:00Z`,
}))
movies[0].Trickplay = { 'ms-m0': { 320: { Width: 320, Height: 180, TileWidth: 10, TileHeight: 10, ThumbnailCount: 6, Interval: 10000 } } }
movies[0].Chapters = [{ StartPositionTicks: 0, Name: 'Anfang' }, { StartPositionTicks: 30 * TICKS, Name: 'Mitte' }]

const series = { Id: 's0', Name: 'Severance', Type: 'Series', ProductionYear: 2022, Overview: 'Testserie', Genres: ['Drama'], ChildCount: 1, People: [PERSON], DateCreated: '2026-11-10T12:00:00Z' }
const season = { Id: 's0-1', Name: 'Staffel 1', Type: 'Season', IndexNumber: 1, SeriesId: 's0', SeriesName: 'Severance', ChildCount: 3 }
const episodes = ['Gute Nachrichten', 'Halbe Loop', 'Im Takt'].map((Name, i) => ({
  Id: `e${i + 1}`, Name, Type: 'Episode', MediaType: 'Video', IndexNumber: i + 1, ParentIndexNumber: 1, Overview: `Folge ${i + 1} der Testserie`,
  SeriesId: 's0', SeriesName: 'Severance', SeasonId: 's0-1', SeasonName: 'Staffel 1', RunTimeTicks: RUNTIME, DateCreated: '2026-11-10T12:00:00Z',
}))
const views = [
  { Id: 'v-movies', Name: 'Filme', Type: 'CollectionFolder', CollectionType: 'movies' },
  { Id: 'v-shows', Name: 'Serien', Type: 'CollectionFolder', CollectionType: 'tvshows' },
]
const all = [...movies, series, season, ...episodes]
const byId = Object.fromEntries(all.map((item) => [item.Id, item]))

const segments = { m0: [['Intro', 2, 20]], e1: [['Intro', 2, 20]], e2: [['Intro', 2, 20], ['Outro', 45, 60]], e3: [['Intro', 2, 20]] }

// Per user state, changed by the app.
const positions = { m1: 20 * TICKS }
const played = new Set(['e1'])
const favorites = new Set()
const prefs = {}
let sessionCounter = 0
let connectPolls = 0

const report = {
  playing: [], progress: [], stopped: [], streamRequests: [], playbackInfo: [], subtitleRequests: [], trickplayRequests: [],
  activeEncodingsDeleted: 0, played: [], favorites: [], authorizedCodes: [], quickConnectLogins: 0,
}

function userData(item) {
  const position = positions[item.Id] ?? 0
  const data = {
    PlaybackPositionTicks: position, PlayedPercentage: item.RunTimeTicks && position ? (100 * position) / item.RunTimeTicks : undefined,
    Played: played.has(item.Id), PlayCount: played.has(item.Id) ? 1 : 0, IsFavorite: favorites.has(item.Id), Key: item.Id,
  }
  if (item.Type === 'Series' || item.Type === 'Season') data.UnplayedItemCount = episodes.filter((e) => !played.has(e.Id)).length
  return data
}

function mediaSource(item, directPlay = true) {
  const id = item.Id
  const noAudio = id === 'm3'
  const streams = [{ Index: 0, Type: 'Video', Codec: 'h264', Width: 640, Height: 360, DisplayTitle: '360p H264', RealFrameRate: 25, Profile: 'Constrained Baseline' }]
  if (!noAudio) streams.push({ Index: 1, Type: 'Audio', Codec: 'aac', Language: 'ger', DisplayTitle: 'Deutsch AAC Stereo', Channels: 2, IsDefault: true })
  streams.push({
    Index: 2, Type: 'Subtitle', Codec: 'srt', Language: 'ger', DisplayTitle: 'Deutsch', IsExternal: true, IsTextSubtitleStream: true,
    SupportsExternalStream: true, DeliveryMethod: 'External', DeliveryUrl: `/Videos/${id}/ms-${id}/Subtitles/2/0/Stream.srt`,
  })
  const canDirect = directPlay && id !== 'm2'
  return {
    Id: `ms-${id}`, Name: item.Name, Path: `/media/${id}.mp4`, Protocol: 'File', IsRemote: false, Container: 'mp4', RunTimeTicks: RUNTIME,
    Size: 5_000_000, Bitrate: 700_000, ETag: `etag-${id}`, SupportsDirectPlay: canDirect, SupportsDirectStream: canDirect, SupportsTranscoding: true,
    TranscodingUrl: canDirect ? undefined : `/Videos/${id}/master.m3u8?MediaSourceId=ms-${id}&VideoCodec=h264&AudioCodec=aac&TranscodeReasons=VideoCodecNotSupported`,
    TranscodingSubProtocol: canDirect ? undefined : 'hls', TranscodingContainer: canDirect ? undefined : 'ts',
    MediaStreams: streams, DefaultAudioStreamIndex: noAudio ? undefined : 1, DefaultSubtitleStreamIndex: -1, HasSegments: !!segments[id],
  }
}

function withData(item) {
  const full = { ...item, UserData: userData(item) }
  if (item.MediaType === 'Video') full.MediaSources = [mediaSource(item)]
  if (item.Type === 'Episode' || item.Type === 'Season') full.ParentBackdropItemId = 's0'
  return full
}

// Jellyfin treats query names case insensitively.
function params(url) {
  const out = {}
  for (const [key, value] of url.searchParams) out[key.toLowerCase()] = value
  return out
}

function listItems(q) {
  let items
  if (q.ids) items = q.ids.split(',').map((id) => byId[id]).filter(Boolean)
  else if (q.parentid === 'v-movies') items = movies
  else if (q.parentid === 'v-shows') items = [series]
  else if (q.parentid === 's0') items = [season]
  else if (q.parentid === 's0-1') items = episodes
  else items = all
  if (q.includeitemtypes) {
    const types = q.includeitemtypes.split(',')
    items = items.filter((item) => types.includes(item.Type))
  } else if (!q.ids) items = items.filter((item) => item.Type !== 'Season' && item.Type !== 'Episode')
  if (q.searchterm) items = items.filter((item) => item.Name.toLowerCase().includes(q.searchterm.toLowerCase()))
  if (q.personids) items = items.filter((item) => item.People?.some((p) => p.Id === q.personids))
  for (const filter of (q.filters ?? '').split(',').filter(Boolean)) {
    if (filter === 'IsPlayed') items = items.filter((item) => played.has(item.Id))
    if (filter === 'IsUnplayed') items = items.filter((item) => !played.has(item.Id))
    if (filter === 'IsFavorite') items = items.filter((item) => favorites.has(item.Id))
    if (filter === 'IsResumable') items = items.filter((item) => positions[item.Id] > 0)
  }
  const sortBy = (q.sortby ?? 'SortName').split(',')[0]
  const key = { SortName: 'Name', DateCreated: 'DateCreated', ProductionYear: 'ProductionYear', CommunityRating: 'CommunityRating' }[sortBy] ?? 'Name'
  items = [...items].sort((a, b) => (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0))
  if (q.sortorder === 'Descending') items.reverse()
  const start = Number(q.startindex ?? 0)
  const limit = Number(q.limit ?? items.length)
  return { Items: items.slice(start, start + limit).map(withData), TotalRecordCount: items.length }
}

const json = (res, body, status = 200) => {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}
const noContent = (res) => {
  res.writeHead(204)
  res.end()
}
const notFound = (res) => {
  res.writeHead(404)
  res.end()
}

function sendFile(req, res, file, type) {
  if (!fs.existsSync(file)) return notFound(res)
  const size = fs.statSync(file).size
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '')
  if (!range) {
    res.writeHead(200, { 'content-type': type, 'content-length': size, 'accept-ranges': 'bytes' })
    return req.method === 'HEAD' ? res.end() : fs.createReadStream(file).pipe(res)
  }
  const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]))
  const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
  if (start >= size) {
    res.writeHead(416, { 'content-range': `bytes */${size}` })
    return res.end()
  }
  res.writeHead(206, { 'content-type': type, 'content-length': end - start + 1, 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes' })
  return req.method === 'HEAD' ? res.end() : fs.createReadStream(file, { start, end }).pipe(res)
}

function trackStream(req, res, kind) {
  const entry = { path: req.url.split('?')[0], kind, range: req.headers.range ?? null, status: 0 }
  report.streamRequests.push(entry)
  res.on('finish', () => (entry.status = res.statusCode))
}

const auth = () => ({ AccessToken: 'tok', User: { Id: 'u1', Name: 'Max' }, ServerId: 'mock' })

function handle(req, res, body) {
  const url = new URL(req.url, 'http://x')
  const p = url.pathname
  const q = params(url)
  const m = req.method
  let match

  if (p === '/__report') return json(res, report)
  if (p === '/System/Info/Public') return json(res, { ServerName: 'Mock', Version: '10.11.5', Id: 'mock', StartupWizardCompleted: true })
  if (p === '/Users/AuthenticateByName') {
    const { Username, Pw } = JSON.parse(body || '{}')
    return Username === 'max' && Pw === 'secret' ? json(res, auth()) : json(res, { error: 'bad login' }, 401)
  }
  if (p === '/Users/Me') return json(res, { Id: 'u1', Name: 'Max', Configuration: { EnableNextEpisodeAutoPlay: true, SubtitleMode: 'Default', AudioLanguagePreference: 'ger' } })
  if (p === '/Users') return json(res, [{ Id: 'u2', Name: 'Diana' }])
  if (p === '/Sessions/Logout') return noContent(res)

  // Quick Connect: the first two polls are not yet authorized.
  if (p === '/QuickConnect/Enabled') return json(res, true)
  if (p === '/QuickConnect/Initiate') {
    connectPolls = 0
    return json(res, { Code: '482913', Secret: 'sec', Authenticated: false })
  }
  if (p === '/QuickConnect/Connect') return json(res, { Code: '482913', Secret: q.secret, Authenticated: ++connectPolls > 2 })
  if (p === '/QuickConnect/Authorize') {
    report.authorizedCodes.push(q.code)
    return json(res, true)
  }
  if (p === '/Users/AuthenticateWithQuickConnect') {
    report.quickConnectLogins++
    return JSON.parse(body || '{}').Secret === 'sec' ? json(res, auth()) : json(res, { error: 'bad secret' }, 401)
  }

  if (p.startsWith('/DisplayPreferences/')) {
    if (m === 'POST') {
      prefs[p] = JSON.parse(body || '{}').CustomPrefs
      return noContent(res)
    }
    return json(res, { CustomPrefs: prefs[p] ?? {} })
  }

  if (p === '/UserViews') return json(res, { Items: views, TotalRecordCount: views.length })
  if (p === '/UserItems/Resume') {
    const items = all.filter((item) => positions[item.Id] > 0 && !played.has(item.Id)).map(withData)
    return json(res, { Items: items, TotalRecordCount: items.length })
  }
  if (p === '/Shows/NextUp') {
    const next = episodes.find((e) => !played.has(e.Id))
    return json(res, { Items: next ? [withData(next)] : [], TotalRecordCount: next ? 1 : 0 })
  }
  if (p === '/Items/Latest') return json(res, (q.parentid === 'v-shows' ? [series] : [...movies].reverse()).map(withData))
  if (p === '/Items') return json(res, listItems(q))
  if (p === '/Persons') {
    const people = [{ ...PERSON, Type: 'Person' }].filter((person) => !q.searchterm || person.Name.toLowerCase().includes(q.searchterm.toLowerCase()))
    return json(res, { Items: people, TotalRecordCount: people.length })
  }
  if ((match = /^\/Items\/([^/]+)\/Similar$/.exec(p))) {
    const items = movies.filter((item) => item.Id !== match[1]).slice(0, 4).map(withData)
    return json(res, { Items: items, TotalRecordCount: items.length })
  }
  if (/^\/Shows\/s0\/Seasons$/.test(p)) return json(res, { Items: [withData(season)], TotalRecordCount: 1 })
  if (p.includes('/Seasons')) return json(res, { Items: [], TotalRecordCount: 0 })
  if (/^\/Shows\/s0\/Episodes$/.test(p)) {
    let items = episodes
    const index = episodes.findIndex((e) => e.Id === q.adjacentto)
    if (index >= 0) items = episodes.slice(Math.max(0, index - 1), index + 2)
    return json(res, { Items: items.map(withData), TotalRecordCount: items.length })
  }

  if ((match = /^\/User(Played|Favorite)Items\/([^/]+)$/.exec(p))) {
    const [, kind, id] = match
    const set = kind === 'Played' ? played : favorites
    if (m === 'POST') set.add(id)
    else set.delete(id)
    if (kind === 'Played' && m === 'POST') delete positions[id]
    report[kind === 'Played' ? 'played' : 'favorites'] = [...set]
    return json(res, byId[id] ? userData(byId[id]) : {})
  }

  if ((match = /^\/Items\/([^/]+)\/PlaybackInfo$/.exec(p))) {
    const item = byId[match[1]]
    if (!item) return notFound(res)
    const info = JSON.parse(body || '{}')
    report.playbackInfo.push({
      ItemId: item.Id, EnableDirectPlay: info.EnableDirectPlay, StartTimeTicks: info.StartTimeTicks, MediaSourceId: info.MediaSourceId,
      AudioStreamIndex: info.AudioStreamIndex, SubtitleStreamIndex: info.SubtitleStreamIndex, MaxStreamingBitrate: info.MaxStreamingBitrate,
      HasDeviceProfile: !!info.DeviceProfile,
    })
    return json(res, { PlaySessionId: `ps-${++sessionCounter}`, MediaSources: [mediaSource(item, info.EnableDirectPlay !== false)] })
  }
  if ((match = /^\/MediaSegments\/([^/]+)$/.exec(p))) {
    const items = (segments[match[1]] ?? []).map(([Type, start, end], i) => ({ Id: `${match[1]}-seg${i}`, ItemId: match[1], Type, StartTicks: start * TICKS, EndTicks: end * TICKS }))
    return json(res, { Items: items, TotalRecordCount: items.length })
  }

  if (p === '/Sessions/Playing' || p === '/Sessions/Playing/Progress' || p === '/Sessions/Playing/Stopped') {
    const r = JSON.parse(body || '{}')
    const entry = { ItemId: r.ItemId, PositionTicks: r.PositionTicks, IsPaused: r.IsPaused, PlayMethod: r.PlayMethod, PlaySessionId: r.PlaySessionId, Failed: r.Failed, at: Date.now() }
    const list = p.endsWith('Stopped') ? 'stopped' : p.endsWith('Progress') ? 'progress' : 'playing'
    report[list].push(entry)
    if (list === 'stopped' && r.ItemId && !played.has(r.ItemId)) positions[r.ItemId] = r.PositionTicks
    return noContent(res)
  }
  if (p === '/Videos/ActiveEncodings' && m === 'DELETE') {
    report.activeEncodingsDeleted++
    return noContent(res)
  }

  if ((match = /^\/Videos\/([^/]+)\/stream(\.\w+)?$/.exec(p))) {
    trackStream(req, res, 'direct')
    if (match[1] === 'm4') {
      // Sicario: the direct stream is broken, so the player has to fall back to the transcode.
      res.writeHead(200, { 'content-type': 'video/mp4', 'content-length': 1024 })
      return res.end(crypto.randomBytes(1024))
    }
    return sendFile(req, res, path.join(MEDIA, match[1] === 'm3' ? 'test-noaudio.mp4' : 'test.mp4'), 'video/mp4')
  }
  if ((match = /^\/Videos\/[^/]+\/(?:master|main|index)\.m3u8$/.exec(p))) {
    trackStream(req, res, 'hls')
    return sendFile(req, res, path.join(MEDIA, 'hls', 'index.m3u8'), 'application/vnd.apple.mpegurl')
  }
  if ((match = /^\/Videos\/[^/]+\/(?:.*\/)?(seg\d+\.ts)$/.exec(p))) {
    trackStream(req, res, 'hls')
    return sendFile(req, res, path.join(MEDIA, 'hls', match[1]), 'video/mp2t')
  }
  if (/^\/Videos\/[^/]+\/[^/]+\/Subtitles\/\d+\/\d+\/Stream\.\w+$/.test(p)) {
    report.subtitleRequests.push(p)
    return sendFile(req, res, path.join(MEDIA, 'test.srt'), 'application/x-subrip')
  }
  if (/^\/Videos\/[^/]+\/Trickplay\/\d+\/\d+\.jpg$/.test(p)) {
    report.trickplayRequests.push(p)
    return sendFile(req, res, path.join(MEDIA, 'trickplay-0.jpg'), 'image/jpeg')
  }
  return notFound(res)
}

http
  .createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      if (!req.url.startsWith('/__report')) console.log(req.method, req.url, req.headers.range ?? '')
      try {
        handle(req, res, body)
      } catch (error) {
        console.error(error)
        json(res, { error: String(error) }, 500)
      }
    })
  })
  .listen(8096, '0.0.0.0', () => console.log(`mock jellyfin on 8096, media from ${MEDIA}`))
