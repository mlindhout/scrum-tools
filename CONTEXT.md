# Scrum Tools

An accountless web app for two Scrum tools — planning poker and retrospectives — where teams collaborate in shared rooms.

## Language

**Room**:
A shared space where a team collaborates, created by anyone and reachable via a shared link with a `nanoid`. Contains a planning poker section and a retrospective section.
_Avoid_: Board, session, workspace

**Member**:
A participant in a room, identified by a stable `clientId` (a `nanoid` in local storage) with a display name as its label. The name is unique within a room; the `clientId` survives a refresh, so a member reclaims their seat (votes, cards).
_Avoid_: User, participant, account

**clientId**:
The stable, per-browser identity of a member, generated as a `nanoid` and kept in local storage. Independent of the display name; the same `clientId` is reused across rooms.

## Planning Poker

**Round**:
An ephemeral estimation round: a 30-second timer during which present members cast a Vote. Exists only live (via presence/broadcast), is not persisted. Ends on reveal.
_Avoid_: Game, session, vote round

**Vote**:
The value a member picks in a Round from the deck, hidden until the reveal. Displayed visually as that member's card (grey = not yet voted, green = voted).
_Avoid_: Card (that word is reserved for the retrospective), estimate, point

**Reveal**:
The moment all Votes become visible — as soon as every present member has voted or the timer expires — shown sorted ascending by value.

**Deck**:
The fixed set of vote values: `0, 1, 2, 3, 5, 8, 13, 20, 40, 100, ?`. `?` means "cannot estimate" and sorts to the back on reveal.

**Participant**:
A member who takes part in poker: has a card, casts a Vote, and counts toward the all-voted reveal.

**Spectator**:
A present member without a card who does not vote and does not count toward the reveal, but sees everything. Can still start/restart a Round (this is how a non-estimating scrum master is modelled: a Spectator who drives the rounds). The mode (Participant/Spectator) is remembered per room in local storage.
_Avoid_: Observer, viewer, scrum master (there is no separate scrum master role)

## Retrospective

**Retrospective**:
A persistent, live-collaborative session within a room with its own id and an editable date label (defaults to today; multiple on the same date are allowed). Contains three fixed columns and a list of Actions. Can be locked to block editing.
_Avoid_: Retro board, session

**Column**:
One of the three fixed columns of a Retrospective: `Praise`, `We should start…`, `We should stop…`. Not configurable.

**Card**:
A text note a member places in a Column. Can collect +1's from members. Right-click (or long-press on mobile) opens creating an Action. (In poker the equivalent is a Vote — "Card" is reserved for the retro here.)
_Avoid_: Note, sticky, item

**Action**:
A follow-up item created from a Card (right-click / long-press) but standalone thereafter: a description, an optional assignee (free text) and a done toggle. Shown as a list beneath the table. Keeps no reference to the source Card.
_Avoid_: Task, todo, follow-up

**Lock**:
The frozen state of a Retrospective: fully read-only (no cards, +1's or actions editable). Any member can lock/unlock a retro; a new retro starts unlocked.
