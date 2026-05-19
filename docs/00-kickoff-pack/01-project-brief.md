# 01 - Project Brief

## 1. Probleme
Les organisateurs d'evenements gerent aujourd'hui les demandes clients, les devis, les validations, le planning et les echanges dans plusieurs outils disperses comme WhatsApp, Excel, les appels et les emails. Cette fragmentation provoque des pertes d'information, un suivi peu fiable et une experience client difficile a professionnaliser.

## 2. Cible
- Utilisateur principal : organisateur d'evenements independant ou petite structure qui gere plusieurs prestations client en parallele.
- Pain actuel : les informations sont saisies plusieurs fois, les validations sont difficiles a tracer, les devis ne sont pas toujours relies a l'evenement et le planning operationnel reste fragile.

## 3. Solution proposee (haut niveau)
EasyEvent propose une plateforme web centralisee pour piloter le cycle de vie d'un evenement : creation de demande, gestion du catalogue, selection de prestations, devis, validation, conversation client, maquettes, planning, suivi operationnel et historique. L'objectif n'est pas seulement de numeriser les taches, mais de donner un espace commun ou chaque acteur sait quoi faire, quand le faire et dans quel etat se trouve l'evenement.

## 4. Contexte projet
- Type : projet de formation / projet personnel presente comme preuve de conception.
- Equipe : developpement principalement solo, avec un profil full-stack junior utilisant Next.js, Prisma, NextAuth et PostgreSQL.
- Delai cible : MVP stabilise en 4 a 6 semaines, puis consolidation technique et documentation avant presentation.

## 5. Contraintes non negociables
- Authentification obligatoire et separation claire des roles : client, staff organisateur, responsable organisateur, administrateur plateforme.
- Donnees clients et evenements protegees : chaque utilisateur ne doit acceder qu'aux ressources de son perimetre.
- Tracabilite minimale des actions importantes via historique, notifications ou journal d'audit.
- Base de donnees relationnelle propre avec Prisma et migrations versionnees.
- Parcours MVP utilisable sans application mobile native.
- Respect des principes RGPD : minimisation des donnees, securisation des acces, possibilite de corriger les informations de profil.

## 6. Critere de succes
Dans les 6 mois, un organisateur peut traiter au moins 80 % d'une demande evenementielle complete dans EasyEvent, de la creation de l'evenement jusqu'au devis et a la planification, sans devoir maintenir un suivi principal dans Excel ou WhatsApp.
