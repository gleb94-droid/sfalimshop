import { useState, useRef, useCallback, useEffect } from "react";
import { createClient } from '@supabase/supabase-js'
const supabase = createClient('https://ubvgrxlxtelulwjtfudd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVidmdyeGx4dGVsdWx3anRmdWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODIyODMsImV4cCI6MjA5NDM1ODI4M30.79zQ0LMAzzocGSMD3ruNl2m_jan6siQJ_A1Ex7lOxyE')

const COLORS = {
  bg: "#0f0f0f", bgCard: "#1a1a1a", border: "#2a2a2a",
  accent: "#FF6B35", accentHover: "#ff8255", accentDim: "rgba(255,107,53,0.15)",
  white: "#ffffff", gray: "#888888", grayLight: "#555555", success: "#4ade80",
};

const SHIPPING_PRICE = 30;
const ADMIN_EMAIL = "gleb2009@gmail.com";

const IL_PREFIXES = [
  { value: "050" }, { value: "052" }, { value: "053" },
  { value: "054" }, { value: "055" }, { value: "057" }, { value: "058" },
];

const ORDER_STAGES = [
  { key: "received",  en: "Order Received",    he: "התקבלה הזמנה",     ru: "Заказ получен",      emoji: "📥" },
  { key: "design",    en: "In Design",          he: "בעיצוב",            ru: "В дизайне",          emoji: "🎨" },
  { key: "printing",  en: "Printing",           he: "בהדפסה",            ru: "В печати",           emoji: "🖨️" },
  { key: "ready",     en: "Ready to Ship",      he: "מוכן למשלוח",       ru: "Готов к отправке",   emoji: "📦" },
  { key: "shipped",   en: "Shipped",            he: "נשלח",              ru: "Отправлен",          emoji: "🚚" },
  { key: "delivered", en: "Delivered",          he: "נמסר",              ru: "Доставлен",          emoji: "✅" },
];


// Time helpers
const timeAgo = (dateStr, lang) => {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return lang === "he" ? "עכשיו" : lang === "ru" ? "только что" : "just now";
  if (diff < 3600) { const m = Math.floor(diff/60); return lang === "he" ? `${m} דקות` : lang === "ru" ? `${m} мин.` : `${m}m ago`; }
  if (diff < 86400) { const h = Math.floor(diff/3600); return lang === "he" ? `${h} שעות` : lang === "ru" ? `${h} ч.` : `${h}h ago`; }
  const d = Math.floor(diff/86400);
  return lang === "he" ? `${d} ימים` : lang === "ru" ? `${d} дн.` : `${d}d ago`;
};

const timeBetween = (start, end, lang) => {
  const diff = Math.floor((new Date(end) - new Date(start)) / 1000);
  if (diff < 3600) { const m = Math.floor(diff/60); return lang === "he" ? `${m} דקות` : lang === "ru" ? `${m} мин.` : `${m} min`; }
  if (diff < 86400) { const h = Math.floor(diff/3600); return lang === "he" ? `${h} שעות` : lang === "ru" ? `${h} ч.` : `${h} hrs`; }
  const d = Math.floor(diff/86400);
  return lang === "he" ? `${d} ימים` : lang === "ru" ? `${d} дн.` : `${d} days`;
};

