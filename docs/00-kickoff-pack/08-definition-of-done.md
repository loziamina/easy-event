# 08 - Definition of Done

## Definition of Done - Conception

Cette checklist dit si le cadrage EasyEvent est pret a passer en execution. Les cases cochees sont couvertes par les livrables du dossier `docs/00-kickoff-pack/`. Les cases ouvertes doivent etre traitees avant de considerer le cadrage comme valide a 100 %.

## 1. Cadrage

- [x] Brief 1 page redige : `01-project-brief.md`.
- [x] Probleme, cible, contexte et contraintes formalises.
- [x] Difference probleme / idee / solution explicitee.

## 2. Perimetre

- [x] User stories redigees.
- [x] Priorisation MoSCoW faite.
- [x] MVP defini.
- [x] Liste IN/OUT explicite.
- [x] Ajouts opportunistes identifies et repousses hors MVP.

## 3. Modele metier

- [x] Roles RBAC definis.
- [x] Permissions par role formalisees.
- [x] Regles metier numerotees.
- [x] Machines a etats dessinees pour les entites a statuts.
- [x] Cas d'erreur principaux identifies.

## 4. Base de donnees

- [x] Choix moteur documente.
- [x] ERD redige.
- [x] Dictionnaire de donnees redige.
- [x] Index prevus listes.
- [x] Anti-patterns BDD identifies.
- [ ] Timestamps + soft delete presents sur toutes les tables critiques.
- [ ] IDs publics opaques prevus dans le schema effectif.

Note : `04-database.md` documente les champs cibles et les dettes actuelles. Le schema Prisma existant n'est pas encore aligne a 100 % avec cette cible.

## 5. Architecture

- [x] Schema de composants valide.
- [x] Flux principaux documentes.
- [x] Matrice des responsabilites complete.
- [x] Place des services metier definie.
- [x] Place de la persistance definie.
- [x] Place des fichiers, emails, audit et notifications definie.

## 6. Securite by design

- [x] Secrets en variables d'environnement prevus.
- [x] Authentification documentee.
- [x] RBAC cote serveur documente.
- [x] Audit log documente.
- [x] OWASP / IDOR / upload / XSS identifies comme risques.
- [ ] HTTPS + HSTS valides sur l'environnement cible.
- [ ] bcrypt cost 12 applique dans le code.
- [ ] Rate limiting login/reset/upload applique.
- [ ] RGPD : inventaire, retention et droit effacement finalises.

## 7. Observabilite minimale

- [x] Logs prevus.
- [x] Metriques prevues.
- [x] Traces prevues pour V1.1.
- [x] Audit metier et historique evenement documentes.
- [ ] Logs structures + correlation ID implementes.
- [ ] Outil d'erreur prod choisi et configure.

## 8. ADR

- [x] `ADR-001-choix-bdd.md` redige.
- [x] `ADR-002-framework-backend.md` redige.
- [x] `ADR-003-strategie-auth.md` redige.
- [x] Options envisagees, decision, justification et consequences documentees.

## 9. Long terme

- [x] Registre de dette redige.
- [x] Dettes acceptees distinguees des dettes refusees.
- [x] Risques top 5 identifies avec parade.
- [x] Place reservee pour design patterns.
- [x] Place reservee pour Docker.
- [x] Place reservee pour CI/CD.
- [x] Ligne YAGNI definie.

## 10. Kickoff Pack

- [x] Tous les livrables disponibles dans `docs/00-kickoff-pack/`.
- [x] Dossier `06-adr/` compile avec 3 ADR.
- [ ] `CONTRIBUTING.md` cree.
- [ ] README nettoye et aligne avec l'etat Docker/PostgreSQL.
- [ ] Relu par un pair, mentor ou referent technique.
- [ ] Valide par le decideur projet.

## 11. Passage au backlog Sprint 1

Source des tickets Sprint 1 : user stories MUST de `02-product-scope.md`.

Ordre recommande :

1. Stabiliser les fondations projet : README, CONTRIBUTING, CI minimale, variables d'environnement.
2. Aligner le schema Prisma avec les dettes critiques de `04-database.md` : soft delete, public IDs, index, enums prioritaires.
3. Securiser l'auth : bcrypt cost 12, rate limiting, controles anti-IDOR.
4. Tester les regles critiques : RBAC, transitions d'evenement, calcul devis/pricing.
5. Implementer ou finaliser les user stories MUST dans l'ordre du scope.
6. Revoir `07-tech-debt-register.md` a chaque fin de sprint.

## 12. Phrases d'alerte

Si une phrase apparait pendant l'execution, ouvrir une decision ou un ticket :

- "On verra apres."
- "C'est juste un MVP."
- "On adaptera la BDD plus tard."
- "On n'a qu'un seul type d'utilisateur."
- "C'est moderne."
- "Pas besoin d'ADR, c'est evident."
- "On va securiser apres le MVP."
- "On peut tout mettre dans la meme table."
- "Les tests, on en mettra a la fin."
- "On documentera plus tard."

## 13. Statut final de conception

Statut : pret pour passage en backlog technique, mais pas encore valide a 100 % pour demarrage production.

Conditions restantes avant validation complete :

- validation humaine du kickoff pack ;
- creation de `CONTRIBUTING.md` ;
- nettoyage README ;
- arbitrage des dettes securite et BDD a rembourser avant la prochaine phase.

Signe : ___________  
Date : 2026-05-20
