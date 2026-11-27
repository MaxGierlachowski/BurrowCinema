# JellyWatch Analyse: Video Player und Jellyfin Browsing für die App (Handy und Android TV)

Stand: 27.11.2026. Grundlage für den Plan, der BurrowCinema (`app/`) um Wiedergabe, Jellyfin Browsing und Android TV erweitert.

Markierungen im Text:
* **[verifiziert]**: im Quellcode, in der OpenAPI Spezifikation oder per `npm view` geprüft.
* **[Doku]**: aus der JellyWatch Dokumentation oder dem README, nicht im Code prüfbar (JellyWatch ist nicht Open Source).
* **[unverifiziert]**: aus Erfahrung oder Sekundärquellen, vor der Umsetzung im Prototyp prüfen.

---

## 0. Kurzfassung

1. **JellyWatch ist eine native Kotlin/Compose App mit Media3 (ExoPlayer), FFmpeg Audio Erweiterung, libass und zusätzlich MPV.** Den vollen Umfang (Passthrough, libass, PGS lokal, Bildwiederholrate umschalten, Night Mode) erreicht man nur mit eigenem nativem Player Code. Für uns realistisch ist der Kern: Wiedergabe mit Direct Play oder Transcode, Spuren wählen, Fortsetzen, Fortschritt melden, Intro und Abspann überspringen, Trickplay, nächste Folge, PiP, D Pad Bedienung, Home Reihen, Quick Connect auf dem TV.
2. **Streamyfin (unsere nächste Referenz, Expo SDK 58 mit `react-native-tvos@0.88.1-0`) benutzt keine npm Player Bibliothek mehr**, sondern zwei eigene Expo Module: `modules/mpv-player` (libmpv, Standard) und `modules/exoplayer-player` (Media3 1.11.1 plus `org.jellyfin.media3:media3-ffmpeg-decoder:1.9.0+1`, nur Android TV). Das sind mehrere tausend Zeilen Kotlin/Swift. Das ist kein Startpunkt für uns, aber eine Blaupause für eine spätere Ausbaustufe.
3. **Empfehlung Player Stufe 1: `react-native-video` 6.x** (aktuell 6.20.0, Media3 1.8.0, New Architecture über Interop Layer, externe SRT/VTT/TTML Untertitel, Audio und Untertitel Spurwahl, PiP, `bufferConfig`, Header). Dazu ein konservatives Jellyfin DeviceProfile, damit der Server alles transkodiert, was Media3 ohne FFmpeg nicht kann (DTS, TrueHD, PGS, gestyltes ASS). `expo-video` 58.0.14 ist die Alternative, hat aber **keine externen Untertitel** (Sidecar) [verifiziert]. `react-native-video` v7 ist Beta und meldet TV Support als "TODO" [verifiziert].
4. **Stufe 2 (später):** FFmpeg Audio Decoder über einen kleinen Patch in react-native-video (Extension Renderer Mode ist dort hart auf `OFF`) oder ein eigenes Expo Modul nach Streamyfin Vorbild (Media3 + FFmpeg + libass `io.github.peerless2012:ass-media`).
5. **Android TV:** `react-native` durch `npm:react-native-tvos@0.88.1-0` ersetzen (gleiche RN Version wie unsere 0.88.1, von Streamyfin mit Expo SDK 58 produktiv genutzt) und `@react-native-tvos/config-tv@0.1.7` mit `isTV: true` einbinden. Dann bekommt **ein einziges APK** den `LEANBACK_LAUNCHER` Eintrag, `touchscreen required=false`, `leanback required=false` und das TV Banner, und installiert sich auf Handy und TV. Laufzeitweiche über `Platform.isTV`. ABIs auf `arm64-v8a,armeabi-v7a` erweitern (Streamyfin macht genau das für TV, weil viele Boxen 32 Bit sind).
6. **TV UI ist eigene Arbeit:** auf Android TV ersetzt Streamyfin `NativeTabs` durch eine eigene fokussierbare Navigationsleiste, nutzt auf TV `FlatList` statt `FlashList` (Fokusprobleme), keine RN `Modal` sondern Routen als Modals, genau ein `hasTVPreferredFocus` pro Screen, `TVFocusGuideView` zwischen nicht ausgerichteten Bereichen.
7. **Jellyfin API:** alles Nötige ist in der 10.11.5 OpenAPI Spezifikation vorhanden und unten mit Methode, Pfad und Parametern aufgelistet. Mindestversionen: Trickplay 10.9, MediaSegments 10.10, Quick Connect mit `userId` beim Autorisieren 10.9.

---

## 1. Quellen und Methode

| Quelle | Stand | Wie genutzt |
|---|---|---|
| JellyWatch README (`scratchpad/jellywatch/README.md`) | Klon vom 27.11.2026 | vollständig gelesen |
| jellywatch.app/player | abgerufen 27.11.2026 | Produktseite |
| jellywatch.app/doc/player/... | abgerufen 27.11.2026 | gelesen: `tv-introduction`, `tv-navigation`, `tv-media-player`, `player-phone-tablet`, `tv-subtitles`, `tv-home-screen`, `tv-media-details`, `tv-library-browsing`, `tv-search`, `tv-settings`, `tv-audio-video-advanced`, `tv-connecting-server`, `tv-match-frame-rate`, `tv-home-screen-channels`, `player-downloads` |
| Streamyfin | `git clone --depth 1`, Commit `d55c002` vom 27.11.2026 | Code gelesen (Player, Profile, Segmente, Trickplay, TV, CI) |
| jellyfin-androidtv | `git clone --depth 1`, Commit `6bb3b10` vom 26.11.2026 | Code gelesen (DeviceProfile, Stream Resolver, Reporting, Segmente, Trickplay, Home, Manifest) |
| Jellyfin OpenAPI | `streamyfin/docs/jellyfin-openapi-stable.json`, Version **10.11.5** | alle Endpunkte unten dagegen geprüft |
| npm Registry | `npm view` / `npm pack` am 27.11.2026 | Versionen, Peer Dependencies, Gradle Dateien der Player Pakete |

Beide Klone liegen unter `/tmp/claude-0/-home-user-BurrowCinema/6fa5a2cf-e91e-519d-961d-600b90b2669a/scratchpad/refs/` (flüchtig).

Widersprüche in den JellyWatch Quellen: README nennt Android 8.0+, die Produktseite Android 7.0+. Skip Intro laut README ab Jellyfin 10.9 (vermutlich über das Intro Skipper Plugin), die offizielle MediaSegments API gibt es erst ab 10.10.

---

## 2. Funktionsumfang von JellyWatch (nur Wiedergabe und Browsing relevant)

### 2.1 Wiedergabe [Doku]

| Funktion | Details laut JellyWatch |
|---|---|
| Engine | ExoPlayer (Media3) mit Hardware Decoding. Zusätzlich MPV (VC 1, RMVB). Einstellung: ExoPlayer, MPV, Auto (Exo zu MPV), Auto (MPV zu Exo) |
| Codecs | H.264, HEVC, AV1 (libdav1d Software Fallback), VP9. HDR10, HDR10+, Dolby Vision (P7 Optionen: Auto, HDR10, DV, DV P8.1) |
| Audio | TrueHD Atmos, DTS:X, DTS HD MA Passthrough, sonst lokaler FFmpeg Decode, zuletzt Server Transcode ("3 level fallback"). Force Passthrough pro Codec (AC 3, E AC 3, TrueHD, DTS, DTS HD), Force Stereo, HDMI Audio Priming |
| Wiedergabearten | Direct Play, Direct Stream (Remux), Transcode. Automatische Wahl. Bild oder gestylte Untertitel können Transcode erzwingen |
| Qualität live | Original, 4K, 1080p, 720p, 480p, 360p, während der Wiedergabe umschaltbar |
| Max Bitrate | Unlimited, 2, 4, 8, 20, 40, 80, 120 Mbps. Max Auflösung Auto, 1080p, 4K, 8K |
| Puffer | Ziel 10 bis 240 s (Standard 120 s), Read Ahead Speicher Auto bis 256 MB |
| Untertitel | Text (SRT, VTT, TTML) von der App gezeichnet und stylebar. ASS/SSA per libass. PGS, DVB, VobSub lokal dekodiert. Externe Dateien als Sidecar. Eingebettete Fonts |
| Untertitel Auswahl | Modus: Flagged (default/forced), Always, Foreign audio only, Forced only, None. Bevorzugte und Fallback Sprache, SDH bevorzugen. Wahl wird pro Titel gemerkt |
| Untertitel Aussehen | Größe, Schrift, fett, kursiv, Farbe, Deckkraft, Rand (None, Outline, Shadow, Raised, Depressed), Hintergrund, vertikale Position, Presets |
| Untertitel online suchen | Im Player über Server Plugin (OpenSubtitles). Ergebnis wird auf dem Server gespeichert |
| Verzögerung | Untertitel Delay und Audio Delay Panels |
| Trickplay | Vorschaubild über der Seek Leiste (Jellyfin 10.9+) |
| Bildwiederholrate | Match Frame Rate, Match Resolution, "Sync playback to display" (nur TV) |
| Segmente | Intro, Abspann, Recap, Preview, Werbung: je Off, Button, Auto. Standard: Intro und Abspann Button. Abspann überspringen öffnet Up Next |
| Up Next | Karte mit Countdown, "Play now" und "Cancel". Auto next: Off, sofort, oder Sekunden (Doku: Standard 10 s, README: 15 s) |
| Still watching | Nach 2, 3, 4, 5, 8 Folgen ohne Eingabe (Standard 3), stoppt nach 60 s ohne Antwort |
| Geschwindigkeit | 0.5x bis 2x in 0.25 Schritten |
| Seitenverhältnis | Fit, Crop, Stretch |
| Stats for Nerds | Decoder, Codec, Auflösung, Bitrate, HDR Typ, Audio Ausgabe (Passthrough oder PCM), fps, verlorene Frames, Puffer, Bandbreite |
| Night Mode | Dynamikkompression |
| PiP | Home Taste während der Wiedergabe, 16:9, Android 8+ |
| Fortsetzen | Resume mit optionalem Zurückspulen (Off, 5, 10, 15, 20, 30 s) |
| Kapitel | Kapitelmarken auf der Leiste, Kapitelstreifen (TV: D Pad runter) |

### 2.2 Player Bedienung: Handy gegen TV [Doku]

