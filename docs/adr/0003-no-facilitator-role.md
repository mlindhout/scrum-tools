# Geen facilitator-/scrummaster-rol; alleen Participant en Spectator

Planning poker kent bewust geen aparte facilitator- of scrummaster-rol. Er zijn maar twee modi: Participant (heeft een kaart en stemt) en Spectator (aanwezig, geen kaart, telt niet mee voor de reveal). Round-besturing ("new round" / herstart) staat open voor iederéén, ook Spectators. Een niet-schattende scrummaster wordt daarmee gemodelleerd als een Spectator die de rondes drijft — zonder permissiemachinerie, wat past bij het accountloze, rol-loze karakter van de app.

## Consequences

- Geen autorisatielogica rond round-besturing; elke aanwezige mag starten/herstarten.
- De Participant/Spectator-modus wordt per room onthouden in local storage (anders dan de globaal onthouden display-naam).
- De all-voted-reveal vuurt alleen als er ≥1 Participant is en die allemaal gestemd hebben; een room met uitsluitend Spectators onthult pas bij timeout.