const LANGS = {
  he: {
    dir: "rtl", label: "HE",
    nav: { home: "בית", order: "הזמנה", track: "מעקב הזמנה", login: "כניסה", logout: "יציאה", admin: "ניהול" },
    hero: { badge: "הדפסות מותאמות אישית · ישראל 🇮🇱", h1line1: "העיצוב שלך.", h1line2: "על הכל.", sub: "חולצות, ספלים, מדבקות — מותאמים אישית עם העיצוב שלך.", cta: "התחל לעצב ←", from: "החל מ-₪" },
    steps: ["מוצר", "עיצוב", "פרטים", "סיום"],
    product: { title: "בחר מוצר", sub: "מה תרצה להתאים אישית?", options: "אפשרויות", from: "החל מ-₪", continue: "המשך ←" },
    customize: { title: (p) => `התאם: ${p}`, sub: "העלה עיצוב וראה תצוגה מקדימה.", size: "מידה", option: "אפשרות", color: "צבע", design: "העיצוב שלך", uploadTitle: "העלה עיצוב", uploadSub: "PNG, JPG, SVG · רזולוציה גבוהה", uploaded: "עיצוב הועלה ✓", changeFile: "לחץ לשינוי", dragHint: "גרור לשינוי מיקום", designSize: "גודל עיצוב", shipping: "משלוח", total: "סה״כ", back: "← חזרה", continue: "המשך ←" },
    form: { title: "הפרטים שלך", sub: "כמעט סיימנו!", name: "שם מלא *", namePh: "השם שלך", email: "מייל *", emailPh: "your@email.com", phone: "טלפון", phonePh: "1234567", notes: "הערות", notesPh: "בקשות מיוחדות...", qty: "כמות", summary: "סיכום", shipping: "משלוח", total: "סה״כ", paymentNote: "💳 תשלום בשלב הבא", paymentSub: "נעבד תשלום לאחר אישור.", back: "← חזרה", place: "בצע הזמנה" },
    confirm: { title: "ההזמנה בוצעה! 🎉", sub1: "תודה", sub2: "נצור קשר בקרוב בכתובת", track: "עקוב אחרי ההזמנה", another: "הזמן שוב" },
    auth: { login: "כניסה", register: "הרשמה", email: "אימייל", password: "סיסמה", name: "שם מלא", loginBtn: "כנס", registerBtn: "הירשם", noAccount: "אין לך חשבון?", hasAccount: "כבר רשום?", loginTitle: "ברוך הבא חזרה", registerTitle: "צור חשבון" },
    track: { title: "מעקב הזמנות", sub: "עקוב אחרי ההתקדמות של ההזמנות שלך", noOrders: "אין הזמנות עדיין", order: "הזמנה", status: "סטטוס", date: "תאריך" },
    admin: { title: "לוח ניהול", orders: "הזמנות", total: "סה״כ", statuses: { received: "התקבלה", design: "בעיצוב", printing: "בהדפסה", ready: "מוכן", shipped: "נשלח", delivered: "נמסר" }, customer: "לקוח", updateStatus: "עדכן סטטוס", noOrders: "אין הזמנות" },
    products: { tshirt: "חולצת טי", mug: "ספל", sticker: "מדבקה" },
    variants: { standard: "סטנדרט 11oz", large: "גדול 15oz", magic: "משנה צבע", small: "קטן 5×5 ס״מ", medium: "בינוני 10×10 ס״מ", largeS: "גדול 15×15 ס״מ", sheet: "גיליון מדבקות" },
  },
  en: {
    dir: "ltr", label: "EN",
    nav: { home: "Home", order: "Order", track: "Track Order", login: "Login", logout: "Logout", admin: "Admin" },
    hero: { badge: "Custom Prints · Made in Israel 🇮🇱", h1line1: "Your design.", h1line2: "On everything.", sub: "T-shirts, mugs, stickers — fully customized with your design.", cta: "Start Designing →", from: "from ₪" },
    steps: ["Product", "Customize", "Details", "Done"],
    product: { title: "Choose your product", sub: "What would you like to customize?", options: "options", from: "from ₪", continue: "Continue →" },
    customize: { title: (p) => `Customize: ${p}`, sub: "Upload your design and preview it.", size: "Size", option: "Option", color: "Color", design: "Your Design", uploadTitle: "Upload design", uploadSub: "PNG, JPG, SVG · High resolution", uploaded: "Design uploaded ✓", changeFile: "Click to change", dragHint: "Drag to reposition", designSize: "Design Size", shipping: "Shipping", total: "Total", back: "← Back", continue: "Continue →" },
    form: { title: "Your details", sub: "Almost there!", name: "Full Name *", namePh: "Your name", email: "Email *", emailPh: "your@email.com", phone: "Phone", phonePh: "1234567", notes: "Notes", notesPh: "Special requests...", qty: "Quantity", summary: "Summary", shipping: "Shipping", total: "Total", paymentNote: "💳 Payment on next step", paymentSub: "We'll process payment after confirmation.", back: "← Back", place: "Place Order" },
    confirm: { title: "Order Placed! 🎉", sub1: "Thanks", sub2: "We'll be in touch at", track: "Track your order", another: "Order Another" },
    auth: { login: "Login", register: "Register", email: "Email", password: "Password", name: "Full Name", loginBtn: "Login", registerBtn: "Register", noAccount: "No account?", hasAccount: "Already registered?", loginTitle: "Welcome back", registerTitle: "Create account" },
    track: { title: "Order Tracking", sub: "Follow the progress of your orders", noOrders: "No orders yet", order: "Order", status: "Status", date: "Date" },
    admin: { title: "Admin Dashboard", orders: "Orders", total: "total", statuses: { received: "Received", design: "Design", printing: "Printing", ready: "Ready", shipped: "Shipped", delivered: "Delivered" }, customer: "Customer", updateStatus: "Update Status", noOrders: "No orders yet" },
    products: { tshirt: "Custom T-Shirt", mug: "Custom Mug", sticker: "Custom Sticker" },
    variants: { standard: "Standard 11oz", large: "Large 15oz", magic: "Magic Color Change", small: "Small 5×5cm", medium: "Medium 10×10cm", largeS: "Large 15×15cm", sheet: "Sticker Sheet" },
  },
  ru: {
    dir: "ltr", label: "RU",
    nav: { home: "Главная", order: "Заказ", track: "Отследить", login: "Войти", logout: "Выйти", admin: "Админ" },
    hero: { badge: "Индивидуальная печать · Израиль 🇮🇱", h1line1: "Ваш дизайн.", h1line2: "На всём.", sub: "Футболки, кружки, стикеры — с вашим дизайном.", cta: "Начать →", from: "от ₪" },
    steps: ["Товар", "Дизайн", "Детали", "Готово"],
    product: { title: "Выберите товар", sub: "Что хотите настроить?", options: "варианта", from: "от ₪", continue: "Продолжить →" },
    customize: { title: (p) => `Настройте: ${p}`, sub: "Загрузите дизайн и посмотрите превью.", size: "Размер", option: "Вариант", color: "Цвет", design: "Ваш дизайн", uploadTitle: "Загрузить дизайн", uploadSub: "PNG, JPG, SVG · Высокое разрешение", uploaded: "Дизайн загружен ✓", changeFile: "Нажмите для изменения", dragHint: "Перетащите для позиции", designSize: "Размер дизайна", shipping: "Доставка", total: "Итого", back: "← Назад", continue: "Продолжить →" },
    form: { title: "Ваши данные", sub: "Почти готово!", name: "Полное имя *", namePh: "Ваше имя", email: "Email *", emailPh: "your@email.com", phone: "Телефон", phonePh: "1234567", notes: "Заметки", notesPh: "Особые пожелания...", qty: "Количество", summary: "Итог", shipping: "Доставка", total: "Итого", paymentNote: "💳 Оплата на следующем шаге", paymentSub: "Обработаем оплату после подтверждения.", back: "← Назад", place: "Оформить заказ" },
    confirm: { title: "Заказ оформлен! 🎉", sub1: "Спасибо", sub2: "Свяжемся с вами по адресу", track: "Отследить заказ", another: "Заказать ещё" },
    auth: { login: "Войти", register: "Регистрация", email: "Email", password: "Пароль", name: "Полное имя", loginBtn: "Войти", registerBtn: "Зарегистрироваться", noAccount: "Нет аккаунта?", hasAccount: "Уже есть аккаунт?", loginTitle: "С возвращением", registerTitle: "Создать аккаунт" },
    track: { title: "Отслеживание заказов", sub: "Следите за прогрессом ваших заказов", noOrders: "Заказов пока нет", order: "Заказ", status: "Статус", date: "Дата" },
    admin: { title: "Панель администратора", orders: "Заказов", total: "всего", statuses: { received: "Получен", design: "Дизайн", printing: "Печать", ready: "Готов", shipped: "Отправлен", delivered: "Доставлен" }, customer: "Клиент", updateStatus: "Обновить статус", noOrders: "Заказов нет" },
    products: { tshirt: "Футболка", mug: "Кружка", sticker: "Стикер" },
    variants: { standard: "Стандарт 11oz", large: "Большой 15oz", magic: "Меняет цвет", small: "Маленький 5×5см", medium: "Средний 10×10см", largeS: "Большой 15×15см", sheet: "Лист стикеров" },
  },
};

const PRODUCTS = (t) => [
  { id: "tshirt", name: t.products.tshirt, emoji: "👕", variants: [{ id: "s", label: "S", price: 89 }, { id: "m", label: "M", price: 89 }, { id: "l", label: "L", price: 89 }, { id: "xl", label: "XL", price: 99 }, { id: "xxl", label: "XXL", price: 99 }], colors: ["#ffffff", "#1a1a1a", "#1e3a5f", "#7f1d1d", "#14532d"], printArea: { x: 130, y: 100, w: 140, h: 160 } },
  { id: "mug", name: t.products.mug, emoji: "☕", variants: [{ id: "standard", label: t.variants.standard, price: 69 }, { id: "large", label: t.variants.large, price: 79 }, { id: "magic", label: t.variants.magic, price: 89 }], colors: ["#ffffff", "#1a1a1a", "#fef3c7", "#dbeafe"], printArea: { x: 90, y: 90, w: 180, h: 120 } },
  { id: "sticker", name: t.products.sticker, emoji: "✨", variants: [{ id: "small", label: t.variants.small, price: 15 }, { id: "medium", label: t.variants.medium, price: 25 }, { id: "largeS", label: t.variants.largeS, price: 35 }, { id: "sheet", label: t.variants.sheet, price: 45 }], colors: ["#ffffff", "#f0fdf4", "#fef9c3", "#fdf2f8"], printArea: { x: 75, y: 75, w: 250, h: 250 } },
];

