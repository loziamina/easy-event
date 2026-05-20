# 03 - Domain Model

## 1. Roles et permissions (RBAC)

| Role | Creer une demande evenement | Lire ses evenements | Gerer les evenements de l'organisation | Gerer catalogue/devis | Assigner staff | Gerer staff | Gerer organisateurs | Voir audit | Recevoir emails |
|------|------------------------------|---------------------|----------------------------------------|----------------------|----------------|-------------|---------------------|------------|----------------|
| CLIENT | Oui | Oui, uniquement les siens | Non | Non | Non | Non | Non | Non | Oui |
| ORGANIZER_STAFF | Non | Oui, uniquement les evenements assignes | Oui, sur evenements assignes | Oui, dans son organisation | Non | Non | Non | Oui, perimetre organisation | Oui |
| ORGANIZER_OWNER | Non | Oui, perimetre organisation | Oui, tous les evenements de l'organisation | Oui, dans son organisation | Oui | Oui | Oui, son organisation | Oui, perimetre organisation | Oui |
| PLATFORM_ADMIN | Non | Oui, tous les perimetres | Oui, tous les evenements | Oui, selon besoin support | Oui | Oui | Oui, plateforme | Oui, global | Oui |

Principes RBAC :
- Le role est stocke comme une valeur explicite, jamais comme un simple `isAdmin`.
- Une action sensible doit verifier le role cote serveur, meme si le bouton est cache cote interface.
- Le client ne peut voir et modifier que ses propres demandes.
- Le staff ne peut gerer que les evenements de son organisation qui lui sont assignes.
- Le responsable organisateur gere l'espace de son organisation, sans acceder aux donnees d'une autre organisation.
- L'administrateur plateforme garde un acces support et moderation sur l'ensemble de la plateforme.

## 2. Regles metier (numerotees)

- RM-01 : un email utilisateur est unique dans tout le systeme.
- RM-02 : un utilisateur non authentifie ne peut acceder a aucune donnee evenementielle privee.
- RM-03 : un utilisateur ne peut consulter que les ressources autorisees par son role et son perimetre.
- RM-04 : un client peut creer, modifier ou supprimer une demande uniquement tant qu'elle reste en brouillon ou non finalisee.
- RM-05 : un evenement soumis passe de `DRAFT` a `PENDING_APPROVAL`.
- RM-06 : un evenement en attente peut etre accepte, refuse ou renvoye en brouillon.
- RM-07 : un evenement accepte peut etre planifie ou refuse si l'organisateur ne peut finalement pas le prendre.
- RM-08 : un evenement planifie peut etre marque comme termine, mais ne peut plus revenir en brouillon.
- RM-09 : un evenement termine devient une reference historique et ne doit plus etre modifie sur ses informations principales.
- RM-10 : chaque changement de statut important d'un evenement doit etre trace dans l'historique.
- RM-11 : chaque action importante qui concerne un utilisateur doit creer une notification et, pour les actions critiques, envoyer un email.
- RM-12 : lorsqu'un evenement est assigne a un membre du staff, ce membre doit recevoir un email d'assignation.
- RM-12bis : un responsable organisateur peut modifier les coordonnees des membres de son staff rattaches a la meme organisation, y compris l'email de connexion si celui-ci reste unique.
- RM-13 : un devis est toujours rattache a un evenement existant.
- RM-14 : un devis en brouillon peut etre modifie par l'organisateur.
- RM-15 : un devis envoye au client ne doit pas etre modifie silencieusement ; toute modification doit creer une nouvelle version ou repasser par une action explicite.
- RM-16 : un devis accepte ou refuse garde sa decision et sa date de decision.
- RM-17 : un produit du catalogue peut etre indisponible sans etre supprime, afin de conserver l'historique des evenements et devis.
- RM-18 : une prestation deja rattachee a un evenement conserve ses informations utiles meme si le catalogue evolue ensuite.
- RM-19 : une organisation peut etre `PENDING`, `APPROVED` ou `SUSPENDED`.
- RM-20 : une organisation suspendue ne doit plus pouvoir recevoir de nouvelles demandes client.
- RM-21 : une conversation doit toujours etre rattachee a un client et a un interlocuteur organisateur ou admin.
- RM-22 : les pieces jointes et maquettes doivent rester liees a leur evenement pour conserver le contexte de validation.
- RM-23 : une maquette validee ne doit pas etre remplacee silencieusement ; une nouvelle version doit etre creee.
- RM-24 : un ticket support doit garder son historique de statut jusqu'a resolution ou refus.
- RM-25 : les donnees personnelles doivent etre limitees aux informations necessaires a la gestion de l'evenement.
- RM-26 : la base de donnees garantit l'integrite minimale : unicite email, relations entre evenement/client/devis, references obligatoires.
- RM-27 : la logique metier doit vivre cote serveur dans des fonctions ou services dedies ; le front sert a guider l'utilisateur, pas a garantir seul les regles.

