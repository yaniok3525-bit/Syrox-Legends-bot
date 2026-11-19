'use strict';

/**
 * Sayrox Legends - Ayarlar
 *
 * ⚠️ ROL HİYERARŞİSİ UYARISI:
 * Botun kendi rolü, aşağıda tanımlanan TÜM rollerin sunucu rol listesinde ÜSTÜNDE olmalıdır.
 * (Sunucu Ayarları > Roller > Bot rolünü sürükleyip verilecek rollerin üstüne taşı.)
 */
module.exports = {
  BOT_NAME: 'Sayrox Legends',
  EMBED_COLOR: 0xa970ff, // Embed sol çizgi rengi (mor)

  // Görseller (opsiyonel). Doğrudan resim/GIF linki yaz. Boş bırakırsan gösterilmez.
  IMAGE_URL: '',
  THUMBNAIL_URL: '',

  // Kullanıcı başına butonlar arası bekleme süresi (ms)
  COOLDOWN_MS: 2000,

  // true ise Yönetici, Rolleri Yönet, Ban vb. tehlikeli yetkili roller panele eklenemez.
  BLOCK_DANGEROUS_ROLES: true,

  /**
   * ROLLER (en fazla 25)
   * roleId : Rol ID'si (Geliştirici Modu açık iken role sağ tık > ID'yi Kopyala)
   * name   : Rolün adı. Sadece yedek/okunabilirlik içindir: ID ile rol bulunamazsa (rol silinip
   *          yeniden oluşturulduysa vb.) bot rolü bu isimle bulmaya çalışır ve uyarı verir.
   * emoji  : Standart emoji veya özel emoji ("<:ad:123456789012345678>", animasyonlu: "<a:ad:123...>")
   * style  : (opsiyonel) 'Secondary' (gri, varsayılan) | 'Primary' | 'Success' | 'Danger'
   */
  ROLES: [
    { roleId: '1572971813330227350', name: 'Bildirim:Güncelleme',    emoji: '⚖️' },
    { roleId: '1572971770569564230', name: 'Bildirim:Restart-Bakım', emoji: '🪛' },
    { roleId: '1572971673777602560', name: 'Bildirim:Çekiliş',       emoji: '🏷️' },
    { roleId: '1572971628323807383', name: 'Bildirim:Etkinlik',      emoji: '🎪' },
  ],
};
