# BurrowCinema

Ein schlanker, mobil optimierter Web Client für Jellyfin. Anmelden mit dem eigenen Jellyfin Account, Filme und Serien durchstöbern, Details ansehen und Titel in eigene Ordner sortieren. Über Radarr und Sonarr lassen sich auch Titel finden und einsortieren, die noch nicht heruntergeladen sind.

Läuft komplett im Browser und wird automatisch über GitHub Pages gehostet.

## Funktionen
* Login direkt gegen die Jellyfin API
* Bibliothek mit Filmen und Serien, Sortierung und endlosem Scrollen
* Suche über Jellyfin, Radarr und Sonarr gleichzeitig
* Detailseiten mit Backdrop, Infos, Staffeln und Besetzung
* Ordner für eigene Sammlungen, auch mit Titeln, die noch fehlen
* Fehlende Filme und Serien direkt in Radarr bzw. Sonarr anfragen, mit Auswahl aus allen Qualitätsprofilen
* Ordner werden im Jellyfin Profil gespeichert und sind auf allen Geräten gleich
* Auslosung: gemeinsam mit anderen Jellyfin Benutzern durch Filme und Serien swipen und sehen, worauf alle Lust haben
* Lässt sich auf dem Handy zum Home Bildschirm hinzufügen

## Einrichtung

### 1. GitHub Pages aktivieren
Im Repo unter **Settings, Pages** bei **Source** den Eintrag **GitHub Actions** wählen. Danach baut und veröffentlicht der Workflow die Seite bei jedem Push auf `main`. Die Adresse lautet dann `https://maxgierlachowski.github.io/BurrowCinema/`.

GitHub Pages für private Repos braucht einen bezahlten GitHub Plan. Alternativ das Repo öffentlich machen, im Code liegen keine Zugangsdaten.

### 2. Server erreichbar machen
Weil die Seite per HTTPS ausgeliefert wird, blockiert der Browser Aufrufe an `http://` Adressen. Jellyfin, Radarr und Sonarr müssen deshalb über **HTTPS** erreichbar sein, zum Beispiel über einen Reverse Proxy, Tailscale Serve oder einen Cloudflare Tunnel. Alle drei erlauben API Aufrufe von fremden Seiten (CORS) bereits standardmäßig.

### 3. Radarr und Sonarr verbinden (optional)
In der App unter **Einstellungen** Adresse und API Key eintragen. Den Key findet man in Radarr bzw. Sonarr unter **Settings, General, Security**. Die Keys bleiben nur im Browser des jeweiligen Geräts gespeichert.

### 4. Server für die Auslosung (optional)
Die Auslosung braucht einen kleinen Server, der Auslosungen und Swipes für alle Teilnehmer speichert. Angemeldet wird weiterhin nur über Jellyfin: Der Server prüft den Jellyfin Login jeder Anfrage direkt bei Jellyfin und speichert weder Passwörter noch Tokens. Die Daten liegen in einer SQLite Datei.

Das Docker Image wird bei jeder Änderung im Ordner `server/` automatisch gebaut und unter `ghcr.io/maxgierlachowski/burrowcinema-server` veröffentlicht. Beispiel für Docker Compose:

```yaml
services:
  burrowcinema:
    image: ghcr.io/maxgierlachowski/burrowcinema-server:latest
    container_name: burrowcinema
    restart: unless-stopped
    environment:
      JELLYFIN_URL: http://jellyfin:8096            # wie der Server Jellyfin erreicht, gern intern
      ALLOWED_ORIGIN: https://maxgierlachowski.github.io
    volumes:
      - ./burrowcinema:/data
    ports:
      - 8787:8787
```

Danach den Port 8787 wie Jellyfin per HTTPS erreichbar machen und die Adresse in der App unter **Einstellungen, Auslosung** eintragen.

Ist das Repo privat, ist auch das Image privat. Dann vorher `docker login ghcr.io` mit einem GitHub Token (Berechtigung `read:packages`) ausführen, oder das Image direkt bauen: `docker build -t burrowcinema-server ./server`.

## Entwicklung
```bash
npm install
npm run dev      # lokaler Server auf http://localhost:5173
npm run build    # statischer Build nach dist/

# Server lokal starten (Node 22.18 oder neuer)
cd server && npm install
JELLYFIN_URL=https://jellyfin.example.com ALLOWED_ORIGIN=http://localhost:5173 npm start
```

Technik: Vite, React, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, React Router. Details zur Planung stehen in [PLAN.md](PLAN.md).
