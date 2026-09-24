# Kỳ Viện — Dự án cờ tướng

Giao diện cổ trang hiện đại: nền mực, son đỏ, vàng đồng, bàn cờ gỗ. **Frontend Next.js + React + TypeScript; backend Python/FastAPI; dữ liệu PostgreSQL.**

## Đối chiếu với yêu cầu

| # | Yêu cầu | Đã làm | Kiểm tra bằng |
|---|---|---|---|
| 1 | Giao diện đăng ký / đăng nhập | Hộp thoại Đăng nhập/Đăng ký; mật khẩu băm scrypt, cookie HttpOnly; chống dò mật khẩu **theo từng tài khoản** (một người gõ sai không khóa cả trang) | E2E `01-basics`, `05-resilience`; pytest |
| 2 | Tạo room chơi game | "Tạo phòng mới" → mã 6 ký tự; danh sách phòng đang chờ (chỉ phòng mà chủ phòng còn online, mới nhất trước); mục **Phòng của bạn**; nút **Rời phòng** | E2E `01`, `02`; pytest |
| 3 | Mời bạn vào room — **trong game, MXH, mã phòng** | *Trong game*: mời theo tên tài khoản, người nhận thấy thông báo (toast có nút **Tham gia** + huy hiệu trên menu) dù đang ở màn hình nào. *MXH*: hộp chia sẻ của thiết bị (Zalo, Messenger… trên điện thoại), nút Facebook / Telegram / X / Email, **Sao chép lời mời** để dán vào Zalo/Messenger; liên kết có ảnh xem trước. *Mã phòng / liên kết* `?room=MÃ`: người chưa có tài khoản mở liên kết → đăng ký → **vào thẳng phòng** | E2E `02-invite-resume` |
| 4 | Load bàn cờ + lưu bàn cờ | Lưu vào tài khoản (PostgreSQL), lưu trên trình duyệt (khách), xuất/nạp JSON, xóa ván đã lưu; khi nạp chọn **chơi tiếp với máy** hoặc **hai người**. Tải lại trang (F5): ván với máy được **tự khôi phục**, phòng online được **nạp lại từ PostgreSQL** (bàn cờ, lượt, lịch sử, chat) | E2E `03-saves-ai`, `02-invite-resume` |
| 5 | Chơi 2 người online qua mạng | WebSocket; máy chủ kiểm tra người chơi, lượt, phiên bản bàn cờ và luật đi; thấy đối thủ **trực tuyến/ngoại tuyến**; tự kết nối lại (kể cả khi API khởi động lại); mở phòng ở tab thứ hai không làm hai tab đá nhau | E2E `01`, `02`, `05`; pytest |
| 6 | Khung chat giữa người chơi (video call) | Chat lưu trong PostgreSQL; video call WebRTC ngay cạnh khung chat (nhận / từ chối / tắt mic / tắt camera); máy không có camera tự chuyển sang **gọi thoại** và vẫn thấy hình đối phương | E2E `01`, `04-call-matrix` |
| 7 | Chơi với máy | Minimax + alpha-beta, 3 mức. Mức 3 thắng ngẫu nhiên và thắng mức 1 (cả hai màu); nước đi chậm nhất khoảng 0,15 giây | `npm run check:ai`, E2E `03` |

Luật cờ được kiểm hai nơi (trình duyệt và máy chủ) và đều cho đúng số nước đi chuẩn của cờ tướng từ thế khai cuộc: 44 / 1 920 / 79 666 / 3 290 240 (`npm run check:rules`, `pytest`).

## Chạy đầy đủ bằng Docker

Cần Docker Desktop/Engine đang chạy và Docker Compose. Trong thư mục dự án:

```bash
cp .env.example .env        # Windows PowerShell: copy .env.example .env
```

Mở `.env`, điền `POSTGRES_PASSWORD` và `JWT_SECRET` (mỗi giá trị tối thiểu 32 ký tự, dùng chuỗi hex ngẫu nhiên). Tạo **hai giá trị khác nhau** bằng:

```bash
python -c "import secrets; print(secrets.token_hex(32)); print(secrets.token_hex(32))"
```

