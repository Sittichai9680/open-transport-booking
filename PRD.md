# Product Requirements Document (PRD)

## Project Name

**Booking Engine Framework (BEF)** — Open Transport Booking Platform

## Vision

Open-source, provider-agnostic booking engine framework สำหรับธุรกิจขนส่งทุกประเภท

ไม่ใช่ "เว็บจองตั๋วรถทัวร์" — แต่เป็น **framework** ที่ใครก็เอาไปสร้างระบบจองของตัวเองได้

รองรับ transport modes ผ่าน **Provider Adapter Architecture**:

- รถทัวร์ (Bus)
- รถตู้ (Van)
- เรือ (Boat)
- รถไฟ (Train)
- Shuttle Bus
- Event Transportation
- และ transport ใหม่ที่ community สร้าง adapter มาเอง

---

## Problem Statement

### สำหรับ Developer / Agency

- ไม่มี open-source booking engine framework ที่พร้อมใช้ในตลาด
- ทุกครั้งที่ลูกค้าต้องการระบบจอง ต้องเขียนใหม่ตั้งแต่ศูนย์
- ระบบจองที่มีอยู่ (Ticketmelon, Eventbrite API) ไม่ได้ออกแบบสำหรับ transport
- Seat map, route search, reservation lock — เป็น domain complexity ที่ต้องแก้ซ้ำทุกโปรเจกต์

### สำหรับ Operator (ผู้ประกอบการขนส่ง)

- ระบบจองที่มีในตลาด: แพง, ปิดซอร์ส, ปรับแต่งยาก, Vendor lock-in
- ผู้ประกอบการรายเล็ก-กลาง ไม่มีระบบค้นหาเที่ยว / เลือกที่นั่ง / จอง / รับชำระเงิน
- อยากได้ระบบที่ตนเองหรือนักพัฒนาท้องถิ่นเอาไปต่อยอดได้

**Booking Engine Framework แก้ปัญหาทั้งสองฝั่ง** — developer ได้ framework ที่ reuse ได้, operator ได้ platform ที่ปรับแต่งได้

---

## Solution

BEF คือ **framework + reference implementation** ไม่ใช่ SaaS product

### Core Principles

1. **Provider Adapter Architecture** — core engine ไม่รู้ว่ากำลังคุยกับ bus operator, train operator, หรือ mock provider — มันคุยผ่าน interface
2. **Run in 5 minutes** — `docker compose up` แล้วมีทุกอย่าง: DB, Redis, API, frontend, demo data
3. **API-first** — ทุกฟีเจอร์暴露ผ่าน REST API ที่มี OpenAPI spec; frontend เป็นแค่ consumer
4. **Event-sourced booking** — ทุก state change ใน booking lifecycle มี event log, ทำให้ audit, replay, และ debug ได้
5. **Extensible, not configurable** — ไม่พยายาม config รองรับทุกกรณี; ให้เขียน adapter แทน

---

## User Types

| Role | Description |
|---|---|
| **Passenger** | ลูกค้าที่ค้นหาเที่ยวและจองตั๋ว |
| **Operator** | ผู้ให้บริการขนส่ง — จัดการ route, vehicle, seat layout, ดู booking |
| **Administrator** | ผู้ดูแลระบบ — ดูภาพรวมทุก operator |
| **Developer** | คนที่เอา framework ไปใช้ — สร้าง custom adapter, override UI, deploy |

---

## Core User Flow

### Passenger Flow

```
Search → Trip List → Trip Detail → Seat Selection → Checkout → Confirmation
```

1. **Search**: เลือกต้นทาง, ปลายทาง, วันที่ → กดค้นหา
2. **Trip List**: แสดงเที่ยวที่มี — operator, เวลาออก/ถึง, ราคา, ที่นั่งคงเหลือ
3. **Trip Detail**: ข้อมูลเที่ยว + seat map
4. **Seat Selection**: เลือกที่นั่งจาก visual seat map (สถานะ: available / reserved / occupied)
5. **Checkout**: กรอกชื่อ, เบอร์, อีเมล → กดยืนยัน
6. **Confirmation**: แสดง booking number + QR code + สถานะ

### Operator Flow

```
Dashboard → Manage Routes → Manage Vehicles → View Bookings
```

---

## Functional Requirements

### FR-001 Search Routes

ค้นหาเที่ยวตาม origin, destination, date  
Response time < 2 วินาที  
รองรับ partial match และ fuzzy search บนชื่อสถานี

### FR-002 Seat Map

Seat layout กำหนดผ่าน JSON schema  
รองรับ: Single deck, Double deck, Mini bus, Van  
สถานะต่อที่นั่ง: `available`, `reserved` (locked), `occupied`, `unavailable`  
Render แบบ visual บน frontend (SVG/Canvas)

ตัวอย่าง seat layout JSON:

