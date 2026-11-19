'use strict';

/*
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║                        SAYROX LEGENDS - ROL BOTU                     ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║ ⚠️  ROL HİYERARŞİSİ (EN ÖNEMLİ KURAL)                                ║
 * ║ Botun rolü, vereceği/alacağı rollerin sunucu rol listesinde          ║
 * ║ ÜSTÜNDE olmalıdır. Aksi halde Discord rol işlemini reddeder.         ║
 * ║                                                                      ║
 * ║ ⚠️  GEREKLİ BOT YETKİLERİ                                            ║
 * ║  • Rolleri Yönet (Manage Roles)                                      ║
 * ║  • Kanalları Gör, Mesaj Gönder, Bağlantı Yerleştir                   ║
 * ║  • Mesaj Geçmişini Oku (butonlardaki sayıları güncellemek için)      ║
 * ║                                                                      ║
 * ║ ⚠️  PORTAL AYARI                                                     ║
 * ║  Developer Portal > Bot > "SERVER MEMBERS INTENT" AÇIK olmalı.       ║
 * ║  (Butonlardaki üye sayısını hesaplamak için gerekli.)                ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

try {
  require('dotenv').config();
} catch {
  // dotenv yoksa (ör. Replit Secrets) sorun değil.
}

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  DiscordAPIError,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require('discord.js');

const config = require('./config');

const BTN_PREFIX = 'sayrox:role:';
const NO_MENTIONS = { parse: [] };
const REFRESH_DELAY_MS = 2000;

const STYLE_MAP = {
  Primary: ButtonStyle.Primary,
  Secondary: ButtonStyle.Secondary,
  Success: ButtonStyle.Success,
  Danger: ButtonStyle.Danger,
};

const DANGEROUS_PERMS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.ManageNicknames,
  PermissionFlagsBits.ManageEmojisAndStickers,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.ModerateMembers,
  PermissionFlagsBits.MentionEveryone,
].filter((flag) => typeof flag === 'bigint'); // discord.js sürüm farklarına karşı güvenlik

/* ───────────────────────── Yardımcılar ───────────────────────── */

const isHttpUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
};

function parseEmoji(input) {
  if (typeof input !== 'string' || !input.trim()) return null;
  const m = input.trim().match(/^<(a?):(\w{2,32}):(\d{17,20})>$/);
  if (m) return { animated: m[1] === 'a', name: m[2], id: m[3] };
  return input.trim();
}

const normalizeName = (str) =>
  String(str ?? '').toLocaleLowerCase('tr').replace(/[\s:_-]+/g, '');

/**
 * Rolü önce ID ile bulur. ID bulunamazsa (ör. rol silinip yeniden oluşturulduysa)
 * config'teki isimle yedek eşleştirme yapar. İsim birden fazla role uyuyorsa güvenlik için eşleştirmez.
 */
function resolveRole(guild, cfg) {
  const byId = guild.roles.cache.get(cfg.roleId);
  if (byId) return { role: byId, viaName: false };
  if (cfg.name) {
    const wanted = normalizeName(cfg.name);
    const matches = guild.roles.cache.filter((r) => r.id !== guild.id && normalizeName(r.name) === wanted);
    if (matches.size === 1) return { role: matches.first(), viaName: true };
  }
  return { role: null, viaName: false };
}

function validateConfig() {
  const errors = [];
  if (!process.env.DISCORD_TOKEN) {
    errors.push('DISCORD_TOKEN bulunamadı. Replit Secrets veya .env dosyasına ekle.');
  }
  if (!Array.isArray(config.ROLES) || config.ROLES.length === 0) {
    errors.push('config.js içinde en az 1 rol tanımlanmalı.');
  } else {
    if (config.ROLES.length > 25) errors.push('En fazla 25 rol tanımlanabilir (Discord sınırı).');
    const seen = new Set();
    config.ROLES.forEach((r, i) => {
      const tag = `ROLES[${i}]`;
      if (!r || typeof r !== 'object') return errors.push(`${tag} geçersiz.`);
      if (!/^\d{17,20}$/.test(String(r.roleId))) {
        errors.push(`${tag}.roleId geçerli bir rol ID'si değil ("${r.roleId}"). Gerçek rol ID'sini yaz.`);
      }
      if (seen.has(r.roleId)) errors.push(`${tag}.roleId tekrar ediyor.`);
      seen.add(r.roleId);
      if (typeof r.emoji !== 'string' || !r.emoji.trim()) {
        errors.push(`${tag}.emoji boş olamaz.`);
      }
      if (r.name !== undefined && (typeof r.name !== 'string' || !r.name.trim())) {
        errors.push(`${tag}.name boş olamaz (istemiyorsan satırı sil).`);
      }
      if (r.style && !STYLE_MAP[r.style]) {
        errors.push(`${tag}.style geçersiz ("${r.style}"). Primary/Secondary/Success/Danger kullan.`);
      }
    });
  }
  return errors;
}