Sau đó:

```bash
docker compose up --build -d
```

Mở **http://localhost:3000** (đúng `localhost`, không dùng `127.0.0.1`: `ALLOWED_ORIGINS` mặc định chỉ có `http://localhost:3000`). PostgreSQL chỉ truy cập trong mạng Docker. Backend tạo schema lần đầu và tự thêm cột mới khi nâng cấp từ bản cũ. Dữ liệu giữ ở volume `pgdata` qua lần khởi động lại; không chạy `docker compose down -v` nếu muốn giữ dữ liệu. Web chỉ khởi động sau khi backend báo khỏe (`/api/health`).

Thử ngay: dùng hai trình duyệt (hoặc một cửa sổ riêng tư), đăng ký hai tài khoản, một người tạo phòng, người kia nhập mã hoặc mở liên kết mời. Một cửa sổ chỉ giữ được một tài khoản.

Next.js chuyển `/api/*` tới FastAPI (WebSocket đi qua cùng đường: `/api/ws/{mã}` với vé ngắn hạn dùng một lần lấy từ `/api/ws-ticket`).

> `BACKEND_URL`, `NEXT_PUBLIC_API_URL` và `NEXT_PUBLIC_SITE_URL` được Next.js đọc **lúc build**, nên `compose.yaml` truyền chúng vào bước build (`build.args`). Đổi giá trị thì build lại: `docker compose up --build -d`.

## Chạy phát triển không Docker

Cần Python 3.12+, Node 22.13+ và một PostgreSQL (hoặc SQLite cho thử nhanh).

1. Tạo database và user riêng, ví dụ `kyvien`.
2. Backend:
   ```bash
   python -m venv .venv && . .venv/bin/activate      # Windows: .venv\Scripts\Activate.ps1
   pip install -r backend/requirements.txt
   export DATABASE_URL=postgresql+psycopg://USER:PASSWORD@localhost:5432/kyvien   # hoặc sqlite:///dev.db
   export JWT_SECRET=$(python -c "import secrets; print(secrets.token_hex(32))")
   export ALLOWED_ORIGINS=http://localhost:3000 COOKIE_SECURE=false
   python -m uvicorn backend.main:app --port 8000 --workers 1
   ```
   (PowerShell: `$env:DATABASE_URL='...'; $env:JWT_SECRET='...'; $env:ALLOWED_ORIGINS='http://localhost:3000'; $env:COOKIE_SECURE='false'`.)
3. Frontend:
   ```bash
   corepack pnpm install --frozen-lockfile
   BACKEND_URL=http://127.0.0.1:8000 npx next dev      # PowerShell: $env:BACKEND_URL='http://127.0.0.1:8000'; npx next dev
   ```

Trong Docker, `Dockerfile` dùng `next build` và standalone output. Các script `dev/build` mặc định trong package dành cho bản Sites/Vinext; dùng `dev:next`, `build:next`, `start:next` khi chạy Next.js tiêu chuẩn.

## Mời bạn vào phòng

Trong phòng, bấm **Mời bằng hữu**:

- **Trong game** — gõ tên đăng nhập của bạn bè → *Gửi lời mời*. Người nhận thấy thông báo trong vòng vài giây và bấm **Tham gia** ngay trên thông báo (hoặc trong mục *Phòng chơi*).
- **Mạng xã hội** — *Chia sẻ liên kết phòng* mở hộp chia sẻ của thiết bị (điện thoại có Zalo, Messenger…); trên máy tính dùng nút Facebook / Telegram / X / Email hoặc *Sao chép lời mời* rồi dán vào Zalo Web, Messenger… Nút Zalo riêng cần Official Account ID của Zalo nên không có sẵn.
- **Mã phòng** — gửi mã 6 ký tự; người kia chọn *Vào phòng bằng mã*. Liên kết `https://tên-miền/?room=MÃ` làm cùng việc; nếu người mở chưa đăng nhập, sau khi đăng nhập/đăng ký họ được đưa thẳng vào phòng.

