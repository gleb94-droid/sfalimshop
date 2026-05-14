import { useState, useRef, useCallback } from "react";

const COLORS = {
  bg: "#0f0f0f", bgCard: "#1a1a1a", bgCardHover: "#222222",
  border: "#2a2a2a", accent: "#FF6B35", accentHover: "#ff8255",
  accentDim: "rgba(255,107,53,0.15)", white: "#ffffff",
  gray: "#888888", grayLight: "#555555", success: "#4ade80",
};

const SHIPPING_PRICE = 30;

const IL_PREFIXES = [
  { value: "050", label: "050" },
  { value: "052", label: "052" },
  { value: "053", label: "053" },
  { value: "054", label: "054" },
  { value: "055", label: "055" },
  { value: "057", label: "057" },
  { value: "058", label: "058" },
];

const LANGS = {
  he: {
    dir: "rtl", label: "HE", name: "עברית",
    nav: { home: "בית", order: "הזמנה", admin: "הזמנות" },
    hero: { badge: "הדפסות מותאמות אישית · ישראל 🇮🇱", h1line1: "העיצוב שלך.", h1line2: "על הכל.", sub: "חולצות, ספלים, מדבקות — מותאמים אישית עם העיצוב שלך. העלה, צפה בתצוגה מקדימה והזמן תוך דקות.", cta: "התחל לעצב ←", ctaSec: "דוגמאות", from: "החל מ-₪" },
    steps: ["מוצר", "עיצוב", "פרטים", "סיום"],
    product: { title: "בחר את המוצר שלך", sub: "מה תרצה להתאים אישית היום?", options: "אפשרויות", from: "החל מ-₪", continue: "המשך ←" },
    customize: { title: (p) => `התאם אישית: ${p}`, sub: "העלה את העיצוב שלך וראה איך זה נראה.", size: "מידה", option: "אפשרות", color: "צבע", design: "העיצוב שלך", uploadTitle: "העלה את העיצוב שלך", uploadSub: "PNG, JPG, SVG · רזולוציה גבוהה", uploaded: "עיצוב הועלה ✓", changeFile: "לחץ לשינוי", dragHint: "גרור לשינוי מיקום העיצוב", designSize: "גודל עיצוב", shipping: "משלוח (מחיר קבוע)", total: "סה״כ", back: "← חזרה", continue: "המשך להזמנה ←" },
    form: { title: "הפרטים שלך", sub: "כמעט סיימנו — מלא את הפרטים ושלח הזמנה.", name: "שם מלא *", namePh: "השם המלא שלך", email: "כתובת מייל *", emailPh: "your@email.com", phone: "מספר טלפון", phonePh: "1234567", notes: "הוראות מיוחדות", notesPh: "בקשות מיוחדות או הערות להזמנה...", qty: "כמות", summary: "סיכום הזמנה", shipping: "משלוח", total: "סה״כ", paymentNote: "💳 תשלום בשלב הבא", paymentSub: "נעבד את התשלום שלך בצורה מאובטחת לאחר אישור ההזמנה.", back: "← חזרה", place: "בצע הזמנה" },
    confirm: { title: "ההזמנה בוצעה!", sub1: "תודה", sub2: "קיבלנו את ההזמנה שלך ונצור קשר בקרוב בכתובת", another: "הזמן שוב ←" },
    admin: { title: "לוח הזמנות", total: "סה״כ הזמנות", empty: "אין הזמנות עדיין", emptySub: "הזמנות יופיעו כאן כשלקוחות יזמינו", statuses: ["חדש", "בעבודה", "הושלם"], customer: "לקוח", design: "קובץ עיצוב", status: "סטטוס" },
    products: { tshirt: "חולצת טי מותאמת", mug: "ספל מותאם", sticker: "מדבקה מותאמת" },
    variants: { standard: "סטנדרט 11oz", large: "גדול 15oz", magic: "משנה צבע", small: "קטן 5×5 ס״מ", medium: "בינוני 10×10 ס״מ", largeS: "גדול 15×15 ס״מ", sheet: "גיליון מדבקות" },
  },
  en: {
    dir: "ltr", label: "EN", name: "English",
    nav: { home: "Home", order: "Order", admin: "Orders" },
    hero: { badge: "Custom Prints · Made in Israel 🇮🇱", h1line1: "Your design.", h1line2: "On everything.", sub: "T-shirts, mugs, stickers — fully customized with your design. Upload, preview, and order in minutes.", cta: "Start Designing →", ctaSec: "See Examples", from: "from ₪" },
    steps: ["Product", "Customize", "Details", "Done"],
    product: { title: "Choose your product", sub: "What would you like to customize today?", options: "options", from: "from ₪", continue: "Continue →" },
    customize: { title: (p) => `Customize your ${p.toLowerCase()}`, sub: "Upload your design and see how it looks.", size: "Size", option: "Option", color: "Color", design: "Your Design", uploadTitle: "Upload your design", uploadSub: "PNG, JPG, SVG · High resolution", uploaded: "Design uploaded ✓", changeFile: "Click to change", dragHint: "Drag to reposition your design", designSize: "Design Size", shipping: "Shipping (flat rate)", total: "Total", back: "← Back", continue: "Continue to Order →" },
    form: { title: "Your details", sub: "Almost there — fill in your info and place your order.", name: "Full Name *", namePh: "Your full name", email: "Email Address *", emailPh: "your@email.com", phone: "Phone Number", phonePh: "1234567", notes: "Special Instructions", notesPh: "Any special requests or notes for your order...", qty: "Quantity", summary: "Order Summary", shipping: "Shipping", total: "Total", paymentNote: "💳 Payment on next step", paymentSub: "We'll process your payment securely after you confirm your order.", back: "← Back", place: "Place Order" },
    confirm: { title: "Order Placed!", sub1: "Thanks", sub2: "We received your order and we'll be in touch at", another: "Order Another →" },
    admin: { title: "Orders Dashboard", total: "total orders", empty: "No orders yet", emptySub: "Orders will appear here when customers place them", statuses: ["New", "In Progress", "Done"], customer: "Customer", design: "Design File", status: "Status" },
    products: { tshirt: "Custom T-Shirt", mug: "Custom Mug", sticker: "Custom Sticker" },
    variants: { standard: "Standard 11oz", large: "Large 15oz", magic: "Magic Color Change", small: "Small 5×5cm", medium: "Medium 10×10cm", largeS: "Large 15×15cm", sheet: "Sticker Sheet" },
  },
  ru: {
    dir: "ltr", label: "RU", name: "Русский",
    nav: { home: "Главная", order: "Заказ", admin: "Заказы" },
    hero: { badge: "Индивидуальная печать · Израиль 🇮🇱", h1line1: "Ваш дизайн.", h1line2: "На всём.", sub: "Футболки, кружки, стикеры — с вашим дизайном. Загрузите, просмотрите и закажите за минуты.", cta: "Начать дизайн →", ctaSec: "Примеры", from: "от ₪" },
    steps: ["Товар", "Дизайн", "Детали", "Готово"],
    product: { title: "Выберите товар", sub: "Что вы хотите настроить сегодня?", options: "варианта", from: "от ₪", continue: "Продолжить →" },
    customize: { title: (p) => `Настройте: ${p}`, sub: "Загрузите дизайн и посмотрите как он будет выглядеть.", size: "Размер", option: "Вариант", color: "Цвет", design: "Ваш дизайн", uploadTitle: "Загрузите дизайн", uploadSub: "PNG, JPG, SVG · Высокое разрешение", uploaded: "Дизайн загружен ✓", changeFile: "Нажмите для изменения", dragHint: "Перетащите для изменения позиции", designSize: "Размер дизайна", shipping: "Доставка (фиксированная)", total: "Итого", back: "← Назад", continue: "Перейти к заказу →" },
    form: { title: "Ваши данные", sub: "Почти готово — заполните данные и оформите заказ.", name: "Полное имя *", namePh: "Ваше полное имя", email: "Email *", emailPh: "your@email.com", phone: "Номер телефона", phonePh: "1234567", notes: "Особые пожелания", notesPh: "Любые особые пожелания или примечания...", qty: "Количество", summary: "Сводка заказа", shipping: "Доставка", total: "Итого", paymentNote: "💳 Оплата на следующем шаге", paymentSub: "Мы обработаем ваш платёж после подтверждения заказа.", back: "← Назад", place: "Оформить заказ" },
    confirm: { title: "Заказ оформлен!", sub1: "Спасибо", sub2: "Мы получили ваш заказ и свяжемся с вами по адресу", another: "Заказать ещё →" },
    admin: { title: "Панель заказов", total: "заказов всего", empty: "Заказов пока нет", emptySub: "Заказы появятся здесь когда клиенты сделают их", statuses: ["Новый", "В работе", "Выполнен"], customer: "Клиент", design: "Файл дизайна", status: "Статус" },
    products: { tshirt: "Футболка на заказ", mug: "Кружка на заказ", sticker: "Стикер на заказ" },
    variants: { standard: "Стандарт 11oz", large: "Большой 15oz", magic: "Меняет цвет", small: "Маленький 5×5см", medium: "Средний 10×10см", largeS: "Большой 15×15см", sheet: "Лист стикеров" },
  },
};

