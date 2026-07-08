# Directe client-toegang tot Supabase, beveiligd via RLS met de nano-id als capability

Er zijn geen accounts, dus geen login. De browser praat rechtstreeks met Supabase via de publieke anon-key; er is geen eigen serverlaag. Toegang wordt beveiligd met Row Level Security: de room-`nanoid` (21 tekens, onraadbaar) is de enige capability. Er bestaat géén blanket-select-policy, zodat niemand met de anon-key alle rooms of retrospectives kan enumereren — je komt alleen bij data waarvan je de room-`nanoid` al kent.

## Consequences

- **Efemere vs. persistente data.** Live planning-poker-state (stemmen die nog niet onthuld zijn, presence, timer) loopt via Supabase Broadcast/Presence en raakt de database niet. Alleen persistente data — room, retrospectives, kaarten, acties — gaat de DB in, onder RLS.
- De onraadbaarheid van de room hangt volledig aan de entropie van de `nanoid`; die moet lang genoeg blijven (21 tekens).
- Geen server betekent geen plek voor server-side secrets of vertrouwde validatie; alle autorisatie moet in RLS-policies uitdrukbaar zijn.
