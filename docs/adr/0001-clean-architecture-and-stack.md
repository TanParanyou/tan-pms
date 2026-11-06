# ADR-0001: Clean Architecture (.NET 10), Hybrid EF Core/Dapper & Next.js Stack

## Status

Accepted — 2026-11-06

## Context

`tan-pms` ต้องรองรับการบริหารที่พักทั้ง 3 โหมด (`Hourly`, `Daily`, `Monthly`) สำหรับองค์กรที่มีหลายสาขาและหลายอาคาร (`Property` -> `Building` -> `Floor` -> `Unit`) โดยมีทั้งฝั่งปฏิบัติการ (`admin`) และฝั่งบริการตนเองของลูกค้า/ผู้เช่า (`client`) ระบบต้องการความถูกต้องของธุรกรรมทางการเงิน (ใบแจ้งหนี้, ใบเสร็จ, กะแคชเชียร์, เงินประกัน) ควบคู่กับความเร็วในการอ่านข้อมูลตารางใหญ่ (ผังห้องรวม `Unified Room Rack` และตารางจดมิเตอร์ยกตึก)

## Decision

1. **Backend:** ใช้ `.NET 10` (`C#`) จัดโครงสร้างแบบ **4-Layer Clean Architecture** (`Domain`, `Application`, `Infrastructure`, `WebApi`) ตามมาตรฐานตระกูล `tan-*`
2. **Data Access (Hybrid CQRS):**
   - ใช้ **`EF Core 10`** สำหรับฝั่งเขียนข้อมูล (`Commands`), การจัดการ Transaction, Migrations และ `AuditableEntityInterceptor`
   - ใช้ **`Dapper`** บน `PostgreSQL` สำหรับฝั่งอ่านข้อมูลที่ซับซ้อน (`Queries`) โดยบังคับส่งข้อมูลแบบ Structured Projection
3. **Frontend & Contract:** ใช้ **`Next.js (App Router)`** + `TypeScript (Strict)` แยก Route Group `(auth)`, `(admin)` และ `(client)` โดยเชื่อมกับ Backend ผ่านสัญญา **`OpenAPI`** (`contracts/openapi/tan-pms.v1.json`) และรายงานข้อผิดพลาดตามมาตรฐาน **RFC 9457 Problem Details**

## Consequences

- **ข้อดี:** แยกกฎธุรกิจใน `Domain`/`Application` ออกจากโครงสร้างพื้นฐานได้อย่างสะอาด ทดสอบด้วย `ArchUnitNET` และ `Testcontainers` ได้เต็มรูปแบบ และได้ความเร็วการคิวรีหน้าผังห้องและตารางมิเตอร์จาก `Dapper`
- **ข้อควรระวัง:** นักพัฒนาต้องรักษาวินัยไม่เขียนโค้ดข้ามชั้นโปรเจกต์ และต้องอัปเดตไฟล์ OpenAPI Contract ทุกครั้งที่เปลี่ยน DTO