## 3. Machines a etats (entites a statuts)

### Entite : Evenement

- Etats : `DRAFT`, `PENDING_APPROVAL`, `ACCEPTED`, `REFUSED`, `PLANNED`, `DONE`
- Transitions autorisees :
  - `DRAFT` -> `PENDING_APPROVAL` : le client soumet sa demande.
  - `PENDING_APPROVAL` -> `ACCEPTED` : l'organisateur accepte la demande.
  - `PENDING_APPROVAL` -> `REFUSED` : l'organisateur refuse la demande.
  - `PENDING_APPROVAL` -> `DRAFT` : la demande doit etre completee ou corrigee.
  - `ACCEPTED` -> `PLANNED` : l'organisation operationnelle est confirmee.
  - `ACCEPTED` -> `REFUSED` : l'organisateur annule avant planification.
  - `REFUSED` -> `PENDING_APPROVAL` : le client ou l'organisateur relance la demande apres correction.
  - `PLANNED` -> `DONE` : l'evenement est termine.
  - `PLANNED` -> `ACCEPTED` : le planning doit etre repris.
- Transitions interdites :
  - `DRAFT` -> `DONE`
  - `PENDING_APPROVAL` -> `DONE`
  - `DONE` -> tout autre statut

### Entite : Devis

- Etats : `DRAFT`, `SENT`, `ACCEPTED`, `REFUSED`
- Transitions autorisees :
  - `DRAFT` -> `SENT` : l'organisateur envoie le devis au client.
  - `SENT` -> `ACCEPTED` : le client accepte le devis.
  - `SENT` -> `REFUSED` : le client refuse le devis.
  - `SENT` -> `DRAFT` : l'organisateur reprend le devis apres demande de modification.
- Transitions interdites :
  - `ACCEPTED` -> `DRAFT` sans nouvelle version.
  - `REFUSED` -> `ACCEPTED` sans nouvel envoi ou validation explicite.

### Entite : Organisation

- Etats : `PENDING`, `APPROVED`, `SUSPENDED`
- Transitions autorisees :
  - `PENDING` -> `APPROVED` : l'administrateur valide l'organisation.
  - `PENDING` -> `SUSPENDED` : l'administrateur bloque une organisation non conforme.
  - `APPROVED` -> `SUSPENDED` : l'administrateur suspend l'organisation.
  - `SUSPENDED` -> `APPROVED` : l'administrateur reactive l'organisation.

### Entite : Maquette

- Etats : `PENDING`, `APPROVED`, `CHANGES_REQUESTED`
- Transitions autorisees :
  - `PENDING` -> `APPROVED` : le client valide la maquette.
  - `PENDING` -> `CHANGES_REQUESTED` : le client demande des modifications.
  - `CHANGES_REQUESTED` -> `PENDING` : l'organisateur soumet une nouvelle version.

### Entite : Ticket support

- Etats : `OPEN`, `IN_PROGRESS`, `RESOLVED`, `REFUSED`
- Transitions autorisees :
  - `OPEN` -> `IN_PROGRESS` : un administrateur prend le ticket en charge.
  - `OPEN` -> `REFUSED` : la demande est hors perimetre ou invalide.
  - `IN_PROGRESS` -> `RESOLVED` : le probleme est traite.
  - `IN_PROGRESS` -> `REFUSED` : la demande ne peut pas etre satisfaite.

## 4. Cas d'erreur identifies

- Utilisateur non connecte qui tente d'acceder a un evenement prive -> reponse `401 Unauthorized`, redirection vers la connexion.
- Utilisateur connecte mais hors perimetre qui tente une action interdite -> reponse `403 Forbidden`, aucune modification, tentative journalisee si action sensible.
- Client qui tente de modifier un evenement deja accepte, planifie ou termine -> action refusee avec message clair.
- Organisateur qui tente d'assigner un staff d'une autre organisation -> action refusee, aucun email envoye.
- Email d'assignation impossible a envoyer -> l'assignation reste valide, une notification interne est creee, l'erreur email est loggee pour relance.
- Deux utilisateurs modifient le meme evenement presque en meme temps -> derniere modification controlee cote serveur ; les changements de statut doivent passer par la machine a etats.
- Produit devenu indisponible apres ajout a un evenement -> l'historique reste lisible, mais le produit ne peut plus etre ajoute a de nouvelles demandes.
- Devis accepte puis modification demandee -> creation d'une nouvelle version ou retour explicite en brouillon selon decision produit.
- Organisation suspendue avec evenements en cours -> les evenements existants restent consultables, mais aucune nouvelle demande ne peut etre creee pour cette organisation.
- Donnee ancienne incomplete apres migration -> l'API degrade proprement l'affichage ou bloque l'action avec un message explicite plutot que de crasher.