function describeError(err) {
  if (err instanceof DiscordAPIError) {
    switch (err.code) {
      case 50013:
        return 'Botun bu rolü yönetme yetkisi yok. Bot rolü, verilecek rolün **üstünde** olmalı ve **Rolleri Yönet** yetkisi açık olmalı.';
      case 10011:
        return 'Bu rol sunucuda artık mevcut değil. Lütfen yetkililere bildirin.';
      case 10007:
        return 'Üye bilgisi alınamadı. Lütfen tekrar deneyin.';
      case 10062:
      case 40060:
        return null; // Etkileşim süresi dolmuş / zaten yanıtlanmış.
      default:
        return `Discord bir hata döndürdü (kod ${err.code}). Lütfen daha sonra tekrar deneyin.`;
    }
  }
  return 'Beklenmeyen bir hata oluştu. Lütfen daha sonra tekrar deneyin.';
}

async function respond(interaction, content) {
  try {
    if (interaction.deferred) {
      await interaction.editReply({ content, allowedMentions: NO_MENTIONS });
    } else if (interaction.replied) {
      await interaction.followUp({ content, flags: MessageFlags.Ephemeral, allowedMentions: NO_MENTIONS });
    } else {
      await interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: NO_MENTIONS });
    }
  } catch (err) {
    console.error('[respond] Yanıt gönderilemedi:', err?.message ?? err);
  }
}

/* ───────────────────────── Panel kayıtları (kalıcı) ───────────────────────── */

const DATA_DIR = path.join(__dirname, 'data');
const PANELS_FILE = path.join(DATA_DIR, 'panels.json');

function loadPanels() {
  try {
    const parsed = JSON.parse(fs.readFileSync(PANELS_FILE, 'utf8'));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p) => p && p.guildId && p.channelId && p.messageId);
  } catch {
    return [];
  }
}

let panels = loadPanels();

function savePanels() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${PANELS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(panels, null, 2));
    fs.renameSync(tmp, PANELS_FILE);
  } catch (err) {
    console.error('[panels] Kaydedilemedi:', err?.message ?? err);
  }
}

function removePanel(messageId) {
  panels = panels.filter((p) => p.messageId !== messageId);
  savePanels();
}

/* ───────────────────────── Panel oluşturma ───────────────────────── */

/** Sunucuda gerçekten var olan ve atanabilir rolleri döndürür. */
function getPanelRoles(guild, me) {
  const items = [];
  const warnings = [];

  for (const cfg of config.ROLES) {
    const { role, viaName } = resolveRole(guild, cfg);
    if (role && viaName) {
      warnings.push(
        `**${role.name}** rolü ID ile bulunamadı, isimle eşleşti. config.js'teki ID'yi şununla güncelle: \`${role.id}\``,
      );
    }
    if (!role) {
      warnings.push(`Rol bulunamadı: ${cfg.name ?? cfg.emoji} (${cfg.roleId}) → panele eklenmedi.`);
    } else if (role.id === guild.id || role.managed) {
      warnings.push(`**${role.name}** atanamaz bir rol (everyone/bot/entegrasyon) → panele eklenmedi.`);
    } else if (config.BLOCK_DANGEROUS_ROLES && role.permissions.any(DANGEROUS_PERMS)) {
      warnings.push(`**${role.name}** tehlikeli yetkiler içeriyor → panele eklenmedi.`);
    } else {
      if (me && me.roles.highest.comparePositionTo(role) <= 0) {
        warnings.push(`**${role.name}** rolü bot rolünün üstünde/eşit → bot bu rolü veremez! Bot rolünü yukarı taşı.`);
      }
      items.push({ cfg, role });
    }
  }
  return { items, warnings };
}

