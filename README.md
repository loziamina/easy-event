# EasyEvent

EasyEvent est une plateforme web pour centraliser la gestion d'evenements entre clients, organisateurs, staff et administrateurs.

Le projet remplace les echanges disperses entre WhatsApp, Excel, appels et fichiers par un espace unique pour :

- creer et suivre des demandes d'evenement ;
- gerer un catalogue de prestations ;
- construire et envoyer des devis ;
- centraliser les conversations ;
- suivre les statuts, maquettes, tickets et notifications ;
- tracer les actions importantes via audit et historique.

Stack principale :

- Next.js 14
- React 18
- Prisma 5
- PostgreSQL 16
- NextAuth
- Docker / Docker Compose

## Kickoff Pack

Le cadrage projet est documente dans le dossier :

- Local : `docs/00-kickoff-pack/`
- GitHub : https://github.com/loziamina/easy-event/tree/main/docs/00-kickoff-pack

Schema du Kickoff Pack :

```text
docs/00-kickoff-pack/
|-- 01-project-brief.md
|-- 02-product-scope.md
|-- 03-domain-model.md
|-- 04-database.md
|-- 05-architecture.md
|-- 06-adr/
|   |-- ADR-001-choix-bdd.md
|   |-- ADR-002-framework-backend.md
|   `-- ADR-003-strategie-auth.md
|-- 07-tech-debt-register.md
`-- 08-definition-of-done.md
```

Avant de modifier le code, lire en priorite :

1. `02-product-scope.md` pour le perimetre MVP.
2. `03-domain-model.md` pour les roles, regles metier et machines a etats.
3. `04-database.md` pour le modele de donnees et les dettes BDD.
4. `05-architecture.md` pour les responsabilites par couche.
5. `07-tech-debt-register.md` pour les dettes acceptees et les risques.

## Prerequis

- Node.js 20.x recommande
- npm
- Docker Desktop, optionnel mais recommande pour lancer PostgreSQL localement

## Installation locale

```bash
npm install
```

Copier le fichier d'environnement :

```bash
copy .env.example .env
```

Adapter ensuite les variables dans `.env`.

Exemple PostgreSQL local :

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/DATABASE?schema=public"
DIRECT_URL="postgresql://USER:PASSWORD@localhost:5432/DATABASE?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="replace-with-admin-password"
DEMO_ORGANIZER_EMAIL="owner@example.com"
DEMO_ORGANIZER_PASSWORD="replace-with-demo-owner-password"
```

## Lancer avec Docker

Creer le fichier d'environnement Docker local :

```bash
copy .env.docker.example .env.docker
```

Puis remplacer les placeholders dans `.env.docker`.

```bash
docker compose up --build
```

Ouvrir ensuite :

```text
http://localhost:3000
```

Le `docker-compose.yml` lance :

- l'application Next.js en mode dev avec hot reload ;
- une base PostgreSQL 16 ;
- un volume persistant pour les donnees PostgreSQL ;
- `prisma generate`, `prisma db push` et le seed au demarrage.

Les comptes de demo Docker sont ceux que tu renseignes dans `.env.docker` :

- admin : `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- organisateur : `DEMO_ORGANIZER_EMAIL` / `DEMO_ORGANIZER_PASSWORD`
- client : inscription via `/auth/signup`

## Lancer sans Docker

Verifier que PostgreSQL est disponible et que `DATABASE_URL` pointe vers la bonne base, puis :

```bash
npm run prisma:generate
npx prisma db push
npm run seed
npm run dev
```

Ouvrir ensuite :

```text
http://localhost:3000
```

## Scripts utiles

```bash
npm run dev
npm run dev:docker
npm run build
npm run start
npm run test:unit
npm run test:coverage
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio
npm run seed
```

## Structure du projet

```text
components/       UI React reutilisable
docs/             documentation projet et kickoff pack
lib/              services metier, auth, permissions, Prisma
pages/            pages Next.js et routes API
prisma/           schema Prisma et seed
public/           assets publics et uploads locaux
styles/           styles globaux
tests/            tests unitaires
```

Dans cette architecture :

- le frontend vit dans `pages/` et `components/` ;
- l'API vit dans `pages/api/` ;
- les regles metier vivent dans `lib/*` ;
- l'acces BDD passe par Prisma ;
- les choix structurants sont traces dans `docs/00-kickoff-pack/06-adr/`.

## Points de vigilance

Les dettes connues sont documentees dans `docs/00-kickoff-pack/07-tech-debt-register.md`.

Avant production, traiter en priorite :

- bcrypt cost 12 ;
- rate limiting sur auth/reset/upload ;
- IDs publics opaques ;
- soft delete sur entites critiques ;
- logs structures et correlation ID ;
- nettoyage RGPD ;
- CI bloquante.