const PRODUCTS = (t) => [
  { id: "tshirt", name: t.products.tshirt, emoji: "👕", variants: [{ id: "s", label: "S", price: 89 }, { id: "m", label: "M", price: 89 }, { id: "l", label: "L", price: 89 }, { id: "xl", label: "XL", price: 99 }, { id: "xxl", label: "XXL", price: 99 }], colors: ["#ffffff", "#1a1a1a", "#1e3a5f", "#7f1d1d", "#14532d"], printArea: { x: 130, y: 100, w: 140, h: 160 } },
  { id: "mug", name: t.products.mug, emoji: "☕", variants: [{ id: "standard", label: t.variants.standard, price: 69 }, { id: "large", label: t.variants.large, price: 79 }, { id: "magic", label: t.variants.magic, price: 89 }], colors: ["#ffffff", "#1a1a1a", "#fef3c7", "#dbeafe"], printArea: { x: 90, y: 90, w: 180, h: 120 } },
  { id: "sticker", name: t.products.sticker, emoji: "✨", variants: [{ id: "small", label: t.variants.small, price: 15 }, { id: "medium", label: t.variants.medium, price: 25 }, { id: "largeS", label: t.variants.largeS, price: 35 }, { id: "sheet", label: t.variants.sheet, price: 45 }], colors: ["#ffffff", "#f0fdf4", "#fef9c3", "#fdf2f8"], printArea: { x: 75, y: 75, w: 250, h: 250 } },
];

