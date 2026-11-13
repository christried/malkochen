# Changelog

Cosa è cambiato in malkochen per chi lo usa, dal più recente. Nell'app sotto "Novità" (/changelog). Il formato segue [Keep a Changelog](https://keepachangelog.com/it-IT/1.1.0/). I nomi delle sezioni (Added, Changed, Removed, Fixed, Security) restano in inglese in ogni lingua: l'app li mostra tradotti. La versione inglese è `CHANGELOG.md`, quella tedesca `CHANGELOG.de.md`, e tutte e tre cambiano nella stessa PR.

## [Unreleased]

## [1.3.1] - 2026-11-13

### Added

- Ogni bacheca ha ora una lista della spesa, la stessa per tutti: una terza vista accanto a Colonne e Settimana. Apri un piatto e tocca Nella lista della spesa per aggiungerne gli ingredienti (togli quello che avete già), oppure metti tutta la settimana dal piano settimanale in un colpo. Scrivi cos'altro manca, e al negozio tocchi una riga per spuntarla. Rimuovi completate fa ordine, e tutto funziona anche senza connessione.

### Changed

- L’informativa sulla privacy ora nomina anche il piano settimanale e la lista della spesa tra ciò che salvi su una bacheca.
- Se il Trova ricette non ha trovato nessuna ricetta, Cerca di nuovo lo fa cercare ancora. Un piatto si può cercare due volte all’ora.

### Fixed

- Trova ricetta ora legge anche la didascalia dei post aggiunti prima che malkochen tenesse le didascalie, così trova anche la ricetta sotto un TikTok più vecchio.

## [1.3.0] - 2026-11-12

### Added

- Ora i piatti possono avere una ricetta. Apri un piatto e tocca Aggiungi ricetta per scrivere ingredienti e passaggi riga per riga, anche senza connessione. Una lista incollata diventa una riga per voce, e la ricerca trova un piatto anche dai suoi ingredienti.
- Vuoi che malkochen cerchi per te la ricetta di un piatto? Puoi chiedere il Trova ricette nelle tue impostazioni.
- Ogni bacheca ha ora un piano settimanale accanto alle sue colonne: in alto passi da Colonne a Settimana. Metti i piatti nei giorni in cui vuoi cucinarli, lo stesso piatto su più giorni o più piatti in un giorno, e indica chi cucina. Quel giorno tocchi Cucinato ✓ direttamente dal piano, anche senza connessione.

### Changed

- L’informativa sulla privacy ora ha una sezione su Trova ricette: quando cerca una ricetta per te, la caption e il testo della pagina collegata vanno ad Anthropic.

## [1.2.1] - 2026-11-11

### Changed

- Più ordine: nel piatto, Cucinato ✓ ora sta subito sotto il titolo, accanto ad Apri l’originale, così non devi più scorrere per trovarlo. Le schede mostrano più del titolo di un piatto, e sul telefono la bacheca è più tranquilla, con le schede direttamente sul colore della colonna.

## [1.2.0] - 2026-11-10

### Added

- Hai cucinato più piatti? Selezionali (tieni premuto su uno, o Ctrl-clic sul desktop), tocca Cucinato ✓ e contano tutti. Una sola festa per tutti, un classico ha comunque la sua, e un solo Annulla li riporta tutti indietro.
- malkochen funziona anche con poco segnale, o senza. Le bacheche che hai già aperto restano sul tuo telefono: puoi spostare i piatti, toccare Cucinato ✓, commentare, dare un pollice, correggere un titolo o aggiungere un piatto da un link. Arriva tutto appena torni in rete, e una piccola barra ti dice cosa sta ancora aspettando.

## [1.1.2] - 2026-11-09

### Changed

- L’informativa sulla privacy ora ha una sezione su Snackbert, un’app per l’alimentazione a cui puoi raccontare i piatti che cucini, se hai un account lì.

## [1.1.1] - 2026-11-09

### Changed

- L’informativa sulla privacy ora dice che per i link di TikTok, come per Instagram, malkochen legge la pagina di incorporamento pubblica del post.

### Fixed

- Incollando un link di TikTok tornano il titolo, la foto, chi l’ha pubblicato e la descrizione. TikTok aveva smesso di darli senza dire niente.

## [1.1.0] - 2026-10-26

### Added

