# EasyEvent (Next.js + Prisma + NextAuth)
Aujourd’hui, les organisateurs d’événements gèrent leurs échanges avec les clients de manière dispersée à travers plusieurs outils comme WhatsApp, Excel ou les appels téléphoniques, ce qui rend le suivi des demandes, des devis, des plannings et des validations complexe et peu structuré. Ce projet vise à créer une plateforme web centralisée permettant aux organisateurs de gérer l’ensemble de leur activité depuis un seul espace : gestion des événements, catalogue de services, communication avec les clients, création de devis, partage de maquettes et planification opérationnelle. L’objectif est de simplifier le processus de réservation, améliorer l’expérience client et professionnaliser la gestion des événements grâce à des outils digitaux adaptés aux besoins réels du terrain.

## Prérequis
- Node.js 18+ (ou 20+)
- npm

## Installation
```bash
npm install
```

## Configuration
1) Copie `.env.example` -> `.env`
2) Mets un secret :
```bash
# Windows PowerShell
# (ou remplace manuellement)
```

Exemple `.env` :
- `DATABASE_URL="file:./dev.db"`
- `NEXTAUTH_URL="http://localhost:3000"`
- `NEXTAUTH_SECRET="CHANGE_ME_PLEASE"`
- `ADMIN_EMAIL="admin@easyevent.com"`
- `ADMIN_PASSWORD="admin123"`

## Base de données (Prisma)
```bash
npx prisma migrate dev --name init
npm run seed
```

## Lancer le projet
```bash
npm run dev
```
Ouvre: http://localhost:3000

## Comptes
- Admin (créé via seed) : `admin@easyevent.com` / `admin123`
- Client : inscription via l'interface `/auth/signup`

## Fonctionnalités
- Auth (client / admin) : NextAuth Credentials + bcrypt
- Events CRUD (client) : créer / modifier / supprimer tant que PENDING_APPROVAL
- Validation admin : accepter / refuser
- Chat client <-> admin : messages persistés en DB (Prisma) via `/api/conversations`
- Catalogue : admin ajoute des produits, clients consultent

## Structure
- `pages/` : routes + API
- `components/` : UI (Dashboard, Catalogue, Events, Chat, Sidebar)
- `prisma/` : schema + seed
- `lib/` : prisma + auth helpers