function TShirtMockup({ color, imageUrl, imagePos }) {
  return (
    <svg viewBox="0 0 400 420" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <defs>
        <linearGradient id="ts-hl" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="white" stopOpacity="0.15" /><stop offset="50%" stopColor="white" stopOpacity="0" /><stop offset="100%" stopColor="black" stopOpacity="0.1" /></linearGradient>
        <clipPath id="ts-clip"><path d="M150,40 L80,80 L40,140 L90,160 L90,380 L310,380 L310,160 L360,140 L320,80 L250,40 C240,70 200,80 200,80 C200,80 160,70 150,40Z" /></clipPath>
        <filter id="ts-shadow"><feDropShadow dx="0" dy="4" stdDeviation="12" floodOpacity="0.4" /></filter>
      </defs>
      <ellipse cx="200" cy="400" rx="120" ry="12" fill="rgba(0,0,0,0.3)" />
      <path d="M150,40 L80,80 L40,140 L90,160 L90,380 L310,380 L310,160 L360,140 L320,80 L250,40 C240,70 200,80 200,80 C200,80 160,70 150,40Z" fill={color} filter="url(#ts-shadow)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <path d="M175,42 Q200,75 225,42" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="2" />
      {imageUrl ? <image href={imageUrl} x={imagePos.x} y={imagePos.y} width={imagePos.size} height={imagePos.size} clipPath="url(#ts-clip)" preserveAspectRatio="xMidYMid meet" /> : <g clipPath="url(#ts-clip)"><rect x="145" y="110" width="110" height="130" rx="6" fill="rgba(255,107,53,0.12)" stroke="rgba(255,107,53,0.3)" strokeWidth="1.5" strokeDasharray="5,4" /><text x="200" y="168" textAnchor="middle" fill="rgba(255,107,53,0.6)" fontSize="11" fontFamily="monospace">↑ Upload</text><text x="200" y="184" textAnchor="middle" fill="rgba(255,107,53,0.6)" fontSize="11" fontFamily="monospace">design here</text></g>}
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
      <path d="M315,140 Q365,140 365,200 Q365,260 315,260" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="200" cy="72" rx="118" ry="15" fill={color} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      {imageUrl ? <image href={imageUrl} x={imagePos.x} y={imagePos.y} width={imagePos.size} height={imagePos.size} clipPath="url(#mug-clip)" preserveAspectRatio="xMidYMid meet" /> : <g clipPath="url(#mug-clip)"><rect x="110" y="120" width="160" height="120" rx="6" fill="rgba(255,107,53,0.12)" stroke="rgba(255,107,53,0.3)" strokeWidth="1.5" strokeDasharray="5,4" /><text x="190" y="176" textAnchor="middle" fill="rgba(255,107,53,0.6)" fontSize="11" fontFamily="monospace">↑ Upload</text><text x="190" y="192" textAnchor="middle" fill="rgba(255,107,53,0.6)" fontSize="11" fontFamily="monospace">design here</text></g>}
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
      <ellipse cx="200" cy="385" rx="110" ry="10" fill="rgba(0,0,0,0.3)" />
      <circle cx="200" cy="198" r="162" fill="white" filter="url(#stk-shadow)" />
      <circle cx="200" cy="198" r="155" fill={color} />
      {imageUrl ? <image href={imageUrl} x={imagePos.x} y={imagePos.y} width={imagePos.size} height={imagePos.size} clipPath="url(#stk-clip)" preserveAspectRatio="xMidYMid meet" /> : <g clipPath="url(#stk-clip)"><circle cx="200" cy="198" r="100" fill="rgba(255,107,53,0.12)" stroke="rgba(255,107,53,0.3)" strokeWidth="1.5" strokeDasharray="5,4" /><text x="200" y="193" textAnchor="middle" fill="rgba(255,107,53,0.6)" fontSize="11" fontFamily="monospace">↑ Upload</text><text x="200" y="209" textAnchor="middle" fill="rgba(255,107,53,0.6)" fontSize="11" fontFamily="monospace">design here</text></g>}
      <ellipse cx="155" cy="130" rx="55" ry="30" fill="rgba(255,255,255,0.08)" transform="rotate(-30,155,130)" />
    </svg>
  );
}

