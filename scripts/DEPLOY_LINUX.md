# Hướng Dẫn Triển Khai Arychi Web Suite Trên VPS Linux (Ubuntu / Debian)

Tài liệu hướng dẫn tối ưu và cấu hình chạy dự án trên môi trường VPS Linux 24/7 ổn định và tiết kiệm tài nguyên.

---

## 1. Cài Đặt Môi Trường Ban Đầu Trên VPS

Chạy các lệnh sau trên VPS:

```bash
# 1. Cập nhật hệ thống
sudo apt update && sudo apt upgrade -y

# 2. Cài đặt các công cụ cơ bản, Git, FFmpeg và Curl
sudo apt install -y git curl wget ffmpeg make

# 3. Cài đặt Node.js LTS (v20+) & Golang
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo apt install -y golang-go
```

Kiểm tra phiên bản:
```bash
node -v
npm -v
go version
ffmpeg -version
```

---

## 2. Tải Code & Cài Đặt Dependencies

```bash
# Clone repository
git clone https://github.com/co1ko2oki-svg/arychi-web.git /var/www/arychi-web
cd /var/www/arychi-web

# Cấu hình biến môi trường
cp .env.example .env
nano .env   # Điền Discord Token, Database, Client ID, Client Secret...

# Cài đặt node dependencies
npm install
npm --prefix frontend install

# Build giao diện frontend
npm run build
```

---

## 3. Biên Dịch Binary Go Cho Linux

Bạn có 2 cách:

### Cách A: Biên dịch trực tiếp trên VPS
```bash
# Sử dụng script đã tối ưu
bash build.sh

# Hoặc dùng makefile
make build
```

### Cách B: Cross-compile trên Windows rồi upload lên VPS
Trên máy tính Windows của bạn, chạy:
```bash
npm run build:linux
```
Lệnh này sẽ tự động xuất các file binary Linux 64-bit vào thư mục `bin/` (`quest-server`, `stream-server`, `arychi-server`,...). Bạn chỉ cần upload thư mục `bin/` lên VPS và cấp quyền:
```bash
chmod +x bin/*
```

---

## 4. Chạy Thử Nghiệm

Chạy trực tiếp qua launcher:
```bash
bash start.sh
```
*(Launcher sẽ khởi chạy song song Go Quest server cổng 3001, Go Stream server cổng 3000 và Web Vite cổng 5173).*

---

## 5. Triển Khai Chạy Ngầm 24/7 Bằng Systemd (Khuyên dùng)

Systemd giúp hệ thống tự động khởi động cùng VPS khi reboot và tự restart nếu gặp sự cố.

### Bước 1: Sao chép file service
```bash
sudo cp scripts/systemd/arychi.service /etc/systemd/system/arychi.service
```

### Bước 2: Kích hoạt và khởi chạy
```bash
sudo systemctl daemon-reload
sudo systemctl enable arychi.service
sudo systemctl start arychi.service
```

### Các lệnh quản lý:
```bash
# Xem trạng thái
sudo systemctl status arychi

# Xem log trực tiếp
journalctl -u arychi -f

# Khởi động lại
sudo systemctl restart arychi

# Dừng dịch vụ
sudo systemctl stop arychi
```

---

## 6. Cấu Hình Nginx & Tên Miền (Domain + SSL)

### Bước 1: Cài đặt Nginx
```bash
sudo apt install -y nginx
```

### Bước 2: Cấu hình VirtualHost
```bash
sudo cp scripts/nginx/arychi.conf /etc/nginx/sites-available/arychi.conf
sudo nano /etc/nginx/sites-available/arychi.conf  # Sửa your-domain.com thành domain thật

sudo ln -s /etc/nginx/sites-available/arychi.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Bước 3: Cài đặt SSL miễn phí (Certbot)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```
