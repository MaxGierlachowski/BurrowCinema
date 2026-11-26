# Auslosung: Plan

Eine Abstimmung im Stil von Tinder. Ein Benutzer legt eine Auslosung an, lädt andere Jellyfin Benutzer ein, alle swipen durch dieselben Filme oder Serien, und am Ende sieht man, worauf die meisten Lust haben.

## 1. Anforderungen

### Anlegen
| Nr | Anforderung |
|----|-------------|
| A1 | Titel der Auslosung frei wählbar, zum Beispiel „Filmabend Freitag“ |
| A2 | Quelle: ganze Bibliothek oder einer der eigenen Ordner |
| A3 | Filter: nur Filme, nur Serien oder beides |
| A4 | Zeitraum: Start und Ende (Datum und Uhrzeit). Standard: Start sofort, Ende in 24 Stunden |
| A5 | Andere Jellyfin Benutzer suchen und einladen |
| A6 | Der Titelpool wird beim Anlegen eingefroren (Snapshot), damit alle exakt dieselben Titel bewerten, auch wenn sich Ordner oder Bibliothek später ändern |

### Teilnehmen
| Nr | Anforderung |
|----|-------------|
| T1 | Neuer Tab „Auslosung“ mit drei Bereichen: Laufend, Geplant, Beendet |
| T2 | Sichtbar sind alle Auslosungen, die man erstellt hat oder zu denen man eingeladen ist |
| T3 | Laufende Auslosung öffnen und Karten swipen: rechts „Will ich sehen“, links „Gerade nicht“. Zusätzlich Buttons für beide Richtungen und „Rückgängig“ |
| T4 | Fortschritt wird gespeichert, man kann jederzeit unterbrechen und weitermachen |
| T5 | Jeder bekommt die Karten in eigener zufälliger Reihenfolge, damit die ersten Titel nicht bevorzugt werden |

### Beenden und Ergebnis
| Nr | Anforderung |
|----|-------------|
| E1 | Automatisches Ende zum eingestellten Zeitpunkt |
| E2 | Der Ersteller kann jederzeit früher beenden oder die Auslosung löschen |
| E3 | Während sie läuft, sieht man nur den Fortschritt (wer hat wie viel geswiped), nicht die Stimmen, damit niemand beeinflusst wird |
| E4 | Danach eine Rangliste: Zustimmung in Prozent, Anzahl der Stimmen, hervorgehoben die Titel, die **alle** wollen |
| E5 | Fehlende Titel (aus Radarr oder Sonarr Ordnern) lassen sich direkt aus dem Ergebnis anfragen |

### Statistik
| Nr | Anforderung |
|----|-------------|
| S1 | Übersicht über alle Auslosungen, an denen man beteiligt war: beliebteste und unbeliebteste Titel, getrennt nach Filmen und Serien |

## 2. Das zentrale Problem: gemeinsame Daten

Die App ist eine statische Seite auf GitHub Pages ohne eigenes Backend. Für Auslosungen müssen aber mehrere Benutzer dieselben Daten lesen und schreiben.

Geprüft im Jellyfin Quellcode (`RequestHelpers.GetUserId`, `UserController`):
* `GET /Users` darf jeder angemeldete Benutzer aufrufen. Die Suche nach Benutzern funktioniert also direkt.
* Die Profil Ablage (`DisplayPreferences`), in der die Ordner liegen, darf jeder nur für sich selbst lesen und schreiben. Fremde Profile sind nur für Admins zugänglich.

Daraus ergeben sich zwei Wege:

### Variante A: nur Jellyfin, kein neuer Dienst
Jeder speichert seine Swipes im eigenen Profil. Der Ersteller schreibt als Admin die Einladung in die Profile der Eingeladenen und liest später deren Swipes aus.
* Nur Jellyfin **Admins** können Auslosungen anlegen.
* Eingeladene sehen das Ergebnis erst, nachdem die App des Erstellers es einmal ausgewertet und in ihre Profile geschrieben hat.
* Keine Live Fortschrittsanzeige für Eingeladene, gleichzeitige Schreibzugriffe können sich überschreiben.
* Zweckentfremdung einer Jellyfin Funktion, die dafür nicht gedacht ist.

