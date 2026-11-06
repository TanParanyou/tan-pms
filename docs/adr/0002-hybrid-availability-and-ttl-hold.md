# ADR-0002: Hybrid Availability Engine (`tstzrange` + `UnitType` Quota) & Booking Hold TTL

## Status

Accepted — 2026-11-06

## Context

`tan-pms` เปิดให้ใช้ห้องพักเดียวกันได้ทั้งแบบรายชั่วโมง (`Hourly`), รายวัน (`Daily`) และรายเดือน (`Monthly`) รวมถึงเปิดให้ลูกค้าในฝั่ง `client` จองออนไลน์และโอนเงินแนบสลิป หากใช้เพียงการตรวจด้วยคำสั่ง `SELECT` ในโค้ดก่อน `INSERT` จะเกิดปัญหา Race Condition จนเกิดการจองซ้อน (Double-Booking) หรือเกิดปัญหาลูกค้ากดจองค้างไว้โดยไม่จ่ายเงินทำให้อัตราห้องว่างถูกบล็อกถาวร

## Decision

1. **Database-Level Time-Range Exclusion (`tstzrange` + `EXCLUDE USING gist`):**
   - สำหรับการจองที่ระบุเลขห้อง (`UnitId`), การเปิดห้องพักจริง (`Stay` รวมเวลา `TurnaroundBufferMinutes`), และสัญญาเช่ารายเดือน (`Lease`) ระบบจัดเก็บช่วงเวลาเป็น `tstzrange` (UTC) ใน PostgreSQL และสร้าง Constraint `EXCLUDE USING gist (unit_id WITH =, occupied_period WITH &&)` เพื่อป้องกันเวลาทับซ้อนในระดับฐานข้อมูล 100%
2. **Hybrid Booking Model (`UnitType` Quota vs Specific `Unit`):**
   - การจองออนไลน์ผ่าน `client` (`Hourly`/`Daily`) จะล็อกโควตาระดับ `UnitType` ก่อน (โดยใช้ Row Lock `SELECT ... FOR UPDATE` บน `UnitType` ขณะคำนวณจำนวนห้องว่างสุทธิ) แล้วให้พนักงานฝั่ง `admin` กดจัดสรรเลข `Unit` ก่อนหรือขณะเช็กอิน
   - การจองหน้าเคาน์เตอร์หรือสัญญารายเดือนสามารถระบุ `UnitId` เพื่อล็อกห้องจริงได้ทันที
3. **Booking Hold with TTL (`HoldExpiresAt`):**
   - ใบจองออนไลน์ที่รอชำระเงินจะอยู่ในสถานะ `Hold` พร้อมกำหนด `HoldExpiresAt` (ค่าเริ่มต้น 15 นาที)
   - ทั้งคิวรีตรวจสอบห้องว่างและ Background Worker จะตัดใบจองที่ `Status == Hold && HoldExpiresAt <= UtcNow` ออกจากโควตาที่ถูกใช้งานทันที และเปลี่ยนสถานะเป็น `Expired`

## Consequences

- **ข้อดี:** ป้องกันการจองซ้อนได้ 100% แม้มีการยิงจองพร้อมกันจำนวนมาก และไม่เกิดปัญหาห้องค้างจากลูกค้าที่กดจองแล้วไม่ชำระเงิน
- **ข้อควรระวัง:** ต้องเปิดใช้งาน Extension `btree_gist` ใน PostgreSQL เสมอ และต้องรวม `TurnaroundBufferMinutes` เข้าไปในช่วงเวลาที่บล็อกของโหมด `Hourly`