Liên kết chia sẻ có ảnh xem trước (Open Graph) khi đặt `NEXT_PUBLIC_SITE_URL` là địa chỉ công khai của trang. Liên kết trỏ tới `localhost`/mạng nội bộ chỉ mở được với người cùng mạng; hộp thoại có cảnh báo khi đó.

## Chơi từ hai máy khác mạng

Triển khai Docker trên một máy chủ có tên miền và HTTPS, reverse proxy đến cổng 3000 (Caddy tự xử lý WebSocket và `X-Forwarded-For`; với nginx cần thêm `Upgrade`/`Connection`). Đặt trong `.env`:

```dotenv
ALLOWED_ORIGINS=https://co-tuong.example.com
COOKIE_SECURE=true
NEXT_PUBLIC_SITE_URL=https://co-tuong.example.com
TRUSTED_PROXY_HOPS=1
```

Không để `COOKIE_SECURE=false` khi đưa lên Internet. Camera và micro yêu cầu HTTPS (`localhost` là ngoại lệ của trình duyệt). Trình duyệt gửi nhịp `ping` mỗi 20 giây nên kết nối không bị proxy có thời gian chờ ngắn (ví dụ nginx mặc định 60 giây) cắt khi hai người đang nghĩ nước.

**`TRUSTED_PROXY_HOPS`** = số reverse proxy phía trước backend có ghi địa chỉ khách vào `X-Forwarded-For` (một proxy như Caddy/nginx đặt trước Next.js → `1`). Để `0` khi không có proxy nào: header bị bỏ qua. Next.js không tự thêm header này, nên nếu không có proxy ngoài, backend chỉ thấy địa chỉ của web container; vì vậy giới hạn đăng nhập tính theo tài khoản, và chỉ giới hạn *đăng ký* (20 lần/phút) dùng địa chỉ khách.

Ví dụ nginx:

```nginx
map $http_upgrade $connection_upgrade { default upgrade; '' close; }
server {
  server_name co-tuong.example.com;   # + chứng chỉ TLS
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

### Nếu giao diện và API ở hai tên miền

Đặt `NEXT_PUBLIC_API_URL=https://api.example.com/api` **trước khi build frontend**. Đặt `ALLOWED_ORIGINS` trên backend bằng chính origin của frontend. Với cookie cross-site, backend phải có `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true`. Một số trình duyệt chặn third-party cookie; nên triển khai cùng origin qua reverse proxy để ổn định. Tệp Compose mặc định dùng cùng origin và `lax`.

### Video call

Khi hai người đã vào phòng, mở tab **Trò chuyện** → biểu tượng camera. Người nhận bấm *Nhận cuộc gọi* và cho phép camera/micro. Khung gọi nằm ngay dưới bảng điều khiển của phòng (trên điện thoại là cửa sổ nhỏ nổi phía dưới). Có nút tắt micro, tắt camera, kết thúc; không có camera thì gọi thoại và vẫn nhận hình của đối phương. Nếu đối phương rời phòng quá 6 giây thì cuộc gọi tự kết thúc.

Máy chủ trả STUN mặc định. Để hoạt động đáng tin cậy qua NAT/firewall, điền TURN của bạn:

```dotenv
TURN_URL=turn:your-turn-host:3478
TURN_USERNAME=your-turn-user
TURN_PASSWORD=your-turn-password
```

Không có ghi âm/ghi hình hoặc lưu video vào database.

## Biến môi trường

| Biến | Nơi dùng | Mặc định | Ý nghĩa |
|---|---|---|---|
| `POSTGRES_PASSWORD`, `JWT_SECRET` | compose | bắt buộc | ≥ 32 ký tự, hai giá trị khác nhau |
| `ALLOWED_ORIGINS` | backend | `http://localhost:3000` | origin của trang web (CSRF và WebSocket); nhiều giá trị cách nhau bằng dấu phẩy |
| `COOKIE_SECURE`, `COOKIE_SAMESITE` | backend | `true` (compose: `false`), `lax` | thuộc tính cookie phiên |
| `TRUSTED_PROXY_HOPS` | backend | `0` | xem ở trên |
| `TURN_URL`, `TURN_USERNAME`, `TURN_PASSWORD` | backend | trống | máy chủ TURN cho video call |
| `BACKEND_URL` | web, lúc build | `http://backend:8000` | đích của `/api/*` |
| `NEXT_PUBLIC_API_URL` | web, lúc build | trống | API ở tên miền khác |
| `NEXT_PUBLIC_SITE_URL` | web, lúc build | trống | địa chỉ công khai, dùng cho liên kết mời và ảnh xem trước |
| `TEST_DATABASE_URL` | pytest | SQLite tạm | chạy bộ test trên PostgreSQL |