| Aspekt | Handy / Tablet | Android TV |
|---|---|---|
| Steuerung einblenden | Tippen | Hoch, Select oder jede andere Taste |
| Spulen | Seek Leiste ziehen, Skip Buttons | Links/Rechts bei ausgeblendeten Controls springt um Skip Dauer (5, 10, 30 s, Standard 10). Einstellung "Remote skip": volle Leiste oder nur Position zeigen |
| Transport | Vorherige, zurück, Play/Pause, vor, nächste | Gleiche Reihe, von der Mitte nach außen: Prev/Next Folge, Rewind/Forward, Play/Pause, dann Speed, Aspect, Quality, Audio, Subtitles, Stats, PiP |
| Untere Reihe | Quality, Audio, Subtitles, Speed, Aspect, Chapters, Stats, Cast, PiP | wie oben in der Leiste |
| Kapitel | Marken auf der Leiste | D Pad runter öffnet Kapitelstreifen |
| Oben | Speed Badge wenn nicht 1x | Uhrzeit und "Endet um" |
| Helligkeit, Lautstärke | Eigene Icons links und rechts öffnen vertikale Slider. **Keine** Wischgesten, kein Doppeltipp, kein Pinch dokumentiert | Systemlautstärke der Fernbedienung |
| Medientasten | - | Play, Pause, FF, Rewind, nächste und vorherige Folge |
| Zurück | System Zurück | Erst Controls ausblenden, dann Player verlassen |
| Ausrichtung | Option "Lock landscape in the player" | Querformat |
| PiP | Home Taste | Home Taste (Android 8+) |

### 2.3 TV Navigation außerhalb des Players [Doku]

* **Seitenleiste** links als schmale Icon Leiste, klappt mit Fokus auf und zeigt Labels. Einträge: Suche, Home, Einstellungen, dazu pro Server Bibliothek ein Eintrag (Filme, Serien, ...). Im Player ausgeblendet.
* **D Pad:** Links in die Seitenleiste, Rechts zurück in den Inhalt, Hoch/Runter zwischen Reihen. Select öffnet. **Langes Select** öffnet Kontextaktionen (z. B. "Aus Weiterschauen entfernen").
* **Zurück** geht eine Ebene zurück, auf oberster Ebene beendet ein zweites Drücken die App. **Home** zurück zum Launcher.
* **Fokus wird wiederhergestellt**, wenn man zu einem Screen zurückkehrt. Fokus verloren: Links bringt ihn in die Seitenleiste.
* Gamepads funktionieren als D Pad (A = Select).

Handy: Bottom Bar mit Home, Suche, Bibliothek, Anfragen, Einstellungen. Auf Tablet oder im Querformat wird daraus eine Seitenleiste (Rail).

### 2.4 Browsing [Doku]

| Bereich | Inhalt |
|---|---|
| Home TV | Großes Featured Item mit Play Button, dann Reihen: Weiterschauen, Next Up, verfügbare Anfragen, eigene Regal Reihen, "Zuletzt hinzugefügt" je Bibliothek. Bis 20 Elemente pro Reihe. Weiterschauen und Next Up optional zusammengelegt (sortiert nach zuletzt gespielt) |
| Home Handy | Featured oben, Weiterschauen, Next Up, Meine Bibliotheken, "Zuletzt hinzugefügt in ..." |
| Karten | Poster, Titel, Fortschrittsbalken. Optional Badges (Auflösung, Audio, Rating), Sprachflaggen, ClearLogo statt Titel |
| Home anpassen | Reihen zeigen, verstecken, sortieren, Kartengröße, Elemente pro Reihe, Bibliotheken unter "Zuletzt hinzugefügt" (Premium) |
| Bibliothek | Poster Raster. Sortierung: Name, Erscheinungsdatum, Hinzugefügt, Zuletzt gespielt, Community Rating, Critic Rating, Altersfreigabe, Laufzeit, Wiedergaben, Zufall, zuletzt hinzugefügte Folge. Filter: Status (alle, ungesehen, gesehen, angefangen, Favoriten), Genres, Jahre, Freigaben, Mindestbewertung. Raster oder Liste, Spaltenzahl. Wird pro Bibliothek gemerkt. Shuffle |
| Film Details | Play/Resume, von vorn (mit Rückfrage), Version wählen, Trailer (extern, meist YouTube), gesehen/ungesehen, Favorit, Download (nur Handy). Inhalt, Genres, Studios, Regie, Drehbuch, Besetzung mit Fotos, Sammlung, Extras, "Mehr wie das", Dateidetails, IMDb/TMDB/TVDB Links. Theme Song im Hintergrund, lokaler Trailer stumm als Backdrop |
| Serie | Staffeln und Next Up Folge, Shuffle alle oder ungesehene |
| Staffel | Folgenliste mit Inhalt, Ausstrahlung, Laufzeit, gesehen Status |
| Folge | Play/Resume, Links zu vorheriger und nächster Folge. Anti Spoiler: unscharfes Bild, generischer Titel, kein Inhalt für ungesehene Folgen |
| Suche | Ergebnisse beim Tippen, Kategorien Filme, Serien, Sammlungen, Folgen, Personen. Sprachsuche per Mikrofon (nicht auf Fire TV). Optional anfragbare Titel (Seerr) |
| Launcher Kanäle | Android TV Startbildschirm: Weiterschauen (bis 15) und je Bibliothek die neuesten (bis 15), Deep Links `jellywatch://movie/{id}` usw. Kein Watch Next erwähnt |

### 2.5 Anmeldung [Doku]

* Server Adresse eingeben, ohne Schema wird `http://` ergänzt. Benutzername und optional Passwort.
* **TV Quick Login** von JellyWatch läuft über das **eigene JellyWatch Konto** (6 stelliger Code, Handy muss mit Google angemeldet sein, "Connect my TV" in der Handy App). Das ist **nicht** Jellyfin Quick Connect. Für uns ist Jellyfin Quick Connect der passende, serverseitige Ersatz (funktioniert auch mit der Jellyfin Web Oberfläche als Bestätiger).
* Selbstsignierte Zertifikate nur mit installierter CA.

---

## 3. Klassifizierung aller JellyWatch Funktionen

MUST = Kern für Wiedergabe und Browsing auf Handy und TV. SHOULD = wertvoll und mit React Native machbar. LATER/OUT = später, außerhalb des Ziels oder nur mit nativem Aufwand, den wir jetzt nicht leisten.

### 3.1 Wiedergabe

| Funktion | Klasse | Begründung |
|---|---|---|
| Direct Play (H.264, HEVC, VP9, AV1 nur mit Hardware Decoder) | MUST | Kern, Media3 kann es mit den Geräte Decodern |
| Direct Stream und Transcode über HLS als Fallback | MUST | Server übernimmt alles, was das Gerät nicht kann |
| 4K HDR10 / HLG Wiedergabe | MUST | Media3 mit SurfaceView reicht (react-native-video `viewType` SURFACE) |
| Dolby Vision Profil 5 nur mit Decoder Probe | SHOULD | Ohne DV Decoder lila/grün, darum per CodecProfile sperren (wie Streamyfin) |
| Dolby Vision P7 Optionen | LATER | Braucht native Kontrolle über den Decoder |
| TrueHD/DTS Passthrough und FFmpeg Decode | LATER | Nur mit FFmpeg Extension oder eigenem Modul; bis dahin Audio Transcode durch den Server |
| 3 Stufen Fallback (Passthrough, FFmpeg, Server) | LATER | Wir haben 2 Stufen: Gerät, sonst Server |
| Fortsetzen ab gespeicherter Position | MUST | `UserData.PlaybackPositionTicks` plus Seek |
| Resume Zurückspulen | SHOULD | Eine Zahl abziehen, trivial |
| Fortschritt an Jellyfin melden (Start, Progress, Stopped) | MUST | Sonst kein Weiterschauen und kein gesehen Status |
| Audio Spur wählen | MUST | Direct Play im Player, Transcode per neuer PlaybackInfo |
| Untertitel wählen und aus | MUST | Text extern oder eingebettet, Bild/ASS vom Server einbrennen |
| Standard Spuren aus Jellyfin Benutzerkonfiguration | MUST | `AudioLanguagePreference`, `SubtitleLanguagePreference`, `SubtitleMode` aus `/Users/Me` |
| Spurwahl pro Serie/Titel merken | SHOULD | Lokal speichern, wie Streamyfin `seriesTrackMemory` |
| ASS/SSA pixelgenau (libass) | LATER | Native Bibliothek nötig; bis dahin Media3 Grundstyling oder Burn In |
| PGS/DVB/VobSub lokal | LATER | Media3 PGS laut Streamyfin unzuverlässig, darum Encode (Burn In) |
| Untertitel Aussehen | SHOULD | react-native-video `subtitleStyle` kann nur Größe, Abstände, Deckkraft; mehr erst mit eigenem Modul |
| Untertitel online suchen und laden | SHOULD | Reine REST Aufrufe (`RemoteSearch/Subtitles`), Server Plugin nötig |
| Untertitel/Audio Delay | LATER | Keine API in react-native-video |
| Qualität live wechseln | SHOULD | Neue PlaybackInfo mit `MaxStreamingBitrate`, Player neu laden an aktueller Position |
| Max Bitrate Einstellung | MUST | Gehört ins DeviceProfile und PlaybackInfo |
| Geschwindigkeit 0.5x bis 2x | SHOULD | `rate` Prop |
| Seitenverhältnis Fit/Crop/Stretch | SHOULD | `resizeMode` contain/cover/stretch |
| Trickplay Vorschau | SHOULD | Kachelbilder per REST, Ausschnitt in RN zeichnen |
| Kapitelmarken und Kapitel springen | SHOULD | `Chapters` Feld des Items |
| Intro/Abspann/Recap/Preview/Werbung überspringen (Off, Button, Auto) | MUST | JellyWatch Kernmerkmal, reine REST Logik |
| Up Next mit Countdown | MUST | Für Serien unverzichtbar, `/Shows/{id}/Episodes?adjacentTo` |
| Still watching | SHOULD | Zähler über aufeinanderfolgende Folgen ohne Eingabe |
| Uhrzeit und "Endet um" | SHOULD | Rein UI |
| Stats for Nerds (leicht) | SHOULD | Aus MediaSource und Player Events (Codec, Auflösung, Bitrate, Play Method, Transcode Gründe) |
| Stats inkl. verlorene Frames und Audio Ausgabe | LATER | Braucht native Player Daten |
| Bild in Bild | SHOULD | react-native-video `enterPictureInPictureOnLeave` plus Manifest Flag |
| Bildwiederholrate und Auflösung angleichen | LATER | Native `Display.Mode` / `setFrameRate` Aufruf, kleines Expo Modul möglich |
| Night Mode | OUT | Audio DSP im nativen Player |
| Engine Wahl ExoPlayer/MPV | OUT | Wir haben eine Engine |
| Puffer und Read Ahead Einstellungen | LATER | `bufferConfig` existiert, aber Tuning braucht Geräte zum Testen |
| Tunneled Playback, HDMI Audio Priming, Software Codecs | OUT | Geräte Spezialfälle |
| Querformat erzwingen im Player (Handy) | MUST | `expo-screen-orientation` |
| Helligkeit und Lautstärke Slider (Handy) | SHOULD | `expo-brightness`, System Lautstärke braucht Paket oder eigenes Modul |
| Medientasten der Fernbedienung | MUST | `useTVEventHandler` (react-native-tvos) |
| Bildschirm wach halten | MUST | `expo-keep-awake`, beim Verlassen freigeben (sonst blockiert es den TV Bildschirmschoner) |
| Cast / Chromecast, "Auf TV abspielen" | LATER | Cast SDK nativ; "auf TV abspielen" ginge später über Jellyfin Sessions API |
| Downloads und Offline | LATER | Eigene große Baustelle |
| SyncPlay / Watch Party | OUT | Laut Auftrag außerhalb |

