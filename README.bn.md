# OpenCode

[OpenCode](https://github.com/anomalyco/opencode) এর একটি মতামতপূর্ণ ফর্ক।

---

## শুরু করুন

### প্রয়োজনীয়তা

- [Bun](https://bun.sh) 1.3+

### ইনস্টলেশন

```bash
bun install
```

### চালান

```bash
# TUI শুরু করুন
bun dev

# headless API সার্ভার শুরু করুন
bun dev serve

# ওয়েব ইন্টারফেস শুরু করুন
bun dev web

# নির্দিষ্ট ডিরেক্টরিতে চালান
bun dev <directory>
```

### স্ট্যান্ডালোন এক্সিকিউটেবল তৈরি করুন

```bash
./packages/opencode/script/build.ts --single
```

তারপর চালান:

```bash
./packages/opencode/dist/opencode-<platform>/bin/opencode
```

`<platform>` এর পরিবর্তে আপনার প্ল্যাটফর্ম বসান (যেমন, `darwin-arm64`, `linux-x64`)।

### এজেন্টস

OpenCode এ দুটি বিল্ট-ইন এজেন্ট রয়েছে যা আপনি `Tab` কি(key) দিয়ে পরিবর্তন করতে পারবেন।

- **build** - ডিফল্ট, ডেভেলপমেন্টের কাজের জন্য সম্পূর্ণ অ্যাক্সেসযুক্ত এজেন্ট
- **plan** - বিশ্লেষণ এবং কোড এক্সপ্লোরেশনের জন্য রিড-ওনলি এজেন্ট
  - ডিফল্টভাবে ফাইল এডিট করতে দেয় না
  - ব্যাশ কমান্ড চালানোর আগে অনুমতি চায়
  - অপরিচিত কোডবেস এক্সপ্লোর করা বা পরিবর্তনের পরিকল্পনা করার জন্য আদর্শ

এছাড়াও জটিল অনুসন্ধান এবং মাল্টিস্টেপ টাস্কের জন্য একটি **general** সাবএজেন্ট অন্তর্ভুক্ত রয়েছে।
এটি অভ্যন্তরীণভাবে ব্যবহৃত হয় এবং মেসেজে `@general` লিখে ব্যবহার করা যেতে পারে।

### ডেস্কটপ অ্যাপ

ডেভেলপমেন্ট মোডে ডেস্কটপ অ্যাপ চালান:

```bash
bun run --cwd packages/desktop dev
```

প্রোডাকশন বিল্ড তৈরি করুন:

```bash
bun run --cwd packages/desktop build
bun run --cwd packages/desktop package
```

### Web UI

UI পরিবর্তন পরীক্ষা করুন:

1. OpenCode সার্ভার শুরু করুন (`bun dev serve`)
2. চালান:

```bash
bun run --cwd packages/app dev
```

---

### অবদান

আপনি যদি OpenCode এ অবদান রাখতে চান, অনুগ্রহ করে একটি পুল রিকোয়েস্ট সাবমিট করার আগে আমাদের [কন্ট্রিবিউটিং ডকস](./CONTRIBUTING.md) পড়ে নিন।
