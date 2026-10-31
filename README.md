# Weed Firm

Ein browserbasiertes Grow-Imperium im 3D-Growroom: Samen pflanzen, gießen, düngen, ernten und den Vorrat dann zum besten Marktpreis verkaufen. Die komplette Spieloberfläche ist auf Deutsch.

## Spielen

Das Projekt ist eine statische Website ohne Build-Schritt. Wegen der ES-Module braucht es einen kleinen Webserver:

```bash
python3 -m http.server 3000
# danach http://localhost:3000 öffnen
```

Alternativ lässt sich der Ordner mit jedem anderen Static-Server ausliefern.

## Was drin ist

- **6 Töpfe** – drei sind von Anfang an frei, die restlichen drei kosten $900, $3.200 und $10.000.
- **32 Sorten** – von Northern Lights und Blue Dream über OG Kush, Gorilla Glue #4 und White Widow bis Gelato und Runtz. Jede Sorte hat THC-Gehalt, Typ, Wirkung, Wachstumszeit, Ertrag und eigenen Marktpreis.
- **Schnelle Freischaltungen** – das erste Level-up kommt nach wenigen Ernten, danach purzeln neue Genetiken im Minutentakt.
- **Samen & Dünger** – Samen werden beim Pflanzen verbraucht oder automatisch nachgekauft. Der Blüte-Booster gibt +30 % Wachstum und +6 % Qualität pro Zyklus.
- **Ausbau** – LED-Array, Nährstoff-Linie, Smart Pots, Sicherheit und Genetik-Labor mit insgesamt dutzenden Stufen.
- **Markt** – Preise bewegen sich alle sieben Sekunden. Wer die Spitze erwischt, verdient deutlich mehr.
- **Hitze & Razzien** – Ernten und Verkäufe erzeugen Hitze. Ab 100 % wird beschlagnahmt und kassiert. Sicherheit senkt beides.
- **Fortschritt** – Level- und XP-System, Statistiken, Autosave im Browser und Offline-Wachstum beim nächsten Besuch.
- **3D-Growroom** – Three.js mit prozeduralen Pflanzen, LED-Leisten, Neon-Schild, Staubpartikeln und sortenabhängigen Blütenfarben.
- **Mobil & Desktop** – touch-freundliche Marker, Slider-Panel und responsive Kamera für Hoch- und Querformat.

## Steuerung

| Aktion | Desktop | Mobil |
| --- | --- | --- |
| Topf auswählen | Topf im Raum oder in der Übersicht anklicken | Topf oder Marker antippen |
| Gießen / Ernten / Düngen | Buttons im Topf-Detail | Buttons im Topf-Detail |
| Tab wechseln | Tabs oder Tasten `1`–`4` | Tabs antippen |
| Detail schließen | `Esc` oder „Alle Töpfe“ | „Alle Töpfe“ |

Los geht es mit $320, zwei Blue-Dream-Samen, einem Northern-Lights-Samen, 3,4 g im Vorrat und einem reifen Blue-Dream-Topf. Der erste Verkauf finanziert in der Regel direkt den nächsten Samen.

## Tests

Die Spiellogik liegt bewusst getrennt in `src/game.js` und lässt sich ohne Browser testen:

```bash
npm test
```

Die Tests decken Pflanzen, Gießen, Düngen, Wachstum, Ernten, Verkaufen, Level-ups, Upgrades, Töpfe, Razzien, Marktdrift und Offline-Fortschritt ab.

## Technik

- Vanilla HTML/CSS/JavaScript, kein Build-Schritt, keine Laufzeit-Abhängigkeiten.
- Three.js r160 liegt lokal unter `vendor/three.module.js`.
- Schriften liegen lokal unter `assets/fonts/`.
- Spielstand: `localStorage` (`weedfirm.save.v5`), automatisch alle fünf Sekunden und bei jeder Aktion.
- Zum Debuggen liegt der Zustand unter `window.__weedfirm = { state, scene, ui }`.

```
index.html          HUD, Start-Overlay, Tabs
styles.css          Layout, HUD, Startbildschirm
ui.css              Panels, Karten, Shop, Markt, Ausbau
src/game.js         Regeln, Wirtschaft, Sorten, XP, Markt, Razzien
src/scene.js        3D-Growroom, Pflanzen, Kamera, Marker
src/ui.js           UI-Controller, Aktionen, Toasts
src/panels.js       HTML für Anbau, Samen, Markt und Ausbau
src/icons.js        Inline-SVG-Icons
src/audio.js        WebAudio-Soundeffekte
src/main.js         Laden/Speichern, Offline-Wachstum, Loop
tests/game.test.mjs Tests der Spiellogik
```

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://omgithub.com).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://omgithub.com/MrSchalke/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/MrSchalke/PlayGround)

- 🎮 [Open the project](https://omgithub.com/MrSchalke/PlayGround).
- ✨ [Remix this project](https://omgithub.com/?remix=MrSchalke%2FPlayGround).
- 💻 [Explore the source](https://github.com/MrSchalke/PlayGround).
- 🛠️ [Check build runs](https://github.com/MrSchalke/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/MrSchalke/PlayGround/issues).
- 👤 [Explore the creator's projects](https://omgithub.com/MrSchalke).
- 🌍 [Create with OMGithub](https://omgithub.com).
<!-- omgithub:readme:end -->