- Condividi un piatto: Condividi il link ti dà un link che chiunque può aprire, senza account. Se il piatto piace, si può copiare su una propria bacheca, e chi è nuovo si iscrive strada facendo.
- Copia un piatto su un’altra delle tue bacheche, con la foto, il link e tutto quello che malkochen ha trovato.
- Il testo del post: malkochen tiene la descrizione con cui arriva un post, la mostra nel piatto, e la ricerca trova i piatti anche così. I piatti che hai aggiunto prima ricevono la loro nei prossimi giorni.
- Le novità vengono da te: dopo un aggiornamento, malkochen ti mostra una volta cosa è cambiato.
- Una piccola spinta: se le notifiche push o l’email giornaliera sono spente, Topfbert ogni tanto ti chiede se le vuoi, al massimo una volta al mese e mai quando si è appena aperto qualcos’altro.
- Note legali e privacy ora stanno dentro malkochen, nella tua lingua, in fondo a ogni bacheca.
- Le nostre email mostrano il logo di malkochen in Gmail.

### Changed

- Le notifiche push dicono chi ha fatto cosa e su quale bacheca, e mostrano la foto del piatto.
- Riproduci il video compare solo sui piatti il cui video parte davvero in malkochen.
- Le novità si sono rifatte il look: una scheda per ogni versione, e sul computer una barra per saltare dall’una all’altra.
- La nostra informativa sulla privacy è nuova. Descrive malkochen com’è oggi, con i link condivisi, le copie e il fatto che chi gestisce malkochen può aprire ogni bacheca per dare una mano. Dai un’occhiata sotto Privacy in fondo a una bacheca.
- Sul computer la ricerca si apre al centro dell’intestazione, e le impostazioni stanno proprio accanto alla tua foto.

### Fixed

- Finestre e pannelli non si chiudono più quando trascini o selezioni del testo fuori da loro, o quando clicchi accanto dopo aver scritto qualcosa. La X, Esc e Annulla li chiudono come sempre.
- Le etichette dei campi stanno bene nel bordo del campo, anche quando Chrome lo compila per te.
- Nel campo dei commenti il pulsante e il testo sono centrati, senza spazio in più sopra.

## [1.0.0] - 2026-10-22

### Added

- Bacheche: raccogli quello che vuoi cucinare, da solo o con altri. Invita le persone con un link, metti i piatti in colonne come Idee e Questa settimana, trova ogni piatto con la ricerca e vedi subito cosa hanno aggiunto gli altri dall’ultima volta.
- Piatti dai link: incolla un link da TikTok, Instagram, YouTube Shorts, Pinterest o un food blog, e malkochen trova l’immagine, un titolo e chi l’ha fatto. I video partono direttamente nel piatto, e con malkochen installato su Android condividi i link dall’app in cui li hai trovati. Niente link? Aggiungi il piatto a memoria, con la tua foto o uno dei nostri disegni.
- Cucinati e classici: sposta un piatto in Cucinati ogni volta che lo prepari. A ogni volta sale di livello, da provato a futuro preferito e immancabile, e alla decima è un classico, che Topfbert festeggia con te.
- Voti e commenti: dai un pollice in su o in giù a un piatto cucinato, e parla di qualsiasi piatto. La sua cronologia mostra tutto quello che gli è successo, e la sua scheda si illumina quando c’è qualcosa di nuovo.
- L’archivio: piatti e bacheche archiviati restano lì 30 giorni, così puoi sempre recuperarli.
- Permessi: chi è titolare di una bacheca decide cosa può fare ogni membro, oppure gli lascia solo guardare, commentare e votare.
- Lingue: malkochen parla tedesco, inglese e italiano. Scegli la tua nelle impostazioni, e già che ci sei anche chiaro o scuro.
- Notifiche: notifiche push sui tuoi dispositivi e un’email giornaliera, se le vuoi, quando altri aggiungono piatti, commentano o votano sulle tue bacheche.
- Il tour: Topfbert ti fa vedere tutto la prima volta che apri una bacheca, e di nuovo quando vuoi, dalle impostazioni.
- Aperto a tutti: chiunque può iscriversi, con Google o con un codice che ti mandiamo per email, ed elimina il tuo account da solo quando vuoi.
- Novità: questa pagina, in fondo alle tue impostazioni e segnata come Nuovo dopo ogni aggiornamento.

[Unreleased]: https://github.com/christried/malkochen/compare/v1.3.1...HEAD
[1.3.1]: https://github.com/christried/malkochen/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/christried/malkochen/compare/v1.2.1...v1.3.0
[1.2.1]: https://github.com/christried/malkochen/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/christried/malkochen/compare/v1.1.2...v1.2.0
[1.1.2]: https://github.com/christried/malkochen/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/christried/malkochen/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/christried/malkochen/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/christried/malkochen/releases/tag/v1.0.0
