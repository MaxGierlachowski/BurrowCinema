# BurrowCinema

Ein schlanker, mobil optimierter Web Client für Jellyfin. Anmelden mit dem eigenen Jellyfin Account, Filme und Serien durchstöbern, Details ansehen, Titel in Ordner sortieren, fehlende Titel über Radarr und Sonarr anfragen und gemeinsam per Swipe auslosen, was geschaut wird.

## Funktionen
* Login direkt gegen die Jellyfin API
* Bibliothek mit Filmen und Serien, Sortierung, Rating und endlosem Scrollen
* Suche über Jellyfin, Radarr und Sonarr gleichzeitig
* Detailseiten mit Backdrop, Infos, Staffeln und Besetzung
* Ordner für eigene Sammlungen, auch mit Titeln, die noch fehlen. Sie liegen im Jellyfin Profil und sind auf allen Geräten gleich
* Fehlende Filme und Serien direkt in Radarr bzw. Sonarr anfragen, mit Auswahl aus allen Qualitätsprofilen
* Auslosung: gemeinsam mit anderen Jellyfin Benutzern durch Filme und Serien swipen und sehen, worauf alle Lust haben
* Lässt sich auf dem Handy zum Home Bildschirm hinzufügen

## Deployment (empfohlen): ein Container für alles

Das `Dockerfile` im Hauptordner baut ein einziges Image mit der App **und** dem Server für die Auslosung. Beides läuft unter derselben Adresse, in der App muss deshalb keine Server Adresse eingetragen werden.

### Mit einer Deploy Plattform (Dokploy, Coolify, CapRover, Railway …)
1. Neuen Service bzw. neue Application anlegen und dieses GitHub Repo verbinden, Branch `main`.
2. Als Build Methode **Dockerfile** wählen (Pfad `Dockerfile`, Kontext `.`). Alternativ kann die Plattform die `docker-compose.yml` nutzen.
3. Umgebungsvariable setzen:

   | Variable | Pflicht | Beispiel | Zweck |
   |---|---|---|---|
   | `JELLYFIN_URL` | ja | `http://jellyfin:8096` | Wie der Container Jellyfin erreicht. Darf eine interne Adresse sein |
   | `ALLOWED_ORIGIN` | nein | `https://maxgierlachowski.github.io` | Nur nötig, wenn zusätzlich die GitHub Pages Version diesen Server nutzt |

4. Persistenten Speicher (Volume) unter **`/data`** einhängen. Dort liegt die SQLite Datenbank der Auslosungen.
5. Domain auf **Port `8787`** zeigen lassen, mit HTTPS.
6. Deploy starten. Der Container meldet sich über einen eingebauten Healthcheck (`/api/health`) als gesund.

### Mit Docker Compose
```bash
cp .env.example .env        # JELLYFIN_URL eintragen
docker compose up -d --build
```
Die App läuft dann auf Port 8787 und muss noch per Reverse Proxy mit HTTPS erreichbar gemacht werden.

### Fertiges Image
Bei jedem Push auf `main` wird das Image zusätzlich unter `ghcr.io/maxgierlachowski/burrowcinema:latest` veröffentlicht (für amd64 und arm64). Ist das Repo privat, ist auch das Image privat und braucht vorher `docker login ghcr.io`.

## Wichtig: HTTPS für Jellyfin, Radarr und Sonarr
Die App spricht Jellyfin, Radarr und Sonarr direkt aus dem Browser an. Weil die App per HTTPS läuft, blockiert der Browser Aufrufe an `http://` Adressen. Alle drei müssen deshalb im Browser per **HTTPS** erreichbar sein, zum Beispiel über denselben Reverse Proxy. Ihre CORS Einstellungen erlauben das bereits standardmäßig.

Radarr und Sonarr werden in der App unter **Einstellungen** verbunden. Den API Key findet man dort jeweils unter **Settings, General, Security**. Adresse und Key werden im Jellyfin Profil gespeichert und sind danach auf jedem Gerät verfügbar, auf dem man sich mit demselben Jellyfin Account anmeldet.

## Wo welche Daten liegen
| Daten | Ort |
|---|---|
| Ordner | Im Jellyfin Profil des Benutzers, plus Zwischenspeicher im Browser |
| Radarr, Sonarr, Auslosung Server, letzte Qualitätsprofile | Im Jellyfin Profil des Benutzers, plus Zwischenspeicher im Browser |
| Jellyfin Login | Nur im Browser des jeweiligen Geräts |
| Auslosungen und Swipes | SQLite Datei im Container unter `/data` |

Der Server speichert keine Passwörter und keine Tokens. Er prüft bei jeder Anfrage den Jellyfin Login direkt bei Jellyfin.

## Alternative: GitHub Pages
Ohne eigenen Container läuft die App auch unter `https://maxgierlachowski.github.io/BurrowCinema/` (Workflow `deploy.yml`, Pages Source „GitHub Actions“). Die Auslosung braucht dann trotzdem den Container, dessen Adresse in der App unter **Einstellungen, Auslosung** eingetragen wird.

## Entwicklung
```bash
npm install
npm run dev      # App auf http://localhost:5173
npm run build    # statischer Build nach dist/

# Server lokal (Node 22.18 oder neuer)
cd server && npm install
JELLYFIN_URL=https://jellyfin.example.com ALLOWED_ORIGIN=http://localhost:5173 npm start
```

Technik: Vite, React, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, React Router. Server: Node, Hono, SQLite. Planung in [PLAN.md](PLAN.md) und [docs/auslosung-plan.md](docs/auslosung-plan.md).