### Variante B: kleiner eigener Dienst (empfohlen)
Ein kleiner Server läuft als Docker Container neben Jellyfin, Radarr und Sonarr.
* Jeder kann Auslosungen anlegen, alle sehen Fortschritt und Ergebnis sofort.
* **Keine eigenen Konten:** Die App schickt den vorhandenen Jellyfin Token mit, der Server prüft ihn bei Jellyfin (`GET /Users/Me`) und weiß so, wer anfragt. Passwörter oder Tokens speichert der Server nicht.
* Daten liegen in einer SQLite Datei auf eurem Server, nicht bei einem Cloud Anbieter.
* Aufwand für euch: Container starten und wie Jellyfin per HTTPS erreichbar machen.

## 3. Schnittstellen (Variante B)

Technik: Node 24, Hono, eingebautes `node:sqlite`. Das Image wird per GitHub Actions gebaut und in der GitHub Container Registry veröffentlicht.

Konfiguration per Umgebungsvariablen: `JELLYFIN_URL`, `ALLOWED_ORIGIN` (die GitHub Pages Adresse), `DATA_DIR`.

Jede Anfrage trägt `Authorization: MediaBrowser Token="…"`, genau wie bei Jellyfin.

| Methode | Pfad | Zweck |
|---------|------|-------|
| GET | `/api/draws` | Eigene und eingeladene Auslosungen mit Status (geplant, laufend, beendet) und eigenem Fortschritt |
| POST | `/api/draws` | Anlegen: Titel, Zeitraum, Eingeladene, Titelpool |
| GET | `/api/draws/:id` | Details, Titelpool, eigene Swipes, Fortschritt aller, Ergebnis wenn beendet |
| PUT | `/api/draws/:id/swipes/:itemKey` | Swipe speichern oder ändern (`{ like: true \| false }`) |
| DELETE | `/api/draws/:id/swipes/:itemKey` | Swipe zurücknehmen |
| POST | `/api/draws/:id/end` | Früher beenden (nur Ersteller) |
| DELETE | `/api/draws/:id` | Löschen (nur Ersteller) |
| GET | `/api/stats` | Statistik über alle eigenen Auslosungen |
| GET | `/api/health` | Für den Verbindungstest in den Einstellungen |

### Datenmodell
```
draws        id, title, owner_id, owner_name, item_type, source_label, starts_at, ends_at, ended_at, created_at
participants draw_id, user_id, user_name
items        draw_id, item_key, source, item_id, type, title, year, rating, poster
swipes       draw_id, user_id, item_key, liked, swiped_at
```
Der Status wird beim Lesen aus `starts_at`, `ends_at` und `ended_at` berechnet. Dadurch braucht es keinen Hintergrundjob für das automatische Ende.

## 4. Risiken und Lösungen

| Risiko | Lösung |
|--------|--------|
| Server nicht per HTTPS erreichbar | Wie bei Jellyfin über Reverse Proxy, Tailscale oder Cloudflare Tunnel. Ohne HTTPS blockiert der Browser |
| CORS | Server erlaubt nur die GitHub Pages Adresse |
| Große Bibliotheken (tausende Titel) | Snapshot speichert nur das Nötigste (Titel, Jahr, Rating, Poster URL). Swipes werden einzeln gespeichert, der Fortschritt bleibt auch bei Abbruch |
| Unterschiedliche Bibliotheksrechte der Benutzer | Poster und Infos kommen aus dem Snapshot, deshalb sehen alle dieselben Karten |
| Zeitzonen | Gespeichert wird in UTC, angezeigt in lokaler Zeit |
| Schlechte Verbindung beim Swipen | Swipe wird sofort angezeigt und im Hintergrund gespeichert, bei Fehler gibt es einen Hinweis und einen neuen Versuch |
| Prüfung des Tokens bei jeder Anfrage | Ergebnis von `/Users/Me` wird kurz zwischengespeichert |
| Benutzer wird in Jellyfin gelöscht | Name ist in der Auslosung gespeichert, bisherige Stimmen bleiben |

## 5. Umsetzungsschritte
1. Server: Datenbank, Token Prüfung, Endpunkte, Dockerfile, Workflow für das Image
2. App: Einstellung für die Server Adresse mit Verbindungstest
3. App: Tab „Auslosung“ mit Liste (laufend, geplant, beendet)
4. App: Anlegen mit Quelle, Filter, Zeitraum und Benutzersuche
5. App: Swipe Ansicht mit Gesten, Buttons und Rückgängig
6. App: Ergebnis, Fortschritt, Beenden und Löschen
7. App: Statistik über alle Auslosungen
8. Tests mit nachgebautem Jellyfin, README mit Docker Compose Beispiel
