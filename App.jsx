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
    nav: { home: "בית", order: "הזמנה", track: "מעקב הזמנה", about: "אודות", login: "כניסה", logout: "יציאה", admin: "ניהול" },
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
    nav: { home: "Home", order: "Order", track: "Track Order", about: "About", login: "Login", logout: "Logout", admin: "Admin" },
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
    nav: { home: "Главная", order: "Заказ", track: "Отследить", about: "О нас", login: "Войти", logout: "Выйти", admin: "Админ" },
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
              {(filterStatus === "all" ? orders : orders.filter(o => o.status === filterStatus)).map(order => {
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
              {(filterStatus === "all" ? orders : orders.filter(o => o.status === filterStatus)).map(order => {
                const stage = ORDER_STAGES.find(s => s.key === order.status) || ORDER_STAGES[0];
                const isOpen = selected === order.id;
                return (
                  <div key={order.id}
                    style={{ background: COLORS.bgCard, border: `1px solid ${isOpen ? COLORS.accent : COLORS.border}`, borderRadius: 12, padding: "16px 20px", transition: "border-color 0.2s" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div onClick={() => setSelected(isOpen ? null : order.id)} style={{ flex: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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

// Particles + Floating Emojis Background
function ParticlesBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    // Dot particles
    const particles = Array.from({ length: 75 }, (_, i) => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: i < 8 ? Math.random() * 3 + 2 : i < 25 ? Math.random() * 1.5 + 0.8 : Math.random() * 0.8 + 0.2,
      dx: (Math.random() - 0.5) * 0.3,
      dy: (Math.random() - 0.5) * 0.3,
      alpha: i < 8 ? Math.random() * 0.35 + 0.15 : Math.random() * 0.2 + 0.05,
      color: i < 12 ? '#FF6B35' : i < 22 ? '#ff8c5a' : '#ffffff',
      pulse: Math.random() * Math.PI * 2,
    }));

    // Floating emoji items
    const emojis = ['☕', '👕', '✨', '☕', '👕', '☕', '✨', '👕', '☕', '☕', '👕', '✨', '☕', '👕'];
    const floaters = emojis.map((emoji, i) => ({
      emoji,
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size: Math.random() * 28 + 16,
      dx: (Math.random() - 0.5) * 0.2,
      dy: (Math.random() - 0.5) * 0.2,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.008,
      alpha: Math.random() * 0.18 + 0.07,
      pulse: Math.random() * Math.PI * 2,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const t2 = Date.now() / 1000;

      // Draw dots
      particles.forEach(p => {
        const pr = p.r + Math.sin(t2 * 1.5 + p.pulse) * 0.3;
        const pa = p.alpha + Math.sin(t2 * 1.2 + p.pulse) * 0.06;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.1, pr), 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, pa);
        ctx.fill();
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
      });

      // Draw connections
      particles.forEach((p1, i) => {
        particles.slice(i + 1).forEach(p2 => {
          const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = '#FF6B35';
            ctx.globalAlpha = (1 - dist / 100) * 0.06;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });

      // Draw floating emojis
      floaters.forEach(f => {
        const fa = f.alpha + Math.sin(t2 * 0.8 + f.pulse) * 0.03;
        const fs = f.size + Math.sin(t2 * 0.6 + f.pulse) * 1.5;
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.rotation);
        ctx.globalAlpha = Math.max(0, fa);
        ctx.font = `${fs}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(f.emoji, 0, 0);
        ctx.restore();
        f.x += f.dx; f.y += f.dy;
        f.rotation += f.rotSpeed;
        if (f.x < -50 || f.x > canvas.width + 50) f.dx *= -1;
        if (f.y < -50 || f.y > canvas.height + 50) f.dy *= -1;
      });

      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <canvas ref={canvasRef} style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: 0, opacity: 0.7,
    }} />
  );
}


// Cursor Glow Effect
function CursorGlow() {
  const [pos, setPos] = useState({ x: -200, y: -200 });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const move = (e) => { setPos({ x: e.clientX, y: e.clientY }); setVisible(true); };
    const leave = () => setVisible(false);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseleave', leave);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseleave', leave); };
  }, []);

  return (
    <div style={{
      position: 'fixed', pointerEvents: 'none', zIndex: 9999,
      left: pos.x - 200, top: pos.y - 200,
      width: 400, height: 400,
      borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(255,107,53,0.08) 0%, transparent 70%)',
      transition: 'opacity 0.3s',
      opacity: visible ? 1 : 0,
      transform: 'translate(0, 0)',
    }} />
  );
}

// Scroll Reveal Hook
function useScrollReveal(ref) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return visible;
}

// Magnetic Button Component
function MagneticButton({ children, style, onClick, disabled }) {
  const btnRef = useRef(null);
  const handleMouseMove = (e) => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    btn.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`;
  };
  const handleMouseLeave = () => {
    if (btnRef.current) btnRef.current.style.transform = 'translate(0, 0)';
  };
  return (
    <button ref={btnRef} onClick={onClick} disabled={disabled}
      onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}
      style={{ ...style, transition: 'transform 0.15s ease, background 0.2s, box-shadow 0.2s' }}>
      {children}
    </button>
  );
}

function Hero({ setPage, lang }) {
  const t = LANGS[lang];
  const products = PRODUCTS(t);
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "80px 24px 60px", direction: t.dir, background: `radial-gradient(ellipse at 50% 0%, rgba(255,107,53,0.12) 0%, transparent 60%), ${COLORS.bg}` }}>
      <div style={{ display: "inline-block", background: COLORS.accentDim, border: `1px solid rgba(255,107,53,0.3)`, borderRadius: 100, padding: "6px 18px", marginBottom: 24, color: COLORS.accent, fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'Varela Round',sans-serif" }}>{t.hero.badge}</div>
      <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(36px,8vw,90px)", fontWeight: 900, lineHeight: 1.0, marginBottom: 24, letterSpacing: "-2px", color: COLORS.white }}>
        {t.hero.h1line1}<br /><span style={{ color: COLORS.accent, fontStyle: "italic" }}>{t.hero.h1line2}</span>
      </h1>
      <p style={{ color: COLORS.gray, fontSize: 18, maxWidth: 480, lineHeight: 1.7, marginBottom: 40, fontFamily: "'Varela Round',sans-serif", fontWeight: 300 }}>{t.hero.sub}</p>
      <button onClick={() => setPage("order")} style={{ background: COLORS.accent, color: "#fff", border: "none", padding: "16px 36px", borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", transition: "background 0.2s" }} onMouseOver={e => e.target.style.background = COLORS.accentHover} onMouseOut={e => e.target.style.background = COLORS.accent}>{t.hero.cta}</button>
      <div style={{ display: "flex", gap: 20, marginTop: 80, flexWrap: "wrap", justifyContent: "center" }}>
        {products.map((p, idx) => (
          <div key={p.id} onClick={() => setPage("order")}
            style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: "24px 32px", cursor: "pointer", minWidth: 160, transition: "border-color 0.2s, transform 0.3s, box-shadow 0.3s", animation: `fadeUp 0.6s ${idx * 0.15}s ease forwards`, opacity: 0 }}
            onMouseOver={e => { e.currentTarget.style.borderColor = COLORS.accent; e.currentTarget.style.transform = "translateY(-8px)"; e.currentTarget.style.boxShadow = `0 20px 40px rgba(255,107,53,0.15)`; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
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
  const [mobileMenu, setMobileMenu] = useState(false);
  return (
    <>
    <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(15,15,15,0.95)", backdropFilter: "blur(24px)", borderBottom: `1px solid rgba(255,107,53,0.15)`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", height: 72, direction: "ltr", boxShadow: "0 4px 30px rgba(0,0,0,0.3)" }}>
      {/* Logo - LEFT */}
      <div style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => setPage("home")}>
        <img src="data:image/png;base64,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" alt="Sfalim Shop" style={{ height: 58, width: "auto", maxWidth: 280, mixBlendMode: "screen" }} /></div>

      {/* Nav links - CENTER (desktop) */}
      <div className="nav-center" style={{ display: "flex", gap: 4, alignItems: "center", position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
        {["home", "order", "about"].map(p => (
          <button key={p} onClick={() => setPage(p)} style={{
            background: page === p ? COLORS.accentDim : "transparent",
            border: page === p ? `1px solid ${COLORS.accent}` : "1px solid transparent",
            color: page === p ? COLORS.accent : COLORS.gray,
            padding: "8px 18px", borderRadius: 8, cursor: "pointer",
            fontFamily: "'Varela Round',sans-serif", fontSize: 13, fontWeight: 500,
            transition: "all 0.2s", position: "relative", overflow: "hidden",
          }}
          onMouseOver={e => { if(page !== p) { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}}
          onMouseOut={e => { if(page !== p) { e.currentTarget.style.color = COLORS.gray; e.currentTarget.style.background = "transparent"; }}}
          >{t.nav[p]}</button>
        ))}
        {user && (
          <button onClick={() => setPage("track")} style={{ background: page === "track" ? COLORS.accentDim : "transparent", border: page === "track" ? `1px solid ${COLORS.accent}` : "1px solid transparent", color: page === "track" ? COLORS.accent : COLORS.gray, padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontSize: 13, fontWeight: 500, transition: "all 0.2s" }}
          onMouseOver={e => { if(page !== "track") { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}}
          onMouseOut={e => { if(page !== "track") { e.currentTarget.style.color = COLORS.gray; e.currentTarget.style.background = "transparent"; }}}
          >{t.nav.track}</button>
        )}
        {isAdmin && (
          <button onClick={() => setPage("admin")} style={{ background: page === "admin" ? COLORS.accentDim : "transparent", border: page === "admin" ? `1px solid ${COLORS.accent}` : "1px solid transparent", color: page === "admin" ? COLORS.accent : COLORS.gray, padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontSize: 13, fontWeight: 500, transition: "all 0.2s" }}>📋 {t.nav.admin}</button>
        )}
      </div>

      {/* Hamburger - MOBILE */}
      <div className="nav-mobile-menu" style={{ display: "none", alignItems: "center", gap: 8 }}>
        <button onClick={() => setMobileMenu(m => !m)} style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.white, borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 18 }}>☰</button>
      </div>

      {/* Auth + Lang - RIGHT */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
        {user ? (
          <button onClick={onLogout} style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.gray, padding: "7px 16px", borderRadius: 8, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontSize: 13, transition: "all 0.2s" }}
          onMouseOver={e => { e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.color = "#ef4444"; }}
          onMouseOut={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.color = COLORS.gray; }}
          >{t.nav.logout}</button>
        ) : (
          <button onClick={() => setPage("auth")} style={{ background: COLORS.accent, border: "none", color: "#fff", padding: "8px 20px", borderRadius: 8, cursor: "pointer", fontFamily: "'Varela Round',sans-serif", fontSize: 13, fontWeight: 600, transition: "all 0.2s", boxShadow: "0 0 20px rgba(255,107,53,0.3)" }}
          onMouseOver={e => { e.currentTarget.style.background = COLORS.accentHover; e.currentTarget.style.boxShadow = "0 0 30px rgba(255,107,53,0.5)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseOut={e => { e.currentTarget.style.background = COLORS.accent; e.currentTarget.style.boxShadow = "0 0 20px rgba(255,107,53,0.3)"; e.currentTarget.style.transform = "translateY(0)"; }}
          >{t.nav.login}</button>
        )}
        <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: 3, border: `1px solid ${COLORS.border}` }}>
          {Object.keys(LANGS).map(l => (
            <button key={l} onClick={() => setLang(l)} style={{ background: lang === l ? COLORS.accent : "transparent", color: lang === l ? "#fff" : COLORS.gray, border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "'Varela Round',sans-serif", transition: "all 0.2s" }}>{LANGS[l].label}</button>
          ))}
        </div>
      </div>
    </nav>
  );
}

// Main App

// ============ ACCESSIBILITY ============
function AccessibilityMenu({ lang }) {
  const [open, setOpen] = useState(false);
  const [fontSize, setFontSize] = useState(100);
  const [highContrast, setHighContrast] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    document.documentElement.style.fontSize = fontSize + '%';
  }, [fontSize]);

  useEffect(() => {
    if (highContrast) {
      document.body.style.filter = 'contrast(1.4) brightness(1.1)';
    } else {
      document.body.style.filter = 'none';
    }
  }, [highContrast]);

  useEffect(() => {
    if (reduceMotion) {
      const style = document.getElementById('reduce-motion-style') || document.createElement('style');
      style.id = 'reduce-motion-style';
      style.textContent = '* { animation: none !important; transition: none !important; }';
      document.head.appendChild(style);
    } else {
      const style = document.getElementById('reduce-motion-style');
      if (style) style.remove();
    }
  }, [reduceMotion]);

  const t = {
    he: { title: 'נגישות', textSize: 'גודל טקסט', contrast: 'ניגודיות גבוהה', motion: 'הפחת אנימציות', reset: 'איפוס', close: 'סגור' },
    en: { title: 'Accessibility', textSize: 'Text Size', contrast: 'High Contrast', motion: 'Reduce Motion', reset: 'Reset', close: 'Close' },
    ru: { title: 'Доступность', textSize: 'Размер текста', contrast: 'Высокий контраст', motion: 'Без анимации', reset: 'Сбросить', close: 'Закрыть' },
  }[lang] || { title: 'Accessibility', textSize: 'Text Size', contrast: 'High Contrast', motion: 'Reduce Motion', reset: 'Reset', close: 'Close' };

  const btnBase = { width: '100%', padding: '10px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Varela Round',sans-serif", fontSize: 13, fontWeight: 500, textAlign: 'left', transition: 'all 0.2s', marginBottom: 8 };

  return (
    <>
      {/* Accessibility button - fixed bottom left */}
      <button
        aria-label="Accessibility menu"
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed', bottom: 24, left: 24, zIndex: 9998,
          width: 52, height: 52, borderRadius: '50%',
          background: '#FF6B35', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, boxShadow: '0 4px 20px rgba(255,107,53,0.5)',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 30px rgba(255,107,53,0.7)'; }}
        onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(255,107,53,0.5)'; }}
      >♿</button>

      {/* Accessibility panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 88, left: 24, zIndex: 9997,
          background: '#1a1a1a', border: '1px solid #2a2a2a',
          borderRadius: 16, padding: 20, width: 260,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          animation: 'fadeUp 0.2s ease',
        }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, marginBottom: 16, fontFamily: "'Varela Round',sans-serif" }}>
            ♿ {t.title}
          </div>

          {/* Text size */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: '#888', fontSize: 11, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t.textSize}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => setFontSize(f => Math.max(80, f - 10))} style={{ ...btnBase, width: 36, height: 36, padding: 0, textAlign: 'center', background: '#111', border: '1px solid #2a2a2a', color: '#fff', fontSize: 18, marginBottom: 0 }}>−</button>
              <div style={{ flex: 1, textAlign: 'center', color: '#FF6B35', fontWeight: 700, fontFamily: "'Varela Round',sans-serif" }}>{fontSize}%</div>
              <button onClick={() => setFontSize(f => Math.min(140, f + 10))} style={{ ...btnBase, width: 36, height: 36, padding: 0, textAlign: 'center', background: '#111', border: '1px solid #2a2a2a', color: '#fff', fontSize: 18, marginBottom: 0 }}>+</button>
            </div>
          </div>

          {/* High contrast */}
          <button onClick={() => setHighContrast(!highContrast)} style={{ ...btnBase, background: highContrast ? 'rgba(255,107,53,0.15)' : '#111', border: `1px solid ${highContrast ? '#FF6B35' : '#2a2a2a'}`, color: highContrast ? '#FF6B35' : '#888', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {t.contrast} <span>{highContrast ? '✓' : '○'}</span>
          </button>

          {/* Reduce motion */}
          <button onClick={() => setReduceMotion(!reduceMotion)} style={{ ...btnBase, background: reduceMotion ? 'rgba(255,107,53,0.15)' : '#111', border: `1px solid ${reduceMotion ? '#FF6B35' : '#2a2a2a'}`, color: reduceMotion ? '#FF6B35' : '#888', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {t.motion} <span>{reduceMotion ? '✓' : '○'}</span>
          </button>

          {/* Reset */}
          <button onClick={() => { setFontSize(100); setHighContrast(false); setReduceMotion(false); }} style={{ ...btnBase, background: 'transparent', border: '1px solid #2a2a2a', color: '#555', textAlign: 'center', marginBottom: 0 }}>
            {t.reset}
          </button>
        </div>
      )}
    </>
  );
}

// ============ ABOUT PAGE ============
function AboutPage({ lang, setPage }) {
  const t = {
    he: {
      badge: 'באר שבע, בירת הנגב 🏙️',
      title: 'אנחנו Sfalim Shop',
      subtitle: 'מקצועיות ושירות אדיב — מ-2023',
      story: 'Sfalim Shop נולד מתוך אהבה לעיצוב ויצירה. מאז 2023 אנחנו מביאים לחיים כל עיצוב — על חולצות, ספלים ומדבקות — עם רמת גימור מקצועית שתרגישו בה.',
      techTitle: 'הטכנולוגיות שלנו',
      tech: [
        { name: 'Sublimation', desc: 'הדפסה לחולצות פוליאסטר וספלים עם צבעים עמוקים ועמידים', icon: '🌊' },
        { name: 'DTF', desc: 'הדפסה ישירה על בד — מתאים לכל סוג בד בפירוט מדהים', icon: '🎯' },
        { name: 'Vinyl', desc: 'חיתוך ויניל לעיצובים חדים וברורים עם עמידות גבוהה', icon: '✂️' },
      ],
      processTitle: 'איך זה עובד?',
      process: [
        { step: '01', title: 'בחר מוצר', desc: 'חולצה, ספל או מדבקה' },
        { step: '02', title: 'העלה עיצוב', desc: 'תמונה, לוגו, או כל קובץ' },
        { step: '03', title: 'מקם ושלח', desc: 'צפה בתצוגה מקדימה ושלח הזמנה' },
        { step: '04', title: 'קבל אצלך', desc: 'נייצר ונשלח אליך' },
      ],
      contactTitle: 'יצירת קשר',
      location: 'באר שבע, ישראל',
      cta: 'התחל להזמין',
    },
    en: {
      badge: 'Beer Sheva, Capital of the Negev 🏙️',
      title: "We're Sfalim Shop",
      subtitle: 'Professionalism & friendly service — since 2023',
      story: 'Sfalim Shop was born from a love of design and creativity. Since 2023, we bring every design to life — on t-shirts, mugs and stickers — with professional quality you can feel.',
      techTitle: 'Our Technologies',
      tech: [
        { name: 'Sublimation', desc: 'Printing on polyester shirts and mugs with deep, durable colors', icon: '🌊' },
        { name: 'DTF', desc: 'Direct to film printing on any fabric type with stunning detail', icon: '🎯' },
        { name: 'Vinyl', desc: 'Vinyl cutting for sharp, clear designs with high durability', icon: '✂️' },
      ],
      processTitle: 'How it works',
      process: [
        { step: '01', title: 'Choose product', desc: 'T-shirt, mug or sticker' },
        { step: '02', title: 'Upload design', desc: 'Image, logo or any file' },
        { step: '03', title: 'Place & send', desc: 'Preview and submit order' },
        { step: '04', title: 'Receive it', desc: "We'll create and ship to you" },
      ],
      contactTitle: 'Contact Us',
      location: 'Beer Sheva, Israel',
      cta: 'Start Ordering',
    },
    ru: {
      badge: 'Беэр-Шева, столица Негева 🏙️',
      title: 'Мы — Sfalim Shop',
      subtitle: 'Профессионализм и дружелюбный сервис — с 2023',
      story: 'Sfalim Shop родился из любви к дизайну и творчеству. С 2023 года мы воплощаем любой дизайн в жизнь — на футболках, кружках и стикерах — с профессиональным качеством.',
      techTitle: 'Наши технологии',
      tech: [
        { name: 'Sublimation', desc: 'Печать на полиэстер и кружках с яркими стойкими цветами', icon: '🌊' },
        { name: 'DTF', desc: 'Прямая печать на любой ткани с потрясающей детализацией', icon: '🎯' },
        { name: 'Vinyl', desc: 'Виниловая резка для четких дизайнов с высокой прочностью', icon: '✂️' },
      ],
      processTitle: 'Как это работает',
      process: [
        { step: '01', title: 'Выбрать товар', desc: 'Футболка, кружка или стикер' },
        { step: '02', title: 'Загрузить дизайн', desc: 'Фото, логотип или любой файл' },
        { step: '03', title: 'Разместить и отправить', desc: 'Просмотр и оформление заказа' },
        { step: '04', title: 'Получить', desc: 'Создадим и доставим вам' },
      ],
      contactTitle: 'Связаться с нами',
      location: 'Беэр-Шева, Израиль',
      cta: 'Начать заказ',
    },
  }[lang] || {};

  const sectionStyle = { maxWidth: 900, margin: '0 auto', padding: '0 24px' };

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', paddingTop: 90, fontFamily: "'Varela Round',sans-serif" }}>

      {/* Hero section */}
      <div style={{ ...sectionStyle, textAlign: 'center', padding: '60px 24px 80px' }}>
        <div style={{ display: 'inline-block', background: 'rgba(255,107,53,0.15)', border: '1px solid rgba(255,107,53,0.3)', borderRadius: 100, padding: '6px 18px', marginBottom: 24, color: '#FF6B35', fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {t.badge}
        </div>
        <h1 style={{ color: '#fff', fontSize: 'clamp(36px,6vw,72px)', fontWeight: 900, marginBottom: 16, fontFamily: "'Playfair Display',serif", letterSpacing: '-1px' }}>{t.title}</h1>
        <p style={{ color: '#FF6B35', fontSize: 18, marginBottom: 32 }}>{t.subtitle}</p>
        <p style={{ color: '#888', fontSize: 17, maxWidth: 580, margin: '0 auto', lineHeight: 1.8 }}>{t.story}</p>
      </div>

      {/* Technologies */}
      <div style={{ background: '#111', borderTop: '1px solid #1e1e1e', borderBottom: '1px solid #1e1e1e', padding: '60px 24px' }}>
        <div style={{ ...sectionStyle }}>
          <h2 style={{ color: '#fff', fontSize: 32, marginBottom: 40, textAlign: 'center', fontFamily: "'Playfair Display',serif" }}>{t.techTitle}</h2>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
            {t.tech?.map((tech, i) => (
              <div key={i} style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 16, padding: '28px 32px', flex: '1 1 220px', maxWidth: 280, transition: 'border-color 0.2s, transform 0.2s' }}
                onMouseOver={e => { e.currentTarget.style.borderColor = '#FF6B35'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
                onMouseOut={e => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>{tech.icon}</div>
                <div style={{ color: '#FF6B35', fontWeight: 700, fontSize: 18, marginBottom: 10 }}>{tech.name}</div>
                <div style={{ color: '#666', fontSize: 14, lineHeight: 1.7 }}>{tech.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Process */}
      <div style={{ padding: '60px 24px' }}>
        <div style={{ ...sectionStyle }}>
          <h2 style={{ color: '#fff', fontSize: 32, marginBottom: 48, textAlign: 'center', fontFamily: "'Playfair Display',serif" }}>{t.processTitle}</h2>
          <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap', justifyContent: 'center' }}>
            {t.process?.map((step, i) => (
              <div key={i} style={{ flex: '1 1 180px', textAlign: 'center', padding: '0 20px', position: 'relative' }}>
                {i < (t.process.length - 1) && <div style={{ position: 'absolute', top: 24, left: '60%', right: '-10%', height: 1, background: 'linear-gradient(to right, #FF6B35, #2a2a2a)', opacity: 0.4 }} />}
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,107,53,0.15)', border: '2px solid #FF6B35', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#FF6B35', fontWeight: 800, fontSize: 14 }}>{step.step}</div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{step.title}</div>
                <div style={{ color: '#555', fontSize: 13, lineHeight: 1.6 }}>{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Contact */}
      <div style={{ background: '#111', borderTop: '1px solid #1e1e1e', padding: '60px 24px' }}>
        <div style={{ ...sectionStyle, textAlign: 'center' }}>
          <h2 style={{ color: '#fff', fontSize: 32, marginBottom: 32, fontFamily: "'Playfair Display',serif" }}>{t.contactTitle}</h2>
          <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 40 }}>
            <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, padding: '20px 32px', color: '#888', fontSize: 15 }}>📍 {t.location}</div>
            <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, padding: '20px 32px', color: '#888', fontSize: 15 }}>📧 gleb2009@gmail.com</div>
          </div>
          <button onClick={() => setPage('order')} style={{ background: '#FF6B35', color: '#fff', border: 'none', padding: '16px 48px', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: "'Varela Round',sans-serif", boxShadow: '0 0 30px rgba(255,107,53,0.4)', transition: 'all 0.2s' }}
            onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 0 40px rgba(255,107,53,0.6)'; }}
            onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 0 30px rgba(255,107,53,0.4)'; }}>
            {t.cta} →
          </button>
        </div>
      </div>
    </div>
  );
}

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
      <ParticlesBackground />
      <CursorGlow />
      <AccessibilityMenu lang={lang} />
      <Nav page={page} setPage={setPage} lang={lang} setLang={setLang} user={user} isAdmin={isAdmin} onLogout={handleLogout} />
      {page === "home" && <Hero setPage={setPage} lang={lang} />}
      {page === "about" && <AboutPage lang={lang} setPage={setPage} />}
      {page === "order" && <OrderPage lang={lang} user={user} setPage={setPage} />}
      {page === "track" && <TrackPage lang={lang} user={user} />}
      {page === "auth" && <AuthPage lang={lang} onAuth={handleAuth} />}
      {page === "admin" && isAdmin && <AdminPage lang={lang} />}
      {page === "admin" && !isAdmin && <Hero setPage={setPage} lang={lang} />}
    </div>
  );
}