## Kiểm tra

```bash
python -m pip install pytest httpx
python -m pytest backend/test_backend.py -q      # 10 test: luật, xác thực, phòng, WebSocket, lưu ván, migration...
npm run typecheck                                # tsc --noEmit
npx eslint .                                     # 0 lỗi, 0 cảnh báo
npx next build
npm run check:rules                              # perft 44 / 1920 / 79666 / 3290240 cho luật ở trình duyệt
npm run check:parity                             # luật ở trình duyệt và ở máy chủ cho cùng danh sách nước đi (cần Python)
npm run check:ai                                 # mức 3 thắng mức 1 và bộ chọn ngẫu nhiên
```

Bộ test backend mặc định dùng SQLite tạm. Để chạy **cùng bộ test trên PostgreSQL** (khóa hàng `FOR UPDATE`, kiểu JSON, khóa ngoại, độ dài cột):

```bash
TEST_DATABASE_URL=postgresql+psycopg://USER:PASSWORD@localhost:5432/kyvien_test python -m pytest backend/test_backend.py -q
```

Dùng database trống dùng một lần: test tạo user và phòng mà không dọn.

**Kiểm thử end-to-end bằng trình duyệt thật** (hai đến ba người chơi độc lập, nước đi, chat, video call, mời, tải lại trang, lưu/nạp, chơi với máy, điện thoại). Cần Chrome hoặc Edge đã cài, và ứng dụng đang chạy ở `BASE`:

```bash
cd e2e && npm install
BASE=http://localhost:3000 npm test               # PowerShell: $env:BASE='http://localhost:3000'; npm test
```

Camera/micro trong test là luồng giả lập nên không phụ thuộc phần cứng. Bước "API khởi động lại giữa ván" chạy khi đặt `RESTART_BACKEND_CMD` (lệnh khởi động lại API trên cùng database). Mỗi lần chạy tạo một số tài khoản `ra_…`, `na_…`: dùng database thử nghiệm.

## Cấu trúc

- `app/page.tsx`: kỳ đài, phòng, đăng nhập, lưu/nạp, chat, mời. `app/globals.css`: giao diện responsive. `app/layout.tsx`: metadata và ảnh xem trước.
- `hooks/use-room-socket.ts`: kết nối WebSocket của phòng (vé, tự nối lại, nhịp ping, mã 4001 = mở ở tab khác). `hooks/use-call.ts`: WebRTC.
- `lib/chess.ts`: luật chơi và AI. `lib/api.ts`: gọi API và kiểu dữ liệu. `lib/share.ts`: liên kết mời.
- `backend/main.py`: API, xác thực, database, WebSocket. `backend/chess.py`: luật được máy chủ xác thực. `backend/test_backend.py`: kiểm thử.
- `e2e/`: kiểm thử trình duyệt. `scripts/check-rules.mjs`, `scripts/check-ai.mjs`: kiểm tra luật và AI.
- `compose.yaml`, `Dockerfile`, `backend/Dockerfile`, `.env.example`: triển khai.

## Dữ liệu

| Bảng | Nội dung |
|---|---|
| users | Tên kỳ thủ và hash mật khẩu |
| rooms | Hai kỳ thủ, bàn cờ JSON, lượt, lịch sử, trạng thái, version, `created_at` |
| saves | Bàn cờ đã lưu (kèm chế độ chơi), thuộc về từng user |
| messages | Tin nhắn và thời gian trong từng phòng |
| invitations | Người mời, người nhận, mã phòng |

