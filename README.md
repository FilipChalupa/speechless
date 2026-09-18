# Speechless

Napíš text, stlač Enter (alebo tlačidlo Prehrať) a zariadenie ho povie nahlas.
Určené hlavne pre telefón.

## Ako to funguje

- Statická stránka bez buildu – `index.html`, `style.css`, `main.js`.
- Reč zabezpečuje Google Translate TTS (`translate.google.com/translate_tts`).
  Dlhší text sa rozdelí na časti do 180 znakov a prehrá sa postupne.
- Enter aj tlačidlo Prehrať vyprázdnia pole a text uložia do histórie
  (localStorage). Kliknutie na položku v histórii ju prehrá znova.
- Jazyk je zatiaľ natvrdo slovenčina – konštanta `LANGUAGE` v `main.js`.

## Vývoj

Stačí otvoriť `index.html` v prehliadači, alebo si spustiť statický server:

```sh
npx serve .
```

## Nasadenie

GitHub Pages servíruje vetvu `main` z koreňa repozitára, takže nasadenie je
obyčajný push.