```json
{
  "deck": "single",
  "rows": [
    { "row": 1, "seats": ["A1", "A2", "aisle", "A3", "A4"] },
    { "row": 2, "seats": ["B1", "B2", "aisle", "B3", "B4"] }
  ]
}
```

### FR-003 Reservation Lock

เมื่อ passenger เลือกที่นั่ง → lock 15 นาทีผ่าน Redis  
หมดเวลา → auto-release + WebSocket broadcast  
ป้องกัน double booking ด้วย Redis atomic operations

### FR-004 Booking Creation (Event-Sourced)

Booking lifecycle เป็น event stream:

```
SeatReserved → BookingCreated → BookingConfirmed
                                → BookingExpired
                                → BookingCancelled
```

ทุก state change เป็น immutable event  
Current state = event stream projection  
ทำให้ audit trail, replay, และ debug ได้โดยไม่ต้อง query DB ย้อนหลัง

### FR-005 QR Ticket

สร้าง QR code สำหรับ check-in  
เข้ารหัส booking reference + passenger name + trip info  
แสดงผลบนหน้า confirmation และส่งทางอีเมล

### FR-006 Operator Dashboard

แสดง:
- Bookings วันนี้ / สัปดาห์นี้ / เดือนนี้
- Revenue summary
- Route performance
- Vehicle utilization
- Seat occupancy rate

### FR-007 WebSocket Seat Availability

Real-time seat status update ผ่าน WebSocket  
เมื่อมีคน lock/cancel seat → ทุก client ที่ดู trip เดียวกันเห็นทันที  
ลดโอกาส double booking และปรับปรุง UX

---

## Provider Adapter Architecture

### Interface (Core Contract)

```typescript
interface TripProvider {
  searchTrips(query: SearchQuery): Promise<Trip[]>;
  getTrip(tripId: string): Promise<TripDetail>;
  getSeatMap(tripId: string): Promise<SeatMap>;
  reserveSeat(tripId: string, seatNumber: string): Promise<Reservation>;
  confirmBooking(reservationId: string, passenger: PassengerInfo): Promise<Booking>;
  cancelBooking(bookingId: string): Promise<void>;
}
```

### Built-in Providers

| Provider | Description |
|---|---|
| `MockProvider` | Demo data สำหรับ development และ CI |
| `BusProvider` | Reference implementation สำหรับรถทัวร์ |
| `TrainProvider` | Reference implementation สำหรับรถไฟ |
| `BoatProvider` | Reference implementation สำหรับเรือ |

Community สร้าง provider เองได้โดย implement `TripProvider` interface — ไม่ต้องแก้ core engine

---

## API Design

Base path: `/api/v1`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/trips` | Search trips |
| `GET` | `/trips/:id` | Trip detail + seat map |
| `POST` | `/bookings` | Create booking (reserve seat) |
| `GET` | `/bookings/:id` | Booking detail + QR |
| `POST` | `/bookings/:id/confirm` | Confirm booking |
| `POST` | `/bookings/:id/cancel` | Cancel booking |
| `GET` | `/bookings?phone=xxx` | Lookup bookings by phone |
| `GET` | `/routes` | List routes (operator) |
| `POST` | `/routes` | Create route (operator) |
| `GET` | `/admin/stats` | Dashboard stats (admin) |

WebSocket endpoint: `ws://host/ws/trips/:id` — seat availability stream

ทุก endpoint มี OpenAPI 3.1 spec ที่ `/api/docs`

---

## Database Schema (Logical)