function LangSwitcher({ lang, setLang }) {
  return (
    <div style={{ display: "flex", gap: 3, background: COLORS.bgCard, borderRadius: 8, padding: 3, border: `1px solid ${COLORS.border}` }}>
      {Object.keys(LANGS).map(l => (
        <button key={l} onClick={() => setLang(l)} style={{ background: lang === l ? COLORS.accent : "transparent", color: lang === l ? "#fff" : COLORS.gray, border: "none", borderRadius: 5, padding: "4px 11px", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s", letterSpacing: "0.04em" }}>
          {LANGS[l].label}
        </button>
      ))}
    </div>
  );
}

function Nav({ page, setPage, lang, setLang }) {
  const t = LANGS[lang];
  return (
    <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(15,15,15,0.92)", backdropFilter: "blur(20px)", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", height: 64, direction: t.dir }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => setPage("home")}>
        <span style={{ fontSize: 22 }}>☕</span>
        <span style={{ color: COLORS.white, fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700 }}>Sfalim <span style={{ color: COLORS.accent }}>&</span> More</span>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {["home", "order", "admin"].map(p => (
          <button key={p} onClick={() => setPage(p)} style={{ background: page === p ? COLORS.accentDim : "transparent", border: page === p ? `1px solid ${COLORS.accent}` : "1px solid transparent", color: page === p ? COLORS.accent : COLORS.gray, padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, transition: "all 0.2s" }}>
            {p === "admin" ? `📋 ${t.nav.admin}` : t.nav[p]}
          </button>
        ))}
        <LangSwitcher lang={lang} setLang={setLang} />
      </div>
    </nav>
  );
}

