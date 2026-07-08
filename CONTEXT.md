# Scrum Tools

Een accountloze webapp voor twee Scrum-tools — planning poker en retrospectives — waarin teams samenwerken in gedeelde rooms.

## Language

**Room**:
Een gedeelde ruimte waar een team samenwerkt, aangemaakt door iedereen en bereikbaar via een gedeelde link met een `nanoid`. Bevat een sectie planning poker en een sectie retrospective.
_Avoid_: Board, session, workspace

**Member**:
Een deelnemer aan een room, geïdentificeerd door een stabiele `clientId` (een `nanoid` in local storage) met een display-naam als label. De naam is uniek binnen een room; de `clientId` overleeft een refresh, zodat een member zijn stoel (stemmen, kaarten) terugpakt.
_Avoid_: User, participant, account

**clientId**:
De stabiele, per-browser identiteit van een member, gegenereerd als `nanoid` en bewaard in local storage. Onafhankelijk van de display-naam; hetzelfde `clientId` wordt hergebruikt over rooms heen.

## Planning Poker

**Round**:
Een efemere schattingsronde: een 30-secondentimer waarin aanwezige members een Vote uitbrengen. Bestaat alleen live (via presence/broadcast), wordt niet bewaard. Eindigt bij reveal.
_Avoid_: Game, session, vote round

**Vote**:
De waarde die een member in een Round kiest uit de deck, verborgen tot de reveal. Visueel weergegeven als de kaart van die member (grijs = nog niet gestemd, groen = gestemd).
_Avoid_: Card (dat woord is gereserveerd voor de retrospective), estimate, point

**Reveal**:
Het moment waarop alle Votes zichtbaar worden — zodra elke aanwezige member gestemd heeft óf de timer afloopt — getoond oplopend gesorteerd op waarde.

**Deck**:
De vaste set stemwaarden: `0, 1, 2, 3, 5, 8, 13, 20, 40, 100, ?`. `?` betekent "kan niet schatten" en sorteert bij reveal achteraan.

**Participant**:
Een member die deelneemt aan poker: heeft een kaart, brengt een Vote uit en telt mee voor de all-voted-reveal.

**Spectator**:
Een aanwezige member zonder kaart die niet stemt en niet meetelt voor de reveal, maar wel alles ziet. Kan nog steeds een Round starten/herstarten (zo wordt een niet-schattende scrummaster gemodelleerd: een Spectator die de rondes drijft). De modus (Participant/Spectator) wordt per room onthouden in local storage.
_Avoid_: Observer, viewer, scrummaster (er is geen aparte scrummaster-rol)

## Retrospective

**Retrospective**:
Een persistente, live-collaboratieve sessie binnen een room met een eigen id en een aanpasbaar datum-label (standaard vandaag; meerdere op dezelfde datum mogen). Bevat drie vaste kolommen en een lijst Actions. Kan gelocked worden om bewerken te blokkeren.
_Avoid_: Retro board, session

**Column**:
Eén van de drie vaste kolommen van een Retrospective: `Praise`, `We should start…`, `We should stop…`. Niet configureerbaar.

**Card**:
Een tekstnotitie die een member in een Column plaatst. Kan +1's van members verzamelen. Rechtsklik (of long-press op mobiel) opent het aanmaken van een Action. (In poker heet het equivalent een Vote — "Card" is hier gereserveerd voor de retro.)
_Avoid_: Note, sticky, item

**Action**:
Een follow-up-item dat vanuit een Card wordt aangemaakt (rechtsklik / long-press) maar daarna losstaat: een beschrijving, optionele assignee (vrije tekst) en een done-toggle. Getoond als lijst onder de tabel. Houdt géén referentie naar de bron-Card.
_Avoid_: Task, todo, follow-up

**Lock**:
De bevroren toestand van een Retrospective: volledig read-only (geen kaarten, +1's of acties wijzigbaar). Elke member kan een retro locken/unlocken; een nieuwe retro start unlocked.
