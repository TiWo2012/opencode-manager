# OpenCode

 fork ذو رأي من [OpenCode](https://github.com/anomalyco/opencode).

---

## البدء

### المتطلبات

- [Bun](https://bun.sh) 1.3+

### التثبيت

```bash
bun install
```

### التشغيل

```bash
# بدء TUI
bun dev

# بدء خادم API بدون واجهة
bun dev serve

# بدء واجهة الويب
bun dev web

# التشغيل في مجلد محدد
bun dev <directory>
```

### بناء ملف تنفيذي مستقل

```bash
./packages/opencode/script/build.ts --single
```

ثم تشغيل:

```bash
./packages/opencode/dist/opencode-<platform>/bin/opencode
```

استبدل `<platform>` بمنصتك (مثل `darwin-arm64`، `linux-x64`).

### Agents

يتضمن OpenCode وكيليْن (Agents) مدمجين يمكنك التبديل بينهما باستخدام زر `Tab`.

- **build** - الافتراضي، وكيل بصلاحيات كاملة لاعمال التطوير
- **plan** - وكيل للقراءة فقط للتحليل واستكشاف الكود
  - يرفض تعديل الملفات افتراضيا
  - يطلب الاذن قبل تشغيل اوامر bash
  - مثالي لاستكشاف قواعد كود غير مألوفة او لتخطيط التغييرات

بالاضافة الى ذلك يوجد وكيل فرعي **general** للبحث المعقد والمهام متعددة الخطوات.
يستخدم داخليا ويمكن استدعاؤه بكتابة `@general` في الرسائل.

### تطبيق سطح المكتب

تشغيل تطبيق سطح المكتب في وضع التطوير:

```bash
bun run --cwd packages/desktop dev
```

إنشاء نسخة إنتاجية:

```bash
bun run --cwd packages/desktop build
bun run --cwd packages/desktop package
```

### Web UI

اختبار تغييرات واجهة المستخدم:

1. تشغيل خادم OpenCode (`bun dev serve`)
2. تشغيل:

```bash
bun run --cwd packages/app dev
```

---

### المساهمة

اذا كنت مهتما بالمساهمة في OpenCode، يرجى قراءة [contributing docs](./CONTRIBUTING.md) قبل ارسال pull request.
