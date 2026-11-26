# BurrowCinema: Projektplan

Ein kleiner, mobil optimierter Web Client, der direkt mit der Jellyfin API spricht. Man meldet sich mit dem eigenen Jellyfin Account an, stöbert durch Filme und Serien, sieht Detailseiten und sortiert Titel in eigene Ordner. Über Radarr und Sonarr lassen sich auch Titel finden und einsortieren, die noch nicht heruntergeladen sind. Gehostet wird alles kostenlos über GitHub Pages.

## 1. Anforderungen

### Funktional
| Nr | Anforderung | Umsetzung |
|----|-------------|-----------|
| F1 | Login mit Jellyfin Account | Server URL, Benutzername, Passwort gegen `POST /Users/AuthenticateByName`. Token und User Id landen im `localStorage`. |
| F2 | Filme und Serien durchsuchen | Bibliothek mit Tabs (Filme, Serien), Sortierung, endloses Scrollen über `GET /Items`. |
| F3 | Suche | Eine Suche über Jellyfin, Radarr und Sonarr gleichzeitig. Treffer, die schon in Jellyfin sind, werden bei den externen Ergebnissen ausgeblendet. |
| F4 | Detailseite | Backdrop, Poster, Logo, Jahr, Laufzeit, Bewertung, Genres, Handlung, Besetzung, bei Serien die Staffeln. Für externe Titel (Radarr, Sonarr) eine eigene Detailansicht mit Hinweis „nicht in der Bibliothek“. |
| F5 | Ordner | Ordner anlegen, umbenennen, löschen. Filme und Serien hinzufügen und entfernen, egal ob aus Jellyfin, Radarr oder Sonarr. |
| F6 | Ordner Sync | Ordner werden in den Jellyfin DisplayPreferences des Users gespeichert (`CustomPrefs`). Dadurch sind sie auf jedem Gerät gleich, auf dem man sich mit demselben Account anmeldet. `localStorage` dient als Cache. |
| F7 | Radarr und Sonarr Anbindung | In den Einstellungen URL und API Key eintragen, mit „Verbindung testen“. Genutzt wird nur die Suche (`/api/v3/movie/lookup`, `/api/v3/series/lookup`). |
| F8 | Anfragen | Fehlende Titel über `POST /api/v3/movie` bzw. `/series` hinzufügen. Alle Qualitätsprofile (`/qualityprofile`) und Speicherorte (`/rootfolder`) werden geladen und sind auswählbar, die letzte Wahl wird gemerkt. Der Titel wird überwacht und sofort gesucht. |
| F9 | Nicht im Umfang | Abspielen. |

### Nicht funktional
* Mobile first, Bottom Navigation auf dem Handy, Top Navigation ab Tablet Breite.
* Dunkles, kinoartiges Design, sauber und responsive mit shadcn/ui.
* Reine statische Seite ohne eigenes Backend, Deployment automatisch per GitHub Actions auf GitHub Pages.
* Oberfläche auf Deutsch.
* Kurzer, gut lesbarer Code.

## 2. Technik und Abhängigkeiten

| Bereich | Wahl | Grund |
|---------|------|-------|
| Build | Vite + TypeScript | schnell, statischer Output für Pages |
| UI | React 19 | Standard für shadcn/ui |
| Komponenten | shadcn/ui (Radix, Tailwind CSS v4, lucide Icons, vaul Drawer, sonner Toasts) | clean, zugänglich, responsive |
| Routing | React Router mit `HashRouter` | GitHub Pages kennt keine SPA Rewrites, Hash Routes funktionieren ohne 404 Trick |
| Daten | TanStack Query | Caching, Ladezustände, Infinite Scroll ohne eigenen Boilerplate |
| Hosting | GitHub Pages über `actions/deploy-pages` | kein externer Hosting Anbieter nötig |

Vite läuft mit `base: './'`, damit der Build unabhängig vom Repo Namen funktioniert.

## 3. Architektur

```
src/
  lib/
    jellyfin.ts     Auth Header, Login, Items, Details, Staffeln, Bild URLs, Preferences
    arr.ts          Radarr und Sonarr Suche + Verbindungstest
    folders.ts      Ordner Datenmodell, Laden und Speichern (Jellyfin Prefs + Cache)
    storage.ts      kleine localStorage Helfer
    utils.ts        cn() von shadcn
  hooks/            useAuth, useFolders, useArrSettings
  components/
    ui/             shadcn Komponenten
    PosterCard, PosterGrid, AppShell (Navigation), AddToFolderDrawer
  pages/
    Login, Library, Search, ItemDetail, ExternalDetail, Folders, FolderDetail, Settings
```

### Datenmodell Ordner
```ts
type FolderItem = {
  key: string                 // "jellyfin:<id>" | "radarr:<tmdbId>" | "sonarr:<tvdbId>"
  source: 'jellyfin' | 'radarr' | 'sonarr'
  id: string
  type: 'movie' | 'series'
  title: string
  year?: number
  poster?: string
}
type Folder = { id: string; name: string; items: FolderItem[]; createdAt: number }
```

### Routen
| Pfad | Seite |
|------|-------|
| `#/login` | Login |
| `#/` | Bibliothek (Filme, Serien) |
| `#/search` | Suche über alle Quellen |
| `#/item/:id` | Jellyfin Detailseite |
| `#/external/:source/:id` | Radarr oder Sonarr Detailseite |
| `#/folders`, `#/folders/:id` | Ordner Übersicht und Inhalt |
| `#/settings` | Account, Radarr, Sonarr |

## 4. Umsetzungsschritte
1. Vite + React + TS Projekt, Tailwind v4, shadcn/ui initialisieren, Dark Theme.
2. API Schicht für Jellyfin (Login, Items, Details, Bilder, Preferences).
3. Auth Kontext, Login Seite, geschützte Routen, App Shell mit Navigation.
4. Bibliothek mit Tabs, Sortierung, Poster Grid, Infinite Scroll, Skeletons.
5. Detailseite für Jellyfin Titel.
6. Radarr und Sonarr: Einstellungen, Verbindungstest, Suche, externe Detailseite.
7. Ordner: Datenmodell, Sync über Jellyfin, Seiten, „Zu Ordner hinzufügen“ Drawer.
8. GitHub Actions Workflow für Pages, README mit Einrichtung.
9. Build prüfen und Smoke Test mit gemockter API im Headless Browser (Mobile Viewport).

## 5. Voraussetzungen auf eurer Seite
* **HTTPS:** GitHub Pages läuft über HTTPS. Browser blockieren Aufrufe von einer HTTPS Seite an `http://` Adressen (Mixed Content). Jellyfin, Radarr und Sonarr müssen also über HTTPS erreichbar sein, zum Beispiel über einen Reverse Proxy, Tailscale Serve oder Cloudflare Tunnel.
* **CORS:** Jellyfin, Radarr und Sonarr erlauben Aufrufe der API von fremden Origins standardmäßig. Ein Reverse Proxy davor darf die CORS Header nicht entfernen.
* **GitHub Pages aktivieren:** Repo Settings, Pages, Source „GitHub Actions“. Der Workflow deployt bei jedem Push auf `main`. Für private Repos braucht GitHub Pages einen bezahlten Plan, sonst Repo öffentlich machen (es liegen keine Zugangsdaten im Code).
* **API Keys:** Radarr und Sonarr Keys bleiben nur im Browser (`localStorage`) des jeweiligen Geräts und werden nie ins Repo geschrieben.
