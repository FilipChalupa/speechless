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
- Jazyk reči sa vyberá v sekcii Nastavenia, predvolený je podľa `navigator.languages`
  (zoznam `LANGUAGES` v `main.js`). Voľba sa pamätá a každý záznam v histórii si
  drží jazyk, v ktorom vznikol.
- Jazyk rozhrania sleduje jazyk reči. Preložené sú `en`, `cs` a `sk`
  (`TRANSLATIONS` v `main.js`), zvyšok spadne na angličtinu.
- Dá sa pridať na plochu (`manifest.webmanifest`, `apple-touch-icon.png`,
  service worker) a spustí sa bez panelu prehliadača. Na iPhone cez Safari →
  Zdieľať → Pridať na plochu. Ikony sa generujú z `icon.svg`.

## Vývoj

Stačí otvoriť `index.html` v prehliadači, alebo si spustiť statický server:

```sh
npx serve .
```

## Nasadenie

Push do `main` spustí workflow, ktorý zavolá `node build.mjs` a výsledný
priečinok `dist/` nasadí na GitHub Pages. Nič sa nekompiluje, build iba
premenuje `style.css` a `main.js` na `style.<hash>.css` a `main.<hash>.js`
a prepíše odkazy v `index.html`.

Prečo: Pages posiela assety s `cache-control: max-age=14400`, takže CDN aj
telefón by inak hodiny držali starú verziu. `index.html` má krátku životnosť,
takže po nasadení hneď ukazuje na nové názvy súborov.

Lokálne sa build nepotrebuje – zdrojové súbory fungujú samé. Ak overuješ
nasadenú verziu cez `curl`, použi `?cb=$(date +%s)`.