// SVG Mockups
function TShirtMockup({ color, imageUrl, imagePos }) {
  return (
    <svg viewBox="0 0 400 420" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <defs>
        <linearGradient id="ts-hl" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="white" stopOpacity="0.15" /><stop offset="100%" stopColor="black" stopOpacity="0.1" /></linearGradient>
        <clipPath id="ts-clip"><path d="M150,40 L80,80 L40,140 L90,160 L90,380 L310,380 L310,160 L360,140 L320,80 L250,40 C240,70 200,80 200,80 C200,80 160,70 150,40Z" /></clipPath>
        <filter id="ts-shadow"><feDropShadow dx="0" dy="4" stdDeviation="12" floodOpacity="0.4" /></filter>
      </defs>
      <ellipse cx="200" cy="400" rx="120" ry="12" fill="rgba(0,0,0,0.3)" />
      <path d="M150,40 L80,80 L40,140 L90,160 L90,380 L310,380 L310,160 L360,140 L320,80 L250,40 C240,70 200,80 200,80 C200,80 160,70 150,40Z" fill={color} filter="url(#ts-shadow)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      {imageUrl ? <image href={imageUrl} x={imagePos.x} y={imagePos.y} width={imagePos.size} height={imagePos.size} clipPath="url(#ts-clip)" preserveAspectRatio="xMidYMid meet" /> : <g clipPath="url(#ts-clip)"><rect x="145" y="110" width="110" height="130" rx="6" fill="rgba(255,107,53,0.12)" stroke="rgba(255,107,53,0.3)" strokeWidth="1.5" strokeDasharray="5,4" /><text x="200" y="175" textAnchor="middle" fill="rgba(255,107,53,0.6)" fontSize="11" fontFamily="monospace">↑ Upload design</text></g>}
      <path d="M150,40 L80,80 L40,140 L90,160 L90,380 L310,380 L310,160 L360,140 L320,80 L250,40 C240,70 200,80 200,80 C200,80 160,70 150,40Z" fill="url(#ts-hl)" opacity="0.3" />
    </svg>
  );
}

function MugMockup({ color, imageUrl, imagePos }) {
  return (
    <svg viewBox="0 0 400 380" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <defs>
        <linearGradient id="mug-grad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="rgba(0,0,0,0.25)" /><stop offset="30%" stopColor="rgba(0,0,0,0)" /><stop offset="70%" stopColor="rgba(0,0,0,0)" /><stop offset="100%" stopColor="rgba(0,0,0,0.3)" /></linearGradient>
        <clipPath id="mug-clip"><path d="M80,80 Q80,60 200,60 Q320,60 320,80 L310,320 Q310,340 200,340 Q90,340 90,320Z" /></clipPath>
      </defs>
      <ellipse cx="200" cy="355" rx="130" ry="14" fill="rgba(0,0,0,0.35)" />
      <path d="M80,80 Q80,60 200,60 Q320,60 320,80 L310,320 Q310,340 200,340 Q90,340 90,320Z" fill={color} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <path d="M315,140 Q370,140 370,200 Q370,260 315,260" fill="none" stroke={color} strokeWidth="22" strokeLinecap="round" />
      <ellipse cx="200" cy="72" rx="118" ry="15" fill={color} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      {imageUrl ? <image href={imageUrl} x={imagePos.x} y={imagePos.y} width={imagePos.size} height={imagePos.size} clipPath="url(#mug-clip)" preserveAspectRatio="xMidYMid meet" /> : <g clipPath="url(#mug-clip)"><rect x="110" y="120" width="160" height="120" rx="6" fill="rgba(255,107,53,0.12)" stroke="rgba(255,107,53,0.3)" strokeWidth="1.5" strokeDasharray="5,4" /><text x="190" y="185" textAnchor="middle" fill="rgba(255,107,53,0.6)" fontSize="11" fontFamily="monospace">↑ Upload design</text></g>}
      <path d="M80,80 Q80,60 200,60 Q320,60 320,80 L310,320 Q310,340 200,340 Q90,340 90,320Z" fill="url(#mug-grad)" />
    </svg>
  );
}

function StickerMockup({ color, imageUrl, imagePos }) {
  return (
    <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <defs>
        <filter id="stk-shadow"><feDropShadow dx="0" dy="6" stdDeviation="15" floodOpacity="0.5" /></filter>
        <clipPath id="stk-clip"><circle cx="200" cy="200" r="155" /></clipPath>
      </defs>
      <circle cx="200" cy="198" r="162" fill="white" filter="url(#stk-shadow)" />
      <circle cx="200" cy="198" r="155" fill={color} />
      {imageUrl ? <image href={imageUrl} x={imagePos.x} y={imagePos.y} width={imagePos.size} height={imagePos.size} clipPath="url(#stk-clip)" preserveAspectRatio="xMidYMid meet" /> : <g clipPath="url(#stk-clip)"><circle cx="200" cy="198" r="100" fill="rgba(255,107,53,0.12)" stroke="rgba(255,107,53,0.3)" strokeWidth="1.5" strokeDasharray="5,4" /><text x="200" y="202" textAnchor="middle" fill="rgba(255,107,53,0.6)" fontSize="11" fontFamily="monospace">↑ Upload design</text></g>}
    </svg>
  );
}

// Auth Page
function AuthPage({ lang, onAuth }) {
  const t = LANGS[lang];
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(""); setLoading(true);
    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onAuth(data.user);
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
        if (error) throw error;
        onAuth(data.user);
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const inputStyle = { width: "100%", background: "#111", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "12px 14px", color: COLORS.white, fontFamily: "'Varela Round',sans-serif", fontSize: 14, outline: "none", marginTop: 8 };

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, direction: t.dir }}>
      <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 40, width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>☕</div>
          <h2 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 28 }}>{mode === "login" ? t.auth.loginTitle : t.auth.registerTitle}</h2>
        </div>
        {mode === "register" && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: COLORS.gray, fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>{t.auth.name}</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
          </div>
        )}
        <div style={{ marginBottom: 16 }}>
          <label style={{ color: COLORS.gray, fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>{t.auth.email}</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ color: COLORS.gray, fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>{t.auth.password}</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
        </div>
        {error && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 16, background: "rgba(248,113,113,0.1)", padding: "10px 14px", borderRadius: 8 }}>{error}</div>}
        <button onClick={handleSubmit} disabled={loading} style={{ width: "100%", background: COLORS.accent, color: "#fff", border: "none", borderRadius: 8, padding: "14px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'Varela Round',sans-serif" }}>
          {loading ? "..." : mode === "login" ? t.auth.loginBtn : t.auth.registerBtn}
        </button>
        <div style={{ textAlign: "center", marginTop: 20, color: COLORS.gray, fontSize: 13 }}>
          {mode === "login" ? t.auth.noAccount : t.auth.hasAccount}{" "}
          <span onClick={() => setMode(mode === "login" ? "register" : "login")} style={{ color: COLORS.accent, cursor: "pointer", fontWeight: 600 }}>
            {mode === "login" ? t.auth.register : t.auth.login}
          </span>
        </div>
      </div>
    </div>
  );
}