function Hero({ setPage, lang }) {
  const t = LANGS[lang];
  const products = PRODUCTS(t);
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "80px 24px 60px", direction: t.dir, background: `radial-gradient(ellipse at 50% 0%, rgba(255,107,53,0.12) 0%, transparent 60%), ${COLORS.bg}` }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700;1,900&family=DM+Sans:wght@300;400;500&display=swap');
        @keyframes float0{from{transform:translateY(0) rotate(-5deg)}to{transform:translateY(-20px) rotate(5deg)}}
        @keyframes float1{from{transform:translateY(0) rotate(3deg)}to{transform:translateY(-15px) rotate(-3deg)}}
        @keyframes float2{from{transform:translateY(0) rotate(-8deg)}to{transform:translateY(-25px) rotate(8deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(255,107,53,0.4)}50%{box-shadow:0 0 0 12px rgba(255,107,53,0)}}
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#0f0f0f}
        ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:#1a1a1a}::-webkit-scrollbar-thumb{background:#333;border-radius:3px}
        select{background:#1a1a1a;color:#888;border:1px solid #2a2a2a;border-radius:8px;padding:10px 12px;font-family:'DM Sans',sans-serif;font-size:14px;outline:none;cursor:pointer;-webkit-appearance:auto;appearance:auto;transition:border-color 0.2s,color 0.2s}
        select:focus{border-color:#FF6B35;color:#fff} select:hover{border-color:#555;color:#ccc}
        option{background:#1a1a1a;color:#fff}
      `}</style>
      {["👕","☕","✨"].map((e,i)=><span key={i} style={{position:"absolute",fontSize:48,opacity:0.06,top:`${25+i*20}%`,left:i===0?"8%":i===1?"88%":"5%",animation:`float${i} ${3+i}s ease-in-out infinite alternate`,pointerEvents:"none"}}>{e}</span>)}
      <div style={{animation:"fadeUp 0.8s ease forwards",opacity:0}}>
        <div style={{display:"inline-block",background:COLORS.accentDim,border:`1px solid rgba(255,107,53,0.3)`,borderRadius:100,padding:"6px 18px",marginBottom:24,color:COLORS.accent,fontSize:12,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"'DM Sans',sans-serif"}}>{t.hero.badge}</div>
      </div>
      <div style={{animation:"fadeUp 0.8s 0.1s ease forwards",opacity:0}}>
        <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(44px,8vw,90px)",fontWeight:900,lineHeight:1.0,marginBottom:24,letterSpacing:"-2px",color:COLORS.white}}>
          {t.hero.h1line1}<br/><span style={{color:COLORS.accent,fontStyle:"italic"}}>{t.hero.h1line2}</span>
        </h1>
      </div>
      <div style={{animation:"fadeUp 0.8s 0.2s ease forwards",opacity:0}}>
        <p style={{color:COLORS.gray,fontSize:18,maxWidth:480,lineHeight:1.7,marginBottom:40,fontFamily:"'DM Sans',sans-serif",fontWeight:300}}>{t.hero.sub}</p>
      </div>
      <div style={{animation:"fadeUp 0.8s 0.3s ease forwards",opacity:0,display:"flex",gap:16,flexWrap:"wrap",justifyContent:"center"}}>
        <button onClick={()=>setPage("order")} style={{background:COLORS.accent,color:"#fff",border:"none",padding:"16px 36px",borderRadius:8,fontSize:16,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",animation:"pulse 2s 1s infinite",transition:"background 0.2s"}}
          onMouseOver={e=>e.target.style.background=COLORS.accentHover} onMouseOut={e=>e.target.style.background=COLORS.accent}>{t.hero.cta}</button>
        <button style={{background:"transparent",color:COLORS.white,border:`1px solid ${COLORS.border}`,padding:"16px 36px",borderRadius:8,fontSize:16,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>{t.hero.ctaSec}</button>
      </div>
      <div style={{display:"flex",gap:20,marginTop:80,flexWrap:"wrap",justifyContent:"center",animation:"fadeUp 0.8s 0.4s ease forwards",opacity:0}}>
        {products.map(p=>(
          <div key={p.id} onClick={()=>setPage("order")} style={{background:COLORS.bgCard,border:`1px solid ${COLORS.border}`,borderRadius:16,padding:"24px 32px",cursor:"pointer",minWidth:160,transition:"border-color 0.2s,transform 0.2s"}}
            onMouseOver={e=>{e.currentTarget.style.borderColor=COLORS.accent;e.currentTarget.style.transform="translateY(-4px)"}}
            onMouseOut={e=>{e.currentTarget.style.borderColor=COLORS.border;e.currentTarget.style.transform="translateY(0)"}}>
            <div style={{fontSize:36,marginBottom:8}}>{p.emoji}</div>
            <div style={{color:COLORS.white,fontFamily:"'DM Sans',sans-serif",fontWeight:500,fontSize:14}}>{p.name}</div>
            <div style={{color:COLORS.accent,fontFamily:"'DM Sans',sans-serif",fontSize:12,marginTop:4}}>{t.hero.from}{Math.min(...p.variants.map(v=>v.price))}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderPage({ addOrder, lang }) {
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
  const [form, setForm] = useState({ name: "", email: "", phonePrefix: "050", phoneNumber: "", notes: "" });
  const [qty, setQty] = useState(1);
  const fileRef = useRef();

  const product = selectedProduct ? products.find(p => p.id === selectedProduct) : null;
  const variant = selectedVariant ? product?.variants.find(v => v.id === selectedVariant) : null;
  const total = variant ? (variant.price * qty) + SHIPPING_PRICE : 0;

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadedImage(ev.target.result);
      const pa = product.printArea;
      setImagePos({ x: pa.x + pa.w / 2 - 50, y: pa.y + pa.h / 2 - 50, size: 100 });
    };
    reader.readAsDataURL(file);
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    setDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragStart({ mx: e.clientX, my: e.clientY, ix: imagePos.x, iy: imagePos.y, scaleX: 400 / rect.width, scaleY: 400 / rect.height });
  };
  const handleMouseMove = useCallback((e) => {
    if (!dragging || !dragStart) return;
    setImagePos(p => ({ ...p, x: dragStart.ix + (e.clientX - dragStart.mx) * dragStart.scaleX, y: dragStart.iy + (e.clientY - dragStart.my) * dragStart.scaleY }));
  }, [dragging, dragStart]);
  const handleMouseUp = () => setDragging(false);

  const handleSubmit = () => {
    if (!form.name || !form.email) return;
    addOrder({ id: Date.now(), date: new Date().toLocaleString(), product: product.name, variant: variant.label, color: product.colors[selectedColor], qty, total, customer: { ...form, phone: form.phoneNumber ? `${form.phonePrefix}-${form.phoneNumber}` : "" }, image: uploadedImage, status: t.admin.statuses[0], lang });
    setStep(4);
  };

  const inputStyle = { width: "100%", background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "12px 14px", color: COLORS.white, fontFamily: "'DM Sans',sans-serif", fontSize: 14, outline: "none", transition: "border-color 0.2s" };
  const labelStyle = { color: COLORS.gray, fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 8 };

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, paddingTop: 80, fontFamily: "'DM Sans',sans-serif", direction: t.dir }}>
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 24px 60px" }}>
        {/* Progress */}
        <div style={{ display: "flex", marginBottom: 40 }}>
          {t.steps.map((s, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: step >= i + 1 ? COLORS.accent : COLORS.bgCard, border: `2px solid ${step >= i + 1 ? COLORS.accent : COLORS.border}`, color: step >= i + 1 ? "#fff" : COLORS.gray, fontSize: 13, fontWeight: 600, transition: "all 0.3s" }}>{step > i + 1 ? "✓" : i + 1}</div>
              <div style={{ fontSize: 11, color: step === i + 1 ? COLORS.accent : COLORS.gray, marginTop: 6, fontWeight: step === i + 1 ? 600 : 400 }}>{s}</div>
            </div>
          ))}
        </div>

        {/* Step 1: Product */}
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
                    <div>
                      <div style={{ color: COLORS.white, fontWeight: 600, fontSize: 16 }}>{p.name}</div>
                      <div style={{ color: COLORS.gray, fontSize: 13, marginTop: 2 }}>{p.variants.length} {t.product.options} · {t.product.from}{Math.min(...p.variants.map(v => v.price))}</div>
                    </div>
                  </div>
                  {selectedProduct === p.id && <span style={{ color: COLORS.accent, fontSize: 20 }}>✓</span>}
                </div>
              ))}
            </div>
            <button onClick={() => selectedProduct && setStep(2)} disabled={!selectedProduct} style={{ marginTop: 24, width: "100%", background: selectedProduct ? COLORS.accent : COLORS.bgCard, color: selectedProduct ? "#fff" : COLORS.gray, border: "none", borderRadius: 8, padding: "14px", fontSize: 15, fontWeight: 600, cursor: selectedProduct ? "pointer" : "not-allowed", fontFamily: "'DM Sans',sans-serif" }}>
              {t.product.continue}
            </button>
          </div>
        )}

        {/* Step 2: Customize */}
        {step === 2 && product && (
          <div>
            <h2 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 32, marginBottom: 8 }}>{t.customize.title(product.name)}</h2>
            <p style={{ color: COLORS.gray, marginBottom: 24 }}>{t.customize.sub}</p>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 280px" }}>
                <div style={{ background: COLORS.bgCard, borderRadius: 16, border: `1px solid ${COLORS.border}`, padding: 12, position: "relative", cursor: dragging ? "grabbing" : "default", userSelect: "none" }}
                  onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
                  {product.id === "tshirt" && <TShirtMockup color={product.colors[selectedColor]} imageUrl={uploadedImage} imagePos={imagePos} />}
                  {product.id === "mug" && <MugMockup color={product.colors[selectedColor]} imageUrl={uploadedImage} imagePos={imagePos} />}
                  {product.id === "sticker" && <StickerMockup color={product.colors[selectedColor]} imageUrl={uploadedImage} imagePos={imagePos} />}
                  {uploadedImage && <div onMouseDown={handleMouseDown} style={{ position: "absolute", left: `${(imagePos.x / 400) * 100}%`, top: `${(imagePos.y / 400) * 100}%`, width: `${(imagePos.size / 400) * 100}%`, height: `${(imagePos.size / 400) * 100}%`, cursor: "grab", border: "1px dashed rgba(255,107,53,0.5)", borderRadius: 4 }} />}
                </div>
                {uploadedImage && <p style={{ color: COLORS.gray, fontSize: 11, textAlign: "center", marginTop: 6 }}>{t.customize.dragHint}</p>}
              </div>
              <div style={{ flex: "1 1 200px", display: "flex", flexDirection: "column", gap: 18 }}>
                {/* Variants */}
                <div>
                  <label style={labelStyle}>{product.id === "tshirt" ? t.customize.size : t.customize.option}</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {product.variants.map(v => (
                      <button key={v.id} onClick={() => setSelectedVariant(v.id)} style={{ background: selectedVariant === v.id ? COLORS.accent : COLORS.bgCard, border: `1px solid ${selectedVariant === v.id ? COLORS.accent : COLORS.border}`, color: selectedVariant === v.id ? "#fff" : COLORS.white, borderRadius: 6, padding: "8px 12px", cursor: "pointer", fontSize: 12, fontFamily: "'DM Sans',sans-serif", fontWeight: 500, transition: "all 0.15s" }}>{v.label}</button>
                    ))}
                  </div>
                </div>
                {/* Colors */}
                <div>
                  <label style={labelStyle}>{t.customize.color}</label>
                  <div style={{ display: "flex", gap: 10 }}>
                    {product.colors.map((c, i) => <div key={i} onClick={() => setSelectedColor(i)} style={{ width: 30, height: 30, borderRadius: "50%", background: c, cursor: "pointer", border: `3px solid ${selectedColor === i ? COLORS.accent : "transparent"}`, boxShadow: "0 0 0 1px rgba(255,255,255,0.1)", transition: "border-color 0.15s" }} />)}
                  </div>
                </div>
                {/* Upload */}
                <div>
                  <label style={labelStyle}>{t.customize.design}</label>
                  <div onClick={() => fileRef.current.click()} style={{ border: `2px dashed ${uploadedImage ? COLORS.accent : COLORS.border}`, borderRadius: 10, padding: "16px", textAlign: "center", cursor: "pointer", background: uploadedImage ? "rgba(255,107,53,0.05)" : "transparent", transition: "all 0.2s" }}
                    onMouseOver={e => e.currentTarget.style.borderColor = COLORS.accent}
                    onMouseOut={e => e.currentTarget.style.borderColor = uploadedImage ? COLORS.accent : COLORS.border}>
                    {uploadedImage ? <><img src={uploadedImage} style={{ width: 50, height: 50, objectFit: "contain", borderRadius: 6, marginBottom: 6 }} /><div style={{ color: COLORS.accent, fontSize: 12 }}>{t.customize.uploaded}</div><div style={{ color: COLORS.gray, fontSize: 11 }}>{t.customize.changeFile}</div></> : <><div style={{ fontSize: 24, marginBottom: 6 }}>📁</div><div style={{ color: COLORS.white, fontSize: 13 }}>{t.customize.uploadTitle}</div><div style={{ color: COLORS.gray, fontSize: 11, marginTop: 2 }}>{t.customize.uploadSub}</div></>}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileUpload} />
                </div>
                {/* Size slider */}
                {uploadedImage && <div><label style={labelStyle}>{t.customize.designSize}</label><input type="range" min="40" max="220" value={imagePos.size} onChange={e => setImagePos(p => ({ ...p, size: Number(e.target.value) }))} style={{ width: "100%", accentColor: COLORS.accent }} /></div>}
                {/* Price box */}
                {variant && <div style={{ background: COLORS.bgCard, borderRadius: 10, padding: 14, border: `1px solid ${COLORS.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.gray, fontSize: 13, marginBottom: 6 }}><span>{product.name}</span><span>₪{variant.price}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.gray, fontSize: 13, marginBottom: 8 }}><span>{t.customize.shipping}</span><span>₪{SHIPPING_PRICE}</span></div>
                  <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 8, display: "flex", justifyContent: "space-between" }}><span style={{ color: COLORS.white, fontWeight: 600 }}>{t.customize.total}</span><span style={{ color: COLORS.accent, fontWeight: 700, fontSize: 18 }}>₪{variant.price + SHIPPING_PRICE}</span></div>
                </div>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <button onClick={() => setStep(1)} style={{ background: "transparent", color: COLORS.gray, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "12px 20px", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>{t.customize.back}</button>
              <button onClick={() => setStep(3)} style={{ flex: 1, background: COLORS.accent, color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>{t.customize.continue}</button>
            </div>
          </div>
        )}

        {/* Step 3: Form */}
        {step === 3 && (
          <div>
            <h2 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 32, marginBottom: 8 }}>{t.form.title}</h2>
            <p style={{ color: COLORS.gray, marginBottom: 32 }}>{t.form.sub}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div><label style={labelStyle}>{t.form.name}</label><input type="text" placeholder={t.form.namePh} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={inputStyle} onFocus={e => e.target.style.borderColor = COLORS.accent} onBlur={e => e.target.style.borderColor = COLORS.border} /></div>
              <div><label style={labelStyle}>{t.form.email}</label><input type="email" placeholder={t.form.emailPh} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} style={inputStyle} onFocus={e => e.target.style.borderColor = COLORS.accent} onBlur={e => e.target.style.borderColor = COLORS.border} /></div>

              {/* Phone with Israeli prefix */}
              <div>
                <label style={labelStyle}>{t.form.phone}</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, direction: "ltr", marginBottom: 10 }}>
                  {IL_PREFIXES.map(pf => (
                    <button key={pf.value} type="button" onClick={() => setForm(p => ({ ...p, phonePrefix: pf.value }))} style={{ background: form.phonePrefix === pf.value ? "rgba(255,107,53,0.15)" : "#1a1a1a", border: `1px solid ${form.phonePrefix === pf.value ? "#FF6B35" : "#2a2a2a"}`, color: form.phonePrefix === pf.value ? "#FF6B35" : "#888", borderRadius: 6, padding: "10px 12px", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", transition: "all 0.15s", letterSpacing: "0.03em" }}>{pf.value}</button>
                  ))}
                </div>
                <input type="tel" placeholder={t.form.phonePh} value={form.phoneNumber} maxLength={7}
                  onChange={e => setForm(p => ({ ...p, phoneNumber: e.target.value.replace(/\D/g, "") }))}
                  style={{ ...inputStyle }}
                  onFocus={e => e.target.style.borderColor = "#FF6B35"}
                  onBlur={e => e.target.style.borderColor = "#2a2a2a"} />
                {form.phoneNumber.length > 0 && <div style={{ color: "#888", fontSize: 11, marginTop: 6, direction: "ltr" }}>📱 {form.phonePrefix}-{form.phoneNumber}</div>}
              </div>

              <div><label style={labelStyle}>{t.form.notes}</label><textarea placeholder={t.form.notesPh} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} style={{ ...inputStyle, resize: "vertical" }} onFocus={e => e.target.style.borderColor = COLORS.accent} onBlur={e => e.target.style.borderColor = COLORS.border} /></div>

              {/* Qty */}
              <div>
                <label style={labelStyle}>{t.form.qty}</label>
                <div style={{ display: "flex", alignItems: "center", gap: 12, direction: "ltr" }}>
                  <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 36, height: 36, borderRadius: 6, background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, color: COLORS.white, cursor: "pointer", fontSize: 18 }}>−</button>
                  <span style={{ color: COLORS.white, fontSize: 18, fontWeight: 600, minWidth: 30, textAlign: "center" }}>{qty}</span>
                  <button onClick={() => setQty(q => q + 1)} style={{ width: 36, height: 36, borderRadius: 6, background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, color: COLORS.white, cursor: "pointer", fontSize: 18 }}>+</button>
                </div>
              </div>

              {/* Summary */}
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
              <button onClick={() => setStep(2)} style={{ background: "transparent", color: COLORS.gray, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "12px 20px", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>{t.form.back}</button>
              <button onClick={handleSubmit} disabled={!form.name || !form.email} style={{ flex: 1, background: form.name && form.email ? COLORS.accent : COLORS.bgCard, color: form.name && form.email ? "#fff" : COLORS.gray, border: "none", borderRadius: 8, padding: "14px", fontSize: 15, fontWeight: 600, cursor: form.name && form.email ? "pointer" : "not-allowed", fontFamily: "'DM Sans',sans-serif" }}>
                {t.form.place} · ₪{total}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 72, marginBottom: 24 }}>🎉</div>
            <h2 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 40, marginBottom: 16 }}>{t.confirm.title}</h2>
            <p style={{ color: COLORS.gray, fontSize: 16, maxWidth: 400, margin: "0 auto 32px", lineHeight: 1.7 }}>{t.confirm.sub1} {form.name}! {t.confirm.sub2} <span style={{ color: COLORS.accent }}>{form.email}</span></p>
            <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 20, maxWidth: 300, margin: "0 auto 32px", textAlign: "left" }}>
              <div style={{ color: COLORS.gray, fontSize: 13, marginBottom: 6 }}>📦 {product?.name} · {variant?.label}</div>
              <div style={{ color: COLORS.gray, fontSize: 13, marginBottom: 6 }}>📮 {t.form.shipping}: ₪{SHIPPING_PRICE}</div>
              <div style={{ color: COLORS.accent, fontSize: 18, fontWeight: 700 }}>{t.form.total}: ₪{total}</div>
            </div>
            <button onClick={() => { setStep(1); setSelectedProduct(null); setUploadedImage(null); setForm({ name: "", email: "", phonePrefix: "050", phoneNumber: "", notes: "" }); setQty(1); }} style={{ background: COLORS.accent, color: "#fff", border: "none", borderRadius: 8, padding: "14px 32px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>{t.confirm.another}</button>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminPage({ orders, updateOrderStatus, lang }) {
  const t = LANGS[lang];
  const [selected, setSelected] = useState(null);
  const statusColors = ["#FF6B35", "#facc15", "#4ade80"];
  const allStatuses = [...LANGS.he.admin.statuses, ...LANGS.en.admin.statuses, ...LANGS.ru.admin.statuses];
  const getStatusIndex = (order) => { for (let i = 0; i < 3; i++) { if ([LANGS.he.admin.statuses[i], LANGS.en.admin.statuses[i], LANGS.ru.admin.statuses[i]].includes(order.status)) return i; } return 0; };

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, paddingTop: 80, fontFamily: "'DM Sans',sans-serif", direction: t.dir }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
          <div>
            <h2 style={{ color: COLORS.white, fontFamily: "'Playfair Display',serif", fontSize: 36 }}>{t.admin.title}</h2>
            <p style={{ color: COLORS.gray, marginTop: 4 }}>{orders.length} {t.admin.total}</p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {t.admin.statuses.map((s, i) => (
              <div key={s} style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 16px", textAlign: "center" }}>
                <div style={{ color: statusColors[i], fontWeight: 700, fontSize: 20 }}>{orders.filter(o => getStatusIndex(o) === i).length}</div>
                <div style={{ color: COLORS.gray, fontSize: 11 }}>{s}</div>
              </div>
            ))}
          </div>
        </div>

        {orders.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: COLORS.gray }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
            <div style={{ fontSize: 18 }}>{t.admin.empty}</div>
            <div style={{ fontSize: 14, marginTop: 8 }}>{t.admin.emptySub}</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {orders.map(order => {
              const si = getStatusIndex(order);
              return (
                <div key={order.id} onClick={() => setSelected(selected === order.id ? null : order.id)}
                  style={{ background: COLORS.bgCard, border: `1px solid ${selected === order.id ? COLORS.accent : COLORS.border}`, borderRadius: 12, padding: "16px 20px", cursor: "pointer", transition: "border-color 0.2s" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColors[si], boxShadow: `0 0 8px ${statusColors[si]}`, flexShrink: 0 }} />
                      <div>
                        <div style={{ color: COLORS.white, fontWeight: 600 }}>{order.customer.name}</div>
                        <div style={{ color: COLORS.gray, fontSize: 13 }}>{order.product} · {order.variant} · ×{order.qty}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: t.dir === "rtl" ? "left" : "right" }}>
                      <div style={{ color: COLORS.accent, fontWeight: 700 }}>₪{order.total}</div>
                      <div style={{ color: COLORS.gray, fontSize: 12 }}>{order.date}</div>
                    </div>
                  </div>
                  {selected === order.id && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${COLORS.border}` }}>
                      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: COLORS.gray, fontSize: 12, marginBottom: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{t.admin.customer}</div>
                          <div style={{ color: COLORS.white, fontSize: 14, marginBottom: 4 }}>📧 {order.customer.email}</div>
                          {order.customer.phone && <div style={{ color: COLORS.white, fontSize: 14, marginBottom: 4 }}>📱 {order.customer.phone}</div>}
                          {order.customer.notes && <div style={{ color: COLORS.gray, fontSize: 13, marginTop: 8, background: COLORS.bg, padding: "8px 12px", borderRadius: 6 }}>💬 {order.customer.notes}</div>}
                        </div>
                        {order.image && <div><div style={{ color: COLORS.gray, fontSize: 12, marginBottom: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{t.admin.design}</div><img src={order.image} style={{ width: 80, height: 80, objectFit: "contain", borderRadius: 8, background: "#fff", padding: 4 }} /></div>}
                        <div>
                          <div style={{ color: COLORS.gray, fontSize: 12, marginBottom: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{t.admin.status}</div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {t.admin.statuses.map((s, i) => (
                              <button key={s} onClick={e => { e.stopPropagation(); updateOrderStatus(order.id, s); }} style={{ background: si === i ? statusColors[i] : COLORS.bg, border: `1px solid ${si === i ? statusColors[i] : COLORS.border}`, color: si === i ? "#000" : COLORS.gray, borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", transition: "all 0.2s" }}>{s}</button>
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
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState("home");
  const [lang, setLang] = useState("he");
  const [orders, setOrders] = useState([]);
  const addOrder = (order) => setOrders(prev => [order, ...prev]);
  const updateOrderStatus = (id, status) => setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh" }}>
      <Nav page={page} setPage={setPage} lang={lang} setLang={setLang} />
      {page === "home" && <Hero setPage={setPage} lang={lang} />}
      {page === "order" && <OrderPage addOrder={addOrder} lang={lang} />}
      {page === "admin" && <AdminPage orders={orders} updateOrderStatus={updateOrderStatus} lang={lang} />}
    </div>
  );
}
