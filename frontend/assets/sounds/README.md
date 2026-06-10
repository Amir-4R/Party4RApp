# Party4R — أصوات الألعاب (Game Sounds)

ضع ملفات الصوت هنا بنفس الأسماء أدناه، ثم فعّل السطر المقابل في
`src/games/sound/SoundManager.ts` (أزل التعليق عن require). النظام يتجاهل أي
ملف غير موجود بأمان ولا يُسقط التطبيق.

| الحدث | اسم الملف |
|------|-----------|
| ضغطة زر | `ui_click.mp3` |
| بداية المباراة | `match_start.mp3` |
| العد التنازلي | `countdown_beep.mp3` |
| الفوز | `victory.mp3` |
| الخسارة | `defeat.mp3` |
| التعادل | `draw.mp3` |
| الترقية لرتبة | `rank_up.mp3` |
| العثور على لاعب | `match_found.mp3` |
| إرسال دعوة | `invite_sent.mp3` |
| قبول دعوة | `invite_accepted.mp3` |
| حركة قطعة | `piece_move.mp3` |
| اصطدام الكيرم | `carrom_collision.mp3` |
| دخول الجيب | `carrom_pocket.mp3` |
| حركة الضمنة | `domino_move.mp3` |

الصيغة المفضّلة: mp3 قصير (< 1s للأصوات القصيرة). يمكن استخدام m4a/wav أيضاً.