// Order Tracker
function TrackPage({ lang, user }) {
  const t = LANGS[lang];
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => { setOrders(data || []); setLoading(false); });
  }, [user]);

  const getStageIndex = (status) => ORDER_STAGES.findIndex(s => s.key === status);

  if (!user) return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", direction: t.dir }}>
      <div style={{ textAlign: "center", color: COLORS.gray }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <div style={{ fontSize: 18, color: COLORS.white, marginBottom: 8 }}>{t.auth.loginTitle}</div>
        <div style={{ fontSize: 14 }}>{t.auth.noAccount}</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, paddingTop: 80, fontFamily: "'Varela Round',sans-serif", direction: t.dir }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>
        <h2 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 36, marginBottom: 8 }}>{t.track.title}</h2>
        <p style={{ color: COLORS.gray, marginBottom: 32 }}>{t.track.sub}</p>

        {loading ? <div style={{ color: COLORS.gray, textAlign: "center", padding: 40 }}>...</div> :
          orders.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: COLORS.gray }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
              <div style={{ fontSize: 18 }}>{t.track.noOrders}</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {orders.map(order => {
                const si = getStageIndex(order.status);
                const stage = ORDER_STAGES[si] || ORDER_STAGES[0];
                const isOpen = selected === order.id;
                return (
                  <div key={order.id} style={{ background: COLORS.bgCard, border: `1px solid ${isOpen ? COLORS.accent : COLORS.border}`, borderRadius: 16, overflow: "hidden", transition: "border-color 0.2s" }}>
                    <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div onClick={() => setSelected(isOpen ? null : order.id)} style={{ flex: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ color: COLORS.white, fontWeight: 600, fontSize: 16 }}>{order.product} — {order.variant}</div>
                        <div style={{ color: COLORS.gray, fontSize: 13, marginTop: 4 }}>{new Date(order.created_at).toLocaleDateString()}</div>
                        <div style={{ color: COLORS.gray, fontSize: 12, marginTop: 2 }}>⏱️ {timeAgo(order.created_at, lang)}</div>
                        {order.completed_at && <div style={{ color: COLORS.success, fontSize: 12, marginTop: 2 }}>✅ {lang === "he" ? "הושלם תוך" : lang === "ru" ? "Выполнен за" : "Completed in"} {timeBetween(order.created_at, order.completed_at, lang)}</div>}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ color: COLORS.accent, fontWeight: 700, fontSize: 18 }}>₪{order.total}</div>
                        <div style={{ color: COLORS.gray, fontSize: 13, marginTop: 4 }}>{stage.emoji} {stage[lang] || stage.en}</div>
                      </div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); setDeleteConfirm(order.id); }} style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: "#ef4444", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 14, marginLeft: 12, flexShrink: 0 }}>🗑️</button>
                    </div>

                    {isOpen && (
                      <div style={{ padding: "0 24px 24px", borderTop: `1px solid ${COLORS.border}` }}>
                        <div style={{ marginTop: 20 }}>
                          {ORDER_STAGES.map((s, i) => {
                            const done = i <= si;
                            const active = i === si;
                            return (
                              <div key={s.key} style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: i < ORDER_STAGES.length - 1 ? 0 : 0 }}>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                  <div style={{ width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: done ? COLORS.accent : COLORS.bg, border: `2px solid ${done ? COLORS.accent : COLORS.border}`, fontSize: 16, transition: "all 0.3s", boxShadow: active ? `0 0 12px ${COLORS.accent}` : "none" }}>
                                    {done ? (i === si ? s.emoji : "✓") : ""}
                                  </div>
                                  {i < ORDER_STAGES.length - 1 && <div style={{ width: 2, height: 32, background: done && i < si ? COLORS.accent : COLORS.border, transition: "background 0.3s" }} />}
                                </div>
                                <div style={{ paddingTop: 8, paddingBottom: i < ORDER_STAGES.length - 1 ? 24 : 0 }}>
                                  <div style={{ color: done ? COLORS.white : COLORS.gray, fontWeight: active ? 700 : 400, fontSize: 15 }}>{s[lang] || s.en}</div>
                                  {active && <div style={{ color: COLORS.accent, fontSize: 12, marginTop: 2 }}>● Current status</div>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        }
      </div>
    </div>
  );
}

// Admin Dashboard
function AdminPage({ lang }) {
  const t = LANGS[lang];
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    fetchOrders();
    const sub = supabase.channel("orders-changes").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, fetchOrders).subscribe();
    return () => sub.unsubscribe();
  }, []);

  const fetchOrders = async () => {
    const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    setOrders(data || []);
    setLoading(false);
  };

  const deleteOrder = async (orderId) => {
    await supabase.from("order_status_history").delete().eq("order_id", orderId);
    await supabase.from("orders").delete().eq("id", orderId);
    setDeleteConfirm(null);
    setSelected(null);
    fetchOrders();
  };

  const updateStatus = async (orderId, status, orderCreatedAt) => {
    const updates = { status };
    if (status === "delivered") updates.completed_at = new Date().toISOString();
    await supabase.from("orders").update(updates).eq("id", orderId);
    await supabase.from("order_status_history").insert({ order_id: orderId, status });
    fetchOrders();
  };

  const statusColors = { received: COLORS.accent, design: "#a78bfa", printing: "#60a5fa", ready: "#facc15", shipped: "#fb923c", delivered: COLORS.success };

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, paddingTop: 80, fontFamily: "'Varela Round',sans-serif", direction: t.dir }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
          <div>
            <h2 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 36 }}>{t.admin.title}</h2>
            <p style={{ color: COLORS.gray, marginTop: 4 }}>{orders.length} {t.admin.total}</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {ORDER_STAGES.map(s => (
              <div key={s.key} style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 14px", textAlign: "center" }}>
                <div style={{ color: statusColors[s.key] || COLORS.accent, fontWeight: 700, fontSize: 18 }}>{orders.filter(o => o.status === s.key).length}</div>
                <div style={{ color: COLORS.gray, fontSize: 11 }}>{s.emoji}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Filter buttons */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {["all", ...ORDER_STAGES.map(s => s.key)].map(key => {
            const stage = ORDER_STAGES.find(s => s.key === key);
            const count = key === "all" ? orders.length : orders.filter(o => o.status === key).length;
            return (
              <button key={key} onClick={() => setFilterStatus(key)} style={{
                background: filterStatus === key ? (key === "all" ? COLORS.accent : statusColors[key] || COLORS.accent) : COLORS.bgCard,
                border: `1px solid ${filterStatus === key ? (key === "all" ? COLORS.accent : statusColors[key] || COLORS.accent) : COLORS.border}`,
                color: filterStatus === key ? "#000" : COLORS.gray,
                borderRadius: 8, padding: "8px 16px", cursor: "pointer",
                fontFamily: "'Varela Round',sans-serif", fontSize: 13, fontWeight: 600,
                transition: "all 0.2s",
              }}>
                {key === "all" ? `📋 ${lang === "he" ? "הכל" : lang === "ru" ? "Все" : "All"}` : `${stage.emoji} ${stage[lang] || stage.en}`} ({count})
              </button>
            );
          })}
        </div>

        {/* Delete confirmation modal */}
        {deleteConfirm && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 32, maxWidth: 400, width: "90%", textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🗑️</div>
              <div style={{ color: COLORS.white, fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                {lang === "he" ? "למחוק את ההזמנה?" : lang === "ru" ? "Удалить заказ?" : "Delete this order?"}
              </div>
              <div style={{ color: COLORS.gray, fontSize: 14, marginBottom: 24 }}>
                {lang === "he" ? "לא ניתן לשחזר פעולה זו" : lang === "ru" ? "Это действие нельзя отменить" : "This action cannot be undone"}
              </div>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <button onClick={() => setDeleteConfirm(null)} style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.gray, borderRadius: 8, padding: "10px 24px", cursor: "pointer", fontFamily: "'Varela Round',sans-serif" }}>
                  {lang === "he" ? "ביטול" : lang === "ru" ? "Отмена" : "Cancel"}
                </button>
                <button onClick={() => deleteOrder(deleteConfirm)} style={{ background: "#ef4444", border: "none", color: "#fff", borderRadius: 8, padding: "10px 24px", cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontWeight: 600 }}>
                  {lang === "he" ? "מחק" : lang === "ru" ? "Удалить" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? <div style={{ color: COLORS.gray, textAlign: "center", padding: 40 }}>Loading...</div> :
          (filterStatus === "all" ? orders : orders.filter(o => o.status === filterStatus)).length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: COLORS.gray }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
              <div>{t.admin.noOrders}</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {orders.map(order => {
                const stage = ORDER_STAGES.find(s => s.key === order.status) || ORDER_STAGES[0];
                const isOpen = selected === order.id;
                return (
                  <div key={order.id} onClick={() => setSelected(isOpen ? null : order.id)}
                    style={{ background: COLORS.bgCard, border: `1px solid ${isOpen ? COLORS.accent : COLORS.border}`, borderRadius: 12, padding: "16px 20px", cursor: "pointer", transition: "border-color 0.2s" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColors[order.status] || COLORS.accent, boxShadow: `0 0 8px ${statusColors[order.status] || COLORS.accent}`, flexShrink: 0 }} />
                        <div>
                          <div style={{ color: COLORS.white, fontWeight: 600 }}>{order.customer_name}</div>
                          <div style={{ color: COLORS.gray, fontSize: 13 }}>{order.product} · {order.variant} · ×{order.quantity}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ color: COLORS.accent, fontWeight: 700 }}>₪{order.total}</div>
                        <div style={{ color: statusColors[order.status], fontSize: 12, marginTop: 2 }}>{stage.emoji} {stage[lang] || stage.en}</div>
                        <div style={{ color: COLORS.gray, fontSize: 11, marginTop: 2 }}>⏱️ {timeAgo(order.created_at, lang)}</div>
                        {order.completed_at && <div style={{ color: COLORS.success, fontSize: 11, marginTop: 2 }}>✅ {timeBetween(order.created_at, order.completed_at, lang)}</div>}
                      </div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); setDeleteConfirm(order.id); }} style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: "#ef4444", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 14, marginLeft: 12, flexShrink: 0 }}>🗑️</button>
                    </div>

                    {isOpen && (
                      <div onClick={e => e.stopPropagation()} style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${COLORS.border}` }}>
                        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ color: COLORS.gray, fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 10 }}>{t.admin.customer}</div>
                            <div style={{ color: COLORS.white, fontSize: 14, marginBottom: 4 }}>📧 {order.customer_email}</div>
                            {order.customer_phone && <div style={{ color: COLORS.white, fontSize: 14, marginBottom: 4 }}>📱 {order.customer_phone}</div>}
                            {order.notes && <div style={{ color: COLORS.gray, fontSize: 13, marginTop: 8, background: COLORS.bg, padding: "8px 12px", borderRadius: 6 }}>💬 {order.notes}</div>}
                          </div>
                          {order.design_url && (
                            <div>
                              <div style={{ color: COLORS.gray, fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 10 }}>Design File</div>
                              <img src={order.design_url} style={{ width: 80, height: 80, objectFit: "contain", borderRadius: 8, background: "#fff", padding: 4, display: "block", marginBottom: 8 }} />
                              <button onClick={async () => {
  const response = await fetch(order.design_url);
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `design-${order.id}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}} style={{ display: "inline-block", background: "rgba(255,107,53,0.15)", border: "1px solid #FF6B35", color: "#FF6B35", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Varela Round',sans-serif" }}>⬇️ Download</button>
                            </div>
                          )}
                          <div>
                            <div style={{ color: COLORS.gray, fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 10 }}>{t.admin.updateStatus}</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {ORDER_STAGES.map(s => (
                                <button key={s.key} onClick={() => updateStatus(order.id, s.key, order.created_at)} style={{ background: order.status === s.key ? statusColors[s.key] : COLORS.bg, border: `1px solid ${order.status === s.key ? statusColors[s.key] : COLORS.border}`, color: order.status === s.key ? "#000" : COLORS.gray, borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'Varela Round',sans-serif", transition: "all 0.2s" }}>
                                  {s.emoji} {s[lang] || s.en}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        }
      </div>
    </div>
  );
}

// Order Page
function OrderPage({ lang, user, setPage }) {
  const t = LANGS[lang];
  const products = PRODUCTS(t);
  const [step, setStep] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedColor, setSelectedColor] = useState(0);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imagePos, setImagePos] = useState({ x: 150, y: 130, size: 100 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [form, setForm] = useState({ name: user?.user_metadata?.full_name || "", email: user?.email || "", phonePrefix: "050", phoneNumber: "", notes: "" });
  const [qty, setQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef();

  const product = selectedProduct ? products.find(p => p.id === selectedProduct) : null;
  const variant = selectedVariant ? product?.variants.find(v => v.id === selectedVariant) : null;
  const total = variant ? (variant.price * qty) + SHIPPING_PRICE : 0;

  const handleFileUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setUploadedImage(ev.target.result); const pa = product.printArea; setImagePos({ x: pa.x + pa.w / 2 - 50, y: pa.y + pa.h / 2 - 50, size: 100 }); };
    reader.readAsDataURL(file);
  };

  const handleMouseDown = (e) => { e.preventDefault(); setDragging(true); const rect = e.currentTarget.getBoundingClientRect(); setDragStart({ mx: e.clientX, my: e.clientY, ix: imagePos.x, iy: imagePos.y, scaleX: 400 / rect.width, scaleY: 400 / rect.height }); };
  const handleMouseMove = useCallback((e) => { if (!dragging || !dragStart) return; setImagePos(p => ({ ...p, x: dragStart.ix + (e.clientX - dragStart.mx) * dragStart.scaleX, y: dragStart.iy + (e.clientY - dragStart.my) * dragStart.scaleY })); }, [dragging, dragStart]);
  const handleMouseUp = () => setDragging(false);

  const handleSubmit = async () => {
    if (!form.name || !form.email) return;
    setSubmitting(true);
    const phone = form.phoneNumber ? `${form.phonePrefix}-${form.phoneNumber}` : "";
    
    let design_url = null;
    if (uploadedImage) {
      try {
        const res = await fetch(uploadedImage);
        const blob = await res.blob();
        const ext = blob.type.includes('png') ? 'png' : blob.type.includes('jpg') || blob.type.includes('jpeg') ? 'jpg' : 'png';
        const fileName = `design-${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('designs')
          .upload(fileName, blob, { contentType: blob.type, upsert: false });
        if (uploadData && !uploadError) {
          const { data: urlData } = supabase.storage.from('designs').getPublicUrl(fileName);
          design_url = urlData.publicUrl;
        } else {
          console.log('Upload error:', uploadError);
        }
      } catch (e) { console.log('Image upload error:', e); }
    }

    const { error } = await supabase.from("orders").insert({
      customer_name: form.name, customer_email: form.email, customer_phone: phone,
      product: product.name, variant: variant.label, color: product.colors[selectedColor],
      quantity: qty, total, notes: form.notes, status: "received",
      user_id: user?.id || null,
      design_url,
      design_x: imagePos.x, design_y: imagePos.y, design_size: imagePos.size,
      product_color: product.colors[selectedColor],
    });
    if (!error) setStep(4);
    setSubmitting(false);
  };

  const inputStyle = { width: "100%", background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "12px 14px", color: COLORS.white, fontFamily: "'Varela Round',sans-serif", fontSize: 14, outline: "none" };
  const labelStyle = { color: COLORS.gray, fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 8 };

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, paddingTop: 80, fontFamily: "'Varela Round',sans-serif", direction: t.dir }}>
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 24px 60px" }}>
        <div style={{ display: "flex", marginBottom: 40 }}>
          {t.steps.map((s, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: step >= i + 1 ? COLORS.accent : COLORS.bgCard, border: `2px solid ${step >= i + 1 ? COLORS.accent : COLORS.border}`, color: step >= i + 1 ? "#fff" : COLORS.gray, fontSize: 13, fontWeight: 600 }}>{step > i + 1 ? "✓" : i + 1}</div>
              <div style={{ fontSize: 11, color: step === i + 1 ? COLORS.accent : COLORS.gray, marginTop: 6 }}>{s}</div>
            </div>
          ))}
        </div>

        {step === 1 && (
          <div>
            <h2 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 32, marginBottom: 8 }}>{t.product.title}</h2>
            <p style={{ color: COLORS.gray, marginBottom: 32 }}>{t.product.sub}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {products.map(p => (
                <div key={p.id} onClick={() => { setSelectedProduct(p.id); setSelectedVariant(p.variants[0].id); setSelectedColor(0); setUploadedImage(null); }}
                  style={{ background: selectedProduct === p.id ? "rgba(255,107,53,0.1)" : COLORS.bgCard, border: `2px solid ${selectedProduct === p.id ? COLORS.accent : COLORS.border}`, borderRadius: 12, padding: "20px 24px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.2s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <span style={{ fontSize: 32 }}>{p.emoji}</span>
                    <div><div style={{ color: COLORS.white, fontWeight: 600 }}>{p.name}</div><div style={{ color: COLORS.gray, fontSize: 13 }}>{p.variants.length} {t.product.options} · {t.product.from}{Math.min(...p.variants.map(v => v.price))}</div></div>
                  </div>
                  {selectedProduct === p.id && <span style={{ color: COLORS.accent }}>✓</span>}
                </div>
              ))}
            </div>
            <button onClick={() => selectedProduct && setStep(2)} disabled={!selectedProduct} style={{ marginTop: 24, width: "100%", background: selectedProduct ? COLORS.accent : COLORS.bgCard, color: selectedProduct ? "#fff" : COLORS.gray, border: "none", borderRadius: 8, padding: "14px", fontSize: 15, fontWeight: 600, cursor: selectedProduct ? "pointer" : "not-allowed", fontFamily: "'Varela Round',sans-serif" }}>{t.product.continue}</button>
          </div>
        )}

        {step === 2 && product && (
          <div>
            <h2 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 32, marginBottom: 8 }}>{t.customize.title(product.name)}</h2>
            <p style={{ color: COLORS.gray, marginBottom: 24 }}>{t.customize.sub}</p>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 280px" }}>
                <div style={{ background: COLORS.bgCard, borderRadius: 16, border: `1px solid ${COLORS.border}`, padding: 12, position: "relative", userSelect: "none" }} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
                  {product.id === "tshirt" && <TShirtMockup color={product.colors[selectedColor]} imageUrl={uploadedImage} imagePos={imagePos} />}
                  {product.id === "mug" && <MugMockup color={product.colors[selectedColor]} imageUrl={uploadedImage} imagePos={imagePos} />}
                  {product.id === "sticker" && <StickerMockup color={product.colors[selectedColor]} imageUrl={uploadedImage} imagePos={imagePos} />}
                  {uploadedImage && <div onMouseDown={handleMouseDown} style={{ position: "absolute", left: `${(imagePos.x / 400) * 100}%`, top: `${(imagePos.y / 400) * 100}%`, width: `${(imagePos.size / 400) * 100}%`, height: `${(imagePos.size / 400) * 100}%`, cursor: "grab", border: "1px dashed rgba(255,107,53,0.5)", borderRadius: 4 }} />}
                </div>
                {uploadedImage && <p style={{ color: COLORS.gray, fontSize: 11, textAlign: "center", marginTop: 6 }}>{t.customize.dragHint}</p>}
              </div>
              <div style={{ flex: "1 1 200px", display: "flex", flexDirection: "column", gap: 18 }}>
                <div>
                  <label style={labelStyle}>{product.id === "tshirt" ? t.customize.size : t.customize.option}</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {product.variants.map(v => <button key={v.id} onClick={() => setSelectedVariant(v.id)} style={{ background: selectedVariant === v.id ? COLORS.accent : COLORS.bgCard, border: `1px solid ${selectedVariant === v.id ? COLORS.accent : COLORS.border}`, color: selectedVariant === v.id ? "#fff" : COLORS.white, borderRadius: 6, padding: "8px 12px", cursor: "pointer", fontSize: 12, fontFamily: "'Varela Round',sans-serif", fontWeight: 500, transition: "all 0.15s" }}>{v.label}</button>)}
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>{t.customize.color}</label>
                  <div style={{ display: "flex", gap: 10 }}>
                    {product.colors.map((c, i) => <div key={i} onClick={() => setSelectedColor(i)} style={{ width: 30, height: 30, borderRadius: "50%", background: c, cursor: "pointer", border: `3px solid ${selectedColor === i ? COLORS.accent : "transparent"}`, boxShadow: "0 0 0 1px rgba(255,255,255,0.1)" }} />)}
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>{t.customize.design}</label>
                  <div onClick={() => fileRef.current.click()} style={{ border: `2px dashed ${uploadedImage ? COLORS.accent : COLORS.border}`, borderRadius: 10, padding: "16px", textAlign: "center", cursor: "pointer" }} onMouseOver={e => e.currentTarget.style.borderColor = COLORS.accent} onMouseOut={e => e.currentTarget.style.borderColor = uploadedImage ? COLORS.accent : COLORS.border}>
                    {uploadedImage ? <><img src={uploadedImage} style={{ width: 50, height: 50, objectFit: "contain", borderRadius: 6, marginBottom: 6 }} /><div style={{ color: COLORS.accent, fontSize: 12 }}>{t.customize.uploaded}</div><div style={{ color: COLORS.gray, fontSize: 11 }}>{t.customize.changeFile}</div></> : <><div style={{ fontSize: 24, marginBottom: 6 }}>📁</div><div style={{ color: COLORS.white, fontSize: 13 }}>{t.customize.uploadTitle}</div><div style={{ color: COLORS.gray, fontSize: 11 }}>{t.customize.uploadSub}</div></>}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileUpload} />
                </div>
                {uploadedImage && <div><label style={labelStyle}>{t.customize.designSize}</label><input type="range" min="40" max="220" value={imagePos.size} onChange={e => setImagePos(p => ({ ...p, size: Number(e.target.value) }))} style={{ width: "100%", accentColor: COLORS.accent }} /></div>}
                {variant && <div style={{ background: COLORS.bgCard, borderRadius: 10, padding: 14, border: `1px solid ${COLORS.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.gray, fontSize: 13, marginBottom: 6 }}><span>{product.name}</span><span>₪{variant.price}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.gray, fontSize: 13, marginBottom: 8 }}><span>{t.customize.shipping}</span><span>₪{SHIPPING_PRICE}</span></div>
                  <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 8, display: "flex", justifyContent: "space-between" }}><span style={{ color: COLORS.white, fontWeight: 600 }}>{t.customize.total}</span><span style={{ color: COLORS.accent, fontWeight: 700, fontSize: 18 }}>₪{variant.price + SHIPPING_PRICE}</span></div>
                </div>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <button onClick={() => setStep(1)} style={{ background: "transparent", color: COLORS.gray, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "12px 20px", cursor: "pointer", fontFamily: "'Varela Round',sans-serif" }}>{t.customize.back}</button>
              <button onClick={() => setStep(3)} style={{ flex: 1, background: COLORS.accent, color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'Varela Round',sans-serif" }}>{t.customize.continue}</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 32, marginBottom: 8 }}>{t.form.title}</h2>
            <p style={{ color: COLORS.gray, marginBottom: 32 }}>{t.form.sub}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div><label style={labelStyle}>{t.form.name}</label><input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder={t.form.namePh} style={inputStyle} onFocus={e => e.target.style.borderColor = COLORS.accent} onBlur={e => e.target.style.borderColor = COLORS.border} /></div>
              <div><label style={labelStyle}>{t.form.email}</label><input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder={t.form.emailPh} style={inputStyle} onFocus={e => e.target.style.borderColor = COLORS.accent} onBlur={e => e.target.style.borderColor = COLORS.border} /></div>
              <div>
                <label style={labelStyle}>{t.form.phone}</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, direction: "ltr", marginBottom: 10 }}>
                  {IL_PREFIXES.map(pf => <button key={pf.value} type="button" onClick={() => setForm(p => ({ ...p, phonePrefix: pf.value }))} style={{ background: form.phonePrefix === pf.value ? "rgba(255,107,53,0.15)" : "#1a1a1a", border: `1px solid ${form.phonePrefix === pf.value ? "#FF6B35" : "#2a2a2a"}`, color: form.phonePrefix === pf.value ? "#FF6B35" : "#888", borderRadius: 6, padding: "10px 12px", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Varela Round',sans-serif", transition: "all 0.15s" }}>{pf.value}</button>)}
                </div>
                <input type="tel" placeholder={t.form.phonePh} value={form.phoneNumber} maxLength={7} onChange={e => setForm(p => ({ ...p, phoneNumber: e.target.value.replace(/\D/g, "") }))} style={inputStyle} onFocus={e => e.target.style.borderColor = COLORS.accent} onBlur={e => e.target.style.borderColor = COLORS.border} />
              </div>
              <div><label style={labelStyle}>{t.form.notes}</label><textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder={t.form.notesPh} rows={3} style={{ ...inputStyle, resize: "vertical" }} onFocus={e => e.target.style.borderColor = COLORS.accent} onBlur={e => e.target.style.borderColor = COLORS.border} /></div>
              <div>
                <label style={labelStyle}>{t.form.qty}</label>
                <div style={{ display: "flex", alignItems: "center", gap: 12, direction: "ltr" }}>
                  <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 36, height: 36, borderRadius: 6, background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, color: COLORS.white, cursor: "pointer", fontSize: 18 }}>−</button>
                  <span style={{ color: COLORS.white, fontSize: 18, fontWeight: 600, minWidth: 30, textAlign: "center" }}>{qty}</span>
                  <button onClick={() => setQty(q => q + 1)} style={{ width: 36, height: 36, borderRadius: 6, background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, color: COLORS.white, cursor: "pointer", fontSize: 18 }}>+</button>
                </div>
              </div>
              <div style={{ background: COLORS.bgCard, borderRadius: 12, padding: 20, border: `1px solid ${COLORS.border}` }}>
                <div style={{ color: COLORS.white, fontWeight: 600, marginBottom: 12 }}>{t.form.summary}</div>
                <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.gray, fontSize: 14, marginBottom: 8 }}><span>{product?.name} × {qty}</span><span>₪{(variant?.price || 0) * qty}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.gray, fontSize: 14, marginBottom: 12 }}><span>{t.form.shipping}</span><span>₪{SHIPPING_PRICE}</span></div>
                <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 12, display: "flex", justifyContent: "space-between" }}><span style={{ color: COLORS.white, fontWeight: 700 }}>{t.form.total}</span><span style={{ color: COLORS.accent, fontWeight: 700, fontSize: 20 }}>₪{total}</span></div>
              </div>
              <div style={{ background: "rgba(255,107,53,0.08)", border: `1px solid rgba(255,107,53,0.2)`, borderRadius: 8, padding: 12 }}>
                <div style={{ color: COLORS.accent, fontSize: 13 }}>{t.form.paymentNote}</div>
                <div style={{ color: COLORS.gray, fontSize: 12, marginTop: 4 }}>{t.form.paymentSub}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <button onClick={() => setStep(2)} style={{ background: "transparent", color: COLORS.gray, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "12px 20px", cursor: "pointer", fontFamily: "'Varela Round',sans-serif" }}>{t.form.back}</button>
              <button onClick={handleSubmit} disabled={!form.name || !form.email || submitting} style={{ flex: 1, background: form.name && form.email ? COLORS.accent : COLORS.bgCard, color: form.name && form.email ? "#fff" : COLORS.gray, border: "none", borderRadius: 8, padding: "14px", fontSize: 15, fontWeight: 600, cursor: form.name && form.email ? "pointer" : "not-allowed", fontFamily: "'Varela Round',sans-serif" }}>
                {submitting ? "..." : `${t.form.place} · ₪${total}`}
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 72, marginBottom: 24 }}>🎉</div>
            <h2 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 40, marginBottom: 16 }}>{t.confirm.title}</h2>
            <p style={{ color: COLORS.gray, fontSize: 16, maxWidth: 400, margin: "0 auto 32px", lineHeight: 1.7 }}>{t.confirm.sub1} {form.name}! {t.confirm.sub2} <span style={{ color: COLORS.accent }}>{form.email}</span></p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              {user && <button onClick={() => setPage("track")} style={{ background: COLORS.accent, color: "#fff", border: "none", borderRadius: 8, padding: "14px 28px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'Varela Round',sans-serif" }}>{t.confirm.track} →</button>}
              <button onClick={() => { setStep(1); setSelectedProduct(null); setUploadedImage(null); setForm({ name: "", email: "", phonePrefix: "050", phoneNumber: "", notes: "" }); setQty(1); }} style={{ background: "transparent", color: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "14px 28px", fontSize: 15, cursor: "pointer", fontFamily: "'Varela Round',sans-serif" }}>{t.confirm.another}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Hero
