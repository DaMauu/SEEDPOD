# SEEDPOD（ไทย）

> หน้านี้เป็นคำแปลภาษาไทยของ [README.md](../../README.md) ฉบับ English และจีนตัวย่อถือเป็นฉบับอ้างอิง
> [简体中文](../../README.md) · [English](../../README.md) · [各语言 / All languages](README.md)

<div align="center">
  <img src="../../docs/banner.png" alt="SEEDPOD · คลังงานต่อยอดของผู้หว่าน" width="100%" />
</div>

<h1 align="center">SEEDPOD</h1>

<p align="center">SEEDPOD · คลังงานต่อยอดของผู้หว่าน</p>

<p align="center"><b>ในทุกสิ่ง จงทำให้ดีที่สุดเท่าที่ทำได้</b></p>

<p align="center">
  <img src="https://img.shields.io/badge/userscripts-37-000000?style=flat-square&logo=tampermonkey" />
  <img src="https://img.shields.io/badge/JavaScript-ES2017-f7df1e?style=flat-square&logo=javascript&logoColor=black" />
  <img src="https://img.shields.io/badge/dependencies-none-2ea44f?style=flat-square" />
  <img src="https://img.shields.io/badge/styles-1-8c796a?style=flat-square" />
  <img src="https://img.shields.io/badge/build-none%20%C2%B7%20single--file-success?style=flat-square" />
  <img src="https://img.shields.io/badge/branch-main-8957e5?style=flat-square" />
</p>

<p align="center">
  <a href="../../README.md">简体中文</a> ·
  <a href="README.zh-TW.md">繁體中文</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.ko.md">한국어</a> ·
  <a href="README.ru.md">Русский</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.pt.md">Português</a> ·
  <a href="README.it.md">Italiano</a> ·
  <a href="README.nl.md">Nederlands</a> ·
  <a href="README.pl.md">Polski</a> ·
  <a href="README.tr.md">Türkçe</a> ·
  <a href="README.vi.md">Tiếng Việt</a> ·
  <a href="README.th.md">ไทย</a> ·
  <a href="README.id.md">Bahasa Indonesia</a> ·
  <a href="README.ar.md">العربية</a>
</p>

---

SEEDPOD รวบรวมส่วนขยายไฟล์เดียวที่ติดตั้งเข้ากับเว็บได้โดยตรง ทั้งสคริปต์ Tampermonkey และสไตล์ชีตภายนอก ใส่ไฟล์เดียวก็ใช้งานได้ ไม่มีขั้นตอน build ไม่มี dependencies ไม่มี backend

แต่ละโมดูลไม่ขึ้นต่อกัน จะติดตั้งตัวไหนก็ดูแค่เอกสารของโมดูลนั้น

## โมดูล

| โมดูล | รูปแบบ | ทำอะไร | ทางเข้า |
|---|---|---|---|
| [`scripts/bluray/`](../../scripts/bluray/) | สคริปต์ผู้ใช้ | แผง نقلแผ่นต้นฉบับ: กรองแบบกลุ่ม ตรวจซ้ำข้ามเว็บ จัดหน้า BDInfo ย้ายภาพหน้าจอ กรอกฟอร์มและส่งทอร์เรนต์ | [ติดตั้ง](../../scripts/bluray/legacy/pt-bluray-assistant-v0.0.0.47.user.js) |
| [`scripts/PTScripts/`](../../scripts/PTScripts/) | สคริปต์ผู้ใช้ 37 ตัว | งานประจำบนเว็บ: ช่วยอัปโหลด ซ่อนข้อมูลตนเอง ซ่อนป้ายและประกาศ ให้ของขวัญแบบกลุ่ม ทำเครื่องหมายการดาวน์โหลด | [ดัชนี](../../scripts/PTScripts/README.md) |
| [`styles/r/`](../../styles/r/) | CSS | ธีมสว่าง Broomhilda Red สไตล์ภายนอกสำหรับเว็บ | [ติดตั้ง](../../styles/r/README.md) |

## คำอธิบาย

