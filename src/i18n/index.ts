export type Lang = 'ar' | 'en'
const D: Record<Lang, Record<string, string>> = {
  ar: { app: 'مدار', workspaces: 'مساحات العمل', demo: 'بيانات تجريبية', classic: 'اللوحة الكلاسيكية', diag: 'التشخيص', search: 'بحث في الروابط…', systems: 'مجموعات', bodies: 'روابط', inbox: 'غير مصنّف',
    open: 'فتح الموقع', url: 'الرابط', tags: 'الوسوم', notes: 'ملاحظات', none: 'لا توجد بيانات بعد. جرّب "بيانات تجريبية".', pick: 'اختر رابطاً لعرض تفاصيله', migrated: 'تم ترحيل بياناتك القديمة', empty: 'فارغة',
    kept: 'محفوظة في اللوحة الكلاسيكية', strokes: 'رسومات', texts: 'نصوص', fav: 'مفضل', lang: 'English', newWs: 'مساحة عمل جديدة' },
  en: { app: 'MADAR', workspaces: 'Workspaces', demo: 'Demo data', classic: 'Classic board', diag: 'Diagnostics', search: 'Search links…', systems: 'Systems', bodies: 'Links', inbox: 'Unsorted',
    open: 'Open website', url: 'URL', tags: 'Tags', notes: 'Notes', none: 'No data yet. Try "Demo data".', pick: 'Select a link to see its details', migrated: 'Your previous data was migrated', empty: 'empty',
    kept: 'kept in the Classic board', strokes: 'drawings', texts: 'texts', fav: 'Favorite', lang: 'العربية', newWs: 'New workspace' }
}
export const t = (l: Lang, k: string) => D[l][k] ?? k
export const dirOf = (l: Lang) => (l === 'ar' ? 'rtl' : 'ltr')