function Hero({ setPage, lang }) {
  const t = LANGS[lang];
  const products = PRODUCTS(t);
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "80px 24px 60px", direction: t.dir, background: `radial-gradient(ellipse at 50% 0%, rgba(255,107,53,0.12) 0%, transparent 60%), ${COLORS.bg}` }}>
      <div style={{ display: "inline-block", background: COLORS.accentDim, border: `1px solid rgba(255,107,53,0.3)`, borderRadius: 100, padding: "6px 18px", marginBottom: 24, color: COLORS.accent, fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'Varela Round',sans-serif" }}>{t.hero.badge}</div>
      <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(44px,8vw,90px)", fontWeight: 900, lineHeight: 1.0, marginBottom: 24, letterSpacing: "-2px", color: COLORS.white }}>
        {t.hero.h1line1}<br /><span style={{ color: COLORS.accent, fontStyle: "italic" }}>{t.hero.h1line2}</span>
      </h1>
      <p style={{ color: COLORS.gray, fontSize: 18, maxWidth: 480, lineHeight: 1.7, marginBottom: 40, fontFamily: "'Varela Round',sans-serif", fontWeight: 300 }}>{t.hero.sub}</p>
      <button onClick={() => setPage("order")} style={{ background: COLORS.accent, color: "#fff", border: "none", padding: "16px 36px", borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", transition: "background 0.2s" }} onMouseOver={e => e.target.style.background = COLORS.accentHover} onMouseOut={e => e.target.style.background = COLORS.accent}>{t.hero.cta}</button>
      <div style={{ display: "flex", gap: 20, marginTop: 80, flexWrap: "wrap", justifyContent: "center" }}>
        {products.map(p => (
          <div key={p.id} onClick={() => setPage("order")} style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: "24px 32px", cursor: "pointer", minWidth: 160, transition: "border-color 0.2s,transform 0.2s" }} onMouseOver={e => { e.currentTarget.style.borderColor = COLORS.accent; e.currentTarget.style.transform = "translateY(-4px)"; }} onMouseOut={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.transform = "translateY(0)"; }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>{p.emoji}</div>
            <div style={{ color: COLORS.white, fontFamily: "'Varela Round',sans-serif", fontWeight: 500, fontSize: 14 }}>{p.name}</div>
            <div style={{ color: COLORS.accent, fontFamily: "'Varela Round',sans-serif", fontSize: 12, marginTop: 4 }}>{t.hero.from}{Math.min(...p.variants.map(v => v.price))}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Nav
function Nav({ page, setPage, lang, setLang, user, isAdmin, onLogout }) {
  const t = LANGS[lang];
  return (
    <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(15,15,15,0.92)", backdropFilter: "blur(20px)", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", height: 64, direction: t.dir }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => setPage("home")}>
        <span style={{ fontSize: 22 }}>☕</span>
        <span style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700 }}>Sfalim <span style={{ color: COLORS.accent }}>&</span> More</span>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        {["home", "order"].map(p => <button key={p} onClick={() => setPage(p)} style={{ background: page === p ? COLORS.accentDim : "transparent", border: page === p ? `1px solid ${COLORS.accent}` : "1px solid transparent", color: page === p ? COLORS.accent : COLORS.gray, padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontSize: 13, fontWeight: 500, transition: "all 0.2s" }}>{t.nav[p]}</button>)}
        {user && <button onClick={() => setPage("track")} style={{ background: page === "track" ? COLORS.accentDim : "transparent", border: page === "track" ? `1px solid ${COLORS.accent}` : "1px solid transparent", color: page === "track" ? COLORS.accent : COLORS.gray, padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontSize: 13, fontWeight: 500 }}>{t.nav.track}</button>}
        {isAdmin && <button onClick={() => setPage("admin")} style={{ background: page === "admin" ? COLORS.accentDim : "transparent", border: page === "admin" ? `1px solid ${COLORS.accent}` : "1px solid transparent", color: page === "admin" ? COLORS.accent : COLORS.gray, padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontSize: 13, fontWeight: 500 }}>📋 {t.nav.admin}</button>}
        {user ? <button onClick={onLogout} style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.gray, padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontSize: 13 }}>{t.nav.logout}</button>
          : <button onClick={() => setPage("auth")} style={{ background: COLORS.accentDim, border: `1px solid ${COLORS.accent}`, color: COLORS.accent, padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontSize: 13, fontWeight: 600 }}>{t.nav.login}</button>}
        <div style={{ display: "flex", gap: 3, background: COLORS.bgCard, borderRadius: 8, padding: 3, border: `1px solid ${COLORS.border}` }}>
          {Object.keys(LANGS).map(l => <button key={l} onClick={() => setLang(l)} style={{ background: lang === l ? COLORS.accent : "transparent", color: lang === l ? "#fff" : COLORS.gray, border: "none", borderRadius: 5, padding: "4px 11px", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "'Varela Round',sans-serif", transition: "all 0.2s" }}>{LANGS[l].label}</button>)}
        </div>
      </div>
    </nav>
  );
}

