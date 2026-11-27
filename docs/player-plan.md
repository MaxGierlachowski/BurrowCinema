# Plan: Wiedergabe, Jellyfin Browsing und Android TV für die App

Stand: 27.11.2026. Grundlage ist [jellywatch-analysis.md](jellywatch-analysis.md). Ziel bis morgen früh: **ein** APK für Handy und Android TV. Es bringt einen Player, ein erweitertes Jellyfin Browsing und eine TV Bedienung mit D Pad. Alles, was es heute gibt, funktioniert weiter.

## 0. Kurzfassung

1. **Player:** `react-native-video` **6.19.3**, exakt gepinnt. Fallback Kette: 6.20.0, dann `expo-video` 58.0.14. Die Bibliothek steckt hinter einer einzigen Komponente `VideoSurface`, damit ein Wechsel nur diese Datei betrifft.
2. **Android TV:** `react-native` wird durch `npm:react-native-tvos@0.88.1-0` ersetzt, dazu kommt `@react-native-tvos/config-tv@0.1.7` mit `isTV: true`. Alles TV Spezifische läuft über `@/lib/tv`. Fallback ist plain React Native 0.88, das reicht nachweislich für D Pad Tasten und Fokus (siehe 1.2). Bricht der Tausch, ändert sich nur `@/lib/tv.tsx` und `package.json`.
3. **Ein APK:** Die Weiche ist `Platform.isTV`, ausgewertet zur Laufzeit. Das Manifest enthält `LAUNCHER` und `LEANBACK_LAUNCHER`, `touchscreen` und `leanback` stehen auf `required=false`. Die ABIs sind `arm64-v8a,armeabi-v7a`.
4. **Ablauf:** Zuerst Phase 0 durch den Orchestrator (Pakete, Konfiguration, gemeinsamer Code, Stubs). Danach drei parallele Arbeitspakete mit strikt getrennten Dateien: **A** Player, **B** Browsing, **C** TV, Login und CI.
5. **Nachweis ohne Gerät:** Der Smoke Test bekommt drei Jobs: einen Build Job, einen Job auf dem Handy Emulator (API 36) und einen auf dem Android TV Emulator (API 36, x86_64, `android-tv`). Der Mock Jellyfin liefert ein erzeugtes Testvideo. Er zählt `/Sessions/Playing`, `/Progress` und `/Stopped` und gibt die Zählung als Bericht aus. Der Test schlägt fehl, wenn eine Prüfung nicht erfüllt ist.

---

## 1. Entscheidungen

### 1.1 Player Bibliothek: react-native-video 6.19.3

| Option | Bewertung |
|---|---|
| `react-native-video` 6.19.3 (18.09.2026) | **Gewählt.** Media3 1.8.0, Sidecar Untertitel (SRT/VTT/TTML), Audio und Untertitel Spurwahl, `source.startPosition`, `source.headers`, PiP, `viewType` SURFACE (HDR), `focusable` Prop, `VideoDecoderProperties` (HEVC/AV1 Probe), Expo Plugin. Seit zwei Monaten im Einsatz |
| `react-native-video` 6.20.0 | Erschienen am 27.11.2026 um 22:13 UTC, also erst vor wenigen Stunden. Ist die einzige Version, die nach RN 0.88 erschien. Wird in Phase 0 parallel gebaut (Probe) und genommen, falls 6.19.3 nicht baut |
| `expo-video` 58.0.14 | Fallback, falls beide 6er Versionen nicht bauen oder im Player abstürzen. Kann **keine** Sidecar Untertitel, dann werden Textuntertitel eingebrannt (`caps.sidecarSubtitles = false` im DeviceProfile) |
| v7 Beta, VLC, MPV, eigenes Modul | Nicht heute (Beta, ungepflegt oder zu viel nativer Code) |

Regeln:
* Nur **eine** Media3 Bibliothek installieren (Gradle Konflikt).
* Version exakt pinnen, ohne `^` oder `~`.
* `controls={false}`: Alle Bedienelemente baut Arbeitspaket A in JS.

### 1.2 Android TV: react-native-tvos mit vorbereitetem Fallback

**Gewählt: Tausch auf `react-native-tvos@0.88.1-0`.** Gründe:
* Gleiche RN Version wie unsere (0.88.1).
* Streamyfin nutzt genau diese Kombination produktiv mit Expo SDK 58, Expo Router, Reanimated 4.7.1 und GH 3.
* Liefert, was eine gute TV Oberfläche braucht: `onFocus`/`onBlur` an `Pressable` (Fokusring pro Karte), `TVFocusGuideView`, `useTVEventHandler` mit Langdruck Events und Fokus Korrekturen in Listen.

**Risiko:** Ein Tausch von `react-native` in einer Expo App ist nachts nicht trivial. Unbekannt sind vorkompilierte Expo Module, Uniwind (bei Streamyfin NativeWind) und Autolinking. Darum gilt:
1. Der Tausch wird in Phase 0 auf einem eigenen Probe Branch gebaut, parallel zum Player Probe Branch. Ein Fehler ist so eindeutig zuzuordnen.
2. Kein Code außer `app/src/lib/tv.tsx` importiert TV APIs aus `react-native`. Alle Pakete nutzen nur `@/lib/tv`.
3. **Fallback plain RN 0.88.** Im Quellcode von `react-native@0.88.1` geprüft:
   * `ReactAndroidHWInputDeviceHelper.kt` sendet über `ReactRootView.dispatchKeyEvent` das Device Event `onHWKeyEvent` mit `eventType`. Werte: `select`, `up`, `down`, `left`, `right`, `playPause`, `play`, `pause`, `rewind`, `fastForward`, `next`, `previous`, `menu`, `info`. Dazu kommt `eventKeyAction` (0 gedrückt, 1 losgelassen).
   * Bei Fokuswechsel sendet es `focus`/`blur` mit dem `tag` der View. Das gilt auch im Bridgeless Modus (`ReactSurfaceView` erbt von `ReactRootView`).
   * `ReactViewManager.setFocusable` hängt einen Click Listener an, und `Pressability.onClick` ruft `onPress` auf. Select auf einer fokussierten `Pressable` funktioniert also.
   * `Platform.isTV`, `hasTVPreferredFocus` und `nextFocus*` gibt es im Kern.
   * Es fehlen `TVFocusGuideView` (Ersatz: plain `View`), Langdruck Events (Ersatz: Zeit zwischen Drücken und Loslassen messen) und `onFocus`/`onBlur` an Views (Ersatz: globaler Fokus Speicher über die `focus`/`blur` Events mit `tag`).
   * Das alles steckt in `@/lib/tv.tsx`. Für die Arbeitspakete ändert sich nichts.
4. **Auslöser für den Fallback:** Der Probe Build mit tvos scheitert (APK Build oder Handy Smoke Test), der Player Probe Build ist grün, und ein Reparaturversuch von höchstens 30 Minuten schlägt fehl.
   * Dann `react-native` zurück auf `0.88.1`, `expo.install.exclude` bleibt.
   * `config-tv` bleibt, es ändert nur das Manifest.
   * `@/lib/tv.tsx` bekommt die Kern Implementierung.

### 1.3 TV oder Handy zur Laufzeit in einem APK

* `export const isTV = Platform.isTV` in `@/lib/tv`, einmal beim Laden ausgewertet. `uiMode` television gilt auch für Fire TV.
* **Keine** `.tv.tsx` Dateien: Metro löst sie nur mit `EXPO_TV=1` auf. TV Komponenten sind eigene Dateien und werden per `isTV ? <TvX/> : <X/>` gewählt.
* Auf TV aus:
  * Haptik (`haptic` wird No Op).
  * Benachrichtigungen und Hintergrundaufgabe der Auslosung (`useDrawNotifications` nur wenn `!isTV`).
  * Hochformat Sperre.
  * Auslosung in der Navigation.
* `deviceName` auf TV: `BurrowCinema Android TV` (Jellyfin Dashboard).

### 1.4 DeviceProfile

Die reine Funktion `buildDeviceProfile(caps, maxBitrate)` liegt in `shared/deviceProfile.ts`. Die Fähigkeiten kommen aus der App (`app/src/lib/deviceCaps.ts`, Arbeitspaket A):

| Fähigkeit | Quelle | Standard |
|---|---|---|
| `hevc` | `VideoDecoderProperties.isHEVCSupported() !== 'unsupported'` | true, wenn die Probe scheitert |
| `av1` | `VideoDecoderProperties.isCodecSupported('video/av01', 1920, 1080) === 'hardware'` | false |
| `ac3` (AC 3, E AC 3) | TV: an. Handy: Einstellung „Dolby Digital direkt abspielen“ | TV true, Handy false |
| `maxAudioChannels` | TV 6, Handy 2 | |
| `sidecarSubtitles` | true mit react-native-video, false mit expo-video | true |

Profil:
* `MaxStaticBitrate` und `MaxStreamingBitrate` = Einstellung (Standard 120 000 000).
* **DirectPlayProfiles:** Video, Container `mp4,m4v,mkv,webm,mov,ts`.
  * VideoCodec `h264,vp9`, dazu `hevc` und `av1` je nach Probe.
  * AudioCodec `aac,mp3,opus,vorbis,flac,pcm_s16le,pcm_s24le`, dazu `ac3,eac3` wenn `caps.ac3`.
  * DTS, TrueHD und ALAC nie, die Audiospur transkodiert der Server bei Video Stream Copy.
* **TranscodingProfiles:** Video, Context `Streaming`, Protocol `hls`, Container `ts`.
  * VideoCodec `h264`, mit `hevc` wenn `caps.hevc`. Sonst würde der Server HEVC Quellen voll transkodieren.
  * AudioCodec `aac,mp3`, plus `ac3,eac3` wenn `caps.ac3`.
  * `MaxAudioChannels` = String(caps.maxAudioChannels), `BreakOnNonKeyFrames: true`.
* **CodecProfiles:**
  * `h264`: `VideoBitDepth LessThanEqual 8`, `IsRequired false`.
  * `hevc`: `VideoRangeType NotEquals DOVI`, `IsRequired true`. Das sperrt nur reines DV Profil 5.
