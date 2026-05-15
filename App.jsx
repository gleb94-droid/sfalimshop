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

// Particles Background
function ParticlesBackground() {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    
    const particles = Array.from({ length: 70 }, (_, i) => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: i < 10 ? Math.random() * 3 + 2 : i < 30 ? Math.random() * 2 + 1 : Math.random() * 1 + 0.3,
      dx: (Math.random() - 0.5) * 0.35,
      dy: (Math.random() - 0.5) * 0.35,
      alpha: i < 10 ? Math.random() * 0.4 + 0.2 : Math.random() * 0.3 + 0.05,
      color: i < 15 ? '#FF6B35' : i < 25 ? '#ff8c5a' : '#ffffff',
      pulse: Math.random() * Math.PI * 2,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let t2 = Date.now() / 1000;
      particles.forEach(p => {
        const pulsedR = p.r + Math.sin(t2 * 1.5 + p.pulse) * 0.4;
        const pulsedAlpha = p.alpha + Math.sin(t2 * 1.2 + p.pulse) * 0.08;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.1, pulsedR), 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, pulsedAlpha);
        ctx.fill();
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
      });

      // Draw connections between nearby particles
      particles.forEach((p1, i) => {
        particles.slice(i + 1).forEach(p2 => {
          const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = '#FF6B35';
            ctx.globalAlpha = (1 - dist / 120) * 0.08;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
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
      pointerEvents: 'none', zIndex: 0, opacity: 0.6,
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
      <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(44px,8vw,90px)", fontWeight: 900, lineHeight: 1.0, marginBottom: 24, letterSpacing: "-2px", color: COLORS.white }}>
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
  return (
    <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(15,15,15,0.95)", backdropFilter: "blur(24px)", borderBottom: `1px solid rgba(255,107,53,0.15)`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", height: 72, direction: "ltr", boxShadow: "0 4px 30px rgba(0,0,0,0.3)" }}>
      {/* Logo - LEFT */}
      <div style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => setPage("home")}>
        <img src="data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAfQB9ADASIAAhEBAxEB/8QAHAABAAICAwEAAAAAAAAAAAAAAAcIAQYCAwUE/8QAVRABAAECBAIDBhEICAUFAQADAAECAwQFBhEHIRIxQQgTUWFxsRQVFiIyNlNyc3SBkZOhssHRFyMzNVJVY5IkJSY0N0JUYkNkgoPhREWUovEnhMLw/8QAGwEBAAMAAwEAAAAAAAAAAAAAAAUGBwEDBAL/xAA/EQEAAQMCAQYLCAEEAgMBAAAAAQIDBAURBhIhMUFxsRMWMzRRU4GRocHRFBUiMjVSYeFyI4KS8EJDJGLxJf/aAAwDAQACEQMRAD8ApkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/9k=" alt="Sfalim Shop" style={{ height: 56, width: "auto", maxWidth: 200, mixBlendMode: "screen" }} /></div>

      {/* Nav links - CENTER */}
      <div style={{ display: "flex", gap: 4, alignItems: "center", position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
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
