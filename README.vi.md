# OpenCode

Một bản fork có chính kiến của [OpenCode](https://github.com/anomalyco/opencode).

---

## Bắt đầu

### Yêu cầu

- [Bun](https://bun.sh) 1.3+

### Cài đặt

```bash
bun install
```

### Chạy

```bash
# Khởi động TUI
bun dev

# Khởi động server API headless
bun dev serve

# Khởi động giao diện web
bun dev web

# Chạy trong thư mục cụ thể
bun dev <directory>
```

### Xây dựng file thực thi độc lập

```bash
./packages/opencode/script/build.ts --single
```

Sau đó chạy với:

```bash
./packages/opencode/dist/opencode-<platform>/bin/opencode
```

Thay `<platform>` bằng nền tảng của bạn (ví dụ: `darwin-arm64`, `linux-x64`).

### Agents

OpenCode bao gồm hai agent được tích hợp sẵn mà bạn có thể chuyển đổi bằng phím `Tab`.

- **build** - Agent mặc định, có toàn quyền truy cập cho công việc lập trình
- **plan** - Agent chỉ đọc dùng để phân tích và khám phá mã nguồn
  - Mặc định từ chối việc chỉnh sửa tệp
  - Hỏi quyền trước khi chạy các lệnh bash
  - Lý tưởng để khám phá các codebase lạ hoặc lên kế hoạch thay đổi

Ngoài ra còn có một subagent **general** dùng cho các tìm kiếm phức tạp và tác vụ nhiều bước.
Agent này được sử dụng nội bộ và có thể gọi bằng cách dùng `@general` trong tin nhắn.

### Ứng dụng Desktop

Chạy ứng dụng desktop ở chế độ phát triển:

```bash
bun run --cwd packages/desktop dev
```

Tạo bản build production:

```bash
bun run --cwd packages/desktop build
bun run --cwd packages/desktop package
```

### Web UI

Kiểm tra thay đổi UI:

1. Khởi động server OpenCode (`bun dev serve`)
2. Chạy:

```bash
bun run --cwd packages/app dev
```

---

### Đóng góp

Nếu bạn muốn đóng góp cho OpenCode, vui lòng đọc [tài liệu hướng dẫn đóng góp](./CONTRIBUTING.md) trước khi gửi pull request.
