Desktop Test Protokoll
Das Speichern von fehlerhaften Links führt dazu, dass der Platzhalter-Kram aufgeht.
Das Speichern ohne Link funktioniert super.
Das Speichern von Foodblog-Rezepten funktioniert ebenfalls.
Bezüglich des L1 TikTok-Videos: Beim Upload von Videos funktioniert alles soweit super.
Eine notwendige Änderung ist, dass das automatisch erzeugte Bild zwar bereits geändert werden kann, aktuell jedoch nur durch Platzhalter.
Es ist auch notwendig, dass das automatisch hinzugefügte Bild durch Scrollen zentriert oder anders ausgerichtet werden kann, da aktuell einfach immer die Mitte des Bildes genommen wird.
Zusätzlich soll beim Dialog zum Ändern des Bildes auch ein komplett eigenes Bild hochgeladen werden können; dies ist eine komplett neue Funktion, die dazugehören soll.
In der Notiz im Dialog zum Gericht hinzufügen soll nicht optional zum Beispiel „mit Räuchertofu statt Speck“ stehen.
Generell soll nichts irgendwie Nicht-Veganes in der App vorkommen, das heißt, hier soll noch nicht Speck stehen, sondern einfach nur eine ausgedachte Notiz.
Diese Notiz soll auch nicht jedes Mal dieselbe sein.
Erstelle dazu mindestens 10 verschiedene Notizen, die hier zufällig angezeigt werden können.
Die Inputs im Dialog zum Gericht hinzufügen sind ein wenig merkwürdig, was das Padding angeht, und sehen unregelmäßig aus.
Zum Beispiel scheint das Padding oben, gemessen am Text, mehr zu sein als das Padding unten.
Im Selection-Input für das Board steht das Chevron an der rechten Seite fast auf der Border vom Input, während auf der linken Seite sehr viel Padding ist.
Das musst du auch fixen.
Das generelle Bild der App auf dem Desktop ist sehr farblos.
Wir haben verschiedene Farben definiert, die aktuell nur in den Punkten beim Sortieren der Boards irgendwie widergespiegelt werden.
Auch auf der Desktop-App soll sich der Hintergrund verändern können.
Auch auf der Desktop-App sollen die verschiedenen Accent Colors von den jeweiligen Boards zusammenspielen, damit das Ganze ein bisschen farbenfroher wird, sowohl im Dark- als auch im Light-Modus.
Beim Hinzufügen von Instagram Reels ist auf der Mitte des Bildes immer der Play-Button mit drauf.
Investigiere mal, ob es irgendwie möglich ist, den wegzulassen; falls nicht, ist das aber nicht schlimm.
Auch hier gelten die anderen Sachen bezüglich des Bildänderns, die bei den TikTok-Bildern galten.
Zusätzlich wird beim Hinzufügen von Instagram-Gerichten aktuell niemals ein Titel aus den Daten generiert.
Der Titel muss also immer manuell eingegeben werden.
Schau hier, ob das einfach eine Restriktion ist oder ob es möglich ist, den Titel von Instagram Reels auch zu bekommen.
Auch bei Instagram Posts kann kein Titel automatisch hinzugefügt werden, überprüfe das auch.
YouTube Shorts funktionieren super.
Pinterest Pins haben auch das Problem, dass die Titel bisher nicht automatisch hinzugefügt werden können.
Schau auch hier, ob das so richtig ist oder ob wir das noch fixen können.
Die Bilder bleiben auch zwei Tage später noch im Board, was super funktioniert.
Derselbe Link kann zweimal hinzugefügt werden, und das Klicken darauf funktioniert ebenfalls.
Generell werden ab jetzt nur noch Sachen festgehalten, die fehlerhaft sind und korrigiert werden sollen.
Eine auffällige Sache ist, dass die Animation des Schreibens vom Titel ein bisschen zu langsam ist.
Da dies bei langen Titeln sehr lange dauert, muss die Animation etwas schneller passieren.
Wenn ein Gericht bereits auf dem Board ist, ist "Topfbert" neben der Notiz zu sehen, dass das Gericht bereits auf dem Board ist.
Generell soll "Topfbert", immer wenn er zu sehen ist, in irgendeiner Form animiert sein und sich zumindest ein bisschen bewegen.
Wenn man über Karten hovert und dadurch eine Hochhebe-Animation startet, dann stoppen andere Animationen, insbesondere der rollende Pebble auf einer leeren Platzhalter-Geschichte von einer Karte.
Das sieht sehr merkwürdig aus, wenn man verschiedene Karten in der App hovert.
Entsprechend muss gesichert sein, dass dieser Pebble, der im Platzhalter ist, weiterrollt, auch wenn ich eine einzelne Karte anhebe.
Falls es irgendwelche Limitationen gibt von Animationen, die gleichzeitig laufen sollen, dann müssen wir gucken, dass diese Animation von dem Platzhalter einer leeren Spalte weiterläuft.
Weiter zum allgemeinen Gefühl und der Kategorie "The Board with a Mouse".
Zusätzlich zu der Farbschemathematik, die ich bereits vorher erwähnt habe, sind die Animationen mit zu wenig FPS, so wie es aussieht.
Bei einem leeren Board gibt es die rollende Kugel, die sehr gut aussieht.
Leider sieht sie auf dem PC so aus, als würde sie ein wenig zu wenig FPS haben.
Wir müssen uns anschauen, ob man das noch verbessern kann, damit das auch auf besseren Monitoren gut aussieht.
Ein weiterer Punkt ist, dass eben dieses Pebble, was von links nach rechts in der Bowl kullert, nicht dort anfängt zu kullern, wo das "still" sich befindet.
Das bedeutet, dass beim Laden der Page die Kugel nach links snappt und dann anfängt zu rollen, obwohl das "still" in der Mitte ist.
Die Kugel muss dort anfangen zu rollen, wo das "still" auch ist, also dazu entweder das "still" anpassen oder die Roll-Animation.
Weiterhin zu ebendem: Wenn mehrere Boards da sind und alle leer sind, dann ist überall das gleiche "still".
Wir müssen uns überlegen, ob wir anstatt der Bowl mit dem Pebble drin nicht weitere Platzhalter einfügen, mindestens zwei weitere, damit wenn wir drei verschiedene Boards haben am Anfang, auch alle drei einen unterschiedlichen Platzhalter bekommen.
Bei weiteren Boards können es dann auch die gleichen Platzhalter werden.
Wir können es aber weiterhin so belassen, dass immer nur ein zufälliger Platzhalter von diesen Platzhaltern animiert ist, damit nicht zu viel Visual Load auf dem User ist.
Was außerdem komisch ist, ist dass ein Board mit einem einzelnen, mit einem einzelnen Eintrag drin, kleiner ist als Boards ohne Eintrag.
Da müssen wir einfach gucken, dass das Board grundsätzlich mindestens so groß ist, wie als wenn nur der Platzhalter da drin ist.
Beim Draggen und Droppen von verschiedenen Einträgen in einer, in einer Spalte funktioniert das Platzmachen sehr gut.
Auch hier scheint es wieder so ein bisschen die Animation zu betreffen, die ein bisschen flickerig aussehen.
Wenn man einen, einen Eintrag zum Beispiel über der Mitte von zwei Slots hält und dann immer wieder hin und her wiggelt, dann fühlt es sich so an, als wäre die Animation etwas niedrig-FPS-ig.
Hier müsste man nochmal schauen, ob das etwas besser aussieht.
Das Draggen in andere Columns funktioniert sehr gut, aber wenn man einen Eintrag in eine andere Column zieht, dann färbt sich richtigerweise der Hintergrund ein und die neue Column kriegt eine Border, eine dicke, die auch etwas farbiger ist.
Die ist aber leider oben abgeschnitten auf der Top-Seite.
Das Ziel hingegekocht oder das Klicken des Gekocht-Buttons funktioniert super.
Die einzige Sache, die da geändert werden soll, ist, dass "Topfbert" nicht immer nur "hmm" sagt, sondern unterschiedliche Sachen.
Das kann random generiert sein, Hauptsache, es sind immer kurze, kurze Sätze oder kurze Ausdrücke und Worte, damit der Toaster unten nicht zu groß wird.
Eine Art von Karte in der App sieht komisch aus und die müssen wir überarbeiten.
Das betrifft die Karte, in der original öffnen steht in der Detailansicht.
Die ist unten nicht mit gerundeten Ecken und oben schon und das sieht meiner Meinung nach merkwürdig aus.
Ich glaube wir sollten die entweder gleichmäßig runden, du kannst mir aber auch gerne Alternativen geben und wir entscheiden das zusammen.
Diese Karte ist auch an anderen Stellen der App, da müssen wir die auch gleichermaßen überarbeiten.
Ich finde das nicht optimal gelöst, das betrifft auch die Hintergrundkarten der einzelnen Spalten und auch zum Beispiel die Karte in der angezeigt wird, dass ein Eintrag bereits mit diesem Link besteht.
Es kann aber auch noch an anderen Stellen sein, da müssen wir nochmal drüber schauen.
Das Verschieben nach einer Karte von dem einen Board in die gekocht Spalte von einem anderen Board löst keine Celebration aus.
Ich glaube, das sollten wir auch noch einbauen, dass die Celebration passiert.
Man könnte überlegen, ob man die Celebration dann stattdessen am oberen Bildschirmrand macht.
Oder die generell an den oberen Bildschirmrand verschiebt, damit man die Toasts zum Rückgängigmachen von anderen Sachen unten lässt.
Aber auch das müssen wir zusammen besprechen, am besten zeigst du mir das, damit ich das nochmal entscheiden kann.
Auch random, aber User sollen die Möglichkeit haben, Profilbilder hinzuzufügen, damit in den kleinen Badges, die anzeigen, wer was hochgeladen hat, besser ersichtlich ist, wer es war.
Wir machen weiter mit dem Dish-Detail: Das Öffnen funktioniert problemlos.
Eine Sache, die direkt relevant wird, ist das Anzeigen vom Urheber bzw. vom Uploader des jeweiligen Contents.
Insofern der verfügbar ist, also in der Autor-Zeile auf einer Seite oder einfach der Kanal, auf dem das gepostet wurde, müssen wir das irgendwo ergänzen.
Zum Beispiel unter dem Titel des Gerichts im Dish-Detail und auf dem Board vielleicht auch einfach unter dem Titel.
Das muss auf jeden Fall noch ergänzt werden; es kann auch klein sein, aber es muss mit rein.
Auf dem Board an sich fällt auf: Sobald ein einzelner Titel länger als zwei Zeilen ist, wird die dritte Zeile nur ganz oben ein bisschen angezeigt und abgeschnitten (truncated), was merkwürdig aussieht.
Hier müssen wir schauen, dass wir längere Titel in kleinerer Schriftgröße anzeigen oder eine bessere Lösung finden.
Mindestens soll beim Drüberhovern der ganze Titel angezeigt werden, also brauchen wir Tooltips oder ein vernünftiges Label für den Desktop.
Rückwirkend auf das Hinzufügen neuer Einträge: Großbuchstaben sind uncool und viele Titel sind in All-Caps.
Wir möchten nur, dass jedes Wort am Anfang großgeschrieben wird und nicht alles in Caps ist.
Die Detailansicht hat, falls noch nicht gekocht wurde, unten eine Animation von Snackbert, ich meine Topfbert.
Diese Topfbert-Animation sieht gerade nicht schön aus und ist langweilig, weil es immer die gleiche ist.
Ich möchte einerseits unterschiedliche Animationen haben und Animationen, die schöner sind.
Vielleicht müssen wir uns dafür noch weitere Charaktere ausdenken, die neben Topfbert und dem Pebble, der hin und her rollt, existieren können.
Ganz wichtig: Alles, was Assets betrifft oder Sachen, die schön aussehen sollen, aber keine Kleinigkeiten sind (wie das Runden einer Border oder reine Animationen im Code), wie z.B. eine neue Animation für Topfbert, da musst du mich darauf hinweisen.
Stelle sicher, dass du mir am Ende ein Handover schreibst für Claude Design.
Damit kann ich in Claude Design diese neuen Assets erstellen lassen und dir übergeben, da du der Coding-Agent bist und wir die bestmögliche Implementation haben wollen.
Am Ende muss hier ein Ticket als Prompt mit drin stehen, den ich an Claude Design übergeben kann, um fehlende Assets erstellen zu lassen.
Klugerweise machst du das ganz am Anfang, damit es parallel ablaufen kann.
Die Platzhalter-Images sind leider nicht schön genug und müssen überarbeitet werden.
Ich würde vorschlagen, dass wir die Platzhalter-Images auf 12 Stück reduzieren und Sachen verwerfen, um neue Ideen zu finden.
Was sehr gut funktioniert und bleiben soll: die Ramennudelsuppe mit den Stäbchen, der Burger, die Tacos, die Pfanne bzw. der Wok (Stir-fry), das Brot, der Kuchen, der Smoothie/das Getränk, der Topf und die Dumplings.
Alle anderen Sachen können komplett weg und wir müssen von vorne anfangen – eine gute Aufgabe für Claude Design.
Die ganze App (das generelles UI) soll im ersten Schritt auch in Englisch und im zweiten Schritt in Italienisch nutzbar sein, was natürlich nicht für manuell eingegebene Titel gilt.
Wenn ich in der Detailansicht auf "kochen" oder "gekocht" klicke, geht der Celebration-Toast auf.
Wenn ich dann eine Notiz zur Kochung hinzufügen möchte, öffnet sich der Dialog in der Mitte super, aber der Toast verschiebt sich dann in das Sheet der Detailansicht hinein, anstatt an der gleichen Stelle zu bleiben (das ist ein Bug).
Ein generelles großes Ding: Die Schriftarten gefallen mir nicht hundertprozentig.
Bitte mach ein paar Vorschläge oder übergib das an Claude Design, falls du denkst, dass das dort besser aufgehoben ist.
Für weitere Platzhalter, zum Beispiel beim Erstellen eines neuen Boards, bitte auch Varianten einfügen.
Damit dort nicht immer zum Beispiel "Kochclub" steht, auch andere Varianten nutzen, die gut funktionieren und die man dann so ein bisschen zufällig rotieren kann.
Der Button zum Öffnen der Settings ist eine Sonne, was sehr irritierend ist.
Das soll auf jeden Fall ein normaler Settings-Knopf in irgendeiner Form sein.
Ich würde am ehesten sagen, dass es einfach ein Cogwheel sein kann, dann ist verständlich, was es sein soll.
Einladungslinks funktionieren super, an dieser Stelle ist aber zu erwähnen, dass diese Einladungslinks sehr hässlich sind.
Die UUIDs in der URL sind als Slugs nicht schön.
Deswegen soll jedes Board einen eigenen, schönen Slug bekommen, der sich einfach aus dem Namen des Boards ergibt und sich auch entsprechend ändert, wenn man den Namen des Boards anpasst.
Da muss eben der Hinweis gegeben werden, dass alte Invite-Links vielleicht nicht mehr funktionieren.
Aber ich möchte, dass sowohl die Invite-Links als auch die Links in der URL selber im Browser schöner werden und die UUIDs nur noch intern benutzt werden.
Bin mir nicht sicher, wie gut das funktioniert, aber wenn während meiner Abwesenheit viele neue Einträge gekommen sind, dann sollen die auch alle als neu gekennzeichnet sein.
Das kannst du auch intern testen.
Es ist wichtig, dass nicht nur eine Sache neu ist, sondern alle Sachen, die ich bisher noch nicht gesehen habe.
In den Board-Einstellungen und für jedes Board kann ein Emoji gewählt werden.
Hier ist es vor allen Dingen wichtig, dass nur vegane Emojis benutzt werden können oder Sachen, die veganisierbar sind.
Hier sind einige Emojis dabei, die für mich gar keinen Sinn ergeben und die sollen auf jeden Fall weg.
Vor allen Dingen soll die Pfanne mit dem Ei stattdessen durch irgendetwas anderes ersetzt werden, was definitiv vegan ist.
Alle anderen Sachen sind meiner Meinung nach in Ordnung.
Bitte checken, aber ich glaube, ich habe das Gefühl, im Bereich neue Spalte von den Board-Einstellungen ist auf der rechten Seite der Hinzufügen-Button nicht horizontal zentriert neben dem Input mit dem Platzhalter zum Beispiel "Wochenende".
In der Mitgliederliste gibt es eine Person, die Besitzer ist.
Da steht im Chip "Besitz" dabei.
Das sollte im besten Fall "Besitzer" bzw. "Besitzer:in", also gegendert, sein im Deutschen und im Englischen dann eben "Owner".
Beim Klicken auf den User auf dem Desktop oben rechts geht sofort das Menü auf für Einstellungen.
Ich fände es besser, wenn in erster Instanz ein kleines Menü aufgeht, wo eben steht, wer angemeldet ist.
Und in dem Menü selber gibt es dann einfach die Option für das Öffnen von den Einstellungen.
Mehr muss da eigentlich aktuell auch noch nicht rein.
Außer eigentlich, wer ist angemeldet, ein Button um die Einstellungen zu öffnen (also /settings) und vielleicht auch noch die Option, sich von dort aus abzumelden, damit man sich einen Klick spart.
Drag and Drop in den Board-Einstellungen funktioniert nicht zuverlässig und mindestens hakelig.
Manchmal hebt man einzelne Karten an, will die draggen und dann bleiben die quasi in der Luft hängen, bis man sie wieder anfasst.
Das funktioniert dann, wenn man oft genug klickt, aber die User Experience ist grauenvoll.
Diese Animation, ich weiß nicht, wo die herkommt, die müssen wir uns auf jeden Fall noch mal anschauen und fixen, denn das geht so gar nicht.
Titel von den Inputs, das gilt wahrscheinlich auch für andere Teile der App, sehen nicht schön aus.
Wir sind in den Board-Einstellungen und der Titel Name, der Titel neue Spalte und der Titel Einladungslink über den Inputs sind nicht sauber gestylt und sehen sehr off aus.
Die sind links-aligned mit dem Input, haben keinerlei Padding, haben kein gutes eigenes Styling.
Im besten Fall oder im schönsten Fall stelle ich mir die so als Field Legend vor, die so in der Border drin ist.
Da müssen wir auch eventuell mal ein paar Varianten ausprobieren, wenn du dir das zutraust und findest, dass du da alle Möglichkeiten abbilden kannst, dann machst du das, alternativ übergib das einfach an Claude Design.
Eine große Sache noch sind die Titel der Karten für die Spalten, also für die einzelnen Boards, also "Ideen" oder "gekocht".
Hier ist sehr wichtig, mir fällt auf, dass wir stark von dem Mockup abweichen, von dem wir am Anfang gestartet sind.
Warum haben wir das getan? Und falls es keinen guten Grund gibt, lass uns zum Mockup zurückkehren, weil diese Titel viel schöner sind.
Ich finde, insbesondere auf dem Desktop sollten wir dahin zurückkehren, auf Mobile sollten wir es auf jeden Fall auch versuchen.
Dieser ganze Test bezieht sich ja nur auf Desktop, aber das sieht gerade noch sehr schwach aus, das ist einfach nur eine grundsätzliche Font und das ist irgendwie nicht schön.
Im Header links gibt's ja das Dropdown für die verschiedenen Boards.
Das funktioniert auch super, die Animationen funktionieren super, die kleinen Bounces sehen gut aus.
Der Clickable Trigger für das Menü, in dem der Boardname steht mit dem Emoji links daneben und dem Chevron rechts daneben, schneidet leider den Emoji ab.
Der Emoji ist nicht gänzlich sichtbar, ich hab das mit einem Cookie probiert, der Cookie ist vergleichsweise groß als Emoji und der ist oben und unten abgeschnitten.
Das ist nicht gut, da müssen wir einfach gucken, dass das auch noch mit reinpasst und vernünftig funktioniert.
Den Titel, also den Login-Bildschirm, müssen wir auch noch leicht überarbeiten.
Die Platzhalter-Images, die um Topfbert herum rotieren, müssen teilweise ausgetauscht und angepasst werden, wie bereits zuvor erwähnt.
Die Animationen hier fühlen sich auf dem Desktop nicht flüssig genug an, was wahrscheinlich an den 30 FPS liegt.
Zudem sehen alle hier animierten Images so aus, als hätten sie weniger Pixel und wirken etwas verpixelt.
Das Fixen dieser Verpixelung wäre super, vielleicht liegt es auch daran, dass die Bildschirme größer sind.
Unter den rotierenden Platzhaltern mit Topfbert steht ein kleines "mahlkochen" und darunter der große Header "Was willst du mahlkochen".
Das obere, kleine "mahlkochen" kann weg.
Wir können Farbe ins Spiel bringen, indem wir in der Headline "Was willst du mahlkochen" das Wort "mahlkochen" einfärben und visuell hervorheben, um klarzumachen, dass dies der App-Name ist.
Das Leerzeichen in "mahlkochen" in der Headline sollte entfernt werden, um den Bezug klarzustellen.
Die Beschreibung darunter sollte in den Singular übertragen werden: "Sammel Essen, das du online findest und plane, was du als nächstes kochen möchtest" oder "was du als nächstes kochst".
Das wäre alles für Desktop.
Stelle sicher, dass du noch einmal alle Visuals gegen unsere Mockups vom Anfang prüfst und checkst, ob sie übereinstimmen.
Falls sie nicht übereinstimmen, melde das (flagge das) zu mir und wir schauen darüber, ob wir die Sachen anpassen können.
