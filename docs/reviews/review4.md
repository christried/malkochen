* Share link für Gericht nach extern für User teilen die das dann eigenem Board hinzufügen können. Gleichzeitig auch Möglichkeit, dish in ein anderes Board zu duplizieren
* Möglichkeit descriptions der Posts rauszuziehen und in der App anzuzeigen
* activity log aller aktivitäten überall ausm Admin Panel raus mit Filtern dafür wirklich jeden Scheiß dadrin
* Überarbeiten: Push Notifications. Headline: "Von MARA in KOCHEN LECKER" // Zweites Bild: vorschaubild vom neuen gericht? nicht 2x malkochen logo ist ja blöde // Description: Rezepttitel, dann Creator, dann Social Media Origin
* Prompts für Push-Notifications (mobile installed only). Alle 30 Tage prompten, falls nicht aktiviert. Prompts für E-Mail Digest, ebenfalls alle 30 Tage prompten, falls nicht aktiviert. Wichtig: Prompts niemals auf einmal, mindestens 48h dazwischen vergangen notwendig.
* "Video abspielen" momentan auch überall wo es keine Videos gibt - die Pill soll nur erscheinen wenn ein Video in malkochen direkt abgespielt werden kann, weil sie sonst nur eine Dopplung von "Original öffnen" ist
* Riesen Feature: snackbert integration:

  * "werbungs-banner" mit snackbert werbung, Interesse? Github Releases Link (Das erst gaaaaanz am Ende)
  * Toggle in den Settings für Snackbert Integration
  * Sobald gekocht angeklickt wurde und Zeit zum rückgängig machen abgelaufen ist, taucht snackbert-kopf in Bild auf und fragt, ob man sich traut, 	ihm das Gericht zu melden. Nein -> snackbert weg. Ja -> Frage, ob man ein Foto von der Portion gemacht hat oder mit Audioaufnahme oder Textinput 	beschreiben will wie groß die Portion war. Betonung, dass alles optional ist. Immer zusätzlich zu diesen Infos mitschicken: Alle Infos die man
irgendwie zum Dish kriegen kann: Post-Link, Titel, Description, vielleicht transcript falls sowas geht? Snackbert ist Vertex und kann eig. sachen
googlen und links aufrufen
* Ich als ADMIN DER GESAMTEN APP (NEUE ROLLE) darf auf alle Boards in meinem Nutzeraccount zugreifen als wären es meine eigenen. Ich werde aber niemandem als Member des Boards angezeigt (außer bei den Board die ich erstellt oder zu denen ich Einladungen angenommen habe).
* "Code from the email" input ist buggy (der label/legenden text ist nicht in der border lücke), gleiches für den email input direkt vorher. Wenn der email input durch chrome autofill eingefärbt wird, erkennt man das die field legend auch nicht mehr gerade...
* Code per email und email digest: da fehlt ein mail avatar, wir krieg ich den rein, dass da nicht der basic google avatar kommt wenn ich die email in gmail öffne?
* text inputs: Kommentieren im Dish: komisches Padding über dem input und button? Button und platzhalter lieber zentrieren - so sieht es weird aus. Wenn das woanders auch genauso ist, dort auch fixen.
* Impressum und datenschutz soll in malkochen selbst passieren. frag mich für die bisherigen files, dann schicke ich sie dir. privacy musst du nochmal checken und ggf. anpassen.
* auf desktop soll das settings cogwheel sinnvollerweise lieber neben dem profil avatar sein (mobile wie bisher)
* auf desktop das suchfeld direkt expanded haben oben in der Mitte, insofern platz dafür vorhanden ist. sonst wie bisher machen. mobile auch bisher.
- Neuigkeiten in den Changenotes, die der user noch nie gesehen hat, werden beim Login in einem "News" Popup Fenster angezeigt. danach nie wieder außer auf der changelog seite
- Changelog auch ganz unten auf der Page im Footer aufrufbar, auch in mobile. Einfach ganz unten auf der page, centered, muss man eben scrollen wenn viele dishes in einer column sind. Impressum & Datenschutz auch dahin moven.
- Changelog Redesign: Fancier machen. Winnies Redesign für changelog als Beispiel nehmen. Wenn Nutzer das nicht schickt, Nutzer explicitely danach fragen!!!

User Feedback, das hier super priorisiert behandeln:

* Etwas was beim eingeben für Frust sorgt, ist dass wenn man ein neues Gericht hinzufügt und mit der Maus nur leicht das Fenster verlässt
mitten in einem Linksklick oder danach, dann schließt das Fenster. Ich glaube persönlich würde ich es präferieren wenn das nur schließt, wenn ich mehrfach außen klicke oder das absichtlich schließe, irngedwie passiert das leicht wenn man mit der Maus einfügt und dann wegbewegt zum notiz eintippen 😄