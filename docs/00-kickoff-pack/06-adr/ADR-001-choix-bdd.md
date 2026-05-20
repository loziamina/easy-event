# ADR-001 : Choix de PostgreSQL comme base de donnees principale

**Date :** 2026-05-20  
**Statut :** Accepte  
**Decideurs :** Amina, equipe technique

## Contexte

EasyEvent est une plateforme de gestion d'evenements avec des donnees fortement relationnelles : utilisateurs, organisateurs, evenements, catalogue, devis, commandes, conversations, notifications, tickets et audit.

Le MVP doit etre livre rapidement, mais le modele de donnees doit rester fiable car il portera les workflows critiques : droits d'acces, historique d'evenement, devis, commandes et suivi organisateur.

Contraintes principales :

- equipe reduite, besoin d'une technologie connue et documentee ;
- donnees relationnelles avec contraintes d'integrite ;
- besoin de transactions pour les commandes, devis et changements de statut ;
- hebergement possible en local via Docker et en cloud via Supabase ;
- cout initial faible et migration possible hors fournisseur.

## Options envisagees

1. PostgreSQL 16 avec Prisma.
2. MongoDB.
3. SQLite.
4. Firestore ou autre BaaS documentaire.

## Decision retenue

Utiliser PostgreSQL 16 comme base de donnees principale, avec Prisma comme ORM et outil de migrations.

## Justification

- Les donnees EasyEvent sont naturellement relationnelles : un evenement appartient a un client, peut etre gere par un organisateur, contenir des prestations, generer des devis et garder un historique.
- PostgreSQL apporte des transactions, des contraintes et des index matures.
- L'equipe peut travailler avec un schema explicite dans `prisma/schema.prisma`, sans multiplier les conventions implicites.
- Prisma accelere le MVP avec un client type, des relations lisibles et des migrations versionnees.
- PostgreSQL est une technologie mature, abondamment documentee, facile a heberger et a recruter.
- Supabase reste reversible car le moteur sous-jacent est PostgreSQL standard.
- PostgreSQL permet d'ajouter du JSON/JSONB plus tard si certains champs semi-structures le justifient.

## Consequences

Positives :

- Integrite referentielle geree par la base et le schema Prisma.
- Requetes analytiques et filtres metier possibles sans changer de moteur.
- Migrations versionnees pour suivre l'evolution du modele.
- Environnement local reproductible avec PostgreSQL dans Docker.

Negatives :

- Le schema doit etre pense et migre proprement ; la flexibilite brute est plus faible qu'en NoSQL.
- Prisma ajoute une couche d'abstraction a connaitre et surveiller.
- Certaines donnees actuellement serialisees en texte devront etre normalisees ou typees JSON.
- Un changement futur vers un modele event-sourced ou documentaire demanderait une migration lourde.
