# ADR-002 : Choix de Next.js comme framework backend et frontend MVP

**Date :** 2026-05-20  
**Statut :** Accepte  
**Decideurs :** Amina, equipe technique

## Contexte

EasyEvent doit livrer un MVP web avec interface utilisateur, authentification, API, catalogue, gestion d'evenements, devis, messagerie, notifications et back-office organisateur/admin.

L'equipe est reduite et le delai de livraison impose de limiter le nombre de services, de depots et de deploiements. Le projet n'a pas encore besoin d'une architecture microservices.

Contraintes principales :

- aller vite sur un MVP fonctionnel ;
- garder une seule base de code pour le front et l'API ;
- s'appuyer sur React, technologie largement connue ;
- permettre un deploiement simple ;
- garder la possibilite d'extraire des services metier plus tard si le produit grossit.

## Options envisagees

1. Next.js full-stack avec routes API.
2. React frontend + Express backend separe.
3. Frontend React + backend NestJS.
4. Backend Django/Rails + frontend separe.

## Decision retenue

Utiliser Next.js comme socle full-stack du MVP : pages React, composants, routes API sous `pages/api`, et couche metier dans `lib/*`.

## Justification

- Next.js permet de livrer rapidement une application web complete sans maintenir deux projets separes.
- React est une technologie mature avec une grande communaute, beaucoup de documentation et un recrutement plus simple.
- Les routes API suffisent pour les besoins MVP : CRUD, auth, RBAC, devis, messages, notifications et back-office.
- La proximite entre front et API reduit le cout de coordination pour une petite equipe.
- Le projet peut garder une architecture claire en separant les responsabilites : routes API pour HTTP/session/validation, services `lib/*` pour logique metier, Prisma pour persistance.
- Un backend dedie reste possible plus tard si les volumes, les workers ou les integrations externes l'exigent.

## Consequences

Positives :

- Livraison MVP plus rapide avec un seul depot et une seule stack principale.
- Moins de configuration pour le developpement local et le deploiement.
- API et interface evoluent ensemble.
- Architecture comprehensible pour un nouveau dev en peu de temps.

Negatives :

- Risque de melanger logique UI, API et metier si la separation `pages/api` / `lib/*` n'est pas respectee.
- Les routes API Next.js ne remplacent pas une architecture backend stricte pour une grande equipe.
- Les workers asynchrones, files de jobs ou traitements lourds devront etre ajoutes separement.
- Si le produit grossit fortement, certaines logiques devront etre extraites dans des modules ou services dedies.
