# OpenCode

フォークของ [OpenCode](https://github.com/anomalyco/opencode) ที่มีความคิดเห็นเป็นของตัวเอง

---

## เริ่มต้น

### ความต้องการ

- [Bun](https://bun.sh) 1.3+

### การติดตั้ง

```bash
bun install
```

### การเรียกใช้

```bash
# เริ่ม TUI
bun dev

# เริ่ม headless API server
bun dev serve

# เริ่ม web interface
bun dev web

# เรียกใช้ในไดเรกทอรีที่กำหนด
bun dev <directory>
```

### สร้างไฟล์ executable แบบ standalone

```bash
./packages/opencode/script/build.ts --single
```

จากนั้นเรียกใช้:

```bash
./packages/opencode/dist/opencode-<platform>/bin/opencode
```

แทนที่ `<platform>` ด้วยแพลตฟอร์มของคุณ (เช่น `darwin-arm64`, `linux-x64`)

### เอเจนต์

OpenCode รวมเอเจนต์ในตัวสองตัวที่คุณสามารถสลับได้ด้วยปุ่ม `Tab`

- **build** - เอเจนต์เริ่มต้น มีสิทธิ์เข้าถึงแบบเต็มสำหรับงานพัฒนา
- **plan** - เอเจนต์อ่านอย่างเดียวสำหรับการวิเคราะห์และการสำรวจโค้ด
  - ปฏิเสธการแก้ไขไฟล์โดยค่าเริ่มต้น
  - ขอสิทธิ์ก่อนเรียกใช้คำสั่ง bash
  - เหมาะสำหรับสำรวจโค้ดเบสที่ไม่คุ้นเคยหรือวางแผนการเปลี่ยนแปลง

นอกจากนี้ยังมีเอเจนต์ย่อย **general** สำหรับการค้นหาที่ซับซ้อนและงานหลายขั้นตอน
ใช้ภายในและสามารถเรียกใช้ได้โดยใช้ `@general` ในข้อความ

### แอปพลิเคชันเดสก์ท็อป

เรียกใช้แอปพลิเคชันเดสก์ท็อปในโหมดพัฒนา:

```bash
bun run --cwd packages/desktop dev
```

สร้างเวอร์ชัน production:

```bash
bun run --cwd packages/desktop build
bun run --cwd packages/desktop package
```

### Web UI

ทดสอบการเปลี่ยนแปลง UI:

1. เริ่ม OpenCode server (`bun dev serve`)
2. เรียกใช้:

```bash
bun run --cwd packages/app dev
```

---

### การมีส่วนร่วม

หากคุณสนใจที่จะมีส่วนร่วมใน OpenCode โปรดอ่าน [เอกสารการมีส่วนร่วม](./CONTRIBUTING.md) ก่อนส่ง Pull Request