### 3.2 Browsing und Navigation

| Funktion | Klasse | Begründung |
|---|---|---|
| Home Reihen Weiterschauen, Next Up, Zuletzt hinzugefügt je Bibliothek | MUST | Standard Jellyfin Endpunkte |
| Featured / Hero Banner (TV) | SHOULD | Rein UI, gute TV Wirkung |
| Weiterschauen und Next Up zusammenlegen | SHOULD | Clientseitig sortieren |
| Aus Weiterschauen entfernen (Langdruck) | SHOULD | Position per UserData zurücksetzen [unverifiziert, siehe 5.5] |
| Home Reihen anpassen | SHOULD | Speichern über unsere bestehenden DisplayPreferences |
| Eigene Regal Reihen nach Regeln | LATER | Nett, aber kein Kern |
| Empfehlungen (JellyWatch Konto) | OUT | Braucht deren Cloud; "Ähnliche Titel" ist der Ersatz |
| Bibliotheken als Einträge (UserViews) | MUST | TV Seitenleiste und Handy Bibliothek |
| Sortierung | MUST | Existiert teils (4 Schlüssel), erweitern |
| Filter (Status, Genres, Jahre) | SHOULD | `/Items` Parameter vorhanden |
| Raster/Liste, Spaltenzahl | LATER | Komfort |
| Film Details mit Play/Resume/von vorn | MUST | Einstieg in die Wiedergabe |
| Version wählen (mehrere MediaSources) | SHOULD | `MediaSourceId` in PlaybackInfo |
| Gesehen / Favorit umschalten | MUST | Zwei Endpunkte |
| Serie, Staffel, Folgenliste | MUST | Haben heute nur Staffel Poster |
| Vorherige/nächste Folge auf Folgenseite | SHOULD | `adjacentTo` |
| Besetzung und Personenseite | SHOULD | Besetzung existiert schon, Personenseite neu |
| "Mehr wie das" | SHOULD | `/Items/{id}/Similar` |
| Trailer (remote) | SHOULD | `RemoteTrailers` öffnen, YouTube extern |
| Lokaler Trailer als Backdrop, Theme Songs | LATER | Zweiter Player und Audio Wiedergabe |
| Sammlungen, Extras | LATER | Nebensache |
| Dateidetails und Provider Links | SHOULD | Daten aus MediaSources |
| Anti Spoiler | SHOULD | Reine UI Regel |
| Shuffle | SHOULD | `sortBy=Random` oder Warteschlange |
| Suche mit Kategorien | MUST | Existiert, um Folgen und Personen erweitern |
| Sprachsuche (TV) | LATER | Braucht Spracherkennung |
| TV Seitenleiste oder Top Leiste, Fokus Wiederherstellung, Zurück zweimal zum Beenden | MUST | Ohne das ist die App auf TV nicht bedienbar |
| Langdruck Kontextaktionen | SHOULD | `onLongPress` auf TV Pressables |
| Launcher Kanäle (Android TV Home) | LATER | Natives TvProvider Modul (Streamyfin hat `tv-recommendations`) |
| Bildschirmschoner | LATER | Android TV hat einen eigenen; nur Keep Awake korrekt freigeben |
| Jellyfin Quick Connect Login auf TV | MUST | Tippen mit der Fernbedienung ist unzumutbar |
| Quick Connect Code auf dem Handy bestätigen | SHOULD | Ein POST, "TV verbinden" in Einstellungen |
| Mehrere Konten, "Wer schaut?" | LATER | Heute eine Sitzung |
| Emby, automatische Servererkennung | OUT | Nur Jellyfin |
| Kids Profile, verknüpfte Profile, mehrere Server | OUT | Laut Auftrag außerhalb |
| Seerr Anfragen | OUT | Wir haben Radarr/Sonarr Anfragen bereits |
| SocialWatch, Feature Board, Achievements | OUT | Laut Auftrag außerhalb |
| Musik, Equalizer, FLAC Surround, Bücher, Android Auto, Live TV, Fotos | OUT | Laut Auftrag außerhalb |
| Home Assistant Kino Modus | OUT | Laut Auftrag außerhalb |
| Admin Dashboard | OUT | Laut Auftrag außerhalb |
| Backup/Restore, Einstellungen kopieren | OUT | Unsere Einstellungen liegen schon im Jellyfin Profil |
| 42 Sprachen | OUT | App ist Deutsch |

---

## 4. Wie es die Open Source Clients machen

### 4.1 Streamyfin (Expo / React Native)

**Stack** [verifiziert, `package.json`]: Expo `58.0.23`, `react-native: npm:react-native-tvos@0.88.1-0`, `@react-native-tvos/config-tv@0.1.7` (devDependency), `@jellyfin/sdk@1.0.2` (Axios), Reanimated 4.7.1, Gesture Handler 3.5.0, FlashList 2.3.3, Expo Router 58, Jotai, React Query, MMKV, NativeWind 2. **Kein** `react-native-video`, **kein** `expo-video`.

**Player** [verifiziert, `modules/`]:
* `modules/mpv-player`: libmpv (`dev.jdtech.mpv:libmpv:1.0.0`) auf Android, MPVKit auf iOS. Standard Engine auf allen Plattformen. Enthält auch eine native Compose Player Oberfläche (Phone und TV: `nativeplayer/ui/tv/TvTransportBar.kt`, `TvTrickplayCard.kt`, `TvEpisodeShelf.kt`, `TvStillWatchingOverlay.kt` ...), Cast Support und Media3 als zweite Engine. ABIs `arm64-v8a, armeabi-v7a, x86, x86_64`.
* `modules/exoplayer-player`: Media3 `1.11.1` (exoplayer, hls, ui, common) plus `org.jellyfin.media3:media3-ffmpeg-decoder:1.9.0+1` (Jellyfin veröffentlicht diese Variante mit vorgebauten FFmpeg Bibliotheken; das androidx Original ist ein Stub). `DefaultRenderersFactory.EXTENSION_RENDERER_MODE_PREFER`. **Nur für Android TV** wählbar (`isExoPlayerSupported`).
* JS Seite: `app/(auth)/player/direct-player.tsx` (knapp 2000 Zeilen) mit `components/video-player/controls/Controls.tsx` (Handy) und `Controls.tv.tsx` (TV, 1882 Zeilen).
* Learned Facts im Repo zeigen, wie viel Gerätearbeit darin steckt (z. B. LoadControl Puffer gegen OOM bei 100 Mbps DV Remux, Amlogic DTS Decoder liefert Stille, Amlogic HDMI Frame Rate Umschaltung vor der echten fps).

**Stream URL** [verifiziert, `utils/jellyfin/media/getStreamUrl.ts`]:
1. `POST /Items/{id}/PlaybackInfo` mit Body `{ UserId, DeviceProfile, SubtitleStreamIndex, StartTimeTicks, AudioStreamIndex, MaxStreamingBitrate, MediaSourceId, AutoOpenLiveStream, isPlayback: true }`.
2. `PlaySessionId` und `MediaSources[0]` merken. Keine MediaSource heißt Fehler mit `ErrorCode` (`NoCompatibleStream` usw.), **nicht** trotzdem eine URL bauen.
3. Hat die MediaSource eine `TranscodingUrl`, ist das die URL (`basePath + TranscodingUrl`, Query unverändert lassen). Bei ausgeschalteten Untertiteln wird `SubtitleMethod=Encode` durch `SubtitleMethod=Hls` ersetzt.
4. Sonst Direct Play: `/Videos/{id}/stream?static=true&container=...&mediaSourceId=...&audioStreamIndex=...&subtitleStreamIndex=...&deviceId=...&ApiKey=...&startTimeTicks=...&maxStreamingBitrate=...&userId=...&playSessionId=...`.
5. Remote Streams (`IsRemote` und `Protocol=Http`) direkt über `Path`.
6. `RequiredHttpHeaders` der MediaSource an den Player geben.

