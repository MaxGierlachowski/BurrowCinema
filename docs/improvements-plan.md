# Verbesserungen und Chromecast

Stand nach Release 008. Grundlage: Durchsicht der ganzen App (Screens, Komponenten, lib) mit Fokus auf das Handy, dazu der gemeldete Fehler an der Seekbar.

## 1. Fehler

| Nr | Problem | Lösung |
|----|---------|--------|
| F1 | Seekbar: Der Knopf läuft beim Ziehen dem Finger davon. `locationX` bezieht sich auf Android auf die View unter dem Finger | Nur das erste Aufsetzen nutzt `locationX`, danach zählt die Bewegung in `pageX` |
| F2 | Spinner beim Puffern fehlt, solange die Bedienung sichtbar ist (nach Sprung oder Seek) | Spinner statt Play/Pause Symbol in der Bedienung |
| F3 | Vorspulen springt auf 0, wenn die Dauer noch unbekannt ist | Nur begrenzen, wenn die Dauer bekannt ist |
| F4 | Suche: Bei einem Fehler bleibt der Bildschirm leer | Fehlerzustand mit "Erneut versuchen" |
| F5 | Ordner: Fehlgeschlagenes Speichern bleibt trotzdem sichtbar | Cache nach Fehler neu laden; Ladefehler nicht als "Noch keine Ordner" zeigen |
| F6 | Auslosung: Pull to Refresh kann mit dem Wischen der Karten kollidieren | Refresh während einer laufenden Auslosung aus |

## 2. Handy Bedienung

* **Touch Targets mindestens 44 dp:** Panel Buttons im Player, Seekbar (h-12), Up Next Buttons, Entfernen Knopf auf Postern, alle Segmented Controls, Sortierung, Einstellungs Chips, Versionswahl, Optionslisten, Serienlink über Folgen. Zusätzlich `hitSlop` für die kleinen Button Größen.
* **Player:** vorige und nächste Folge auch auf dem Handy, Doppeltippen links oder rechts springt zurück oder vor, Seekbar per TalkBack bedienbar, Bedienung blendet bei aktivem Screenreader nicht aus, "Erneut versuchen" bei Wiedergabefehlern.
* **Suche:** Löschen Knopf im Suchfeld (Android kennt `clearButtonMode` nicht).
* **Login:** Weiter zum nächsten Feld per Tastatur, Passwort anzeigen, keine Autokorrektur beim Benutzernamen.
* **Bibliothek:** Sortierung und Filter werden gemerkt.
* **Detailseiten:** "Erneut versuchen" bei Fehlern.
* **Barrierefreiheit:** Standardrolle "button" für alle fokussierbaren Elemente, Rolle "togglebutton" für Gesehen und Favorit.

## 3. Chromecast (Handy)

* Bibliothek `react-native-google-cast` mit Googles Default Media Receiver. Jellyfin liefert den Stream direkt an den Chromecast, das Handy ist die Fernbedienung.
* Cast Symbol oben im Player (nur Handy). Antippen zeigt alle Cast Geräte im WLAN. Nach der Auswahl wird an der aktuellen Position weitergespielt.
* Eigenes Geräteprofil für Chromecast: H.264 in MP4 und VP8/VP9 in WebM direkt, alles andere als HLS mit H.264 und AAC, Untertitel als WebVTT oder eingebrannt.
* Cast Bildschirm auf dem Handy: Titel, Poster, Gerät, Seekbar, 10 s zurück und vor, Play/Pause, Cast beenden. Zusätzlich Steuerung über die Benachrichtigung von Google Cast.
* Jellyfin bekommt Fortschritt, Pause und Stopp vom Handy gemeldet, wie beim lokalen Player.
* Cast beenden setzt lokal an derselben Stelle fort. Ist schon ein Gerät verbunden, startet jeder neue Titel direkt auf dem Chromecast.
* R8 Keep Regel für die Cast Klassen (der Options Provider wird per Name geladen).
* Fehlende Google Play Dienste (manche TV Boxen) werden von der Bibliothek abgefangen; auf dem TV gibt es kein Cast Symbol.

Später: Audio und Untertitel während des Castens wechseln, Up Next auf dem Chromecast, eigener Jellyfin Receiver.

## 4. Prüfen

* `npx tsc --noEmit`, `npx expo export`, Web Build.
* Smoke Test auf Handy und TV Emulator (Chromecast selbst lässt sich dort nicht testen; geprüft wird, dass die App mit der Cast Bibliothek startet und der Player unverändert funktioniert).
* Release 009.