* **SubtitleProfiles:**
  * Mit `sidecarSubtitles`: `srt External`, `subrip External`, `vtt External`, `ttml External`.
  * Ohne `sidecarSubtitles`: alle Textformate `Encode`.
  * Immer: `pgssub Encode`, `dvdsub Encode`, `dvbsub Encode`, `vobsub Encode`.
  * **Keine Embed Profile**, kein `webvtt` Alias (Streamyfin #1892).

### 1.5 Direct Play oder Transcode

Ablauf in `startPlayback` (shared):
1. `POST /Items/{id}/PlaybackInfo?userId=` mit Body `{ UserId, DeviceProfile, MaxStreamingBitrate, StartTimeTicks, AudioStreamIndex, SubtitleStreamIndex, MediaSourceId, EnableDirectPlay, EnableDirectStream: true, EnableTranscoding: true, AllowVideoStreamCopy: true, AllowAudioStreamCopy: true, AutoOpenLiveStream: true }`.
2. `ErrorCode` gesetzt oder keine MediaSource: `PlaybackError`. Deutsche Texte: `NotAllowed` „Wiedergabe ist für dieses Konto nicht erlaubt“, `NoCompatibleStream` „Kein abspielbarer Stream gefunden“, `RateLimitExceeded` „Zu viele gleichzeitige Wiedergaben“.
3. MediaSource wählen: die mit `MediaSourceId`, sonst die erste.
4. Hat sie `IsRemote` und `Protocol === 'Http'`: `Path` direkt verwenden.
5. Gilt `SupportsDirectPlay` und ist `enableDirectPlay !== false`:
   * URL `server + /Videos/{id}/stream?static=true&container=&mediaSourceId=&tag={ETag}&playSessionId=&deviceId=&ApiKey=`.
   * `playMethod = 'DirectPlay'`.
6. Sonst bei vorhandener `TranscodingUrl`:
   * URL `server + TranscodingUrl`, die Query unverändert. `ApiKey` nur anhängen, wenn weder `ApiKey=` noch `api_key=` enthalten ist.
   * `playMethod = 'Transcode'`, `transcodeReasons` aus `TranscodeReasons=`.
7. Sonst `PlaybackError('NoCompatibleStream')`.
8. Header immer: `Authorization: authHeader(token)` plus `RequiredHttpHeaders`. Der Token steht zusätzlich als `ApiKey` in der URL, weil Sidecar und HLS Segmente die Header nicht sicher übernehmen.
9. **Zweite Stufe:** Meldet der Player im Direct Play einen Fehler, wird genau einmal neu ausgehandelt, mit `enableDirectPlay: false` an der aktuellen Position. Erst danach erscheint die Fehlermeldung „Wiedergabe fehlgeschlagen“.
10. **Neu aushandeln**, mit `StartTimeTicks = aktuelle Position`, neuer `PlaySessionId` und `stopTranscode(alt)`, wenn der alte Stream ein Transcode war:
    * Audiowechsel während eines Transcodes.
    * Wahl eines Untertitels mit `DeliveryMethod === 'Encode'`.
    * Wechsel von einem eingebrannten Untertitel weg.
    * Qualitätswechsel.
11. Startposition: Immer `source.startPosition` in ms setzen. Nach `onLoad` prüfen: Liegt die Position mehr als 5 s daneben, einmal seeken. Damit ist die ungeklärte Frage „HLS mit StartTimeTicks absolut oder relativ“ abgedeckt.

### 1.6 Untertitel

* Jellyfin liefert in PlaybackInfo jede Textspur mit `DeliveryMethod External` und `DeliveryUrl`. Eingebettete Spuren extrahiert der Server.
* Alle diese Spuren gehen beim Laden als `source.textTracks` an den Player:
  * `title: 'jf-<Index>'`, `language`.
  * `type` nach Endung: `.srt` = `application/x-subrip`, `.vtt` = `text/vtt`, `.ttml` = `application/ttml+xml`.
  * `uri` = `server + DeliveryUrl` (+ `ApiKey`), bei `IsExternalUrl` unverändert.
* Auswahl lokal ohne neue Aushandlung: `selectedTextTrack={{ type: 'title', value: 'jf-<Index>' }}`, „Aus“ = `{ type: 'disabled' }`. **Keine Zuordnung von Container Spurindizes nötig**, weil wir nie Embed anbieten.
* Bildbasierte Spuren (PGS, DVD, DVB) haben `Encode`. Ihre Wahl löst eine neue Aushandlung mit Burn In aus. Im Menü haben sie den Hinweis „wird eingebrannt“.
* Größe (SHOULD) über `subtitleStyle.fontSize` in drei Stufen: klein, mittel, groß.

### 1.7 Audio und Standardspuren

* Standard ist `DefaultAudioStreamIndex`/`DefaultSubtitleStreamIndex` der ersten PlaybackInfo Antwort. Der Server berechnet sie mit `userId` aus der Benutzerkonfiguration (Sprache, SubtitleMode).
* Gemerkte Wahl pro Serie oder Film (SHOULD) überschreibt das: lokal `bc.tracks.<seriesId|itemId>` mit Sprache von Audio und Untertitel, `null` = aus.
* Direct Play: `selectedAudioTrack={{ type: 'index', value: audioTrackPosition(source, index) }}`. Die Position zählt unter den nicht externen Audiospuren, sortiert nach `Index`.
* Transcode: neue Aushandlung mit `AudioStreamIndex`.

### 1.8 Fortschritt melden

* **Start:** `POST /Sessions/Playing` direkt nach dem ersten `onLoad` mit `PositionTicks = startTicks` und `IsPaused: false`. Nach einer neuen Aushandlung erneut für die neue `PlaySessionId`.
* **Heartbeat:** alle **10 s**, getrieben von `onProgress` (`progressUpdateInterval` 1000 ms) und nicht von `setInterval`. Android pausiert JS Timer im Hintergrund.
* **Sofort zusätzlich** bei Pause, Fortsetzen, Seek (nach dem Seek), Audio Wechsel und Untertitel Wechsel.
* **Stopped:** genau **einmal pro PlaySessionId**, beim Verlassen des Players, beim Wechsel zur nächsten Folge und bei einem Fehler (`Failed: true`).
  * Danach `DELETE /Videos/ActiveEncodings?deviceId=&playSessionId=`, wenn `playMethod === 'Transcode'`.
  * Danach `invalidateAfterPlayback`. Diese Funktion invalidiert Home Reihen, Item, Staffeln, Folgen und Next Up.
* **Hintergrund ohne PiP:** pausieren und Progress mit `IsPaused: true` melden.

### 1.9 Segmente und Up Next

* `GET /MediaSegments/{id}?includeSegmentTypes=Intro,Outro,Recap,Preview,Commercial`. Bei 404/501 eine leere Liste. Den Intro Skipper Fallback gibt es heute nicht.
* Aktion pro Typ in den Einstellungen: `off`, `button` oder `auto`.
  * Standard: Intro und Outro `button`, Recap und Preview `button`, Commercial `off`.
  * Auto Skip nur, wenn die Wiedergabe natürlich in das Segment läuft, nicht nach einem manuellen Seek hinein.
* **Up Next** (Folgen): Die Karte erscheint, sobald ein Outro beginnt oder die Restzeit unter 20 s fällt.
  * Countdown `autoPlayNextSeconds` (Standard 10).
  * Buttons „Jetzt abspielen“ und „Abbrechen“.
  * Automatisch nur, wenn sowohl `Configuration.EnableNextEpisodeAutoPlay` aus `/Users/Me` als auch die Einstellung `autoPlayNext` an sind.
  * „Abspann überspringen“ öffnet die Karte, wenn es eine nächste Folge gibt, sonst springt es ans Ende.

### 1.10 Einstellungen „Wiedergabe“

Gerätelokal (`bc.playback` über `shared/storage`), **nicht** im Jellyfin Profil synchronisiert, weil Handy und TV verschiedene Werte brauchen. Felder:
* `maxBitrate` (Auto = 120 Mbit/s, 40, 20, 8, 4)
* `allowAc3OnPhone`
* `resumeRewindSeconds` (0, 5, 10, 15, 30; Standard 0)
* `segmentActions`
* `autoPlayNext`, `autoPlayNextSeconds`
* `skipSeconds` (Standard 10)
* `subtitleSize`

### 1.11 Ausrichtung, Wachhalten, PiP

* `app.json` `orientation` wird `default` (config-tv entfernt `screenOrientation` ohnehin).
* Handy: Im Root Layout `ScreenOrientation.lockAsync(PORTRAIT_UP)`, wenn `!isTV`. Im Player Querformat (`LANDSCAPE`), beim Verlassen zurück auf Hochformat. TV: nie sperren.
* `expo-keep-awake` nur während der Player spielt. Bei Pause und beim Verlassen freigeben, sonst startet der TV Bildschirmschoner nie.
* PiP (SHOULD, nur Handy): Plugin `enableAndroidPictureInPicture`, `enterPictureInPictureOnLeave={!isTV && playing}`.

### 1.12 Web App

Wiedergabe, Home Reihen und Serienseiten sind heute **nur nativ**. Das ist eine bewusste Abweichung von der README Regel „jeder Screen hat ein Web Gegenstück“ und wird in `app/README.md` vermerkt. Der neue gemeinsame Code ist so geschrieben, dass das Web ihn später nutzen kann.

Pflicht: `npx tsc -b` im Hauptordner bleibt grün. `shared/` wird mit `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly` (kein `enum`, keine Parameter Properties) und `verbatimModuleSyntax` (`import type`) geprüft.

---

## 2. Funktionsumfang heute und Abnahmekriterien

„Code“ heißt prüfbar durch Lesen. „Smoke“ heißt prüfbar im Emulator Lauf, über den Mock Bericht (`/__report`, siehe 6.2) oder den uiautomator Dump. Die Texte in Anführungszeichen sind ein **Vertrag**: Der Treiber sucht genau diese Texte oder `accessibilityLabel`.

### 2.1 Arbeitspaket A: Player

| ID | Funktion | Klasse | Abnahme |
|---|---|---|---|
| A1 | Player Route `player/[id]` mit `VideoSurface` | MUST | Code: lädt `getPlaybackItem`, dann `startPlayback`. Nur `VideoSurface.tsx` importiert `react-native-video`. `controls={false}`, `viewType` SURFACE, auf TV `focusable={false}`. Die Route rendert `<PlayerScreen key={id} />`. Smoke: „Dune“ spielt. Bericht `playing ≥ 1`, `maxPositionTicks ≥ 50 000 000` nach 15 s, mindestens eine `GET /Videos/m0/stream` Anfrage mit Antwort 206, kein `FATAL` im Logcat |
| A2 | Transcode über HLS und Fallback nach Player Fehler | MUST | Code: Regeln 1.5 Punkt 5 bis 10. Smoke: „Her“ (nur Transcode) spielt, Bericht zeigt Anfragen auf `.m3u8` und `.ts`, `PlayMethod: 'Transcode'`, `DELETE /Videos/ActiveEncodings` nach dem Stoppen. „Sicario“ (kaputter Direct Stream) erzeugt eine zweite PlaybackInfo mit `EnableDirectPlay: false` und spielt danach |
| A3 | Fortsetzen ab Position, `start=resume\|beginning` | MUST | Code: `startTicksFor`. Smoke (TV): „Arrival“ (Position 20 s) erstes `Playing` mit `PositionTicks ≥ 190 000 000` |
| A4 | Fortschritt melden (1.8) | MUST | Code: Heartbeat aus `onProgress`, Stopped dedupliziert per `PlaySessionId`, `invalidateAfterPlayback`. Smoke: pro Sitzung `playing = 1`, `progress ≥ 2`, nach `KEYCODE_MEDIA_PAUSE` ein Progress mit `IsPaused: true`, nach Verlassen `stopped = 1`. Die Detailseite zeigt danach „Fortsetzen“ |
| A5 | Audiospur wählen (Panel „Audio“) | MUST | Code: Direct Play über `audioTrackPosition`, Transcode über neue Aushandlung |
| A6 | Untertitel wählen und aus (Panel „Untertitel“, erster Eintrag „Aus“) | MUST | Code: `textTracks` mit `title 'jf-<Index>'`, Encode Spuren handeln neu aus. Smoke (Handy): Nach Wahl „Deutsch“ kommt eine Anfrage auf `/Subtitles/2/` |
| A7 | Standardspuren vom Server, gemerkte Wahl pro Serie | MUST / SHOULD | Code: Startwerte aus `DefaultAudioStreamIndex`/`DefaultSubtitleStreamIndex`, danach `recallTracks` |
| A8 | Segmente überspringen | MUST | Code: `segmentAt`, Button Text aus `SEGMENT_LABEL`, Auto Skip nur bei natürlichem Eintritt. Smoke: „Intro überspringen“ ist im Bereich 2 bis 20 s sichtbar. Ein Tippen darauf führt zu einem Progress mit `PositionTicks ≥ 200 000 000` |
| A9 | Up Next mit Countdown | MUST | Code: 1.9, „Nächste Folge“, „Jetzt abspielen“, „Abbrechen“. Vor `router.replace(playHref(next))` wird Stopped gemeldet. Smoke (Handy): Folge e2 auf 50 s spulen, innerhalb von 25 s gibt es ein `Playing` für `e3` |
| A10 | Handy Bedienung | MUST | Code: Tippen blendet ein und aus, nach 4 s ausblenden, „Wiedergabe pausieren“/„Wiedergabe fortsetzen“, „10 Sekunden zurück“, „10 Sekunden vor“, Seek Leiste („Position“, ziehbar über das Responder System, ohne neues Paket), Zeit, Titel, „Player schließen“. Querformat Sperre, Keep Awake nur beim Spielen. Zurück schließt erst ein offenes Panel, dann den Player |
| A11 | TV Bedienung mit Fernbedienung | MUST | Code: `useRemoteKeys` und `useBackHandler`. Bei ausgeblendeter Bedienung: Links/Rechts ∓/± `skipSeconds` mit kleiner Positionsanzeige, Hoch/Runter/Select blendet ein (Fokus auf Play/Pause). Ist ein Skip Button sichtbar, gehört Select dem Button. Medientasten: playPause, play, pause, rewind/fastForward ∓/± 30 s, next/previous Folge. Langdruck Links/Rechts spult fortlaufend (SHOULD). Panels mit `FocusGuide` und Fokusfalle. Zurück: Panel, dann Bedienung, dann Player. Smoke (TV): `KEYCODE_MEDIA_PLAY_PAUSE` erzeugt `IsPaused: true`. `DPAD_RIGHT` bei ausgeblendeter Bedienung führt zu einem Progress mit +10 s. Zweimal `BACK` erzeugt `stopped = 1` |
| A12 | Karte „Wiedergabe“ in den Einstellungen (`PlaybackSettingsCard`) | MUST für Bitrate, Rest SHOULD | Code: liest und schreibt `getPlaybackSettings`/`savePlaybackSettings`. Smoke: Titel „Wiedergabe“ im Einstellungen Tab sichtbar |
| A13 | Qualität live wechseln (Panel „Qualität“) | SHOULD | Code: neue Aushandlung mit `maxBitrate` |
| A14 | Geschwindigkeit 0.5 bis 2 und Bildformat Fit, Crop, Stretch | SHOULD | Code: `rate`, `resizeMode` |
| A15 | Trickplay Vorschau über der Seek Leiste | SHOULD | Code: `trickplayFor` und `trickplayTile`, Ausschnitt per `expo-image` in einer View mit `overflow: hidden`. Smoke: Anfrage auf `/Trickplay/320/0.jpg` beim Ziehen |
| A16 | Kapitelmarken und Panel „Kapitel“ | SHOULD | Code: aus `item.Chapters` |
| A17 | PiP auf dem Handy | SHOULD | Code: 1.11 |
| A18 | „Statistiken“ (leicht) | SHOULD | Code: PlayMethod, Container, Codecs, Auflösung, Bitrate, Transcode Gründe |
| A19 | Uhrzeit und „Endet um“ | SHOULD | Code |
| A20 | „Schaust du noch?“ nach 3 automatischen Folgen | SHOULD | Code |
| A21 | Untertitel Größe | SHOULD | Code: `subtitleStyle` |

### 2.2 Arbeitspaket B: Browsing

| ID | Funktion | Klasse | Abnahme |
|---|---|---|---|
| B1 | Home Reihen | MUST | Code: Handy, Tab „Bibliothek“: Reihen „Weiterschauen“ (Querformat Karte mit Fortschrittsbalken), „Nächste Folgen“ und „Zuletzt hinzugefügt: {Bibliothek}“ je UserView (`movies`, `tvshows`) über dem bestehenden Raster. TV: `TvHome` mit denselben Reihen und Karten „Alle Filme“ und „Alle Serien“. Smoke Handy und TV: Texte „Weiterschauen“, „Nächste Folgen“, „Zuletzt hinzugefügt: Filme“ sichtbar |
| B2 | Bestehende Bibliothek intakt, neue Route `library/[type]` | MUST | Code: Filme/Serien, Sortierung, Endlos Laden und Pull to Refresh unverändert. Das Raster liegt als `LibraryGrid` vor und wird auch von `library/[type]` genutzt. Smoke: bestehender Treiber Ablauf grün |
| B3 | Play Aktionen auf der Detailseite | MUST | Code: „Abspielen“, oder bei Position > 0 und nicht gesehen „Fortsetzen“ plus „Von vorne“, Fortschrittsbalken. Navigation nur über `playHref`. Hinter `features.player`. Smoke: „Abspielen“ bei Dune öffnet den Player, nach der Rückkehr steht „Fortsetzen“ da |
| B4 | Gesehen und Favorit | MUST | Code: Buttons mit `accessibilityLabel` „Als gesehen markieren“/„Als ungesehen markieren“ und „Zu Favoriten hinzufügen“/„Aus Favoriten entfernen“, optimistisch, danach invalidieren. Smoke: Bericht `played` enthält die ID nach dem Tippen |
| B5 | Serienseite | MUST | Code: Staffelreihe (bestehend, Karte = Staffelname) führt zu `season/[id]`. Block „Nächste Folge“ mit „Abspielen“. „Abspielen“ der Serie startet die Next Up Folge, sonst die erste Folge |
| B6 | Staffelseite `season/[id]` | MUST | Code: Folgenliste mit Nummer, Titel, Laufzeit, zwei Zeilen Inhalt, Haken für gesehen, Fortschritt. Tippen öffnet die Folge, Icon `accessibilityLabel` „Folge {n} abspielen“. Smoke: „Staffel 1“ zeigt drei Folgentitel |
| B7 | Folgen Detailseite (`item/[id]` mit `Type === 'Episode'`) | MUST | Code: Serienname, „S1:F2“, Backdrop der Serie, Play Aktionen, Links zur vorherigen und nächsten Folge (SHOULD) |
| B8 | Suche um „Folgen“ und „Personen“ erweitern | MUST | Code: zusätzliche Abschnitte mit `getItems(type 'Episode')` und `searchPeople` |
| B9 | TV Varianten von Karten, Raster und Details | MUST | Code: Karten über `Focusable`, auf TV `FlatList` mit `removeClippedSubviews={false}` statt FlashList, `BackButton` auf TV ausgeblendet, genau ein `preferredFocus` je gepushtem Screen (Detail: Play Button), `useFocusMemory` auf Home und Raster. Smoke (TV): Auf Home ist ein Knoten `focused="true"`. Nach `BACK` aus der Detailseite ist die zuvor geöffnete Karte fokussiert |
| B10 | „Ähnliche Titel“ | SHOULD | Code: `getSimilar` |
| B11 | Personenseite `person/[id]` | SHOULD | Code: `getItem` und `getPersonItems`, Besetzung verlinkt dorthin |
| B12 | „Trailer“ | SHOULD | Code: `RemoteTrailers[0].Url` per `Linking` |
| B13 | Version wählen bei mehreren MediaSources | SHOULD | Code: übergibt `mediaSourceId` an `playHref` |
| B14 | TV Hero oben auf Home | SHOULD | Code: erstes Weiterschauen Element, sonst neuester Film, Buttons „Fortsetzen“/„Abspielen“ und „Details“ |
| B15 | Statusfilter im Raster: Alle, Ungesehen, Gesehen, Favoriten | SHOULD | Code: `filters` in `getItems` |
| B16 | Anti Spoiler (unscharfe Bilder ungesehener Folgen) | SHOULD, zuletzt | Code: `blur` Parameter |

### 2.3 Arbeitspaket C: TV, Login und CI

| ID | Funktion | Klasse | Abnahme |
|---|---|---|---|
| C1 | TV Navigation | MUST | Code: `(tabs)/_layout.tsx` rendert auf TV statt `NativeTabs` die Headless Tabs aus `expo-router/ui` (`Tabs`, `TabList`, `TabTrigger`, `TabSlot`). Links steht eine Seitenleiste mit „Start“, „Suche“, „Filme“, „Serien“, „Ordner“, „Einstellungen“; „Filme“ und „Serien“ führen per `router.push(libraryHref(...))`. Auslosung ist auf TV versteckt. Auf dem Handy bleibt `NativeTabs` unverändert. Smoke (TV): Die Labels sind sichtbar, `DPAD_LEFT` aus dem Inhalt fokussiert die Seitenleiste |
| C2 | Zurück auf TV | MUST | Code: Auf einem Tab außer Start führt Zurück nach Start. Auf Start erscheint der Hinweis „Zum Beenden erneut Zurück drücken“, ein zweites Zurück innerhalb von 2 s beendet die App. Smoke (TV): Nach einem `BACK` auf Home läuft der Prozess noch |
| C3 | Quick Connect Login (TV und Handy) | MUST | Code: Das Formular bleibt (drei Felder, „Anmelden“ als letzter Button). Neu ist der Button „Mit Quick Connect anmelden“. Ablauf: Server eintragen, `quickConnectEnabled`, dann `initiateQuickConnect`. Der Code wird groß angezeigt, Hinweistext dazu, Abfrage jede Sekunde bis 10 min, dann `loginWithQuickConnect` und `signIn`. Ist Quick Connect aus: „Quick Connect ist auf dem Server ausgeschaltet.“ Auf TV liegt der bevorzugte Fokus auf dem Serverfeld. Smoke (TV): Anmeldung mit Code „482913“ führt zur Home Ansicht |
| C4 | Karte „TV verbinden“ in den Einstellungen (Handy) | SHOULD | Code: Eingabe des Codes, „Verbinden“ ruft `authorizeQuickConnect`, Toast „TV verbunden“. Smoke (Handy): Bericht `authorizedCodes` enthält den Code |
| C5 | Banner, Manifest Prüfung | MUST | Code: `assets/images/tv-banner.png` mit 320×180. Smoke Build Job: `aapt dump badging` zeigt `leanback-launchable-activity`, `launchable-activity` und `uses-feature-not-required: name='android.hardware.touchscreen'` |
| C6 | Smoke Workflow mit drei Jobs (6.1), Mock (6.2), Treiber (6.3, 6.4), Prüfungen mit Exit Code | MUST | Code und ein grüner Lauf auf dem Arbeitsbranch |
| C7 | `@/lib/tv.tsx` pflegen, Fallback Implementierung bei Bedarf | MUST, falls tvos fällt | Code: Exporte unverändert |
| C8 | Einklappbare Seitenleiste (nur Icons, klappt mit Fokus auf) | SHOULD | Code |

### 2.4 Orchestrator

| ID | Funktion | Abnahme |
|---|---|---|
| O1 | `android.yml`: ABIs `arm64-v8a,armeabi-v7a`, Badging Prüfung, Release Text für TV | Badging zeigt `native-code: 'arm64-v8a' 'armeabi-v7a'` und `leanback-launchable-activity` |
| O2 | Phase 0 vollständig (Abschnitt 3 und 4), alle Prüfbefehle grün | 3.4 |

---

## 3. Phase 0: Pakete und Konfiguration (Orchestrator, vor den Arbeitspaketen)

Die Arbeitspakete fassen `package.json`, `package-lock.json`, `app.json`, `metro.config.js`, `tsconfig.json` und `android.yml` **nie** an.

### 3.1 Pakete (in `app/`)

```bash
npx expo install react-native-video@6.19.3 expo-keep-awake expo-screen-orientation
npx expo install @react-native-tvos/config-tv            # ergibt 0.1.7
npx expo install "react-native@npm:react-native-tvos@0.88.1-0"
```
* `expo-keep-awake` ~58.0.4 und `expo-screen-orientation` ~58.0.4 laut `bundledNativeModules.json` von SDK 58.
* `react-native-video` exakt `6.19.3` in `package.json`, ohne `^`.
* Lehnt `npx expo install` den npm Alias ab, ist das die **einzige** dokumentierte Ausnahme: In `package.json` `"react-native": "npm:react-native-tvos@0.88.1-0"` eintragen, danach `npm install`, und das in `app/README.md` vermerken.
* `app/package.json` ergänzen: `"expo": { "install": { "exclude": ["react-native"] } }`.
* Kontrolle: `node -p "require('react-native/package.json').name + ' ' + require('react-native/package.json').version"` ergibt `react-native-tvos 0.88.1-0`.

### 3.2 `app.json`

* `"orientation": "default"`.
* Plugins ergänzen (Reihenfolge: nach `expo-router`):
```json
["react-native-video", { "enableAndroidPictureInPicture": true, "enableNotificationControls": false, "enableBackgroundAudio": false }],
["@react-native-tvos/config-tv", { "isTV": true, "androidTVBanner": "./assets/images/tv-banner.png" }]
```
  Trägt `npx expo install` für `expo-screen-orientation` selbst ein Plugin ein, bleibt es stehen.
* `expo-build-properties` → `android.extraProguardRules`: an den bestehenden String anhängen (mit `\n` getrennt):
```
# react-native-video und Media3: Renderer, Extractor und MediaSource Factories werden teils per Reflection geladen.
-keep class com.brentvatne.** { *; }
-keep class androidx.media3.** { *; }
-dontwarn androidx.media3.**
-dontwarn com.google.ads.interactivemedia.**
```
  Das kostet etwas APK Größe und vermeidet einen zweiten R8 Vorfall wie bei WorkManager. Der Smoke Test läuft mit dem Release Build und würde fehlende Klassen zeigen.
* Banner erzeugen: `assets/images/tv-banner.png`, 320×180, Hintergrund `#110d0a`, links das App Icon, rechts „BurrowCinema“ in `#f3bd5c`. Zum Beispiel mit ImageMagick `convert` oder Python Pillow, beide sind lokal vorhanden.

### 3.3 CI `android.yml`

* `./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a --no-daemon`, den Kommentar anpassen (viele TV Boxen sind 32 Bit).
* Neuer Schritt nach dem Build: `aapt dump badging` (neueste build-tools unter `$ANDROID_HOME/build-tools`) auf das APK.
  * Fehlschlag, wenn `armeabi-v7a`, `arm64-v8a` oder `leanback-launchable-activity` fehlen.
  * Die APK Größe ausgeben.
* Release Text ergänzen:
  * „Läuft auf Handys und Android TV (64 und 32 Bit ARM).“
  * „Auf dem TV: APK mit einer Downloader App oder per `adb install` installieren. BurrowCinema erscheint im TV Launcher. Anmeldung per Quick Connect: Code am TV anzeigen und in Jellyfin (Web, Quick Connect) oder in BurrowCinema auf dem Handy unter Einstellungen, TV verbinden, bestätigen.“

### 3.4 Prüfbefehle (Gate für Phase 0 und jeden Checkpoint)

```bash
cd app && npx tsc --noEmit
cd app && npx expo export --platform android --output-dir /tmp/bc-export-<name>
cd .. && npx tsc -b                     # Web App inklusive shared/
cd app && npx expo prebuild --platform android --no-install && \
  grep -nE "LEANBACK_LAUNCHER|touchscreen|leanback|banner|supportsPictureInPicture|screenOrientation" android/app/src/main/AndroidManifest.xml
```
Erwartung: `LEANBACK_LAUNCHER`, `touchscreen required=false`, `leanback required=false`, `android:banner` und `supportsPictureInPicture="true"` sind vorhanden, `screenOrientation` fehlt. `android/` ist in `.gitignore`.

Ein lokaler Gradle Build ist nicht möglich (kein Android SDK), APK und Emulator laufen nur in CI.

### 3.5 Weitere Phase 0 Änderungen am App Code (danach eingefroren, Änderungen nur über den Orchestrator)

| Datei | Änderung |
|---|---|
| `app/src/lib/tv.tsx` | neu, Exporte siehe 4.5 (tvos Implementierung) |
| `app/src/lib/routes.ts` | neu, siehe 4.6 |
| `app/src/lib/queryKeys.ts` | neu, siehe 4.6 |
| `app/src/lib/features.ts` | neu: `export const features = { player: true, tvShell: true, quickConnect: true }` als Not Aus für die Nacht |
| `app/src/lib/haptics.ts` | alle Funktionen No Op, wenn `isTV` |
| `app/src/lib/platform.ts` | `deviceName` auf TV `BurrowCinema Android TV` |
| `app/src/lib/queryClient.ts` | `buster` auf `'0.0.2'`, weil Items jetzt `UserData` und weitere Felder brauchen |
| `app/src/components/ui/button.tsx` | nutzt intern `Focusable`, also Fokusring auf TV und auf dem Handy unverändert |
| `app/src/app/_layout.tsx` | neue Stack Screens im geschützten Bereich: `player/[id]` (`animation: 'fade'`, `gestureEnabled: false`, `statusBarHidden: true`, `navigationBarHidden: true`), `season/[id]`, `person/[id]`, `library/[type]` (alle `slide_from_right`). Hochformat Sperre auf dem Handy. `useDrawNotifications(ready && !!session && !isTV)` |
| Stubs | `app/src/app/player/[id].tsx`, `season/[id].tsx`, `person/[id].tsx`, `library/[type].tsx` (einfache Platzhalter mit `DetailMessage`), `app/src/components/player/PlaybackSettingsCard.tsx` (`export function PlaybackSettingsCard() { return null }`) |

---

## 4. Gemeinsamer Code zuerst

Der Orchestrator schreibt diesen Code in Phase 0b **vollständig**, nicht als Stub. Es sind reine Funktionen und REST Aufrufe, insgesamt etwa 500 Zeilen. Optional übernimmt das ein einzelner Agent, der **vor** den Arbeitspaketen fertig sein muss.

Danach gehen die Dateien an Besitzer über: `shared/playback.ts` und `shared/deviceProfile.ts` an A, `shared/jellyfin.ts` an B, `shared/quickConnect.ts` und `app/src/lib/tv.tsx` an C. Signaturen dürfen nur **additiv** geändert werden.

Regeln für `shared/`: keine Browser oder RN APIs, kein `URLSearchParams` (vorhandenes `query()` nutzen), kein `enum`, `import type` für Typen.

### 4.1 `shared/jellyfin.ts` (Ergänzungen)

```ts
export function deviceId(): string            // bisher privat, jetzt exportiert

export type UserData = {
  PlaybackPositionTicks?: number; PlayedPercentage?: number; Played?: boolean; PlayCount?: number
  IsFavorite?: boolean; LastPlayedDate?: string; UnplayedItemCount?: number
}
export type MediaStreamType = 'Video' | 'Audio' | 'Subtitle' | 'EmbeddedImage' | 'Data' | 'Lyric'
export type SubtitleDeliveryMethod = 'Encode' | 'Embed' | 'External' | 'Hls' | 'Drop'
export type MediaStream = {
  Index: number; Type: MediaStreamType; Codec?: string; Language?: string; Title?: string; DisplayTitle?: string
  IsDefault?: boolean; IsForced?: boolean; IsExternal?: boolean; IsTextSubtitleStream?: boolean
  SupportsExternalStream?: boolean; DeliveryMethod?: SubtitleDeliveryMethod; DeliveryUrl?: string; IsExternalUrl?: boolean
  Width?: number; Height?: number; BitRate?: number; Channels?: number; ChannelLayout?: string
  VideoRange?: string; VideoRangeType?: string; RealFrameRate?: number; Profile?: string
}
export type MediaSourceInfo = {
  Id: string; Name?: string; Path?: string; Protocol?: string; IsRemote?: boolean; Container?: string
  Size?: number; Bitrate?: number; RunTimeTicks?: number; ETag?: string
  SupportsDirectPlay?: boolean; SupportsDirectStream?: boolean; SupportsTranscoding?: boolean
  TranscodingUrl?: string; TranscodingSubProtocol?: string; TranscodingContainer?: string
  RequiredHttpHeaders?: Record<string, string>; MediaStreams?: MediaStream[]
  DefaultAudioStreamIndex?: number; DefaultSubtitleStreamIndex?: number; HasSegments?: boolean
}
export type ChapterInfo = { StartPositionTicks: number; Name?: string; ImageTag?: string }
export type TrickplayInfo = { Width: number; Height: number; TileWidth: number; TileHeight: number; ThumbnailCount: number; Interval: number; Bandwidth?: number }

// BaseItem bekommt zusätzlich (alle optional):
//   UserData, SeriesId, SeriesName, SeasonId, SeasonName, IndexNumber, ParentIndexNumber, PremiereDate,
//   SeriesPrimaryImageTag, ParentBackdropItemId, ParentBackdropImageTags, ParentThumbItemId, ParentThumbImageTag,
//   ParentLogoItemId, ParentLogoImageTag, CollectionType, MediaType, LocationType, PrimaryImageAspectRatio,
//   MediaSources?: MediaSourceInfo[], Chapters?: ChapterInfo[],
//   Trickplay?: Record<string, Record<string, TrickplayInfo>>, RemoteTrailers?: { Url: string; Name?: string }[]

export type UserView = BaseItem & { CollectionType?: string }
export type UserConfiguration = {
  AudioLanguagePreference?: string; PlayDefaultAudioTrack?: boolean; SubtitleLanguagePreference?: string
  SubtitleMode?: 'Default' | 'Always' | 'OnlyForced' | 'None' | 'Smart'
  EnableNextEpisodeAutoPlay?: boolean; RememberAudioSelections?: boolean; RememberSubtitleSelections?: boolean
}
export type Me = { Id: string; Name: string; Configuration?: UserConfiguration }
export type ItemFilter = 'IsPlayed' | 'IsUnplayed' | 'IsResumable' | 'IsFavorite'

// getItems: opts additiv um parentId?: string, filters?: ItemFilter, personIds?: string erweitert
// getItem: DETAIL_FIELDS zusätzlich MediaSources,RemoteTrailers (UserData kommt standardmäßig mit)

export function getMe(s: Session): Promise<Me>                                                    // GET /Users/Me
export function getUserViews(s: Session): Promise<UserView[]>                                     // GET /UserViews?userId=
export function getResume(s: Session, opts?: { limit?: number; parentId?: string }): Promise<BaseItem[]>
//   GET /UserItems/Resume?userId=&limit=20&mediaTypes=Video&enableTotalRecordCount=false&imageTypeLimit=1&fields=PrimaryImageAspectRatio
export function getNextUp(s: Session, opts?: { limit?: number; seriesId?: string }): Promise<BaseItem[]>
//   GET /Shows/NextUp?userId=&limit=20&enableResumable=false&imageTypeLimit=1
export function getLatest(s: Session, parentId: string, limit?: number): Promise<BaseItem[]>       // GET /Items/Latest (Antwort ist ein Array)
export function getEpisodes(s: Session, seriesId: string, seasonId: string): Promise<BaseItem[]>   // GET /Shows/{id}/Episodes?seasonId=&fields=Overview
export function getAdjacentEpisodes(s: Session, seriesId: string, episodeId: string): Promise<{ previous?: BaseItem; next?: BaseItem }>
//   GET /Shows/{id}/Episodes?adjacentTo=&limit=3
export function getSimilar(s: Session, id: string, limit?: number): Promise<BaseItem[]>           // GET /Items/{id}/Similar
export function searchPeople(s: Session, term: string, limit?: number): Promise<BaseItem[]>       // GET /Persons?searchTerm=
export function getPersonItems(s: Session, personId: string): Promise<BaseItem[]>                 // /Items?personIds=&recursive=true&includeItemTypes=Movie,Series
export function getPlaybackItem(s: Session, id: string): Promise<BaseItem>
//   wie getItem, Fields zusätzlich MediaSources,MediaStreams,Chapters,Trickplay
export function setPlayed(s: Session, id: string, played: boolean): Promise<UserData>             // POST/DELETE /UserPlayedItems/{id}?userId=
export function setFavorite(s: Session, id: string, favorite: boolean): Promise<UserData>         // POST/DELETE /UserFavoriteItems/{id}?userId=
export function thumbUrl(s: Session, item: BaseItem, width?: number): string | undefined
//   Querformat: Folge Primary, sonst ParentThumb, sonst Backdrop (eigener oder ParentBackdrop)
```

### 4.2 `shared/deviceProfile.ts`

```ts
export type DeviceCaps = { isTV: boolean; hevc: boolean; av1: boolean; ac3: boolean; maxAudioChannels: number; sidecarSubtitles: boolean }
export const DEFAULT_CAPS: DeviceCaps   // { isTV: false, hevc: true, av1: false, ac3: false, maxAudioChannels: 2, sidecarSubtitles: true }
export type DeviceProfile = Record<string, unknown>
export function buildDeviceProfile(caps: DeviceCaps, maxBitrate: number): DeviceProfile   // Inhalt siehe 1.4
```

### 4.3 `shared/playback.ts`

```ts
import type { BaseItem, MediaSourceInfo, MediaStream, Session, TrickplayInfo } from './jellyfin'
import type { DeviceCaps } from './deviceProfile'

export const TICKS_PER_SECOND = 10_000_000
export const ticksToSeconds: (ticks?: number) => number
export const secondsToTicks: (seconds: number) => number          // gerundet
export const PROGRESS_INTERVAL_MS = 10_000

export type PlayMethod = 'DirectPlay' | 'DirectStream' | 'Transcode'
export type PlaybackRequest = {
  itemId: string; mediaSourceId?: string; startTicks?: number
  audioStreamIndex?: number; subtitleStreamIndex?: number   // -1 = aus
  maxBitrate: number; caps: DeviceCaps; enableDirectPlay?: boolean
}
export type PlaybackInfoResponse = { PlaySessionId: string; MediaSources: MediaSourceInfo[]; ErrorCode?: string }
export type SubtitleTrack = {
  streamIndex: number; title: string /* 'jf-<Index>' */; label: string; language?: string; uri: string
  mimeType: 'application/x-subrip' | 'text/vtt' | 'application/ttml+xml'
}
export type ResolvedPlayback = {
  url: string; headers: Record<string, string>; playMethod: PlayMethod; playSessionId: string
  mediaSource: MediaSourceInfo; audioStreams: MediaStream[]; subtitleStreams: MediaStream[]
  externalSubtitles: SubtitleTrack[]; audioStreamIndex?: number; subtitleStreamIndex: number
  transcodeReasons: string[]; startTicks: number
}
export class PlaybackError extends Error { code: string; constructor(code: string, message?: string) }

export function getPlaybackInfo(s: Session, req: PlaybackRequest): Promise<PlaybackInfoResponse>
export function resolvePlayback(s: Session, info: PlaybackInfoResponse, req: PlaybackRequest): ResolvedPlayback  // wirft PlaybackError
export function startPlayback(s: Session, req: PlaybackRequest): Promise<ResolvedPlayback>
export function audioTrackPosition(source: MediaSourceInfo, streamIndex: number): number
export function needsRenegotiation(current: ResolvedPlayback, change: { audioStreamIndex?: number; subtitleStreamIndex?: number; maxBitrate?: number }): boolean
export function streamLabel(stream: MediaStream): string        // DisplayTitle ?? Language ?? `Spur ${Index}`

export type ProgressReport = {
  itemId: string; mediaSourceId: string; playSessionId: string; positionTicks: number; isPaused: boolean
  isMuted?: boolean; playMethod: PlayMethod; audioStreamIndex?: number; subtitleStreamIndex?: number; canSeek?: boolean
}
export function reportPlaybackStart(s: Session, r: ProgressReport): Promise<void>      // POST /Sessions/Playing
export function reportPlaybackProgress(s: Session, r: ProgressReport): Promise<void>   // POST /Sessions/Playing/Progress
export function reportPlaybackStopped(s: Session, r: { itemId: string; mediaSourceId: string; playSessionId: string; positionTicks: number; failed?: boolean }): Promise<void>
export function stopTranscode(s: Session, playSessionId: string): Promise<void>        // DELETE /Videos/ActiveEncodings?deviceId=&playSessionId=

export type MediaSegmentType = 'Intro' | 'Outro' | 'Recap' | 'Preview' | 'Commercial'
export type MediaSegment = { Id: string; ItemId: string; Type: MediaSegmentType | 'Unknown'; StartTicks: number; EndTicks: number }
export const SEGMENT_LABEL: Record<MediaSegmentType, string>
//   Intro 'Intro überspringen', Outro 'Abspann überspringen', Recap 'Rückblick überspringen',
//   Preview 'Vorschau überspringen', Commercial 'Werbung überspringen'
export function getMediaSegments(s: Session, itemId: string): Promise<MediaSegment[]>   // 404/501 ergibt []
export function segmentAt(segments: MediaSegment[], positionTicks: number): MediaSegment | undefined

export function trickplayFor(item: BaseItem, mediaSourceId: string, preferredWidth?: number): TrickplayInfo | undefined
export type TrickplayTile = { url: string; x: number; y: number; width: number; height: number; sheetWidth: number; sheetHeight: number }
export function trickplayTile(s: Session, itemId: string, mediaSourceId: string, info: TrickplayInfo, positionMs: number): TrickplayTile
//   Kachel = floor(ms / Interval), Blatt = floor(Kachel / (TileWidth*TileHeight)),
//   URL /Videos/{id}/Trickplay/{Width}/{Blatt}.jpg?mediaSourceId=&ApiKey=

export function shouldOfferResume(item: BaseItem): boolean      // Position > 0, nicht gesehen, unter 95 %
export function startTicksFor(item: BaseItem, mode: 'resume' | 'beginning', rewindSeconds: number): number

export type SegmentAction = 'off' | 'button' | 'auto'
export type PlaybackSettings = {
  maxBitrate: number; allowAc3OnPhone: boolean; resumeRewindSeconds: number
  segmentActions: Record<MediaSegmentType, SegmentAction>; autoPlayNext: boolean; autoPlayNextSeconds: number
  skipSeconds: number; subtitleSize: 'small' | 'medium' | 'large'
}
export const DEFAULT_PLAYBACK_SETTINGS: PlaybackSettings
export const BITRATE_OPTIONS: { value: number; label: string }[]
export function getPlaybackSettings(): PlaybackSettings                                  // load('bc.playback') + Standardwerte
export function savePlaybackSettings(change: Partial<PlaybackSettings>): PlaybackSettings

export type TrackChoice = { audioLanguage?: string; subtitleLanguage?: string | null }  // null = aus
export function recallTracks(key: string): TrackChoice | undefined
export function rememberTracks(key: string, choice: TrackChoice): void
export function applyTrackChoice(source: MediaSourceInfo, choice: TrackChoice | undefined): { audioStreamIndex?: number; subtitleStreamIndex?: number }
```

### 4.4 `shared/quickConnect.ts`

```ts
export type QuickConnectCode = { code: string; secret: string }
export function quickConnectEnabled(server: string): Promise<boolean>                     // GET /QuickConnect/Enabled
export function initiateQuickConnect(server: string): Promise<QuickConnectCode>           // POST /QuickConnect/Initiate, Header ohne Token
export function isQuickConnectAuthorized(server: string, secret: string): Promise<boolean> // GET /QuickConnect/Connect?secret=
export function loginWithQuickConnect(server: string, secret: string): Promise<Session>    // POST /Users/AuthenticateWithQuickConnect { Secret }
export function authorizeQuickConnect(s: Session, code: string): Promise<void>            // POST /QuickConnect/Authorize?code=
```
`server` wird mit `normalizeUrl` normalisiert. Die Antwort wird wie bei `login()` in eine `Session` umgewandelt (gemeinsamer Helfer in `jellyfin.ts`, exportiert als `sessionFromAuth(server, data)`).

### 4.5 `app/src/lib/tv.tsx`

```ts
export const isTV: boolean
export const TV_FOCUS_SCALE = 1.06
export type RemoteKey = 'up' | 'down' | 'left' | 'right' | 'select' | 'playPause' | 'play' | 'pause'
  | 'rewind' | 'fastForward' | 'next' | 'previous' | 'menu' | 'info'
export type RemoteEvent = { key: RemoteKey; action: 'down' | 'up' | 'long' }
export function useRemoteKeys(handler: (e: RemoteEvent) => void, enabled?: boolean): void
//   tvos: useTVEventHandler (long* Events ergeben action 'long'). Fallback: DeviceEventEmitter 'onHWKeyEvent'
export function useBackHandler(handler: () => boolean, enabled?: boolean): void         // BackHandler, true = verbraucht
export type FocusableProps = Omit<PressableProps, 'children' | 'style'> & {
  preferredFocus?: boolean; className?: string; focusedClassName?: string; style?: StyleProp<ViewStyle>
  children: ReactNode | ((state: { focused: boolean }) => ReactNode)
}
export const Focusable: (props: FocusableProps & { ref?: Ref<View> }) => ReactElement
//   Handy: verhält sich wie Pressable (active:opacity-80). TV: Fokusring (Rand primary) und Skalierung TV_FOCUS_SCALE, keine Haptik
export function FocusGuide(props: {
  children: ReactNode; className?: string; style?: StyleProp<ViewStyle>; autoFocus?: boolean
  trapFocusLeft?: boolean; trapFocusRight?: boolean; trapFocusUp?: boolean; trapFocusDown?: boolean
  destinations?: (View | null)[]
}): ReactElement                                                                         // tvos: TVFocusGuideView, Fallback: View
export function useFocusMemory(screenKey: string): { preferred: (itemKey: string) => boolean; remember: (itemKey: string) => void }
//   merkt die zuletzt gewählte Karte pro Screen. Bei erneutem Fokus des Screens liefert preferred(key) true, das setzt hasTVPreferredFocus
```

### 4.6 `app/src/lib/routes.ts` und `app/src/lib/queryKeys.ts`

```ts
// routes.ts
export type PlayParams = { start?: 'resume' | 'beginning'; mediaSourceId?: string; audio?: number; sub?: number }
export function playHref(itemId: string, params?: PlayParams): Href      // /player/{id}?start=...
export const itemHref: (id: string) => Href                              // /item/{id}
export const seasonHref: (seasonId: string, seriesId: string) => Href    // /season/{seasonId}?seriesId=
export const personHref: (personId: string) => Href                      // /person/{id}
export const libraryHref: (type: 'Movie' | 'Series') => Href             // /library/{type}

// queryKeys.ts
export const qk: {
  item(id: string): readonly ['item', string]
  playbackItem(id: string): readonly ['playback-item', string]
  seasons(seriesId: string): readonly ['seasons', string]
  episodes(seasonId: string): readonly ['episodes', string]
  nextUpSeries(seriesId: string): readonly ['next-up', string]
  similar(id: string): readonly ['similar', string]
  me: readonly ['me']
  homeResume: readonly ['home', 'resume']; homeNextUp: readonly ['home', 'next-up']
  homeViews: readonly ['home', 'views']; homeLatest(viewId: string): readonly ['home', 'latest', string]
}
export function invalidateAfterPlayback(client: QueryClient, item: { Id: string; SeriesId?: string; SeasonId?: string }): Promise<void>
```
`['item', id]` und `['seasons', id]` entsprechen den heutigen Schlüsseln.

---

## 5. Arbeitspakete (parallel, gleicher Arbeitsbaum)

Gemeinsame Regeln:
* Nur eigene Dateien anfassen.
* Keine Pakete installieren, keine Konfiguration ändern. Bedarf geht an den Orchestrator.
* **Nicht committen:** Der Orchestrator committet an Checkpoints.
* Eigene Dateien müssen jederzeit typprüfbar sein. `npx tsc --noEmit` Fehler in fremden Dateien ignorieren und melden.
* Vor dem Abschluss `npx expo export --platform android --output-dir /tmp/bc-<paket>` ausführen.
* `app/README.md` (Konventionen) und `app/AGENTS.md` lesen (Expo SDK 58 Doku statt Erinnerung).
* TV APIs nur aus `@/lib/tv`.
* Sheets (`Modal`) nicht im Player und nicht in neuen TV Abläufen verwenden. Bestehende Sheets bleiben.
* Navigation zum Player nur über `playHref`.

### 5.1 Arbeitspaket A: Player und Wiedergabe (etwa 2 h 15 min, MUST etwa 1 h 30 min)

**Dateien (nur diese):**
* `app/src/app/player/[id].tsx`
* `app/src/components/player/**`, neu: `VideoSurface.tsx`, `PlayerScreen.tsx`, `PhoneControls.tsx`, `TvControls.tsx`, `SeekBar.tsx`, `TrackPanel.tsx`, `SkipSegmentButton.tsx`, `UpNextCard.tsx`, `TrickplayPreview.tsx`, `StatsOverlay.tsx`, `StillWatching.tsx`. Dazu `PlaybackSettingsCard.tsx` (Stub ersetzen).
* `app/src/lib/player/**`: `usePlaybackSession.ts` (Aushandlung, Neuaushandlung, Fallback), `useProgressReporter.ts`, `useSegments.ts`, `useUpNext.ts`.
* `app/src/lib/deviceCaps.ts`
* `shared/playback.ts`, `shared/deviceProfile.ts` (additiv)

**Schnittstellen:**
* Liest die Route Parameter aus `PlayParams`.
* Ruft `invalidateAfterPlayback`.
* Die Einstellungen Karte bindet C ein.
* `VideoSurface` hat eine eigene, bibliotheksfreie Prop Schnittstelle: `uri`, `headers`, `startSeconds`, `textTracks`, `selectedSubtitleTitle`, `audioTrackPosition`, `paused`, `rate`, `resizeMode`, `subtitleSize`, `pip`, `onLoad`, `onProgress`, `onPlayingChange`, `onBuffering`, `onEnd`, `onError` sowie ein Ref mit `seek(seconds)`. So ist ein Wechsel auf `expo-video` ein Austausch einer Datei.

**Reihenfolge:**
1. A1, A4, A10 (Direct Play spielt, meldet, Handy Bedienung).
2. A2, A3, A5, A6, A7.
3. A8, A9, A11.
4. A12.
5. SHOULD in der Reihenfolge A19, A14, A13, A15, A16, A17, A18, A21, A20.

### 5.2 Arbeitspaket B: Browsing (etwa 2 h)

**Dateien (nur diese):**
* `app/src/app/(tabs)/index.tsx`, `app/src/app/(tabs)/search.tsx`
* `app/src/app/item/[id].tsx`, `app/src/app/season/[id].tsx`, `app/src/app/person/[id].tsx`, `app/src/app/library/[type].tsx` (Stubs ersetzen)
* `app/src/components/PosterCard.tsx`
* `app/src/components/media/**`: bestehende Dateien plus neu `LibraryGrid.tsx`, `PlayActions.tsx`, `WatchedButton.tsx`, `FavoriteButton.tsx`, `EpisodeList.tsx`, `MediaCard.tsx`, `VersionPicker.tsx`
* `app/src/components/home/**`: neu `HomeRows.tsx`, `TvHome.tsx`, `TvHero.tsx`
* `shared/jellyfin.ts` (additiv)

**Pflicht:**
* `DetailLayout` bleibt rückwärtskompatibel, weil `external/[source]/[id].tsx` es unverändert nutzt.
* `AddToFolder` und `RequestButton` funktionieren weiter.
* Auf TV fällt der Abstand der Seitenleiste C zu. B rendert Inhalt ohne eigene Seitenleiste.

**Schnittstellen:**
* `playHref` für alle Play Buttons (hinter `features.player`).
* `qk` für Query Schlüssel.
* `Focusable`, `useFocusMemory` und `FocusGuide` für TV.
* `index.tsx` wählt `isTV ? <TvHome/> : <Handy Home mit Reihen über LibraryGrid/>`.

**Reihenfolge:**
1. B3, B4 (Einstieg in die Wiedergabe).
2. B1, B2.
3. B5, B6, B7.
4. B9.
5. B8.
6. SHOULD in der Reihenfolge B14, B10, B13, B12, B11, B15, B16.

### 5.3 Arbeitspaket C: Android TV, Login und CI (etwa 2 h)

**Dateien (nur diese):**
* `app/src/app/(tabs)/_layout.tsx`
* `app/src/components/tv/**`: neu `TvTabs.tsx`, `TvSidebar.tsx`
* `app/src/app/login.tsx`, `app/src/components/login/**`: neu `QuickConnectPanel.tsx`
* `app/src/app/(tabs)/settings.tsx`, `app/src/components/settings/TvConnectCard.tsx` (neu). `<PlaybackSettingsCard />` aus A wird vor dem Jellyfin Block eingefügt.
* `app/src/lib/tv.tsx` (additiv, bei Bedarf Fallback), `shared/quickConnect.ts`
* `app/assets/images/tv-banner.png`
* `.github/workflows/android-smoke.yml`
* `.github/scripts/**`: `smoke.sh`, `drive.py`, neu `drive_tv.py`, `mock-jellyfin.cjs`, neu `make-media.sh`, neu `check_report.py`

**Reihenfolge:**
1. **Zuerst C6** (Mock, Medien, Workflow) in den ersten 45 min, damit Checkpoint 1 echte Wiedergabe prüfen kann.
2. Dann C3, C1, C2.
3. Dann C5, C4, C8.

---

## 6. Prüfung ohne Gerät

### 6.1 Workflow `android-smoke.yml`

* **Auslöser:** `workflow_dispatch` sowie `pull_request` auf `main` mit Pfaden `app/**`, `shared/**`, `.github/**`.
* **Job `build`:**
  * Prebuild und `assembleRelease -PreactNativeArchitectures=x86_64`.
  * `aapt dump badging` Prüfung wie in C5.
  * Upload des APK als Artefakt `smoke-apk`.
* **Job `phone`** (needs build):
  * Checkout, Node 22, APK herunterladen, `ffmpeg` (`command -v ffmpeg || sudo apt-get install -y ffmpeg`), KVM.
  * `reactivecircus/android-emulator-runner@v2` mit `api-level: 36`, `target: google_apis`, `arch: x86_64`, `profile: pixel_7`.
  * Script `bash .github/scripts/smoke.sh phone`.
* **Job `tv`** (needs build, parallel zu phone):
  * Gleich, aber mit `api-level: 36`, `target: android-tv`, `arch: x86_64`, `profile: tv_1080p`, `ram-size: 4096M`.
  * Script `bash .github/scripts/smoke.sh tv`.
  * Laut Google Katalog `sys-img/android-tv/sys-img2-3.xml` gibt es `system-images;android-36;android-tv;x86_64`. Fallback: `api-level: 34`, `target: android-tv`, `arch: x86`. Dann muss der Build Job zusätzlich `x86` bauen.
* `smoke.sh <mode>`:
  * `make-media.sh` starten, dann den Mock im Hintergrund, `adb install`.
  * Start über `monkey -c android.intent.category.LAUNCHER` (Handy) oder `LEANBACK_LAUNCHER` (TV).
  * TV zusätzlich: `cmd package query-activities --brief -a android.intent.action.MAIN -c android.intent.category.LEANBACK_LAUNCHER | grep app.burrowcinema`.
  * Danach Treiber, Logcat, Screenshots, `check_report.py <mode>`.
  * **Exit Code ungleich 0 bei jedem Fehler.** Heute steht `exit 0` am Ende, das entfällt.
  * Artefakte immer hochladen (`if: always()`).

### 6.2 Medien und Mock Jellyfin

`make-media.sh` (ffmpeg) erzeugt:
* `test.mp4`: 60 s, 640×360, H.264 baseline, AAC, `+faststart`.
* `test-noaudio.mp4`: zur Unterscheidung von Audio Problemen des Emulators.
* `test.srt`: drei Zeilen Deutsch.
* `hls/` mit `index.m3u8` und `.ts` Segmenten (`-f hls -hls_time 4 -hls_playlist_type vod`) aus `test.mp4`.
* `trickplay-0.jpg`: 10×10 Kacheln zu 320×180 (`fps=1/10,scale=320:180,tile=10x10`).

Mock Inhalt (Vertrag für A und B):

| Element | Daten |
|---|---|
| Benutzer | Login `max`/`secret` wie heute. `/Users/Me` mit `Configuration { EnableNextEpisodeAutoPlay: true, SubtitleMode: 'Default', AudioLanguagePreference: 'ger' }`. `/System/Info/Public` gibt Version `10.11.5` |
| UserViews | `v-movies` „Filme“ (`movies`), `v-shows` „Serien“ (`tvshows`) |
| Filme | Die bestehenden sechs Filme, `RunTimeTicks` 600 000 000. „Arrival“ (m1) hat `UserData.PlaybackPositionTicks` 200 000 000 und steht in `/UserItems/Resume`. „Dune“ (m0) hat Trickplay `{ 'ms-m0': { '320': { Width: 320, Height: 180, TileWidth: 10, TileHeight: 10, ThumbnailCount: 6, Interval: 10000 } } }` und ein Intro Segment von 2 bis 20 s. „Her“ (m2) nur Transcode. „Drive“ (m3) ohne Audio. „Sicario“ (m4) mit kaputtem Direct Stream |
| Serie | „Severance“ (s0), „Staffel 1“ (s0-1), Folgen e1 bis e3 mit `IndexNumber` 1 bis 3, `ParentIndexNumber` 1, `SeriesId`, `SeasonId`. e1 gesehen, e2 in `/Shows/NextUp`. Jede Folge hat ein Intro von 2 bis 20 s, e2 zusätzlich ein Outro von 45 bis 60 s. `adjacentTo` gibt Vorgänger, aktuelle und nächste Folge |
| Listen | `/Items/Latest?parentId=` je View, `/Items` mit `ids`, `IncludeItemTypes`, `SearchTerm` (bestehend erweitert), `/Items/{id}/Similar`, `/Persons` |
| PlaybackInfo | `POST /Items/{id}/PlaybackInfo` ergibt `PlaySessionId 'ps-<n>'` und eine MediaSource `ms-<id>` (`mp4`, `Protocol File`, `SupportsDirectPlay true`, `ETag`). MediaStreams: Video h264 Index 0, Audio aac Index 1 `ger`, Untertitel srt Index 2 `ger` „Deutsch“ `External` mit `DeliveryUrl /Videos/{id}/ms-{id}/Subtitles/2/0/Stream.srt`. `DefaultAudioStreamIndex 1`, `DefaultSubtitleStreamIndex -1`. Bei „Her“ oder `EnableDirectPlay: false` im Body: `SupportsDirectPlay false` und `TranscodingUrl /Videos/{id}/master.m3u8?...&TranscodeReasons=VideoCodecNotSupported` |
| Streams | `/Videos/{id}/stream` mit Range Unterstützung (206, `Content-Range`). Für m4 kommen 1 KB Zufallsbytes. Dazu `.m3u8`/`.ts` aus `hls/`, die Untertitel Datei, `/Videos/{id}/Trickplay/320/0.jpg`, `/MediaSegments/{id}` |
| Benutzerdaten | `POST/DELETE /UserPlayedItems/{id}` und `/UserFavoriteItems/{id}` ändern den Zustand und geben `UserItemDataDto` zurück. `/Sessions/Playing/Stopped` setzt `PlaybackPositionTicks`, damit „Fortsetzen“ prüfbar ist |
| Sitzungen | `/Sessions/Playing`, `/Progress`, `/Stopped` antworten 204 und speichern den Body. `DELETE /Videos/ActiveEncodings` antwortet 204 |
| Quick Connect | `Enabled` gibt true. `Initiate` gibt `{ Code: '482913', Secret: 'sec' }`. `Connect` gibt bei den ersten zwei Abfragen `Authenticated false`, danach true. `AuthenticateWithQuickConnect` antwortet wie `AuthenticateByName`. `Authorize?code=` speichert den Code |
| Bericht | `GET /__report` liefert JSON mit `playing[]` (ItemId, PositionTicks, PlayMethod), `progress[]` (ItemId, PositionTicks, IsPaused, PlayMethod), `stopped[]`, `streamRequests` (Pfad, Status, Range), `playbackInfo[]` (Body Ausschnitt), `subtitleRequests`, `trickplayRequests`, `activeEncodingsDeleted`, `played[]`, `favorites[]`, `authorizedCodes[]` |

### 6.3 Handy Treiber (`drive.py`, bestehende Schritte bleiben vorn)

1. Wie heute: Login, alle Tabs, Dune Detail, Ordner Sheets.
2. Zurück zu „Bibliothek“. Prüfen: „Weiterschauen“, „Nächste Folgen“, „Zuletzt hinzugefügt: Filme“ sind sichtbar.
3. „Dune“, dann „Abspielen“. 15 s warten. Bericht: `playing`, `maxPositionTicks ≥ 5e7`, Range Anfrage.
4. Solange „Intro überspringen“ sichtbar ist (bis 20 s): tippen. Ein späterer Progress muss mindestens `2e8` haben.
5. `input keyevent KEYCODE_MEDIA_PAUSE`, dann 3 s warten. Bericht: `IsPaused true`. **UI Dumps nur bei pausiertem Video**, weil uiautomator bei laufendem Video oft „could not get idle state“ meldet.
6. Bei pausiertem Video: Bildschirm tippen, Panel „Untertitel“, „Deutsch“ wählen. Bericht: `subtitleRequests ≥ 1`.
7. `BACK`: Bericht `stopped ≥ 1`, die Detailseite zeigt „Fortsetzen“.
8. „Als gesehen markieren“ tippen: Bericht `played` enthält `m0`.
9. „Her“ abspielen, 15 s warten, `BACK`. Bericht: `.m3u8`/`.ts` Anfragen, `PlayMethod Transcode`, `activeEncodingsDeleted ≥ 1`.
10. „Sicario“ abspielen. Bericht: zweite PlaybackInfo mit `EnableDirectPlay false`, danach steigt die Position.
11. „Severance“, dann „Staffel 1“: drei Folgentitel sichtbar. Folge 2, dann „Abspielen“, pausieren. Seek Leiste „Position“ bei 85 % tippen (über das Bounds Rechteck aus dem Dump), dann `KEYCODE_MEDIA_PLAY`. Innerhalb von 25 s muss es `playing` für `e3` geben.
12. Einstellungen: „Wiedergabe“ sichtbar. Unter „TV verbinden“ `482913` eingeben und „Verbinden“ tippen. Bericht: `authorizedCodes`.
13. Prüft „Dune“ wegen eines `AudioSink` Fehlers im Logcat nicht, wird „Drive“ (ohne Audio) gespielt und das Ergebnis getrennt ausgegeben.

### 6.4 TV Treiber (`drive_tv.py`, nur D Pad und Medientasten)

Hilfen:
* `focused()`: Text oder `content-desc` des Knotens mit `focused="true"` aus dem Dump.
* `focus_to(label, direction, max=12)`: drückt die Richtungstaste, bis `label` fokussiert ist.

Ablauf:
1. Ein Knoten ist fokussiert. Serverfeld: `DPAD_CENTER`, `input text http://10.0.2.2:8096`, `BACK`.
2. `focus_to('Mit Quick Connect anmelden', DOWN)`, `DPAD_CENTER`. „482913“ ist sichtbar, nach höchstens 10 s erscheint Home.
3. Home: „Start“, „Suche“, „Filme“, „Serien“ sichtbar, „Weiterschauen“ sichtbar, ein Knoten fokussiert. `DPAD_LEFT` fokussiert die Seitenleiste, `DPAD_RIGHT` führt zurück in den Inhalt.
4. `focus_to('Arrival', RIGHT/DOWN)`, `DPAD_CENTER`. Die Detailseite hat „Fortsetzen“ fokussiert, `DPAD_CENTER`. Nach 15 s Bericht: erstes `Playing` mit Position mindestens `1.9e8`.
5. `KEYCODE_MEDIA_PLAY_PAUSE` ergibt `IsPaused true`, ein zweites Drücken `IsPaused false`. `DPAD_RIGHT` bei ausgeblendeter Bedienung bringt einen Progress mit +10 s (±3 s).
6. `BACK` zweimal ergibt `stopped ≥ 1`, die Detailseite ist sichtbar. Ein weiteres `BACK` führt zu Home, fokussiert ist „Arrival“ (Fokus Wiederherstellung).
7. `BACK` auf Home: Hinweis „Zum Beenden erneut Zurück drücken“, der Prozess läuft noch.
8. Logcat ohne `FATAL`, `E AndroidRuntime`, `SIGSEGV`.

### 6.5 Was nur der Nutzer prüfen kann

Echte Fernbedienung, HDR und 4K, AC 3 auf dem Gerät, 32 Bit Box, Fire TV, PiP Verhalten, Leistung schwacher Boxen. Das gehört in die Release Notiz als „Bitte testen“.

---

## 7. Risiken, Reihenfolge, Kürzungen

### 7.1 Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| Tausch auf react-native-tvos bricht Build oder Laufzeit (Uniwind, vorkompilierte Expo Module) | Eigener Probe Branch in Phase 0, Fallback 1.2 ohne Folgen für die Pakete |
| react-native-video 6.19.3 baut nicht mit RN 0.88 oder stürzt über den Interop Layer ab | Parallele Probe mit 6.20.0. Danach `expo-video` 58.0.14 (nur `VideoSurface.tsx` und `caps.sidecarSubtitles = false`) |
| R8 entfernt Klassen per Reflection | Keep Regeln 3.2. Der Smoke Test läuft mit dem Release Build |
| 32 Bit Build (`armeabi-v7a`) scheitert | Zeigt der `android.yml` Probe Lauf. Notfalls nur `arm64-v8a` und die Grenze in der Release Notiz nennen |
| Audio im Emulator mit `-noaudio` | Zweite Datei ohne Audio trennt Player Fehler von Emulator Fehlern |
| uiautomator Dump bei laufendem Video | Nur pausiert dumpen, Player Zustand über `/__report` |
| Zuordnung eingebetteter Spuren | Vermieden: nur External und Encode |
| AC 3 still auf Handys | Standard aus, Einstellung zum Einschalten |
| HLS Startposition relativ oder absolut | Prüfung nach `onLoad` und einmaliger Seek (1.5 Punkt 11) |
| Fokus geht auf TV nach Navigation verloren | `useFocusMemory`, eigene Prüfung in 6.4 Schritt 6 |
| RN `Modal` (Sheets) auf TV | Kein Sheet im Player und in neuen TV Abläufen. Bestehende Sheets sind Android Dialoge mit eigenem Fokus und werden akzeptiert |
| Parallele Arbeit im selben Baum | Strikte Dateibesitzer, keine Commits durch Pakete, Stubs aus Phase 0 sichern die Typprüfung |
| Token in URLs (Logcat) | Bewusst für Sidecar und HLS, zusätzlich Header |
| APK Größe mit zwei ABIs | Wird in `android.yml` ausgegeben, unter 120 MB akzeptiert |

### 7.2 Reihenfolge heute Nacht (T0 = Start)

| Zeit | Wer | Schritt |
|---|---|---|
| T0 bis +0:20 | Orchestrator | Phase 0a: 3.1 bis 3.3, Banner, Probe Branches pushen. `p0/video` enthält Video, Keep Awake, Orientierung, ProGuard und ABI. `p0/video-620` ist gleich, aber mit 6.20.0. `p0/tv` ist `p0/video` plus tvos und config-tv. Je Branch `android.yml` und `android-smoke.yml` per `workflow_dispatch` starten |
| +0:20 bis +1:10 | Orchestrator | Phase 0b: Abschnitt 4 und 3.5, Prüfbefehle 3.4, Commit |
| +1:10 | Orchestrator | **Gate:** CI Ergebnisse auswerten, tvos oder Fallback und Video Version festlegen, auf den Arbeitsbranch übernehmen |
| +1:15 bis +3:15 | A, B, C | Parallel. C liefert Mock und Workflow bis +2:00 |
| +2:15 | Orchestrator | **Checkpoint 1:** Prüfbefehle, Commit, Push, Smoke (Handy und TV) starten. Ergebnisse gehen um etwa +2:55 an die Pakete |
| +3:15 bis +4:15 | Orchestrator, bei Bedarf ein Paket | Integration: Prüfbefehle, `android.yml` und Smoke grün machen, höchstens zwei Reparaturrunden |
| +4:15 bis +4:40 | Orchestrator | Merge auf `main`, Release per `workflow_dispatch` mit nächster freier Nummer (`git ls-remote --tags origin`). `app/README.md` um TV, Player und die Web Abweichung ergänzen |
| Rest bis morgen früh | | Puffer |

### 7.3 Was zuerst gestrichen wird

1. Player SHOULD in dieser Reihenfolge: A20, A21, A18, A17, A16, A15, A13, A14, A19.
2. Browsing SHOULD: B16, B15, B11, B12, B13, B10, B14.
3. C8, dann C4.
4. Smoke Schritte 6.3 Punkte 10 bis 13. Der TV Job bleibt, darf aber im Notfall als nicht blockierend markiert werden. Das steht dann in der Release Notiz.
5. Nicht verhandelbar: A1 bis A4, A5, A6, A8, A9, A10, A11, B1 bis B7, B9, C1 bis C3, C5, O1. Dazu kommt, dass alles Bestehende auf dem Handy funktioniert.

### 7.4 `main` bleibt releasefähig

* Gearbeitet wird auf dem aktuellen Arbeitsbranch. Die Probe Branches zweigen davon ab. `main` bleibt bis zum Gate unberührt, das letzte Release bleibt installierbar.
* **Merge auf `main` nur, wenn alles grün ist:**
  * App `tsc`, Web `tsc -b` und `expo export`.
  * `android.yml` mit zwei ABIs und Badging.
  * Smoke Job phone grün.
  * Smoke Job tv grün oder ausdrücklich als bekannte Lücke in der Release Notiz.
* Ist eine Funktion morgens nicht stabil, schaltet `features.ts` sie ab, statt Code zurückzubauen:
  * `player: false` blendet alle Play Buttons aus.
  * `tvShell: false` lässt TV die Handy Navigation nutzen.
  * `quickConnect: false` blendet den Quick Connect Button aus.
* Ein Release entsteht nur per `workflow_dispatch` mit dem Eingabefeld `release`, nie automatisch.
