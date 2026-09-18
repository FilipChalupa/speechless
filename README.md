# Speechless

Napíš text, stlač Enter (alebo tlačidlo Prehrať) a zariadenie ho povie nahlas.
Určené hlavne pre telefón.

## Ako to funguje

- Statická stránka bez buildu – `index.html`, `style.css`, `main.js`.
- Reč zabezpečuje Google Translate TTS (`translate.google.com/translate_tts`).
  Dlhší text sa rozdelí na časti do 180 znakov a prehrá sa postupne.
- Enter aj tlačidlo Prehrať vyprázdnia pole a text uložia do histórie
  (localStorage). Kliknutie na položku v histórii ju prehrá znova.
- Hviezdička položku pripne: pripnuté sú vždy hore, nevypadnú z histórie po
  dosiahnutí limitu a neodstráni ich ani tlačidlo Vymazať nepripnuté.
- Jazyk je zatiaľ natvrdo slovenčina – konštanta `LANGUAGE` v `main.js`.
- Dá sa pridať na plochu (`manifest.webmanifest`, `apple-touch-icon.png`,
  service worker) a spustí sa bez panelu prehliadača. Na iPhone cez Safari →
  Zdieľať → Pridať na plochu. Ikony sa generujú z `icon.svg`.

## Vývoj

Stačí otvoriť `index.html` v prehliadači, alebo si spustiť statický server:

```sh
npx serve .
```

## Nasadenie

GitHub Pages servíruje vetvu `main` z koreňa repozitára, takže nasadenie je
obyčajný push.
