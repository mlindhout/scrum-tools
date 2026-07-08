# Scrum Tools

## Goal

I want an app to support two essential Scrum tools: planning poker and retrospectives.

## Functionality

### Team access

- no account creating is necessary
- anyone can 'create a team room' (has a name) and share the link
- a room should have a 'nano id' (e.g. UrEB66BKy8kionQq64hmx)
- anyone with the link can join the room
- providing a (unique) member name is required when accessing the room
- member name is stored in local storage and reused when (re)joining the (or another) room
- a room is removed after 90 days of inactivity
- a room has two sections: planning poker and retrospective
- when entering the site for the first time, a landing page is shown with a link to create (and name) a room
- for a returning visitor, the last used room is automatically re-used
- inside a room, you can also create a new room

### Planning Poker

- there is 'new round' button
- once pushed, a timer of 30 seconds starts and is shown on top
- at the center, for each member, the back of a grey card is shown with their name
- at the buttom the scrum fibonacci sequence is shown (including ?)
- when a user clicks a fibonacci number, his card turns green
- once all cards are green, or the timer expires, all cards are revealed, sorted by value ascending

### Retrospective

- drop down in header shows past (dated) retrospectives
- retrospective's can be locked/unlocked (to prevent editing)
- there is a 'new retrospective' button, defaults to today's date
- full width 3 columns table: | praise... | we should start... | we should stop.... |
- any visitor can place cards in any column with some text
- +1's can be added to cards (clicking again removes your vote)
- right-click on a card reveals a 'create action' modal
- these actions appear beneath the table

## Technology

- NodeJS/Typescript
- React
- Tailwind 4
- Deployed on a free cloud provider
