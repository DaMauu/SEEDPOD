# SEEDPOD（العربية）

> هذه الصفحة ترجمة عربية للملف [README.md](../../README.md). النسختان English والصينية المبسطة هما المرجع.
> [简体中文](../../README.md) · [English](../../README.md) · [各语言 / All languages](README.md)

<div align="center">
  <img src="../../docs/banner.png" alt="SEEDPOD · مكتبة مشتقات الزارع" width="100%" />
</div>

<h1 align="center">SEEDPOD</h1>

<p align="center">SEEDPOD · مكتبة مشتقات الزارع</p>

<p align="center"><b>في كل شيء، ابذل أقصى ما تستطيع.</b></p>

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

يجمع SEEDPOD إضافات من ملف واحد تُثبَّت مباشرة في المواقع: سكربتات Tampermonkey وأوراق الأنماط الخارجية. يكفي تثبيت ملف واحد ليعمل، دون خطوة بناء ودون اعتماديات ودون خادم خلفي.

الوحدات مستقلة عن بعضها؛ ويكفي لاختيار ما تثبته الرجوع إلى وثائق تلك الوحدة.

## الوحدات

| الوحدة | الشكل | الوظيفة | المدخل |
|---|---|---|---|
| [`scripts/bluray/`](../../scripts/bluray/) | سكربت مستخدم | لوحة نقل الأقراص الأصلية: تصفية جماعية، وفحص التكرار بين المواقع، وتنسيق BDInfo، ونقل لقطات الشاشة، وتعبئة النموذج وإرسال التورنت | [تثبيت](../../scripts/bluray/legacy/pt-bluray-assistant-v0.0.0.47.user.js) |
| [`scripts/PTScripts/`](../../scripts/PTScripts/) | 37 سكربت مستخدم | المهام اليومية في الموقع: مساعدة الرفع، وإخفاء البيانات الشخصية، وإخفاء الشارات والإعلانات، والإهداء الجماعي، ووسم التنزيلات | [الفهرس](../../scripts/PTScripts/README.md) |
| [`styles/r/`](../../styles/r/) | CSS | سمة Broomhilda Red الفاتحة، نمط خارجي للموقع | [تطبيق](../../styles/r/README.md) |

## الوصف

**bluray** هو السكربت الرئيسي في هذه المكتبة، بنحو 6300 سطر، ويجمع العمل المتكرر في نقل الأقراص الأصلية داخل لوحة واحدة تبقى مفتوحة: يفرز الأقراص المؤهلة وفق القواعد، ويتحقق من التكرار في الموقع الهدف، ويقرأ تنسيق صفحة التفاصيل، وينقل الصور إلى مستضيف آخر، ويملأ نموذج الرفع ثم يرسله إلى برنامج التنزيل. يدعم أربعة أنواع من المواقع: NexusPHP وUNIT3D وGazelle وf3nix. الوثائق: [بداية سريعة](../../scripts/bluray/docs/QUICKSTART.md)، [دليل الاستخدام](../../scripts/bluray/docs/GUIDE.md)، [البنية](../../scripts/bluray/docs/ARCHITECTURE.md)، [التطوير](../../scripts/bluray/docs/DEVELOPMENT.md)، [سياق AI](../../scripts/bluray/docs/AI-CONTEXT.md).

**PTScripts** مجموعة سكربتات نُقلت كاملةً من المشروع الأصلي `DaMauu/Scripts`؛ تُحفظ الملفات كما هي، ولا تُغيَّر إلا روابط التثبيت لتشير إلى هذه المكتبة، وتتبع الترقية المشروع الأصلي. راجع [الفهرس](../../scripts/PTScripts/README.md) لمعرفة غرض كل سكربت.

**styles/r** يضم سمات الموقع. يستخدم عنوان التثبيت tag ثابتًا فلا يتغير المحتوى؛ وبعد تعديل النمط يكفي إنشاء tag جديد.

## التثبيت

- السكربتات: ثبّت [Tampermonkey](https://www.tampermonkey.net/)، وافتح ملف `.user.js` المقابل ثم اضغط `Raw` للتأكيد.
- الأنماط: انسخ رابط jsDelivr المباشر إلى حقل ورقة الأنماط الخارجية في الموقع، أو جرّبه مؤقتًا وفق [الشرح](../../styles/r/README.md).

## قواعد الإصدار

| الوحدة | القاعدة |
|---|---|
| bluray | `0.0.0.N` بأربعة مقاطع متزايدة، إصدار واحد لكل ملف، ولا تُستبدل الإصدارات القديمة ولا تُحذف؛ ويبقى `@version` في الرأس وعنوان اللوحة وسجل الحقن متزامنة |
| PTScripts | يتبع المشروع الأصلي؛ وهذه المكتبة تضمن فقط عدم ضياع الملفات |
| styles | ملف واحد لكل نمط، وعند التعديل يُزاد رقم الإصدار ويُنشأ tag، وتبقى tag القديمة دائمًا للرجوع إليها |

## البنية

```
SEEDPOD/
├── docs/banner.png              صورة الغلاف
├── scripts/
│   ├── bluray/                  لوحة نقل الأقراص الأصلية (وثائق في docs/، legacy/ v0.0.0.1 ~ v0.0.0.47)
│   └── PTScripts/               37 سكربتًا في ملف واحد + الفهرس
├── styles/r/                    سمة Broomhilda Red
└── README.md
```

## المشكلات المعروفة

المشكلات المتكررة والبنود غير المحلولة في bluray (K-01 ~ K-14) مع أنماط تكرارها مسجلة في [`scripts/bluray/README.md`](../../scripts/bluray/README.md). اقرأ ذلك القسم قبل التعديل.

## الترخيص وإخلاء المسؤولية

الكود مرخّص بموجب [GPL-3.0](../../LICENSE): يمكن استخدامه وتعديله وإعادة توزيعه بحرية، لكن عند توزيع نسخة معدّلة يجب إبقاؤها مفتوحة المصدر والحفاظ على إشعار حقوق النشر، ولا يجوز تعبئتها مغلقة وبيعها.

للاستخدام الشخصي فقط في نقل الموارد بين مواقع خاصة لديك تصريح بها. التزم بقواعد كل موقع: تحقق قبل النقل من عدم وجود منع للنقل ومن عدم وجود تكرار.

<p align="center"><sub>نتاج تطوير ليلي شغوف من 大肥鱼 DeepSeek و主任</sub></p>
