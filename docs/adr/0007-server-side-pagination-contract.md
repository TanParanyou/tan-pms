# ADR-0007: Server-Side Pagination Contract (`page`/`pageSize` เป็น Optional + `PaginationMetadata`)

## Status

Accepted — 2026-11-10

## Context

หน้ารายการฝั่ง `admin` และ `client` เดิมได้ข้อมูลทั้งหมดในครั้งเดียวและแบ่งหน้าที่ Frontend ซึ่งไม่ขยายตามข้อมูลจริงหลายสาขา แต่ Frontend และ Test เดิมพึ่งพา Response แบบ "คืนทั้งหมด" อยู่ จึงต้องเพิ่ม Pagination โดยไม่ทำให้ Client เดิมพัง ตามนโยบาย Additive Change ใน [api-conventions.md](../03-contracts/api-conventions.md)

## Decision

1. **Query Parameter `page` และ `pageSize` เป็น Optional ทั้งคู่** (`PageRequest.From`): ถ้าไม่ส่งทั้งสองค่า = พฤติกรรมเดิม (คืนทั้งหมด, `pagination` เป็น `null`); ถ้าส่งอย่างน้อยหนึ่งค่า `page` ต่ำสุด `1` (ค่าเริ่มต้น `1`) และ `pageSize` ค่าเริ่มต้น `50` ถูกบีบ (clamp) ไว้ระหว่าง `1`–`200` (`PageRequest.MaxPageSize = 200`) — ไม่ตอบ `400` เมื่อเกินเพดาน
2. **Response ใช้ Envelope เดิมของแต่ละรายการ + ฟิลด์ใหม่ `pagination`** (`PaginationMetadata`: `page`, `pageSize`, `totalCount`, `totalPages`) ที่เป็น `null` เมื่อไม่ได้ขอแบ่งหน้า — เป็นการเพิ่มฟิลด์แบบ Backward Compatible ไม่เปลี่ยนชื่อ/ชนิดฟิลด์เดิม
3. **การแบ่งหน้าทำใน Query** ด้วย `PagingExtensions.ToPage` (Count/Skip/Take แปลงเป็น SQL บน EF และใช้ได้กับ In-Memory) โดย **Query ต้อง `OrderBy` ก่อนเสมอ** เพื่อให้หน้าเสถียร
4. **ใช้กับรายการ** ผู้ใช้ `admin`, ใบจอง, `Stay`, `Lease`, ใบแจ้งหนี้, กะแคชเชียร์, `DepositLedger`, คิวสลิป, งานแม่บ้าน, `WorkOrder`, `Parcel`, `LeaseIntent` และรายการฝั่ง `client` (ใบแจ้งหนี้, สลิป, `WorkOrder`, พัสดุ, การจอง, การแจ้งเตือน)

## Consequences

- **ข้อดี:** เปิดใช้ทีละหน้าจอได้ ไม่ต้องแก้ Client ทั้งหมดพร้อมกัน; Frontend อ่านจำนวนรวมจาก `pagination.totalCount` โดยไม่ต้องนับเอง
- **ข้อจำกัด:** ยังไม่มี `sortBy`/`sortDir`/`search` กลางที่เป็นมาตรฐานเดียวทุก Endpoint (แต่ละ Endpoint มี Filter ของตัวเอง) และการค้นหาข้อความยังเป็นหน้าที่ของ Endpoint นั้น; Endpoint ที่ไม่ส่ง `page` ยังคืนทั้งหมดซึ่งต้องค่อย ๆ เปลี่ยนเป็นบังคับแบ่งหน้าในเวอร์ชันถัดไป (Breaking Change ต้องผ่าน `v2` หรือประกาศล่วงหน้า)
- **Contract:** `contracts/openapi/tan-pms.v1.json` และ `frontend/src/generated/api/tan-pms.v1.ts` ต้องสะท้อน `pagination` ที่ Nullable

## Alternatives Considered

- **บังคับแบ่งหน้าทุก Endpoint ทันที:** สะอาดกว่าแต่ทำให้ Client เดิมพัง — ปฏิเสธ
- **Cursor/Keyset Pagination:** ประสิทธิภาพดีกว่าบนข้อมูลใหญ่ แต่หน้าตารางต้องกระโดดไปหน้า N และแสดง `totalPages` — เลือก Offset ก่อน (ข้อมูลต่อสาขาไม่ใหญ่)
- **Header `X-Total-Count`/`Link`:** แยกจาก Body ทำให้ใช้กับ OpenAPI Generator/TanStack Query ยากกว่า — ปฏิเสธ
- **ตอบ `400` เมื่อ `pageSize` เกินเพดาน:** เข้มงวดแต่ไม่เป็นมิตรกับ Client — เลือก Clamp
