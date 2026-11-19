# Sayrox Legends – Rol Botu (discord.js v14)

Butonla rol al / bırak (toggle) paneli. Butonlarda emoji + role sahip üye sayısı görünür, sayılar otomatik güncellenir.

## 1) Discord Developer Portal
1. Uygulamanı aç → **Bot** sekmesi → token'ı kopyala (**Reset Token**).
2. **Privileged Gateway Intents** altında **SERVER MEMBERS INTENT**'i **AÇ** ve kaydet. (Şart!)
3. **OAuth2 → URL Generator**: scope `bot` + `applications.commands`.
   Bot yetkileri: **Manage Roles**, View Channels, Send Messages, Embed Links, Read Message History.
4. Çıkan linkle botu sunucuna ekle.

## 2) ⚠️ Rol hiyerarşisi (EN ÖNEMLİ)
Sunucu Ayarları → Roller: **botun rolünü, verilecek 4 rolün de ÜSTÜNE sürükle.**
Aksi halde Discord rol vermeyi reddeder.

## 3) Replit / Sunucu
1. Tüm dosyaları yükle (`index.js`, `config.js`, `package.json`, ...).
2. **Secrets** bölümüne `DISCORD_TOKEN` ekle (token'ı koda yazma!).
3. Shell: `npm install` → `npm start`.
4. Replit'te 7/24 açık kalması için Deployments (Reserved VM) kullan; ücretsiz planda ise bot adresine
   UptimeRobot ile ping at (bot küçük bir HTTP sunucusu açar).

Kendi bilgisayarında: Node.js 18.17+ → `npm install` → `.env.example`'ı `.env` yapıp token'ı yaz → `npm start`.

## 4) Kullanım
- Sunucuda `/rolpaneli` (veya `/rolpaneli kanal:#kanal`) → panel gönderilir. (Sunucuyu Yönet yetkisi gerekir)
- Rol ID'leri, adları ve emojiler `config.js` içinde.
- Rol ID'si bulunamazsa bot `name` ile yedek eşleştirme yapar ve `/rolpaneli` çıktısında uyarı verir.

## Sorun giderme
| Konsol / mesaj | Çözüm |
|---|---|
| `Server Members Intent kapalı` | Portal'dan SERVER MEMBERS INTENT'i aç |
| `Botun bu rolü yönetme yetkisi yok` | Bot rolünü verilecek rollerin üstüne taşı + Manage Roles ver |
| `Rol bulunamadı` | `config.js` içindeki roleId'yi kontrol et |
| Slash komut görünmüyor | Botu `applications.commands` scope'u ile yeniden davet et, Discord'u yenile (Ctrl+R) |
| Sayılar güncellenmiyor | Bot panel kanalında *Read Message History* yetkisine sahip olmalı |