function buildPanelPayload(items) {
  const lines = items.map(({ cfg, role }) => `- <@&${role.id}> ➡️ ${cfg.emoji}`);

  const embed = new EmbedBuilder().setColor(config.EMBED_COLOR).setDescription(lines.join('\n'));
  if (isHttpUrl(config.IMAGE_URL)) embed.setImage(config.IMAGE_URL.trim());
  if (isHttpUrl(config.THUMBNAIL_URL)) embed.setThumbnail(config.THUMBNAIL_URL.trim());

  const buttons = items.map(({ cfg, role }) => {
    const btn = new ButtonBuilder()
      .setCustomId(`${BTN_PREFIX}${cfg.roleId}`)
      .setLabel(String(role.members.size))
      .setStyle(STYLE_MAP[cfg.style] ?? ButtonStyle.Secondary);
    const emoji = parseEmoji(cfg.emoji);
    if (emoji) btn.setEmoji(emoji);
    return btn;
  });

  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  }

  return { embeds: [embed], components: rows, allowedMentions: NO_MENTIONS };
}

/** Üye önbelleğini doldurur (rol sayıları için gerekli). */
async function ensureMembers(guild) {
  try {
    if (guild.members.cache.size < guild.memberCount) {
      await guild.members.fetch();
    }
  } catch (err) {
    console.error(`[üyeler] ${guild.name} üyeleri alınamadı (sayılar eksik olabilir):`, err?.message ?? err);
  }
}

/* ───────────────────────── Sayıları güncelleme ───────────────────────── */

const refreshTimers = new Map();

async function refreshGuildPanels(guild) {
  const guildPanels = panels.filter((p) => p.guildId === guild.id);
  if (guildPanels.length === 0) return;

  const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  const { items } = getPanelRoles(guild, me);
  if (items.length === 0) return;
  const payload = buildPanelPayload(items);

  for (const p of guildPanels) {
    try {
      const channel = guild.channels.cache.get(p.channelId) ?? (await guild.channels.fetch(p.channelId));
      if (!channel || !channel.isTextBased()) {
        removePanel(p.messageId);
        continue;
      }
      const message = await channel.messages.fetch(p.messageId);
      await message.edit(payload);
    } catch (err) {
      if (err instanceof DiscordAPIError && (err.code === 10003 || err.code === 10008)) {
        removePanel(p.messageId); // Kanal/mesaj silinmiş
      } else {
        console.error('[panel yenile] Hata:', err?.message ?? err);
      }
    }
  }
}

function scheduleRefresh(guild) {
  if (refreshTimers.has(guild.id)) return;
  const t = setTimeout(async () => {
    refreshTimers.delete(guild.id);
    try {
      await refreshGuildPanels(guild);
    } catch (err) {
      console.error('[panel yenile] Beklenmeyen hata:', err?.message ?? err);
    }
  }, REFRESH_DELAY_MS);
  refreshTimers.set(guild.id, t);
}

/* ───────────────────────── Client ───────────────────────── */

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

const COMMAND = new SlashCommandBuilder()
  .setName('rolpaneli')
  .setDescription('Sayrox Legends rol panelini bir kanala gönderir.')
  .setContexts(InteractionContextType.Guild)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addChannelOption((o) =>
    o
      .setName('kanal')
      .setDescription('Panelin gönderileceği kanal (boşsa bulunduğun kanal)')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setRequired(false),
  )
  .toJSON();

async function registerCommands(guild) {
  try {
    await guild.commands.set([COMMAND]);
  } catch (err) {
    console.error(`[komut] ${guild.name} (${guild.id}) için komut kaydedilemedi:`, err?.message ?? err);
  }
}

/* ───────────────────────── /rolpaneli ───────────────────────── */

