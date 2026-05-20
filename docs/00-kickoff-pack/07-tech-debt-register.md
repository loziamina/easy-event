# 07 - Tech Debt Register

## 1. Objectif

Ce registre liste les dettes techniques acceptees au demarrage du MVP EasyEvent. Une dette acceptee n'est pas un oubli : elle est connue, son cout futur est estime, et un plan de remboursement est defini.

Le principe de cadrage :

- ne pas surengineerer le MVP ;
- reserver les emplacements futurs pour cache, workers, observabilite et scaling ;
- rembourser les dettes qui touchent la securite, la BDD ou les workflows critiques avant production.

## 2. Dettes acceptees au demarrage

| # | Dette | Pourquoi maintenant | Cout futur estime | Plan de remboursement |
|---|---|---|---|---|
| 1 | IDs `Int autoincrement` exposes dans certaines routes | Plus rapide pour le MVP et deja present dans Prisma | 2 a 4 jours selon routes | Ajouter `publicId` UUID sur ressources exposees en V1.1, puis migrer les URLs |
| 2 | Soft delete incomplet sur les entites metier | Le MVP privilegie les workflows principaux | 2 a 3 jours | Ajouter `deletedAt` sur User, Organizer, Product, Event, Order, Quote, Mockup, Ticket avant prod |
| 3 | Audit fields incomplets (`createdBy`, `updatedBy`) | AuditLog central existe deja, champs par table repousses | 2 jours | Ajouter les FK d'audit sur entites modifiees par humains en V1.1 |
| 4 | Role global dans `User.role` | Suffisant pour un MVP avec une organisation par user | 3 a 5 jours | Creer une table `OrganizerMembership` si multi-organisation ou multi-role devient necessaire |
| 5 | Listes stockees en `String` (`gallery`, `variants`, `portfolioImages`) | Plus rapide pour afficher le catalogue initial | 2 a 4 jours | Migrer vers tables dediees ou JSON type avant filtres avances |
| 6 | Montants en `Float` ou texte | Implementation rapide du devis/catalogue | 2 a 3 jours | Migrer vers `amountCents` + `currency` avant facturation stricte |
| 7 | Statuts stockes en `String` libre | Simple avec Prisma au demarrage | 1 a 2 jours | Remplacer par enums Prisma pour roles, statuts, types et strategies |
| 8 | Bcrypt cost 10 a l'inscription | Valeur actuelle fonctionnelle en dev | 0.5 jour | Passer a cost 12, rehasher a la prochaine connexion si besoin |
| 9 | Pas de rate limiting visible sur login, reset et uploads | Non bloquant pour demo locale | 1 a 2 jours | Ajouter middleware rate limit, idealement Redis ou stockage persistant |
| 10 | Logs non structures | Console suffisante en developpement | 1 a 2 jours | Ajouter Pino, niveaux de logs et correlation ID par requete |
| 11 | Pas de pipeline CI bloquant | Le projet reste en phase cadrage/MVP local | 1 jour | Ajouter GitHub Actions : install, Prisma generate, tests unitaires, build |
| 12 | `CONTRIBUTING.md` absent | Les conventions sont encore implicites | 0.5 a 1 jour | Creer le document avant l'arrivee d'un second dev actif |
| 13 | Emails et workers asynchrones non formalises | Pas necessaire pour demo MVP | 2 a 4 jours | Introduire une file de jobs si les emails deviennent critiques |

## 3. Dettes refusees

Ces raccourcis ne doivent pas etre acceptes, meme au MVP :

- mettre une regle de permission uniquement dans le front ;
- stocker un mot de passe en clair ou avec un hash faible ;
- supprimer physiquement une donnee critique sans historique ;
- modifier un devis accepte sans nouvelle version ou trace explicite ;
- ajouter une table fourre-tout pour eviter de modeliser le domaine ;
- commiter des secrets ou des credentials de production.

## 4. Documentation minimale de maintenabilite

| Document | Statut | Role |
|---|---|---|
| `README.md` | Present, nettoye | Lancer le projet, comprendre le contexte et les comptes demo |
| `docs/00-kickoff-pack/04-database.md` | Present | Comprendre le modele de donnees, les index et les dettes BDD |
| `docs/00-kickoff-pack/06-adr/` | Present | Comprendre les choix structurants : BDD, framework, auth |
| `CONTRIBUTING.md` | Absent | Documenter branches, commits, conventions, tests et revue |

Objectif maintenabilite : un nouveau dev doit comprendre le projet, le lancer et identifier les couches principales en moins d'une journee.

## 5. Risques techniques identifies (top 5)

| # | Risque | Categorie | Probabilite | Impact | Parade |
|---|---|---|---|---|---|
| 1 | BDD lente avec croissance evenements/messages/notifications | Scalabilite | Moyenne | Eleve | Ajouter index prevus, surveiller requetes lentes, paginer les listes |
| 2 | Enumeration ou IDOR via IDs auto-incrementes | Securite | Moyenne | Critique | UUID/public IDs, controles RBAC cote serveur, tests d'acces |
| 3 | Compromission via login/reset sans rate limiting | Securite | Moyenne | Eleve | Rate limiting, alertes echec login, bcrypt cost 12 |
| 4 | Upload abusif ou fichier dangereux | Securite | Moyenne | Eleve | Limites taille/type MIME, stockage objet, scan ou restrictions strictes |
| 5 | Service externe indisponible (Supabase, email, OAuth) | Dependance | Faible a moyenne | Eleve | Mode degrade, timeouts, retries, couche d'abstraction |

## 6. Risques secondaires a suivre

| Risque | Categorie | Signal d'alerte | Action prevue |
|---|---|---|---|
| Monolithe Next.js trop charge | Scalabilite organisationnelle | Routes API difficiles a maintenir, services `lib/*` trop gros | Extraire modules metier ou workers sans changer l'API publique |
| Dette BDD non remboursee | Maintenabilite | Migrations de plus en plus couteuses | Sprint dedie schema avant V1.1 |
| Tests trop limites | Maintenabilite | Regressions sur statuts, devis ou permissions | Ajouter tests unitaires sur RBAC, transitions et pricing |
| Observabilite insuffisante | Exploitation | Bugs prod non reproductibles | Logs structures, Sentry, correlation ID |
| Dependances npm vulnerables | Securite | Alertes audit ou dependabot | Audit regulier, mises a jour groupees et testees |

## 7. Ligne YAGNI retenue

YAGNI s'applique :

- pas de microservices pour le MVP ;
- pas de systeme de plugins ;
- pas de multi-region ;
- pas de cache Redis tant que les mesures ne montrent pas le besoin ;
- pas de sharding ou architecture event-sourced.

YAGNI ne s'applique pas aux fondations :

- schema BDD propre ;
- RBAC cote serveur ;
- audit log des actions sensibles ;
- tests automatises sur les regles critiques ;
- separation entre API, services metier et persistance ;
- secrets hors code source.

## 8. Cadence de revue

- Revue rapide du registre a chaque fin de sprint.
- Toute dette nouvelle doit avoir : raison, cout estime, echeance de remboursement.
- Toute dette securite critique passe avant les features.
- Une dette non remboursee depuis deux releases doit etre requalifiee : acceptee, refusee ou transformee en ticket priorise.