## Đã kiểm thử gì, chưa kiểm thử gì

Đã chạy trên Windows 11 với Chrome 153, Python 3.13, Node 24:

- 10 test backend trên SQLite **và** trên PostgreSQL 18 (bản PGlite — PostgreSQL biên dịch sang WASM, vì máy dev không chạy được PostgreSQL/Docker gốc), gồm migration thêm cột `created_at` vào bảng `rooms` cũ.
- `tsc`, `eslint`, `next build` sạch; `check:rules` đúng perft đến độ sâu 4; `check:parity`: hai bộ luật (TypeScript và Python) cho cùng danh sách nước đi trên mọi thế cờ của các ván ngẫu nhiên (đã chạy thêm một đợt lớn 75 844 thế, không lệch thế nào).
- Bộ E2E (54 bước, 5 nhóm) chạy với bản `next build` standalone + FastAPI + PostgreSQL 18, qua proxy `/api` của Next.js, gồm WebSocket và WebRTC giữa hai trình duyệt.
- `docker compose config` hợp lệ; bước cài phụ thuộc của `Dockerfile` mô phỏng lại và sửa (xem bên dưới).

Chưa kiểm thử được:

- **`docker compose up --build`** chưa được chạy trọn vẹn: Docker Desktop trên máy phát triển không khởi động được (lỗi socket cũ của Docker). Đã sửa một lỗi thật ở `Dockerfile`: bước `pnpm install --frozen-lockfile` thiếu `pnpm-workspace.yaml` nên dừng với `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`.
- Video call qua Internet với NAT thật và máy chủ TURN; camera/micro thật (test dùng luồng giả lập, và WebRTC chỉ chạy giữa hai trình duyệt cùng máy).
- Bản xem trực tuyến Sites/Vinext (Cloudflare).
- Tải lớn / nhiều tiến trình (xem giới hạn).

## Trạng thái bản xem trực tuyến

Bản Sites chạy giao diện bằng lớp tương thích Next.js/Vinext trên Cloudflare. Nơi này không cung cấp máy chủ Python hay PostgreSQL. Vì vậy bản xem có **luyện tập offline, chơi cùng máy, lịch sử, lưu/nạp trên thiết bị**; các chức năng tài khoản, phòng online, chat và video cần kết nối backend riêng.

Mã nguồn đã bao gồm backend thật và cấu hình Docker chạy **Next.js chuẩn**. Không dùng danh sách phòng giả, tài khoản giả hoặc chat giả để mô phỏng online.

## Giới hạn

- Phòng online chạy **một process Uvicorn**. Vé WebSocket, giới hạn tốc độ và danh sách kết nối nằm trong RAM. Cần Redis pub/sub + kho vé dùng chung trước khi mở rộng nhiều worker/replica.
- Chưa áp dụng luật thi đấu chuyên sâu về chiếu đuổi; online hòa khi lặp cùng thế cờ/lượt 3 lần. Không tính giờ, không xếp hạng, không cờ bạc, chưa có ván tái đấu trong cùng phòng (rời phòng rồi tạo phòng mới).
- AI là thuật toán tìm kiếm cơ bản (ba nước), không phải engine cấp kiện tướng; tên mức Cao thủ chỉ biểu thị mức cao nhất của ứng dụng.
- Chưa có email xác minh hoặc quên mật khẩu.
- Schema được tạo qua SQLAlchemy khi khởi động; chỉ có bước thêm cột tự động cho `rooms.created_at`. Khi phát triển schema tiếp cần migration có phiên bản (Alembic) và backup database.
- Đăng xuất xóa cookie và đóng socket hiện tại; JWT còn hạn bị đánh cắp chưa có cơ chế revoke theo session.
- Danh sách phòng đang chờ chỉ gồm phòng mà chủ phòng đang online (theo kết nối trong RAM), nên sau khi API khởi động lại phòng hiện lại khi chủ phòng tự kết nối lại (vài giây).
- Không có máy chủ production Python/PostgreSQL hoặc TURN được cấp sẵn trong bản xem Sites.