// Main App
export default function App() {
  const [page, setPage] = useState("home");
  const [lang, setLang] = useState("he");
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) { setUser(session.user); checkAdmin(session.user); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user) checkAdmin(session.user); else setIsAdmin(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const checkAdmin = async (u) => {
    const { data } = await supabase.from("admins").select("id").eq("id", u.id).single();
    setIsAdmin(!!data);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null); setIsAdmin(false); setPage("home");
  };

  const handleAuth = (u) => {
    setUser(u); checkAdmin(u);
    setPage(u.email === ADMIN_EMAIL ? "admin" : "track");
  };

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Varela+Round&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0f0f0f; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #1a1a1a; } ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
      `}</style>
      <Nav page={page} setPage={setPage} lang={lang} setLang={setLang} user={user} isAdmin={isAdmin} onLogout={handleLogout} />
      {page === "home" && <Hero setPage={setPage} lang={lang} />}
      {page === "order" && <OrderPage lang={lang} user={user} setPage={setPage} />}
      {page === "track" && <TrackPage lang={lang} user={user} />}
      {page === "auth" && <AuthPage lang={lang} onAuth={handleAuth} />}
      {page === "admin" && isAdmin && <AdminPage lang={lang} />}
      {page === "admin" && !isAdmin && <Hero setPage={setPage} lang={lang} />}
    </div>
  );
}
