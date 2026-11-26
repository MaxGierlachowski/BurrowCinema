# BurrowCinema

Ein schlanker, mobil optimierter Web Client für Jellyfin. Anmelden mit dem eigenen Jellyfin Account, Filme und Serien durchstöbern, Details ansehen und Titel in eigene Ordner sortieren. Über Radarr und Sonarr lassen sich auch Titel finden und einsortieren, die noch nicht heruntergeladen sind.

Läuft komplett im Browser und wird automatisch über GitHub Pages gehostet.

## Funktionen
* Login direkt gegen die Jellyfin API
* Bibliothek mit Filmen und Serien, Sortierung und endlosem Scrollen
* Suche über Jellyfin, Radarr und Sonarr gleichzeitig
* Detailseiten mit Backdrop, Infos, Staffeln und Besetzung
* Ordner für eigene Sammlungen, auch mit Titeln, die noch fehlen
* Ordner werden im Jellyfin Profil gespeichert und sind auf allen Geräten gleich
* Lässt sich auf dem Handy zum Home Bildschirm hinzufügen

## Einrichtung

### 1. GitHub Pages aktivieren
Im Repo unter **Settings, Pages** bei **Source** den Eintrag **GitHub Actions** wählen. Danach baut und veröffentlicht der Workflow die Seite bei jedem Push auf `main`. Die Adresse lautet dann `https://maxgierlachowski.github.io/BurrowCinema/`.

GitHub Pages für private Repos braucht einen bezahlten GitHub Plan. Alternativ das Repo öffentlich machen, im Code liegen keine Zugangsdaten.

### 2. Server erreichbar machen
Weil die Seite per HTTPS ausgeliefert wird, blockiert der Browser Aufrufe an `http://` Adressen. Jellyfin, Radarr und Sonarr müssen deshalb über **HTTPS** erreichbar sein, zum Beispiel über einen Reverse Proxy, Tailscale Serve oder einen Cloudflare Tunnel. Alle drei erlauben API Aufrufe von fremden Seiten (CORS) bereits standardmäßig.

### 3. Radarr und Sonarr verbinden (optional)
In der App unter **Einstellungen** Adresse und API Key eintragen. Den Key findet man in Radarr bzw. Sonarr unter **Settings, General, Security**. Die Keys bleiben nur im Browser des jeweiligen Geräts gespeichert.

## Entwicklung
```bash
npm install
npm run dev      # lokaler Server auf http://localhost:5173
npm run build    # statischer Build nach dist/
```

Technik: Vite, React, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, React Router. Details zur Planung stehen in [PLAN.md](PLAN.md).
