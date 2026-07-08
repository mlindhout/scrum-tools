# Stemgeheim is UI-niveau; live tafelstaat via Presence

Er is geen vertrouwde server (zie ADR 0002), dus Votes worden niet server-afgedwongen geheim gehouden tot de reveal. Het verbergen gebeurt op UI-niveau onder een honest-participant-aanname: eerlijk voor een normaal teamlid, maar iemand die netwerkverkeer of de client inspecteert kan een stem vroegtijdig zien. Voor een intern teamtool is dat acceptabel; cryptografisch stemmen verbergen is onevenredig veel complexiteit.

De live tafelstaat loopt via Supabase Presence: elke aanwezige client publiceert of hij gestemd heeft (grijs/groen), Presence synct die volledige staat automatisch naar laatkomers, en de echte waarden gaan pas bij de reveal via broadcast over de lijn.

## Consequences

- Een "votes kunnen vroegtijdig gezien worden"-melding is by design, geen bug.
- Laatkomers midden in een Round krijgen de tafelstaat gratis via Presence-sync; geen aparte sync-server nodig.
