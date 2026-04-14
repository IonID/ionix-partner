# Ionix Partner — Setup pe calculator nou

## Cerințe
- Node.js 18+
- PostgreSQL 17 (`winget install PostgreSQL.PostgreSQL.17`)
- Git

## Pași (o singură dată per calculator)

### 1. Clonează repo-ul
```bash
git clone https://github.com/IonID/ionix-partner.git
cd ionix-partner
```

### 2. Instalează dependențele
```bash
cd apps/api && npm install
cd ../web && npm install
cd ../..
```

### 3. Configurează baza de date
```bash
# Pornește PostgreSQL (dacă nu rulează)
"C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" start -D "C:\Program Files\PostgreSQL\17\data" -U postgres

# Creează DB și user (în psql ca postgres)
psql -U postgres -h 127.0.0.1
CREATE USER ionix_user WITH PASSWORD 'ionix_dev_pass_2024' CREATEDB;
CREATE DATABASE ionix_partner OWNER ionix_user;
\c ionix_partner
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
\q
```

### 4. Creează fișierele .env
```bash
# Copiază template-ul și completează valorile
cp .env.example apps/api/.env
```

Editează `apps/api/.env` — completează cel puțin:
- `DATABASE_URL` — cu credențialele de mai sus
- `JWT_ACCESS_SECRET` și `JWT_REFRESH_SECRET` — generează cu `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`

Creează `apps/web/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 5. Migrare și date demo
```bash
cd apps/api
npx prisma migrate dev --name init
npx ts-node prisma/seed.ts
```

### 6. Pornește serverele
```bash
# Terminal 1 — API
cd apps/api && npm run start:dev

# Terminal 2 — Frontend
cd apps/web && npm run dev
```

Accesează: http://localhost:3000
- Admin: `admin@pin.md` / `Admin@Ionix2024!`
- iHouse: `ihouse@pin.md` / `Partner@iHouse2024!`
- Cactus: `cactus@pin.md` / `Partner@Cactus2024!`

## Flux zilnic de lucru

```bash
# Înainte să lucrezi
git pull

# După ce termini
git add .
git commit -m "descriere scurtă"
git push
```