async function handlePanelCommand(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = interaction.guild;
  if (!guild) return respond(interaction, '❌ Bu komut sadece sunucularda kullanılabilir.');

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return respond(interaction, '❌ Bu komutu kullanmak için **Sunucuyu Yönet** yetkisine sahip olmalısın.');
  }

  const requested = interaction.options.getChannel('kanal');
  const channelId = requested?.id ?? interaction.channelId;
  const channel =
    guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId).catch(() => null));
  if (!channel || !channel.isTextBased() || channel.isDMBased()) {
    return respond(interaction, '❌ Geçerli bir metin kanalı seçilmedi.');
  }

  const me = guild.members.me ?? (await guild.members.fetchMe());
  const chanPerms = channel.permissionsFor(me);
  const missing = [];
  if (!chanPerms?.has(PermissionFlagsBits.ViewChannel)) missing.push('Kanalı Gör');
  if (!chanPerms?.has(PermissionFlagsBits.SendMessages)) missing.push('Mesaj Gönder');
  if (!chanPerms?.has(PermissionFlagsBits.EmbedLinks)) missing.push('Bağlantı Yerleştir');
  if (!chanPerms?.has(PermissionFlagsBits.ReadMessageHistory)) missing.push('Mesaj Geçmişini Oku');
  if (missing.length) {
    return respond(interaction, `❌ Botun <#${channel.id}> kanalında şu yetkileri eksik: **${missing.join(', ')}**`);
  }

  const warnings = [];
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    warnings.push('Botun **Rolleri Yönet** yetkisi yok; butonlar çalışmaz.');
  }

  await guild.roles.fetch().catch(() => null);
  await ensureMembers(guild);

  const { items, warnings: roleWarnings } = getPanelRoles(guild, me);
  warnings.push(...roleWarnings);

  if (items.length === 0) {
    return respond(interaction, `❌ Panele eklenebilecek geçerli rol yok.\n${warnings.map((w) => `• ${w}`).join('\n')}`);
  }

  try {
    const sent = await channel.send(buildPanelPayload(items));
    panels.push({ guildId: guild.id, channelId: channel.id, messageId: sent.id });
    savePanels();
  } catch (err) {
    console.error('[panel] Gönderim hatası:', err);
    return respond(interaction, '❌ Panel gönderilemedi. Emoji ayarlarını ve bot yetkilerini kontrol et.');
  }

  let msg = `✅ Rol paneli <#${channel.id}> kanalına gönderildi.`;
  if (warnings.length) msg += `\n\n⚠️ **Uyarılar:**\n${warnings.map((w) => `• ${w}`).join('\n')}`;
  return respond(interaction, msg.slice(0, 2000));
}

/* ───────────────────────── Buton: toggle ───────────────────────── */

const inFlight = new Set();
const cooldowns = new Map();

async function handleRoleButton(interaction) {
  const guild = interaction.guild;
  if (!interaction.inGuild() || !guild) {
    return respond(interaction, '❌ Bu buton sadece sunucuda kullanılabilir.');
  }

  const roleId = interaction.customId.slice(BTN_PREFIX.length);
  const roleCfg = config.ROLES.find((r) => r.roleId === roleId);
  if (!roleCfg) {
    return respond(interaction, '❌ Bu buton artık geçerli değil. Lütfen yetkililerden paneli yenilemesini isteyin.');
  }

  const key = `${guild.id}:${interaction.user.id}`;
  const now = Date.now();
  if (inFlight.has(key) || (cooldowns.get(key) ?? 0) > now) {
    return respond(interaction, '⏳ Lütfen biraz yavaş ol, işlemin devam ediyor.');
  }
  inFlight.add(key);

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const me = guild.members.me ?? (await guild.members.fetchMe());
    if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return respond(interaction, '❌ Botun **Rolleri Yönet** yetkisi yok. Lütfen bir yetkiliye bildirin.');
    }

    const { role } = resolveRole(guild, roleCfg);
    if (!role) {
      return respond(interaction, '❌ Bu rol sunucuda bulunamadı. Lütfen bir yetkiliye bildirin.');
    }
    if (role.id === guild.id || role.managed) {
      return respond(interaction, '❌ Bu rol atanamaz bir roldür.');
    }
    if (config.BLOCK_DANGEROUS_ROLES && role.permissions.any(DANGEROUS_PERMS)) {
      return respond(interaction, '❌ Güvenlik nedeniyle bu rol butonla verilemez.');
    }
    if (me.roles.highest.comparePositionTo(role) <= 0) {
      return respond(
        interaction,
        `❌ **${role.name}** rolü botun rolünün üstünde veya eşit. Bir yetkili bot rolünü bu rolün üstüne taşımalı.`,
      );
    }

    const member = await guild.members.fetch({ user: interaction.user.id, force: true });

    if (member.roles.cache.has(role.id)) {
      await member.roles.remove(role, `${config.BOT_NAME} rol paneli (kaldırma)`);
      await respond(interaction, `❌ **${role.name}** üzerinizden kaldırıldı!`);
    } else {
      await member.roles.add(role, `${config.BOT_NAME} rol paneli (verme)`);
      await respond(interaction, `✅ **${role.name}** başarıyla verildi!`);
    }

    scheduleRefresh(guild); // Butonlardaki sayıları güncelle
  } catch (err) {
    console.error('[buton] Rol işlemi hatası:', err);
    const text = describeError(err);
    if (text) await respond(interaction, `❌ ${text}`);
  } finally {
    inFlight.delete(key);
    cooldowns.set(key, Date.now() + config.COOLDOWN_MS);
    setTimeout(() => cooldowns.delete(key), config.COOLDOWN_MS + 1000).unref?.();
  }
}

