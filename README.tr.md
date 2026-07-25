# OpenCode

[OpenCode](https://github.com/anomalyco/opencode) 'un düşünceli bir fork'u.

---

## Başlarken

### Gereksinimler

- [Bun](https://bun.sh) 1.3+

### Kurulum

```bash
bun install
```

### Çalıştırma

```bash
# TUI'ı başlat
bun dev

# Headless API sunucusunu başlat
bun dev serve

# Web arayüzünü başlat
bun dev web

# Belirli bir dizinde çalıştır
bun dev <directory>
```

### Bağımsız çalıştırılabilir dosya oluşturma

```bash
./packages/opencode/script/build.ts --single
```

Sonra şununla çalıştırın:

```bash
./packages/opencode/dist/opencode-<platform>/bin/opencode
```

`<platform>` yerine platformunuzu yazın (örn. `darwin-arm64`, `linux-x64`).

### Ajanlar

OpenCode, `Tab` tuşuyla aralarında geçiş yapabileceğiniz iki yerleşik (built-in) ajan içerir.

- **build** - Varsayılan, geliştirme çalışmaları için tam erişimli ajan
- **plan** - Analiz ve kod keşfi için salt okunur ajan
  - Varsayılan olarak dosya düzenlemelerini reddeder
  - Bash komutlarını çalıştırmadan önce izin ister
  - Tanımadığınız kod tabanlarını keşfetmek veya değişiklikleri planlamak için ideal

Ayrıca, karmaşık aramalar ve çok adımlı görevler için bir **genel** alt ajan bulunmaktadır.
Bu dahili olarak kullanılır ve mesajlarda `@general` ile çağrılabilir.

### Masaüstü uygulaması

Masaüstü uygulamasını geliştirme modunda çalıştır:

```bash
bun run --cwd packages/desktop dev
```

Production sürümü oluştur:

```bash
bun run --cwd packages/desktop build
bun run --cwd packages/desktop package
```

### Web UI

UI değişikliklerini test et:

1. OpenCode sunucusunu başlat (`bun dev serve`)
2. Çalıştır:

```bash
bun run --cwd packages/app dev
```

---

### Katkıda Bulunma

OpenCode'a katkıda bulunmak istiyorsanız, lütfen bir pull request göndermeden önce [katkıda bulunma dokümanlarımızı](./CONTRIBUTING.md) okuyun.