**bluray** เป็นสคริปต์หลักของคลังนี้ ยาวประมาณ 6300 บรรทัด รวบงานซ้ำ ๆ ของการย้ายแผ่นต้นฉบับไว้ในแผงเดียวที่เปิดค้างไว้ได้: กรองแผ่นที่เข้าเกณฑ์ตามกฎ ตรวจซ้ำกับเว็บปลายทาง อ่านการจัดหน้าในหน้ารายละเอียด ย้ายภาพไปยังโฮสต์อื่น กรอกฟอร์มอัปโหลด แล้วส่งต่อไปยังโปรแกรมดาวน์โหลด รองรับเว็บสี่ประเภท ได้แก่ NexusPHP, UNIT3D, Gazelle และ f3nix เอกสารดูได้ที่ [เริ่มต้นอย่างรวดเร็ว](../../scripts/bluray/docs/QUICKSTART.md), [คู่มือใช้งาน](../../scripts/bluray/docs/GUIDE.md), [สถาปัตยกรรม](../../scripts/bluray/docs/ARCHITECTURE.md), [การพัฒนา](../../scripts/bluray/docs/DEVELOPMENT.md), [บริบท AI](../../scripts/bluray/docs/AI-CONTEXT.md)

**PTScripts** เป็นชุดสคริปต์ที่ย้ายมาจากต้นทาง `DaMauu/Scripts` ทั้งชุด ไฟล์คงไว้ตามเดิม เปลี่ยนเฉพาะลิงก์ติดตั้งให้ชี้มาที่คลังนี้ การอัปเกรดเป็นไปตามต้นทาง ดูประโยชน์ของแต่ละสคริปต์ได้ที่[ดัชนี](../../scripts/PTScripts/README.md)

**styles/r** เก็บธีมของเว็บ ที่อยู่สำหรับติดตั้งใช้ tag แบบคงที่ เนื้อหาจึงไม่เปลี่ยน หากแก้สไตล์แล้วก็แค่สร้าง tag ใหม่

## การติดตั้ง

- สคริปต์: ติดตั้ง [Tampermonkey](https://www.tampermonkey.net/) เปิดไฟล์ `.user.js` ที่ต้องการแล้วกด `Raw` เพื่อยืนยัน
- สไตล์: คัดลอกลิงก์ตรงของ jsDelivr ไปวางในช่องสไตล์ชีตภายนอกของเว็บ หรือทดลองชั่วคราวตาม[คำอธิบาย](../../styles/r/README.md)

## กฎของเวอร์ชัน

| โมดูล | กฎ |
|---|---|
| bluray | `0.0.0.N` สี่ส่วนเพิ่มขึ้นเรื่อย ๆ หนึ่งเวอร์ชันต่อหนึ่งไฟล์ เวอร์ชันเก่าไม่ถูกเขียนทับและไม่ถูกลบ `@version` ที่ส่วนหัว ชื่อแผง และบันทึกการฉีดต้องตรงกันทั้งสามจุด |
| PTScripts | ตามต้นทาง คลังนี้รับประกันเพียงว่าไฟล์จะไม่หาย |
| styles | หนึ่งไฟล์ต่อหนึ่งสไตล์ แก้ไขแล้วเพิ่มเลขเวอร์ชันและสร้าง tag tag เก่าเก็บไว้ตลอดเพื่อย้อนกลับได้ |

## โครงสร้าง

```
SEEDPOD/
├── docs/banner.png              ภาพปก
├── scripts/
│   ├── bluray/                  แผง نقلแผ่นต้นฉบับ (เอกสารใน docs/, legacy/ v0.0.0.1 ~ v0.0.0.47)
│   └── PTScripts/               37 สคริปต์ไฟล์เดียว + ดัชนี
├── styles/r/                    ธีม Broomhilda Red
└── README.md
```

## ปัญหาที่ทราบ

ปัญหาที่เกิดซ้ำและข้อที่ยังไม่แก้ของ bluray (K-01 ~ K-14) พร้อมรูปแบบการเกิดซ้ำ บันทึกไว้ใน [`scripts/bluray/README.md`](../../scripts/bluray/README.md) อ่านหัวข้อนั้นก่อนแก้ไข

## สัญญาอนุญาตและข้อจำกัดความรับผิด

โค้ดเผยแพร่ภายใต้ [GPL-3.0](../../LICENSE) ใช้ แก้ไข และแจกจ่ายต่อได้อย่างอิสระ แต่เมื่อแจกจ่ายฉบับที่แก้ไขแล้วต้องเปิดเผยซอร์สเช่นเดียวกันและคงประกาศลิขสิทธิ์ไว้ จะนำไปแพ็กปิดซอร์สขายไม่ได้

ใช้ส่วนตัวเพื่อย้ายทรัพยากรระหว่างเว็บปิดที่คุณได้รับอนุญาตเท่านั้น โปรดปฏิบัติตามกฎของแต่ละเว็บ ก่อนย้ายต้องยืนยันว่าไม่มีข้อห้ามย้ายและไม่ซ้ำกับของเดิม

<p align="center"><sub>ผลงานจากการพัฒนาอย่างเร่าร้อนในยามดึกของ 大肥鱼 DeepSeek และ 主任</sub></p>
