// Minimal Jellyfin stand in for the emulator smoke test. The emulator reaches it at http://10.0.2.2:8096.
const http = require('http')
const movies = ['Dune', 'Arrival', 'Her', 'Drive', 'Sicario', 'Whiplash'].map((Name, i) => ({
  Id: `m${i}`, Name, Type: 'Movie', ProductionYear: 2010 + i, CommunityRating: 7 + i / 10, Overview: 'Testfilm', Genres: ['Drama'],
}))
const prefs = {}
const json = (res, body, status = 200) => {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}
http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://x')
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      const p = url.pathname
      console.log(req.method, req.url)
      if (p === '/Users/AuthenticateByName') return json(res, { AccessToken: 'tok', User: { Id: 'u1', Name: 'Max' } })
      if (p === '/Users/Me') return json(res, { Id: 'u1', Name: 'Max' })
      if (p === '/Users') return json(res, [{ Id: 'u2', Name: 'Diana' }])
      if (p.startsWith('/DisplayPreferences/')) {
        if (req.method === 'POST') {
          prefs[p] = JSON.parse(body || '{}').CustomPrefs
          res.writeHead(204)
          return res.end()
        }
        return json(res, { CustomPrefs: prefs[p] ?? {} })
      }
      if (p === '/Items') {
        const ids = url.searchParams.get('ids')
        const items = ids ? movies.filter((m) => m.Id === ids) : movies
        return json(res, { Items: items, TotalRecordCount: items.length })
      }
      if (p.includes('/Seasons')) return json(res, { Items: [], TotalRecordCount: 0 })
      res.writeHead(404)
      res.end()
    })
  })
  .listen(8096, '0.0.0.0', () => console.log('mock jellyfin on 8096'))