**DeviceProfile** [verifiziert, `utils/profiles/native.ts`, `subtitles.ts`]:
* ExoPlayer (Android TV): DirectPlay Container `mp4,mkv,webm,ts,mpegts,mov`, Video `h263,h264,hevc,vp8,vp9,av1`, Audio `vorbis,opus,flac,alac,pcm,mp3,aac,ac3,eac3,dts,dtshd,truehd` (geht nur wegen FFmpeg). CodecProfile `hevc` mit `VideoRangeType NotEquals DOVI` (sperrt nur reines DV Profil 5), entfällt wenn ein DV Decoder erkannt wird. Transcoding: HLS, Container `ts`, Video `h264,hevc`, Audio `aac,mp3,ac3`, `MaxAudioChannels` je nach Modus (Stereo 2, 5.1 6, Passthrough 8, Auto 6). `MaxStaticBitrate` und `MaxStreamingBitrate` 999 999 999.
* ExoPlayer Untertitel: `srt External`, `vtt External`, `ttml External`, `pgssub Encode`. Kommentar: "PGS delivered as Encode (burn-in) because Media3's PGS support is inconsistent".
* MPV: alle Textformate Embed, die meisten auch External, Bildformate Embed oder Encode.
* Hinweis aus dem Code: beim External Profil **nicht** den Alias `webvtt` anbieten, sonst schreibt der Server `.vtt` Dateien mit einem fehlerhaften `Region:` Header neu (Streamyfin #1892).

**Wiedergabe melden** [verifiziert]:
* Start: `reportPlaybackStart` sobald der Stream aufgelöst ist, mit `IsPaused: false` und `PositionTicks: startTicks` (sonst zeigt das Dashboard "paused at 0:00").
* Progress: Heartbeat alle **10 s** (`PROGRESS_REPORT_INTERVAL = 10_000`, `constants/Playback.ts`), zusätzlich sofort bei Pause, Fortsetzen, Seek, Spur und Stummschaltung. Felder: `ItemId, MediaSourceId, PositionTicks, IsPaused, IsMuted, AudioStreamIndex, SubtitleStreamIndex, PlayMethod, PlaySessionId, CanSeek, RepeatMode, PlaybackOrder`.
* Stopped: beim Verlassen genau einmal (dedupliziert pro `PlaySessionId`), mit `ItemId, MediaSourceId, PositionTicks, PlaySessionId`. Danach Player sofort zerstören (OOM auf schwachen Geräten) und Caches für Weiterschauen, Next Up, Item, Episoden, Ähnliche neu laden.
* `PlayMethod`: `Transcode` wenn URL `m3u8` enthält oder `TranscodingUrl` gesetzt, `DirectStream` bei `/Videos/.../stream`, sonst `DirectPlay` (`utils/jellyfin/playMethod.ts`).
* Android pausiert verzögerte JS Timer im Hintergrund (Learned Fact `android-js-timers-pause-in-background`): Heartbeat darf sich nicht auf `setTimeout` im Hintergrund verlassen.

**Segmente** [verifiziert, `utils/segments.ts`]: `GET /MediaSegments/{itemId}?includeSegmentTypes=Intro,Outro,Recap,Commercial,Preview`. Bei 404/501 Fallback auf das Intro Skipper Plugin `GET /Episode/{id}/Timestamps` (Sekunden statt Ticks). Andere Fehler nicht als "alter Server" werten. Ticks durch 10 000 000 = Sekunden.

**Trickplay** [verifiziert, `utils/trickplay.ts`]: `item.Trickplay[mediaSourceId][width]` liefert `Interval, TileWidth, TileHeight, Width, Height, ThumbnailCount`. Bild: `/Videos/{itemId}/Trickplay/{width}/{sheetIndex}.jpg?ApiKey=...&MediaSourceId=...`. Kachel = `floor(ms / Interval)`, Blatt = `Kachel / (TileWidth*TileHeight)`, Offset x/y aus dem Rest.

**Nächste Folge** [verifiziert, `hooks/usePlaybackManager.ts`]: `GET /Shows/{seriesId}/Episodes?adjacentTo={itemId}&limit=3&fields=MediaSources,MediaStreams,ParentId`. Countdown 10 s vor Ende (`NEXT_EPISODE_COUNTDOWN_MS`).

**Quick Connect** [verifiziert, `hooks/useQuickConnect.ts`, `utils/jellyfin/quickConnect.ts`]: TV `POST /QuickConnect/Initiate` ergibt `Code` und `Secret`, Polling jede Sekunde, dann `POST /Users/AuthenticateWithQuickConnect` mit `{ secret }`. Bestätigen auf dem Handy mit `POST /QuickConnect/Authorize?code=...` (ohne `userId`, autorisiert den Aufrufer). Lebensdauer im Code mit 10 min angenommen.

**PiP** [verifiziert]: Config Plugin `plugins/withAndroidPictureInPicture.ts` setzt `android:supportsPictureInPicture="true"` auf `.MainActivity`. Start über die Player Ref.

**Android TV Unterstützung** [verifiziert, `docs/conventions/tv.md`, `app/(auth)/(tabs)/_layout.tsx`]:
* `Platform.isTV` als Weiche. TV Komponenten in eigenen Dateien, **explizit** per `require` hinter `Platform.isTV` geladen, weil die `.tv.tsx` Auflösung in Metro nur mit `EXPO_TV=1` greift.
* Auf Android TV wird `NativeTabs` durch `Stack` plus eigene fokussierbare `TVNavBar` (oben, absolut positioniert) ersetzt.
* Fernbedienung: `useTVEventHandler` aus react-native-tvos (Events `select`, `left`, `right`, `up`, `down`, `playPause`, `longLeft`, `longRight` mit `eventKeyAction` 0 = gedrückt, 1 = losgelassen). Zurück über `BackHandler` (react-native-tvos mappt auch die Apple TV Menu Taste darauf).
* Player Logik bei ausgeblendeten Controls: Links/Rechts = kleiner Sprung, Hoch/Runter = Controls mit fokussiertem Play Button einblenden, Select wird ignoriert (damit z. B. "Intro überspringen" drückbar bleibt), Langdruck Links/Rechts = kontinuierliches Spulen. Bei sichtbaren Controls: erstes Zurück blendet aus, zweites verlässt (optional mit Rückfrage). Unsichtbare Overlay View fängt Select ab, damit versteckte Buttons nicht reagieren.
* Regeln: auf TV `FlatList` statt `FlashList` und `removeClippedSubviews={false}`; genau ein `hasTVPreferredFocus` auf gepushten Screens, keiner auf Tab Roots (außer Home einmal pro Sitzung); Header/Filter außerhalb der Liste; `TVFocusGuideView` mit `destinations` zwischen nicht ausgerichteten Bereichen; keine RN `Modal` auf TV, sondern Route plus Atom; ein Select kann auf Android TV `onPress` doppelt feuern (react-native-tvos #110, #138), daher Schließen nur einmal zulassen; nach einem geschlossenen Modal auf Android TV den Fokus aktiv zurückgeben; Fokusskalierung ca. 1.05 braucht Platz und `overflow: visible`; horizontaler TV Rand 60; TV Schriftgrößen über eigene Skala.
* `react-native.config.js` schaltet mit `EXPO_TV=1` Module für TV ab (expo-notifications, expo-haptics, expo-brightness, expo-screen-orientation, pager-view, track-player, expo-location).

**TV APK Build** [verifiziert, `.github/workflows/build-apps.yml`]: **getrennte** APKs. Handy: `EXPO_TV=0`, nur `arm64-v8a`. TV: `bun run prebuild:tv` (`EXPO_TV=1`), `ORG_GRADLE_PROJECT_reactNativeArchitectures: arm64-v8a,armeabi-v7a` mit dem Kommentar "many older/cheap Android TV boxes and sticks are still 32-bit ARM". Release über `assembleRelease`.

### 4.2 jellyfin-androidtv (offizieller Kotlin TV Client)

Versionen [verifiziert, `gradle/libs.versions.toml`]: Media3 `1.11.1`, `jellyfin-androidx-media 1.9.0+1` (FFmpeg), `libass-android 0.5.1` (`io.github.peerless2012:ass-media`), Jellyfin Kotlin SDK `1.8.12`, Leanback `1.2.0`, TvProvider `1.1.0`, minSdk 24, targetSdk 36.

**Stream Auswahl** [verifiziert, `playback/jellyfin/.../JellyfinMediaStreamResolver.kt`]:
* PlaybackInfo mit `enableDirectPlay, enableDirectStream, enableTranscoding, allowVideoStreamCopy, allowAudioStreamCopy = true`, `autoOpenLiveStream = false`.
* `ErrorCode` gesetzt: Fehler. MediaSources filtern auf `Protocol == File` und nicht `IsRemote` (keine strm).
* Reihenfolge: `SupportsDirectPlay` ergibt `/Videos/{id}/stream?static=true&container=...&mediaSourceId=...&tag={ETag}`. Sonst `SupportsDirectStream` und `TranscodingUrl` (Remux). Sonst `SupportsTranscoding` und `TranscodingUrl`. Sonst kein Stream.
* Beim Beenden eines Transcodes: `DELETE /Videos/ActiveEncodings?deviceId=...&playSessionId=...` (`hlsSegmentApi.stopEncodingProcess`, `PlaybackManager.kt`).

**DeviceProfile** [verifiziert, `util/profile/deviceProfile.kt`]: prüft Decoder per `MediaCodecList` (HEVC, HEVC Main10, AVC High10, AV1, VC1, Level, Max Auflösung, DV/HDR10/HDR10+ je Codec). Transcoding: HLS `ts` (Audio aac, ac3, eac3, mp3) und HLS `mp4` (fMP4, zusätzlich alac, flac, opus, dts), Video `hevc` (wenn unterstützt) und `h264`, `copyTimestamps=false`, `enableSubtitlesInManifest=true`. DirectPlay Container `asf, hls, m4v, mkv, mov, mp4, ogm, ogv, ts, vob, webm, wmv, xvid`. Untertitel: `vtt/webvtt` embed+hls+external, `srt/subrip/ttml` embed+external, `dvbsub/dvdsub/idx` embed+encode, `pgs/pgssub` embed nur wenn Einstellung an, sonst encode, `ass/ssa` encode, embed/external nur mit Einstellung.

**Fortschritt** [verifiziert, `ui/playback/PlaybackController.java`]: alle **3 s** während der Wiedergabe (`PROGRESS_REPORTING_INTERVAL`), alle **15 s** im Pause Zustand.

**Segmente** [verifiziert, `MediaSegmentService.kt`]: `GET /MediaSegments/{itemId}` beim Wechsel des aktuellen Eintrags, daraus zeitgesteuerte Block Events für die gewählten Typen; Auto Skip nur bei natürlicher Aktivierung (nicht nach manuellem Seek in den Bereich).

**Trickplay** [verifiziert, `CustomSeekProvider.kt`]: Kachelrechnung wie oben, Bild über `trickplayApi.getTrickplayTileImageUrl(itemId, width, index, mediaSourceId)` mit `Authorization` Header.

**Home Reihen** [verifiziert, `HomeFragmentHelper.kt`, `HomeSectionType.kt`]: Abschnitte wie jellyfin-web (`latestmedia`, `smalllibrarytiles`, `librarybuttons`, `resume`, `resumeaudio`, `resumebook`, `activerecordings`, `nextup`, `livetv`). Resume: `limit=50`, `mediaTypes=Video`, `excludeItemTypes=AudioBook`, `enableTotalRecordCount=false`, `imageTypeLimit=1`. Next Up: `limit=50`, `enableResumable=false`, optional `nextUpDateCutoff`. Latest pro UserView.

**Manifest** [verifiziert, `app/src/main/AndroidManifest.xml`]: `uses-feature android.software.leanback required=false`, `android.hardware.touchscreen required=false`, `android.hardware.microphone required=false`; Startactivity mit `LAUNCHER` **und** `LEANBACK_LAUNCHER`; `android:banner="@mipmap/app_banner"`; `appCategory="video"`; `largeHeap="true"`; `usesCleartextTraffic="true"`; DreamService als Bildschirmschoner.

---

## 5. Jellyfin REST Endpunkte

Alle Pfade gegen die OpenAPI Spezifikation 10.11.5 geprüft [verifiziert]. Auth Header wie heute in `shared/jellyfin.ts`: `Authorization: MediaBrowser Client="BurrowCinema", Device="...", DeviceId="...", Version="1.0.0", Token="..."`. Wo der Player oder ein Bild keinen Header setzen kann, Query `ApiKey={token}` (so machen es Streamyfin und jellyfin-web). [unverifiziert: In 10.11 ist der alte Query Parameter `api_key` standardmäßig abgeschaltet, `ApiKey` funktioniert; im Prototyp prüfen.] react-native-video und expo-image können Header mitschicken, das ist sauberer als Tokens in URLs (Logcat).

Zeiten in Jellyfin sind **Ticks**: 1 s = 10 000 000 Ticks.

Hinweis zu Versionen: In 10.11.5 gibt es die alten benutzerbezogenen Routen `/Users/{userId}/Items/{itemId}` und `/Users/{userId}/Items/Resume` **nicht** mehr [verifiziert: fehlen in der Spezifikation]. Neu sind `/Items/{itemId}?userId=`, `/UserItems/Resume`, `/UserViews`, `/UserPlayedItems`, `/UserFavoriteItems` [unverifiziert: eingeführt mit 10.9]. Unser heutiger Code nutzt `/Items?userId=` und ist damit kompatibel.

### 5.1 Wiedergabe aushandeln

| Methode und Pfad | Wichtige Parameter | Antwort |
|---|---|---|
| `POST /Items/{itemId}/PlaybackInfo` | Query (alle optional): `userId, maxStreamingBitrate, startTimeTicks, audioStreamIndex, subtitleStreamIndex, maxAudioChannels, mediaSourceId, liveStreamId, autoOpenLiveStream, enableDirectPlay, enableDirectStream, enableTranscoding, allowVideoStreamCopy, allowAudioStreamCopy`. Body `PlaybackInfoDto`: `UserId, MaxStreamingBitrate, StartTimeTicks, AudioStreamIndex, SubtitleStreamIndex, MaxAudioChannels, MediaSourceId, LiveStreamId, DeviceProfile, EnableDirectPlay, EnableDirectStream, EnableTranscoding, AllowVideoStreamCopy, AllowAudioStreamCopy, AutoOpenLiveStream, AlwaysBurnInSubtitleWhenTranscoding` | `PlaybackInfoResponse { MediaSources[], PlaySessionId, ErrorCode }`. `MediaSourceInfo` enthält u. a. `Id, Container, SupportsDirectPlay, SupportsDirectStream, SupportsTranscoding, TranscodingUrl, TranscodingSubProtocol, TranscodingContainer, MediaStreams[], Bitrate, ETag, RequiredHttpHeaders, DefaultAudioStreamIndex, DefaultSubtitleStreamIndex, HasSegments, RunTimeTicks` |
| `GET /Items/{itemId}/PlaybackInfo` | `userId` | wie oben, aber ohne DeviceProfile (nicht nutzen) |

`MediaStream` Felder für Spurmenüs: `Index, Type (Video/Audio/Subtitle), Codec, Language, DisplayTitle, IsDefault, IsForced, IsExternal, IsTextSubtitleStream, SupportsExternalStream, DeliveryMethod (Encode, Embed, External, Hls, Drop), DeliveryUrl, IsExternalUrl, VideoRangeType`.

`TranscodeReason` (Teil von `TranscodingUrl` als `TranscodeReasons=`) erklärt, warum transkodiert wird, z. B. `VideoCodecNotSupported, AudioCodecNotSupported, SubtitleCodecNotSupported, ContainerBitrateExceedsLimit, VideoRangeTypeNotSupported` (gut für die Stats Anzeige).

### 5.2 Stream URLs

| Methode und Pfad | Wann | Wichtige Parameter |
|---|---|---|
| `GET /Videos/{itemId}/stream` (auch `/stream.{container}`) | Direct Play (`static=true`) | `static, container, mediaSourceId, tag (ETag), playSessionId, deviceId, liveStreamId, startTimeTicks`. Mit `static=true` liefert der Server die Datei unverändert (Range Requests, Seek im Player) |
| `GET /Videos/{itemId}/master.m3u8` | Transcode / Remux über HLS | Normalerweise **nicht selbst bauen**, sondern `TranscodingUrl` aus PlaybackInfo nehmen. Parameter u. a. `mediaSourceId, playSessionId, deviceId, videoCodec, audioCodec, videoBitRate, audioBitRate, maxAudioChannels, audioStreamIndex, subtitleStreamIndex, subtitleMethod, maxWidth, maxHeight, startTimeTicks, segmentContainer, transcodeReasons, enableAdaptiveBitrateStreaming, enableTrickplay, alwaysBurnInSubtitleWhenTranscoding` |
| `GET /Videos/{itemId}/main.m3u8` | Variant Playlist hinter master | gleiche Parameter, wird vom Player selbst geladen |
| `DELETE /Videos/ActiveEncodings` | Transcode beenden | `deviceId, playSessionId` |
| `GET /Playback/BitrateTest` | optional, Auto Qualität | `size` (Bytes), Zeit messen |

Regel (wie jellyfin-androidtv): `SupportsDirectPlay` dann `/stream?static=true`, sonst `TranscodingUrl` (Server hat Remux oder Transcode entschieden). Wechsel von Audio Spur, Untertitel mit Burn In oder Qualität während eines Transcodes heißt: neue PlaybackInfo mit neuen Indizes und `StartTimeTicks = aktuelle Position`, alten Transcode beenden, neue URL laden.

### 5.3 Untertitel

| Methode und Pfad | Zweck |
|---|---|
| `GET /Videos/{routeItemId}/{routeMediaSourceId}/Subtitles/{routeIndex}/Stream.{routeFormat}` | Externe Untertitel als `srt`, `vtt`, `ttml`, `ass` usw. Der Server konvertiert ins angefragte Format. Optional `startPositionTicks, endPositionTicks, copyTimestamps, addVttTimeMap` |
| `GET /Videos/{routeItemId}/{routeMediaSourceId}/Subtitles/{routeIndex}/{routeStartPositionTicks}/Stream.{routeFormat}` | Gleiches mit Startposition |
| `MediaStream.DeliveryUrl` | Bei `DeliveryMethod = External` liefert PlaybackInfo den fertigen relativen Pfad, einfach `server + DeliveryUrl` (bei `IsExternalUrl` unverändert) |
| `GET /Items/{itemId}/RemoteSearch/Subtitles/{language}` | Online Suche (Provider Plugin auf dem Server nötig), optional `isPerfectMatch` |
| `POST /Items/{itemId}/RemoteSearch/Subtitles/{subtitleId}` | Gefundene Untertitel auf den Server laden; danach Item neu laden |

Liefermethoden: `Embed` = im Container, Player wählt die Spur selbst. `External` = Sidecar URL. `Encode` = Server brennt ein (erzwingt Transcode). `Hls` = Untertitel im HLS Manifest. Eingebettete Spuren werden vom Player anders nummeriert als `MediaStream.Index`; Zuordnung über Reihenfolge der Untertitelspuren im Container, Sprache und Titel (Streamyfin hat dafür eigene Mapping Logik `routeTrackIndexes.ts`). Im Prototyp genau testen.

### 5.4 Fortschritt melden

| Methode und Pfad | Body | Wann |
|---|---|---|
| `POST /Sessions/Playing` | `PlaybackStartInfo`: `ItemId, MediaSourceId, PlaySessionId, PositionTicks, IsPaused, IsMuted, AudioStreamIndex, SubtitleStreamIndex, PlayMethod (Transcode/DirectStream/DirectPlay), CanSeek, LiveStreamId, RepeatMode, PlaybackOrder, VolumeLevel, NowPlayingQueue, PlaylistItemId` | einmal beim Start |
| `POST /Sessions/Playing/Progress` | `PlaybackProgressInfo` (gleiche Felder) | Heartbeat: Streamyfin 10 s, androidtv 3 s (15 s pausiert). Zusätzlich sofort bei Pause, Fortsetzen, Seek, Spurwechsel |
| `POST /Sessions/Playing/Stopped` | `PlaybackStopInfo`: `ItemId, MediaSourceId, PositionTicks, PlaySessionId, LiveStreamId, Failed, NextMediaType` | einmal beim Verlassen oder Wechsel zur nächsten Folge |
| `POST /Sessions/Playing/Ping` | Query `playSessionId` | hält eine Transcode Sitzung am Leben (optional) |
| `POST /Sessions/Capabilities/Full` | `ClientCapabilitiesDto` | optional, meldet unterstützte Befehle und Medientypen (Fernsteuerung aus dem Dashboard) |

Der Server setzt `Played` automatisch, wenn die Stopped Position über der Server Schwelle (Standard 90 %) liegt, und entfernt den Eintrag aus Weiterschauen [unverifiziert: Schwelle ist eine Server Einstellung].

### 5.5 Benutzerdaten

| Methode und Pfad | Zweck |
|---|---|
| `POST /UserPlayedItems/{itemId}` | als gesehen markieren (`userId`, optional `datePlayed`) |
| `DELETE /UserPlayedItems/{itemId}` | als ungesehen markieren |
| `POST /UserFavoriteItems/{itemId}` / `DELETE ...` | Favorit setzen / entfernen |
| `GET /UserItems/{itemId}/UserData` | `UserItemDataDto { PlaybackPositionTicks, PlayedPercentage, Played, PlayCount, IsFavorite, LastPlayedDate, UnplayedItemCount }` |
| `POST /UserItems/{itemId}/UserData` | Benutzerdaten setzen, z. B. `PlaybackPositionTicks: 0` für "Aus Weiterschauen entfernen" [unverifiziert: Verhalten im Prototyp prüfen] |
| `GET /Users/Me` | eigene `Configuration`: `AudioLanguagePreference, PlayDefaultAudioTrack, SubtitleLanguagePreference, SubtitleMode (Default, Always, OnlyForced, None, Smart), RememberAudioSelections, RememberSubtitleSelections, EnableNextEpisodeAutoPlay, OrderedViews, LatestItemsExcludes, HidePlayedInLatest` |

`UserData` kommt auch direkt in jedem Item mit (`enableUserData=true` bzw. standardmäßig in `/Items`).

### 5.6 Home Reihen und Bibliotheken

| Methode und Pfad | Wichtige Parameter | Zweck |
|---|---|---|
| `GET /UserViews` | `userId, includeExternalContent, presetViews, includeHidden` | Bibliotheken (Filme, Serien, ...) für Seitenleiste |
| `GET /UserItems/Resume` | `userId, limit, mediaTypes=Video, fields, imageTypeLimit, enableImageTypes, excludeItemTypes, includeItemTypes, parentId, enableTotalRecordCount=false, excludeActiveSessions` | Weiterschauen |
| `GET /Shows/NextUp` | `userId, limit, fields, seriesId, parentId, nextUpDateCutoff, enableResumable, enableRewatching, disableFirstEpisode, imageTypeLimit` | Nächste Folgen |
| `GET /Items/Latest` | `userId, parentId, limit, fields, includeItemTypes, isPlayed, groupItems, imageTypeLimit` | Zuletzt hinzugefügt pro Bibliothek, Antwort ist ein Array (kein `Items` Objekt) |
| `GET /Items` | u. a. `userId, parentId, includeItemTypes, recursive, sortBy, sortOrder, filters (IsPlayed, IsUnplayed, IsResumable, IsFavorite), isPlayed, isFavorite, genres, years, minCommunityRating, officialRatings, searchTerm, personIds, startIndex, limit, fields, enableUserData, imageTypeLimit, nameStartsWithOrGreater, adjacentTo, ids` | Raster, Filter, Suche (existiert schon in `shared/jellyfin.ts`) |
| `GET /Search/Hints` | | schnelle Suche über alle Typen (Alternative) |

Nützliche `fields` (Enum `ItemFields`): `Overview, Genres, People, Studios, Taglines, ProviderIds, ChildCount, MediaSources, MediaStreams, Chapters, Trickplay, RemoteTrailers, LocalTrailerCount, PrimaryImageAspectRatio, DateCreated, ParentId, SpecialFeatureCount`. Für den Player braucht ein Item mindestens `MediaSources, MediaStreams, Chapters, Trickplay`.

### 5.7 Serien, Staffeln, Folgen

| Methode und Pfad | Wichtige Parameter |
|---|---|
| `GET /Shows/{seriesId}/Seasons` | `userId, fields, isSpecialSeason, isMissing, adjacentTo, enableUserData` |
| `GET /Shows/{seriesId}/Episodes` | `userId, fields, season, seasonId, isMissing, adjacentTo, startItemId, startIndex, limit, sortBy, enableUserData` |
| Nächste Folge | `GET /Shows/{seriesId}/Episodes?adjacentTo={episodeId}&limit=3` (vorherige, aktuelle, nächste) oder `GET /Shows/NextUp?seriesId=...` |

Item Felder für Folgen: `SeriesId, SeasonId, IndexNumber, ParentIndexNumber`.

### 5.8 Details, Ähnliche, Personen, Trailer

| Methode und Pfad | Zweck |
|---|---|
| `GET /Items/{itemId}?userId=` | ein Item (heute nutzen wir `/Items?ids=`) |
| `GET /Items/{itemId}/Similar` | `userId, limit, fields`, "Mehr wie das" |
| `GET /Persons/{name}` | `userId`, Person Details |
| `GET /Items?personIds={id}&recursive=true&includeItemTypes=Movie,Series` | Filmografie einer Person in der Bibliothek |
| `GET /Items/{itemId}/LocalTrailers` | lokale Trailer (LATER) |
| `GET /Items/{itemId}/ThemeMedia` | Theme Songs/Videos (LATER) |
| `RemoteTrailers` Feld | YouTube URLs, extern öffnen |
| `GET /Items/{itemId}/Images/{imageType}[/{imageIndex}]` | `maxWidth, maxHeight, quality, tag, format, blur, percentPlayed, unplayedCount`. `blur` hilft für Anti Spoiler |

### 5.9 Intro/Abspann (MediaSegments) und Trickplay

| Methode und Pfad | Version | Antwort |
|---|---|---|
| `GET /MediaSegments/{itemId}` | ab **10.10** (Release Notes 10.10, Segmente kommen von Plugins) | Query `includeSegmentTypes` (Enum `Unknown, Commercial, Preview, Recap, Outro, Intro`). Antwort `{ Items: MediaSegmentDto[] }` mit `Id, ItemId, Type, StartTicks, EndTicks` |
| `GET /Episode/{itemId}/Timestamps` | Intro Skipper Plugin, ältere Server | Sekunden, Fallback wie Streamyfin |
| `MediaSourceInfo.HasSegments` | 10.11 Spezifikation | Hinweis, ob Segmente existieren |
| `item.Trickplay` (mit `fields=Trickplay`) | ab **10.9** | `Record<mediaSourceId, Record<width, TrickplayInfoDto>>`, `TrickplayInfoDto { Width, Height, TileWidth, TileHeight, ThumbnailCount, Interval, Bandwidth }` |
| `GET /Videos/{itemId}/Trickplay/{width}/{index}.jpg` | ab 10.9 | Kachelblatt, Query `mediaSourceId` |
| `GET /Videos/{itemId}/Trickplay/{width}/tiles.m3u8` | ab 10.9 | HLS Bild Playlist (für uns nicht nötig) |

### 5.10 Quick Connect (TV Login)

| Methode und Pfad | Wer | Ablauf |
|---|---|---|
| `GET /QuickConnect/Enabled` | TV | `true`, wenn der Admin Quick Connect eingeschaltet hat |
| `POST /QuickConnect/Initiate` | TV | mit Auth Header ohne Token. Antwort `QuickConnectResult { Code, Secret, Authenticated, DeviceId, DeviceName, AppName, ... }`. Code groß anzeigen |
| `GET /QuickConnect/Connect?secret=` | TV | pollen (Streamyfin: jede Sekunde), bis `Authenticated = true` |
| `POST /Users/AuthenticateWithQuickConnect` | TV | Body `{ Secret }`, Antwort wie `AuthenticateByName` (`AccessToken`, `User`) |
| `POST /QuickConnect/Authorize?code=` | Handy (angemeldet) | Code bestätigen. Optional `userId` (ab 10.9 laut Streamyfin `serverVersion.ts`); ohne `userId` autorisiert es den aufrufenden Benutzer. Alternativ in der Jellyfin Web Oberfläche unter Quick Connect |

### 5.11 Sonstiges

| Methode und Pfad | Zweck |
|---|---|
| `GET /System/Info/Public` | Serverversion, um Funktionen (Trickplay 10.9, Segmente 10.10) zu schalten |
| WebSocket `/socket?api_key=...&deviceId=...` | Fernsteuerung, Live Updates von UserData. Nicht Teil der OpenAPI Spezifikation; LATER |

### 5.12 Ablauf einer Wiedergabe (Soll für uns)

1. Item mit `fields=MediaSources,MediaStreams,Chapters,Trickplay` laden. Startposition aus `UserData.PlaybackPositionTicks` (optional minus Resume Rückspulen).
2. Standard Audio und Untertitel bestimmen: gemerkte Wahl, sonst Benutzerkonfiguration (`AudioLanguagePreference`, `SubtitleMode`, `SubtitleLanguagePreference`), sonst `DefaultAudioStreamIndex`/`DefaultSubtitleStreamIndex`.
3. `POST /Items/{id}/PlaybackInfo` mit DeviceProfile, `MaxStreamingBitrate` aus den Einstellungen, Indizes, `StartTimeTicks`, `MediaSourceId`.
4. URL nach Regel 5.2, externe Untertitel aus `DeliveryUrl`.
5. Player starten, nach dem Laden auf Startposition springen (bei Direct Play; bei Transcode steckt `StartTimeTicks` schon in der URL [unverifiziert: ob der Player danach trotzdem seeken muss, im Prototyp prüfen]).
6. `POST /Sessions/Playing`, Heartbeat 10 s, Ereignisberichte.
7. Segmente laden, Skip Button oder Auto Skip; Trickplay beim Scrubben.
8. 10 bis 15 s vor Ende (oder bei Abspann Segment) Up Next mit Countdown; nächste Folge: Stopped melden, neuen Durchlauf starten.
9. Beim Verlassen: Stopped, Transcode beenden (`DELETE /Videos/ActiveEncodings`), Keep Awake freigeben, Caches von Weiterschauen, Next Up, Item und Folgen invalidieren.

---

## 6. Video Bibliotheken für Expo SDK 58 / RN 0.88 (New Architecture)

### 6.1 Übersicht (npm Stand 27.11.2026)

| Paket | Version | Android Engine | New Arch | Externe Untertitel | Spurwahl | PiP | Android TV | Bemerkung |
|---|---|---|---|---|---|---|---|---|
| `react-native-video` | **6.20.0** (latest, veröffentlicht 27.11.2026), davor 6.19.3 (18.09.2026) | Media3 **1.8.0** (Gradle Property `RNVideo_media3Version`), HLS/DASH/SS an, IMA/RTSP aus | über Interop Layer (README: "Old + New (Interop Layer)") | ja: `textTracks` mit `application/x-subrip`, `text/vtt`, `application/ttml+xml` | Audio, Text, Video (`selectedAudioTrack`, `selectedTextTrack`, `selectedVideoTrack` Android) | ja, `enterPictureInPictureOnLeave`, Expo Plugin `enableAndroidPictureInPicture` | keine eigene D Pad UI, eigene JS Controls nötig | Expo Config Plugin vorhanden. `DefaultRenderersFactory` hart auf `EXTENSION_RENDERER_MODE_OFF` mit `setEnableDecoderFallback(true)` (kein FFmpeg ohne Patch). `viewType` TEXTURE/SURFACE/SURFACE_SECURE. `VideoDecoderProperties.isCodecSupported(mime, w, h)` und `isHEVCSupported()`. `subtitleStyle` (Android) nur Größe, Abstände, Deckkraft |
| `react-native-video` v7 | 7.0.0-beta.14 (20.11.2026), Tag `beta`/`next` | Media3 1.4.1 Standard | voll (Nitro, Peer `react-native-nitro-modules >=0.35.0`) | ja: `externalSubtitles` mit `vtt, srt, ssa, ass, auto` | ja | ja (`pictureInPicture`, `autoEnterPictureInPicture`) | README: "TV Support: TODO" (Issue 4607) | Beta, API bricht noch; Abhängigkeit `@videojs/react` |
| `expo-video` | **58.0.14** | Media3 **1.9.1** | ja (Expo Modul) | **nein**: `VideoSource` hat nur `uri, assetId, drm, metadata, headers, useCaching, contentType` | Audio (`availableAudioTracks`), eingebettete Untertitel (`availableSubtitleTracks`), Videospuren (HLS Qualität) | ja (`allowsPictureInPicture`, `startsPictureInPictureAutomatically`) | keine D Pad Logik, eigene Controls (`nativeControls={false}`) | `bufferOptions`, `playbackRate`, `contentFit`, `keepScreenOnWhilePlaying`, `timeUpdateEventInterval`, `seekTolerance`. Externe Untertitel nur über HLS (`SubtitleMethod=Hls`, also Remux/Transcode) oder gar nicht bei Direct Play |
| `react-native-vlc-media-player` | 1.0.98 (letzte Änderung 28.11.2025) | `org.videolan.android:libvlc-all:3.6.3` | unklar, ein Jahr ohne Release | ja (VLC) | ja | eingeschränkt | unklar | Spielt fast alles inkl. ASS/PGS, aber großes APK, alte Abhängigkeiten (`react-native-vector-icons`, `react-native-slider`), Wartung fraglich. Nicht empfohlen |
| MPV | kein gepflegtes npm Paket (`react-native-mpv` existiert nicht) | libmpv `dev.jdtech.mpv:libmpv:1.0.0` (Maven) | nur als eigenes Expo Modul | ja | ja | eigener Code | eigener Code | Weg von Streamyfin, sehr viel nativer Code |
| Eigenes Expo Modul (Media3) | Media3 1.11.1 + `org.jellyfin.media3:media3-ffmpeg-decoder:1.9.0+1` + `io.github.peerless2012:ass-media:0.5.1` | Media3 | ja | ja | ja | eigener Code | eigener Code | Blaupause: Streamyfin `modules/exoplayer-player` (ExoPlayerView.kt 1430 Zeilen) und jellyfin-androidtv `playback/media3` |

### 6.2 Was Media3 ohne FFmpeg auf Android kann

[unverifiziert, aus der Media3 Formatliste und den Profilen der Referenzclients abgeleitet; Geräte unterscheiden sich stark]

| Format | Media3 ohne Extension | Folge für das DeviceProfile |
|---|---|---|
| H.264 8 Bit | Hardware auf allen Geräten | direct play |
| H.264 High10 | selten Hardware | per CodecProfile `VideoBitDepth <= 8` |
| HEVC Main/Main10 | Hardware auf fast allen TVs und aktuellen Handys | per `isHEVCSupported()` schalten |
| AV1 | nur mit Hardware Decoder (neuere Geräte), kein dav1d | nur wenn `isCodecSupported('video/av01', 3840, 2160) === 'hardware'` |
| VP9 | meist Hardware | direct play |
| VC 1, MPEG 2, RMVB | geräteabhängig / nein | transkodieren lassen |
| HDR10, HLG | ja, mit SurfaceView und HDR Display | `viewType` SURFACE |
| Dolby Vision P5 | nur mit DV Decoder | `VideoRangeType NotEquals DOVI` wie Streamyfin |
| DV P7/P8 | Fallback auf Basis Layer (Media3 ab 1.9.1 laut Streamyfin Kommentar) | erlaubt |
| AAC, MP3, Opus, Vorbis, FLAC, PCM | ja | direct play |
| AC 3, E AC 3 | Decoder auf vielen TVs, auf Handys oft nicht; Passthrough wenn HDMI Sink es meldet | auf TV erlauben, auf Handy über Probe oder Einstellung |
| DTS, DTS HD, TrueHD | nur Passthrough an geeigneten Receiver | konservativ: nicht in DirectPlay Audio, Server transkodiert die Audiospur (Video bleibt per Stream Copy) |
| ALAC | braucht FFmpeg | nicht anbieten |
| Untertitel SRT, VTT, TTML | ja, auch als Sidecar | External |
| SSA/ASS | eingebettet mit Grundstyling (ohne libass) | Embed, optional Encode für "gestylt einbrennen" |
| PGS, DVB, VobSub | eingebettet teils, laut Streamyfin "inconsistent" | Encode (Burn In, erzwingt Transcode) |

### 6.3 Empfehlung

**Stufe 1: `react-native-video` 6.x.** Gründe: stabil und gepflegt, Media3, Sidecar Untertitel (wichtig, weil Jellyfin externe SRT Dateien bei Direct Play nur so liefert), Audio/Untertitel Spurwahl, PiP, Header, Expo Plugin. Die TV Bedienung bauen wir ohnehin in JS (wie Streamyfin `Controls.tv.tsx`), dafür braucht es keine native Player UI (`controls={false}`).
* Version: 6.20.0 ist am Analysetag erschienen; falls das Probleme macht, auf 6.19.3 pinnen. Mit `npx expo install react-native-video` installieren (Repo Konvention).
* Risiko: läuft auf RN 0.88 über den Interop Layer. Das ist nicht selbst getestet; erster Schritt im Plan ist ein Prototyp (Direct Play MKV, HLS Transcode, Sidecar SRT, Audio Wechsel, PiP) auf Handy und TV.
* Nur **eine** Media3 Bibliothek installieren: `expo-video` (Media3 1.9.1) und `react-native-video` (1.8.0) zusammen ergeben Versionskonflikte im Gradle Klassenpfad.

**Alternative: `expo-video`**, falls react-native-video auf RN 0.88 nicht stabil läuft. Dann Untertitel nur eingebettet oder über HLS (`SubtitleMethod=Hls`); externe SRT bei Direct Play gingen verloren bzw. müssten eingebrannt werden. Das ist der größte Nachteil.

**Stufe 2 (LATER):**
* FFmpeg Audio für DTS/TrueHD lokal: `react-native-video` per `patch-package` auf `EXTENSION_RENDERER_MODE_PREFER` stellen und `org.jellyfin.media3:media3-ffmpeg-decoder:1.9.0+1` als Abhängigkeit über ein Config Plugin hinzufügen; dazu `RNVideo_media3Version` passend setzen [unverifiziert: Binärkompatibilität 1.8 gegen 1.9 Decoder; Streamyfin fährt 1.11.1 mit dem 1.9.0+1 Decoder].
* Oder eigenes Expo Modul `modules/burrow-player` mit Media3 1.11.1, FFmpeg Decoder und libass (`ass-media`). Erst angehen, wenn Stufe 1 an Grenzen stößt (ASS Anime, PGS ohne Transcode, Passthrough).
* Bildwiederholrate: kleines Expo Modul, das `Surface.setFrameRate` oder `WindowManager.LayoutParams.preferredDisplayModeId` setzt (Streamyfin Learned Fact: App seitige `preferredDisplayModeId` Wahl ist nötig, weil Amlogic Boxen sonst falsch umschalten).

### 6.4 Vorschlag DeviceProfile für Stufe 1 (react-native-video, Media3 ohne FFmpeg)

Als Ausgangspunkt, Werte im Prototyp prüfen:

```json
{
  "Name": "BurrowCinema Media3",
  "MaxStaticBitrate": 120000000,
  "MaxStreamingBitrate": "<aus Einstellung, Standard 120000000>",
  "DirectPlayProfiles": [
    { "Type": "Video", "Container": "mp4,m4v,mkv,webm,mov,ts", "VideoCodec": "h264,hevc,vp9,av1*", "AudioCodec": "aac,mp3,opus,vorbis,flac,pcm_s16le,pcm_s24le,ac3*,eac3*" }
  ],
  "TranscodingProfiles": [
    { "Type": "Video", "Context": "Streaming", "Protocol": "hls", "Container": "ts", "VideoCodec": "h264,hevc*", "AudioCodec": "aac,ac3*,eac3*", "MaxAudioChannels": "6", "BreakOnNonKeyFrames": true }
  ],
  "CodecProfiles": [
    { "Type": "Video", "Codec": "h264", "Conditions": [{ "Condition": "LessThanEqual", "Property": "VideoBitDepth", "Value": "8", "IsRequired": false }] },
    { "Type": "Video", "Codec": "hevc", "Conditions": [{ "Condition": "NotEquals", "Property": "VideoRangeType", "Value": "DOVI", "IsRequired": true }] }
  ],
  "SubtitleProfiles": [
    { "Format": "srt", "Method": "External" }, { "Format": "subrip", "Method": "External" },
    { "Format": "vtt", "Method": "External" }, { "Format": "ttml", "Method": "External" },
    { "Format": "srt", "Method": "Embed" }, { "Format": "subrip", "Method": "Embed" },
    { "Format": "ass", "Method": "Embed" }, { "Format": "ssa", "Method": "Embed" },
    { "Format": "pgssub", "Method": "Encode" }, { "Format": "dvdsub", "Method": "Encode" }, { "Format": "dvbsub", "Method": "Encode" }
  ]
}
```

`*` = nur wenn die Probe es erlaubt (`isHEVCSupported`, `isCodecSupported('video/av01', ...)`, AC 3/E AC 3 auf TV standardmäßig an, auf Handy per Einstellung). `webvtt` nicht als External anbieten (Streamyfin #1892). Für HEVC Transcodes ggf. zusätzlich ein HLS `mp4` (fMP4) Profil wie jellyfin-androidtv. Das Profil gehört als reine Funktion nach `shared/` (z. B. `shared/deviceProfile.ts`), die Probe Ergebnisse kommen von der App herein.

---

## 7. Android TV mit Expo

### 7.1 Zwei Wege

| Weg | Was man bekommt | Bewertung |
|---|---|---|
| **react-native-tvos** (`"react-native": "npm:react-native-tvos@0.88.1-0"`) plus `@react-native-tvos/config-tv@0.1.7` | `Platform.isTV`, `useTVEventHandler` (Fernbedienung inkl. Langdruck), `TVFocusGuideView`, `hasTVPreferredFocus`, Fokus Events und `nextFocus*` auf Pressables, Apple TV dazu. Läuft laut config-tv README auch auf Handys | **empfohlen**: gleiche RN Version wie wir (0.88.1), von Streamyfin mit Expo SDK 58, Expo Router und Reanimated 4 produktiv genutzt. Version 0.88.1-0 vom 03.11.2026 [verifiziert] |
| Plain React Native mit fokussierbaren Views und eigenem Config Plugin für das Manifest | Android Views sind von Haus aus D Pad fokussierbar, `focusable`, `hasTVPreferredFocus` und `nextFocus*` gibt es auf Android auch im Kern | möglich, aber ohne `useTVEventHandler`, `TVFocusGuideView` und Langdruck Events wird die Player Steuerung mühsam [unverifiziert: genauer Umfang im RN Kern 0.88] |

Hinweis: Expo Pakete in `expo install` von der Versionsprüfung für `react-native` ausnehmen (Streamyfin: `expo.install.exclude` enthält `react-native`), weil `npx expo install` sonst das Original vorschlägt. Streamyfin hat zudem einen Learned Fact, dass Expo vorgebaute Module zur exakten RN Patch Version passen müssen (betraf iOS); bei uns zuerst `npx expo export` und einen Android Build prüfen.

### 7.2 Ein APK für Handy und TV

Was Android und Google TV verlangen [verifiziert in jellyfin-androidtv Manifest und config-tv Quellcode]:

| Anforderung | Umsetzung |
|---|---|
| Startactivity mit `android.intent.category.LEANBACK_LAUNCHER` zusätzlich zu `LAUNCHER` | config-tv `setLeanBackLauncherIntent` (bei `isTV: true` oder `EXPO_TV=1`) |
| `<uses-feature android:name="android.hardware.touchscreen" android:required="false"/>` | config-tv `addTouchscreenHardwareFeatureToManifest` |
| `<uses-feature android:name="android.software.leanback" android:required="false"/>` | config-tv, `required=true` nur mit `androidTVRequired: true` (dann **nicht** mehr auf Handys installierbar, also weglassen) |
| TV Banner 320x180 px (xhdpi) als `android:banner` | config-tv Option `androidTVBanner` (Fire TV nimmt das Banner aus dem Amazon Store) |
| Querformat auf TV | config-tv **entfernt** `android:screenOrientation` von MainActivity. Unser `app.json` hat `"orientation": "portrait"`; auf Handys dann zur Laufzeit mit `expo-screen-orientation` hochkant sperren und im Player auf Querformat wechseln |
| Weitere Features nicht verlangen | z. B. Mikrofon nur `required=false`; `POST_NOTIFICATIONS` stört nicht, Benachrichtigungen auf TV aber nicht anbieten |
| 32 Bit Boxen | `-PreactNativeArchitectures=arm64-v8a,armeabi-v7a` statt nur `arm64-v8a` (unser `android.yml`), APK wird größer. Alternativ zwei APKs oder ABI Splits |
| App Kategorie | optional `android:appCategory="video"` per eigenem Plugin |

Streamyfin baut **zwei** APKs (`EXPO_TV=0` und `EXPO_TV=1`), weil es mit `EXPO_TV=1` Module abschaltet (`react-native.config.js`) und `.tv.tsx` Auflösung aktiviert. Für uns reicht **ein APK**: config-tv mit `"isTV": true` fest in `app.json`, TV Code per `Platform.isTV` zur Laufzeit wählen (wie Streamyfin es ohnehin tut). Module wie `expo-haptics` oder `expo-notifications` bleiben drin und werden auf TV einfach nicht aufgerufen.

[unverifiziert] `Platform.isTV` wird in react-native-tvos auf Android über den UI Modus (`UI_MODE_TYPE_TELEVISION`) bestimmt, also zur Laufzeit; im Prototyp auf Handy und TV Emulator prüfen.

### 7.3 Was in unserer App für TV angepasst werden muss

| Heute | Auf TV | Quelle |
|---|---|---|
| `NativeTabs` (Material Bottom Bar) | eigene fokussierbare Navigation (Seitenleiste links wie JellyWatch oder Top Leiste wie Streamyfin), `Stack` darunter | Streamyfin `_layout.tsx` (`IS_ANDROID_TV`) |
| `PosterGrid` mit FlashList | `FlatList` mit `removeClippedSubviews={false}` auf TV | Streamyfin `docs/conventions/tv.md` |
| `Sheet` auf Basis von `Modal` | Route als Modal (`router.push`) auf TV | ebenda |
| `Pressable` mit `active:opacity-80` | sichtbarer Fokuszustand (Skalierung 1.05, weißer Rand), Platz und `overflow: visible` | ebenda |
| Swipe Deck der Auslosung (Gesten) | D Pad Ersatz (Links/Rechts = nein/ja) oder Funktion auf TV ausblenden | eigene Entscheidung |
| Texteingaben (Login, Suche) | Bildschirmtastatur ist mühsam: Quick Connect für Login, Suche mit großem Feld | JellyWatch, Streamyfin |
| Haptik, Benachrichtigungen, Hintergrundaufgabe | auf TV nicht nutzen | Streamyfin schaltet sie für TV ab |
| Zurück | erstes Zurück schließt Overlays, auf Tab Root beendet zweites Zurück die App | JellyWatch Doku, Streamyfin `useTVBackHandler` |
| `expo-keep-awake` im Player | beim Verlassen und bei Pause freigeben, sonst kein TV Bildschirmschoner | Streamyfin `direct-player.tsx` |

Fokus Regeln (aus Streamyfin, verifiziert): genau ein `hasTVPreferredFocus` pro gepushtem Screen; Tab Roots setzen keinen (außer Home einmal pro Sitzung); `TVFocusGuideView` mit `destinations` (Ziel per `useState` Callback Ref, nicht `useRef`); `TVFocusGuideView` ignoriert `display: none`, stattdessen `enabled={false}`; nach Schließen eines Modals Fokus per `requestTVFocus` zurückgeben; Langdruck Select doppelte `onPress` abfangen.

### 7.4 Build und Release

* `android.yml` heute: `expo prebuild --platform android --no-install`, `./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a`. Änderung: `arm64-v8a,armeabi-v7a`, Release Text um Android TV ergänzen ("auf dem TV per Downloader App oder USB installieren").
* `android-smoke.yml` existiert; ein Android TV Emulator Lauf (System Image `android-tv`) wäre eine sinnvolle Ergänzung [nicht geprüft, welche Images GitHub Runner haben].
* Sideload auf Google TV: APK über eine Datei App oder `adb install`. Fire TV: gleiches APK, Leanback Intent funktioniert dort ebenfalls [unverifiziert].

---

## 8. Auswirkungen auf unsere Codebasis

| Bereich | Änderung |
|---|---|
| `shared/jellyfin.ts` | Typen erweitern (`UserData`, `MediaSources`, `MediaStreams`, `Chapters`, `Trickplay`, `SeriesId`, `IndexNumber` ...). Neue Funktionen: `getPlaybackInfo`, `buildStreamUrl`, `reportStart/Progress/Stopped`, `stopTranscode`, `getResume`, `getNextUp`, `getLatest`, `getUserViews`, `getEpisodes`, `getAdjacentEpisodes`, `getSimilar`, `getPerson`, `setPlayed`, `setFavorite`, `getSegments`, `trickplayTileUrl`, `quickConnect*`, `getMe` |
| `shared/` neu | `deviceProfile.ts` (reine Funktion mit Fähigkeiten als Parameter), `playback.ts` (Spurwahl nach Benutzerkonfiguration, Ticks Umrechnung, PlayMethod, Segment Logik, Trickplay Kachelrechnung). Keine `URLSearchParams` in `shared/` (Repo Regel), vorhandenes `query()` nutzen |
| `app/src/app/` neu | `player/[id].tsx` (Vollbild, eigene Controls), Home Screen mit Reihen, Serien/Staffel/Folgen Screens, Personen Screen, TV Login mit Quick Connect, "TV verbinden" in Einstellungen |
| Web App | Laut README Konvention hat jeder Screen ein Web Gegenstück. Wiedergabe im Web ist nicht Teil des Auftrags; Home Reihen und Serien Seiten könnten im Web nachgezogen werden. Im Plan entscheiden |
| `app.json` | Plugins: `react-native-video` (mit `enableAndroidPictureInPicture`, ggf. `enableBackgroundAudio: false`), `@react-native-tvos/config-tv` (`isTV: true`, `androidTVBanner`), `expo-screen-orientation`. `orientation` Strategie (siehe 7.2) |
| `package.json` | `react-native` auf `npm:react-native-tvos@0.88.1-0`, `react-native-video`, `expo-keep-awake`, `expo-screen-orientation`, ggf. `expo-brightness`; `expo.install.exclude: ["react-native"]` |
| CI | ABIs erweitern, Release Text |

---

## 9. Risiken und offene Punkte

| Punkt | Status |
|---|---|
| react-native-video 6 auf RN 0.88 über Interop Layer | nicht getestet, Prototyp zuerst |
| react-native-tvos statt react-native mit Uniwind, Expo Router Native Tabs, Gesture Handler 3, sonner-native | Streamyfin nutzt tvos mit Expo Router, Reanimated 4, GH 3, sonner-native; Uniwind (wir) statt NativeWind (Streamyfin) ist ungeprüft |
| Zuordnung Jellyfin `MediaStream.Index` zu Player Spuren bei eingebetteten Untertiteln/Audio | knifflig, im Prototyp mit mehreren MKVs testen |
| AC 3/E AC 3 auf Handys ohne Decoder | Probe oder Einstellung, sonst Stille bzw. Fehler; Fallback: neu aushandeln mit Audio Transcode |
| Transcode Start mit Position (`StartTimeTicks`) und Seek im HLS | im Prototyp prüfen |
| `api_key` vs `ApiKey` vs Header in 10.11 | Header bevorzugen, `ApiKey` als Fallback, prüfen |
| "Aus Weiterschauen entfernen" über UserData | Verhalten prüfen |
| `Platform.isTV` zur Laufzeit in einem gemeinsamen APK | prüfen |
| APK Größe mit zwei ABIs (und später FFmpeg) | messen; ggf. ABI Splits |
| Keine echten Geräte in dieser Umgebung | Typprüfung und Bundle lokal, APK in CI, Tests auf Gerät durch den Nutzer |
| JellyWatch Funktionsdetails | stammen aus Doku und README, nicht aus Code; manche Punkte sind dort selbst als "nicht dokumentiert" markiert (Langdruck im Player, Gesten) |
