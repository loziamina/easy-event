# 02 - Product Scope

## 1. Backlog priorise (MoSCoW)

### MUST (MVP)
- US-01 : En tant que client, je veux creer un compte et me connecter, afin de suivre mes demandes d'evenement dans un espace personnel.
- US-02 : En tant que client, je veux creer une demande d'evenement avec une date, un lieu, un budget, un nombre d'invites et des besoins, afin de transmettre une demande claire a l'organisateur.
- US-03 : En tant que client, je veux consulter un catalogue de prestations, afin de choisir les produits ou services utiles pour mon evenement.
- US-04 : En tant que client, je veux ajouter des prestations a mon evenement, afin de preparer une demande exploitable par l'organisateur.
- US-05 : En tant qu'organisateur, je veux consulter les demandes d'evenement de mon perimetre, afin de les traiter sans perdre d'information.
- US-06 : En tant qu'organisateur, je veux accepter, refuser ou faire avancer le statut d'un evenement, afin de piloter son cycle de vie.
- US-07 : En tant qu'organisateur, je veux creer et envoyer un devis lie a un evenement, afin de formaliser la proposition commerciale.
- US-08 : En tant que client, je veux consulter le statut de mon evenement et de mon devis, afin de savoir ou en est ma demande.
- US-09 : En tant que client et organisateur, je veux echanger des messages lies au projet, afin de centraliser les decisions et les informations importantes.
- US-10 : En tant qu'administrateur ou responsable organisateur, je veux gerer les roles et les droits d'acces, afin de proteger les donnees de chaque utilisateur.
- US-11 : En tant qu'utilisateur, je veux recevoir un email lorsqu'une action importante me concerne, afin d'etre informe sans devoir rester connecte a la plateforme.

### SHOULD (V1.1)
- US-12 : En tant qu'organisateur, je veux affecter un membre du staff a un evenement, afin de clarifier la responsabilite operationnelle.
- US-13 : En tant que membre du staff, je veux recevoir un email lorsqu'un evenement m'est assigne, afin de prendre connaissance rapidement de ma nouvelle responsabilite.
- US-14 : En tant qu'organisateur, je veux gerer une checklist par evenement, afin de suivre les taches restantes avant le jour J.
- US-15 : En tant qu'organisateur, je veux bloquer des creneaux de planning, afin d'eviter les conflits de disponibilite.
- US-16 : En tant qu'organisateur, je veux partager des maquettes ou documents avec le client, afin de faire valider les elements visuels.
- US-17 : En tant qu'utilisateur, je veux recevoir des notifications dans l'application, afin de ne pas manquer les changements importants lorsque je suis connecte.
- US-18 : En tant qu'administrateur, je veux consulter un journal d'audit, afin de tracer les actions sensibles.

### COULD (si temps)
- US-19 : En tant que client, je veux laisser un avis apres l'evenement, afin de partager mon experience.
- US-20 : En tant qu'organisateur, je veux utiliser des modeles de devis, afin de gagner du temps sur les demandes frequentes.
- US-21 : En tant qu'organisateur, je veux utiliser des modeles d'evenement, afin de pre-remplir les demandes recurrentes.
- US-22 : En tant que client, je veux ajouter des pieces jointes a ma demande, afin de fournir des inspirations ou documents utiles.
- US-23 : En tant que responsable organisateur, je veux gerer une page vitrine de mon organisation, afin de presenter mon activite.

### WON'T (hors scope assume)
- US-24 : En tant que client, je veux payer directement en ligne, afin de regler mon acompte ou ma facture depuis EasyEvent.
- US-25 : En tant que client, je veux utiliser une application mobile native, afin de gerer mon evenement depuis iOS ou Android.
- US-26 : En tant qu'organisateur, je veux synchroniser automatiquement mon planning avec Google Calendar ou Outlook, afin d'eviter la double saisie.
- US-27 : En tant qu'organisateur, je veux generer automatiquement des contrats juridiques, afin de contractualiser chaque prestation.
- US-28 : En tant que client, je veux comparer plusieurs organisateurs et faire jouer la concurrence, afin de choisir l'offre la moins chere.
- US-29 : En tant qu'administrateur, je veux gerer une marketplace publique complete, afin de vendre les prestations de plusieurs organisateurs comme une place de marche.

## 2. Definition du MVP

- Objectif unique : permettre a un client de creer une demande d'evenement et a un organisateur de la transformer en proposition suivie, avec catalogue, statut, devis et conversation centralises.
- Critere de mise en prod : un client peut creer une demande complete, selectionner des prestations, echanger avec l'organisateur, recevoir un devis, suivre le statut de son evenement et recevoir les emails lies aux actions importantes sans utiliser un fichier Excel ou une conversation WhatsApp comme suivi principal.

## 3. Liste OUT (a brandir face aux ajouts opportunistes)

- Paiement integre Stripe / PayPal - exclu du MVP car la valeur principale est le suivi et la validation de la demande, pas l'encaissement.
- Application mobile native - exclue car une application web responsive suffit pour tester l'usage reel.
- Synchronisation Google Calendar / Outlook - exclue car elle ajoute une dependance externe non indispensable au premier cycle de validation.
- Marketplace publique multi-vendeurs avancee - exclue car le MVP vise d'abord l'espace de gestion d'un organisateur et de ses clients.
- Generation automatique de contrats juridiques - exclue car elle demande une validation legale et n'est pas necessaire pour prouver la valeur du produit.
- Paiement d'acompte et facturation comptable - exclus car ils impliquent des contraintes financieres, fiscales et de securite plus lourdes.
- IA de recommandation de prestations - exclue car le catalogue et les devis manuels suffisent pour valider le besoin.
- Chat temps reel avance avec appels audio/video - exclu car une messagerie simple et persistante couvre le besoin de centralisation des echanges.
