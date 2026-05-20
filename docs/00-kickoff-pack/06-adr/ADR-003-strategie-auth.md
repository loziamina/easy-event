# ADR-003 : Strategie d'authentification avec NextAuth et RBAC explicite

**Date :** 2026-05-20  
**Statut :** Accepte  
**Decideurs :** Amina, equipe technique

## Contexte

EasyEvent manipule plusieurs profils avec des droits differents :

- `CLIENT` : cree et suit ses demandes d'evenement ;
- `ORGANIZER_STAFF` : gere les evenements assignes ;
- `ORGANIZER_OWNER` : gere l'espace organisateur, le catalogue, les devis et le staff ;
- `PLATFORM_ADMIN` : administre la plateforme et les organisateurs.

Le projet doit eviter une logique fragile basee sur un booleen `isAdmin`. Les permissions doivent etre controlees cote serveur car le front peut etre contourne.

Contraintes principales :

- authentification rapide a mettre en place pour le MVP ;
- support email/mot de passe et OAuth Google possible ;
- sessions compatibles avec Next.js ;
- RBAC lisible et centralise ;
- possibilite d'ajouter SSO ou providers externes plus tard.

## Options envisagees

1. NextAuth avec Credentials, Google provider optionnel et RBAC applicatif.
2. Auth maison complete avec JWT et refresh token.
3. Service externe type Auth0/Clerk.
4. Auth simplifiee avec un champ `isAdmin`.

## Decision retenue

Utiliser NextAuth pour l'authentification, une session JWT geree par NextAuth, et un RBAC explicite centralise dans `lib/permissions.js`.

## Justification

- NextAuth s'integre directement a Next.js et reduit le risque d'erreur sur la gestion de session.
- Le provider Credentials permet de garder email/mot de passe pour le MVP.
- Le provider Google peut etre active par variables d'environnement sans changer toute l'architecture.
- Les roles explicites couvrent les besoins metier actuels mieux qu'un simple `isAdmin`.
- Les helpers RBAC dans `lib/permissions.js` rendent les controles reutilisables dans les routes API.
- La strategie reste reversible : les utilisateurs et roles restent dans PostgreSQL, pas enfermes dans un fournisseur externe.

## Consequences

Positives :

- Authentification operationnelle rapidement.
- Controle serveur des permissions par role et perimetre.
- Ajout futur d'OAuth/SSO possible.
- Roles lisibles dans le code et dans la base.

Negatives :

- Les routes API doivent appliquer explicitement les controles RBAC ; NextAuth seul ne suffit pas.
- Le modele actuel `User.role` est simple, mais devra evoluer vers une table de membership si un utilisateur peut avoir plusieurs roles dans plusieurs organisations.
- Les protections complementaires restent a ajouter avant production : rate limiting, bcrypt cost 12, politique de session, audit et monitoring des tentatives sensibles.
- Une migration vers un service d'identite externe demanderait une reprise des flux auth et des callbacks.