```
Route
  id, origin, destination, distance_km

Vehicle
  id, name, type (bus|van|boat|train), seat_layout (JSON), operator_id

Trip
  id, route_id, vehicle_id, departure_time, arrival_time, price, status

Seat
  id, trip_id, seat_number, status (available|reserved|occupied|unavailable)

Booking
  id, booking_code, trip_id, seat_id, customer_name, phone, email, status, created_at

BookingEvent (Event Sourcing)
  id, booking_id, event_type, payload (JSON), created_at
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 + TypeScript + Tailwind CSS |
| Backend | NestJS + TypeScript |
| Database | PostgreSQL 16 |
| ORM | Prisma |
| Cache / Lock | Redis 7 |
| Real-time | WebSocket (Socket.io / WS) |
| API Docs | OpenAPI 3.1 (Swagger) |
| Auth | NextAuth.js (JWT) |
| Container | Docker + Docker Compose |
| Demo Data | Custom seeder script |

---

## Success Metrics (v1)

- `docker compose up` → ระบบพร้อมใช้ภายใน 5 นาที (cold start)
- Demo data seeder → มี 10 routes, 5 vehicles, 50 trips, พร้อมทดสอบทันที
- 100 concurrent booking requests — 0 double bookings
- Seat lock consistency 100% (Redis atomic guarantee)
- Search response < 2 วินาที (warm cache)
- OpenAPI spec ครอบคลุมทุก endpoint
- CI/CD pipeline ผ่านบน GitHub Actions

---

## Modules

### 1. `@bef/core` — Booking Engine Core

Package เดียวที่ encapsulate booking logic ทั้งหมด  
Interface: `TripProvider`, `BookingService`, `SeatLockService`  
Zero dependencies on framework (ทดสอบได้ใน isolation)

### 2. `@bef/api` — REST API (NestJS)

Thin layer เหนือ `@bef/core`  
Controller → Service → Provider  
OpenAPI decorators บนทุก endpoint

### 3. `@bef/providers` — Built-in Provider Adapters

`MockProvider`, `BusProvider`, `TrainProvider`, `BoatProvider`  
แต่ละตัว implement `TripProvider` จาก `@bef/core`

### 4. `@bef/web` — Reference Frontend (Next.js)

Search → Seat Map → Checkout → Confirmation  
Responsive (mobile + desktop)  
WebSocket client สำหรับ real-time seat

### 5. `@bef/admin` — Operator Dashboard

Route/Vehicle CRUD  
Booking list + filter  
Revenue + occupancy charts

### 6. Demo Data Seeder

TypeScript script — seed routes, vehicles, trips, seats  
รันอัตโนมัติใน `docker compose up`  
ข้อมูลสมมติแต่สมจริง: กรุงเทพ→เชียงใหม่, ภูเก็ต→กระบี่, etc.

---

## Implementation Decisions

1. **Event sourcing เฉพาะ booking domain** — ไม่ใช้กับทั้งระบบ; route/vehicle ใช้ CRUD ปกติ เพราะ booking เป็น domain เดียวที่ต้องการ audit trail และ consistency guarantee

2. **Redis seat lock ด้วย `SET NX EX`** — atomic lock โดยไม่ต้องใช้ Redlock หรือ distributed consensus; single Redis instance เพียงพอสำหรับ v1

3. **WebSocket per trip** — client subscribe เฉพาะ trip ที่กำลังดู; ลด bandwidth และ server load

4. **Adapter interface เป็น async** — รองรับทั้ง provider ที่ตอบทันที (DB query) และ provider ที่ต้องเรียก external API

5. **Docker Compose เป็น first-class citizen** — ไม่ใช่ afterthought; ทุก service (API, web, admin, DB, Redis) ใน compose file เดียว

6. **OpenAPI spec generate จาก code** — ไม่ใช่เขียนมือ; NestJS Swagger decorators → auto-generate spec

7. **Demo data เป็นภาษาไทย** — route ชื่อจริง, สถานีจริง, เวลาจริง ทำให้ demo น่าเชื่อถือ

---

## Testing Strategy

- `@bef/core` — unit tests 100% (pure logic, no I/O)
- `@bef/providers` — integration tests ต่อ DB จริง (Testcontainers)
- `@bef/api` — E2E tests ผ่าน supertest
- Booking concurrency — stress test ด้วย concurrent seat reservations
- WebSocket — integration test ด้วย WS client

**Contract tests ระหว่าง provider ↔ core**: MockProvider ต้องผ่าน test suite เดียวกับ providers จริง → รับประกันว่า custom provider ของ community จะไม่พัง

---

## Out of Scope (v1)

- Payment gateway integration (v2)
- Multi-operator / marketplace (v2)
- Mobile app (v3)
- Dynamic pricing (v3)
- Loyalty program
- Affiliate program
- AI recommendation
- Hotel + flight bundle
- White-label SaaS deployment
- Kubernetes manifests (Docker Compose เพียงพอสำหรับ v1)

---

## Open Source

- **License**: MIT
- **Monorepo**: ยังไม่ตัดสินใจ (Turborepo vs Nx vs pnpm workspaces)
- **Contributing guide**: TODO
- **Roadmap**: ใน GitHub Projects

---

## Further Notes

### ทำไมต้อง "Framework" ไม่ใช่ "Product"

- Framework = developer เป็นลูกค้าหลัก → community ขยาย → adapters หลากหลาย → ecosystem
- Product = operator เป็นลูกค้าหลัก → ต้องขาย → support burden → ช้า
- ตลาด open-source booking engine ว่าง — ไม่มีใครทำ framework แบบนี้
- มูลค่าทาง portfolio: "I built a booking engine framework used by X agencies" > "I built a bus ticket website"

### GitHub Stars Strategy

สามอย่างที่ทำให้คนกดดาว:

1. **`docker compose up` แล้วรันได้ใน 5 นาที** — สำคัญที่สุด คนตัดสินใจภายใน 5 นาทีแรก
2. **Demo data seeder** — มีข้อมูลสมมติที่สมจริง พร้อมทดสอบทุกฟีเจอร์ทันที ไม่ต้องมานั่งสร้าง route เอง
3. **OpenAPI spec** — developer เห็น API surface ทั้งหมดก่อนติดตั้ง; ใช้ Swagger UI เล่นกับ API ได้ทันที

สามอย่างนี้สำคัญกว่า architecture diagram หรือ test coverage สำหรับการดึงดูด community ช่วงแรก