/* ───────────────────────── Olaylar ───────────────────────── */

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ ${config.BOT_NAME} hazır: ${c.user.tag} (${c.guilds.cache.size} sunucu)`);

  await Promise.allSettled(c.guilds.cache.map((g) => registerCommands(g)));
  console.log('✅ Slash komutları kaydedildi. Kullanım: /rolpaneli');

  for (const guild of c.guilds.cache.values()) {
    await ensureMembers(guild);
    scheduleRefresh(guild);
  }
});

client.on(Events.GuildCreate, async (guild) => {
  await registerCommands(guild);
  await ensureMembers(guild);
});

// Roller başka yollarla değişirse / üye girip çıkarsa sayılar güncel kalsın.
client.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
  if (!panels.some((p) => p.guildId === newMember.guild.id)) return;
  const watched = config.ROLES.map((r) => resolveRole(newMember.guild, r).role?.id).filter(Boolean);
  const changed =
    oldMember.partial || watched.some((id) => oldMember.roles.cache.has(id) !== newMember.roles.cache.has(id));
  if (changed) scheduleRefresh(newMember.guild);
});
client.on(Events.GuildMemberAdd, (m) => {
  if (panels.some((p) => p.guildId === m.guild.id)) scheduleRefresh(m.guild);
});
client.on(Events.GuildMemberRemove, (m) => {
  if (panels.some((p) => p.guildId === m.guild.id)) scheduleRefresh(m.guild);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === COMMAND.name) {
      return await handlePanelCommand(interaction);
    }
    if (interaction.isButton() && interaction.customId.startsWith(BTN_PREFIX)) {
      return await handleRoleButton(interaction);
    }
  } catch (err) {
    console.error('[interaction] Yakalanmamış hata:', err);
    const text = describeError(err);
    if (text) await respond(interaction, `❌ ${text}`);
  }
});

client.on(Events.Error, (err) => console.error('[client] Hata:', err));
client.on(Events.Warn, (msg) => console.warn('[client] Uyarı:', msg));

process.on('unhandledRejection', (reason) => console.error('[unhandledRejection]', reason));
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));

const shutdown = async (signal) => {
  console.log(`\n${signal} alındı, bot kapatılıyor...`);
  try {
    await client.destroy();
  } finally {
    process.exit(0);
  }
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

/* ───────────────────────── Başlat ───────────────────────── */

// Replit gibi platformlarda "ayakta" kalmak için küçük bir HTTP sunucusu (UptimeRobot vb. ile ping atılabilir).
// Sorun çıkarırsa bot yine de çalışmaya devam eder.
try {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`${config.BOT_NAME} çalışıyor.`);
  });
  server.on('error', (err) => console.warn('[http] Keep-alive sunucusu başlatılamadı:', err?.message ?? err));
  server.listen(Number(process.env.PORT) || 3000, '0.0.0.0');
} catch (err) {
  console.warn('[http] Keep-alive sunucusu başlatılamadı:', err?.message ?? err);
}

const configErrors = validateConfig();
if (configErrors.length) {
  console.error('❌ Yapılandırma hataları:\n' + configErrors.map((e) => `  • ${e}`).join('\n'));
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN).catch((err) => {
  if (err?.code === 'DisallowedIntents' || /disallowed intents/i.test(String(err?.message))) {
    console.error(
      '❌ "Server Members Intent" kapalı! Developer Portal > Bot > Privileged Gateway Intents altından ' +
        'SERVER MEMBERS INTENT seçeneğini aç ve botu yeniden başlat.',
    );
  } else {
    console.error('❌ Giriş başarısız (token doğru mu?):', err?.message ?? err);
  }
  process.exit(1);
});
