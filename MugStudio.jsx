// ============ MUG STUDIO — custom mug customizer (route #mug-studio) ============
// Extracted from App.jsx into its own module so React.lazy() can code-split it.
// This file (plus the dynamic `import('three')` inside the 3D effect) carries
// ALL the heavy mug-studio code. The main app bundle never loads any of it —
// it's fetched on demand only when a visitor opens #mug-studio.
//
// COLORS is duplicated here (rather than imported from App.jsx) so this module
// has zero non-vendor dependencies and stays a self-contained chunk.
import { useState, useRef, useEffect } from "react";

const COLORS = {
  bg: `#0f0f0f`, bgCard: `#1a1a1a`, border: `#2a2a2a`,
  accent: `#FF6B35`, accentHover: `#ff8255`, accentDim: `rgba(255,107,53,0.15)`,
  white: `#ffffff`, gray: `#888888`, grayLight: `#555555`, success: `#4ade80`,
};

export default function MugStudio({ lang, setPage, onAddToCart }) {
  // Real mug print geometry (mm). Editor canvas IS this print area at 1:1.
  const PRINT_W_MM = 230;      // arc length of the printable front (handle-to-handle)
  const PRINT_H_MM = 102;      // print height on mug — full body height
  const DPI = 300;             // export resolution
  const PRINT_ARC_FRAC = 0.85; // ≈306° print arc; remainder is the handle gap

  const T = ({
    he: {
      title: `עיצוב ספל אישי`,
      subtitle: `העלו עיצוב, מקמו אותו וצפו בספל תלת-ממדי בזמן אמת. אפשר להוסיף כמה עיצובים על אותו ספל.`,
      upload: `העלאת עיצוב`,
      uploadHint: `גררו תמונה לכאן או לחצו על "העלאת עיצוב". PNG / JPG · עדיף 300dpi.`,
      scale: `גודל`,
      rotation: `סיבוב`,
      printArea: `אזור הדפסה (יד אל יד)`,
      preview3d: `תצוגה תלת-ממדית`,
      dragHint: `גרור את הספל לסיבוב`,
      noWebgl: `הדפדפן שלך לא תומך ב-3D — מציג תצוגה שטוחה.`,
      addToCart: `הוסף לסל`,
      download: `הורד קובץ הדפסה (300dpi)`,
      lowDpi: `התמונה ברזולוציה נמוכה — ההדפסה עלולה לצאת מטושטשת`,
      dimensions: `מידות הדפסה`,
      dpiLabel: `רזולוציה אפקטיבית`,
      designs: `עיצובים על הספל`,
      addDesign: `+ עוד עיצוב`,
      remove: `מחק`,
      designN: (n) => `עיצוב ${n}`,
      missingDesign: `העלו עיצוב לפני הוספה לסל`,
      working: `מעבד...`,
    },
    en: {
      title: `Custom Mug Studio`,
      subtitle: `Upload artwork, position it, watch a live 3D mug. You can stack more than one design on the same mug.`,
      upload: `Upload artwork`,
      uploadHint: `Drag an image here or click "Upload artwork". PNG / JPG · 300dpi preferred.`,
      scale: `Size`,
      rotation: `Rotation`,
      printArea: `Print area (handle to handle)`,
      preview3d: `3D preview`,
      dragHint: `Drag the mug to rotate`,
      noWebgl: `Your browser does not support 3D — showing flat preview.`,
      addToCart: `Add to cart`,
      download: `Download print file (300dpi)`,
      lowDpi: `Low resolution — the print may look blurry`,
      dimensions: `Print size`,
      dpiLabel: `Effective DPI`,
      designs: `Designs on the mug`,
      addDesign: `+ Another design`,
      remove: `Remove`,
      designN: (n) => `Design ${n}`,
      missingDesign: `Upload artwork before adding to cart`,
      working: `Working...`,
    },
    ru: {
      title: `Студия дизайна кружки`,
      subtitle: `Загрузите макет, расположите его и смотрите живую 3D-кружку. На одну кружку можно поставить несколько макетов.`,
      upload: `Загрузить макет`,
      uploadHint: `Перетащите изображение сюда или нажмите «Загрузить макет». PNG / JPG · желательно 300dpi.`,
      scale: `Размер`,
      rotation: `Поворот`,
      printArea: `Область печати (от ручки до ручки)`,
      preview3d: `3D предпросмотр`,
      dragHint: `Потяните кружку, чтобы повернуть`,
      noWebgl: `Браузер не поддерживает 3D — показан плоский предпросмотр.`,
      addToCart: `В корзину`,
      download: `Скачать файл печати (300dpi)`,
      lowDpi: `Низкое разрешение — печать может выйти размытой`,
      dimensions: `Размер печати`,
      dpiLabel: `Эффективный DPI`,
      designs: `Дизайны на кружке`,
      addDesign: `+ Ещё дизайн`,
      remove: `Удалить`,
      designN: (n) => `Дизайн ${n}`,
      missingDesign: `Сначала загрузите макет`,
      working: `Обработка...`,
    },
  })[lang] || null;
  const t = T || {
    title: `Mug Studio`, subtitle: ``, upload: `Upload`, uploadHint: ``,
    scale: `Size`, rotation: `Rotation`,
    printArea: `Print area`, preview3d: `3D preview`, dragHint: ``, noWebgl: ``,
    addToCart: `Add to cart`, download: `Download PNG`, lowDpi: ``,
    dimensions: ``, dpiLabel: ``, designs: `Designs`, addDesign: `+ Add`,
    remove: `Remove`, designN: (n) => `Design ${n}`,
    missingDesign: `Upload first`, working: `...`,
  };
  const isRTL = lang === `he`;

  // ===== Capability detection (runs once on mount) =====
  const [supports3D, setSupports3D] = useState(true);
  useEffect(() => {
    if (typeof window === `undefined`) { setSupports3D(false); return; }
    const reduce = window.matchMedia && window.matchMedia(`(prefers-reduced-motion: reduce)`).matches;
    if (reduce) { setSupports3D(false); return; }
    try {
      const c = document.createElement(`canvas`);
      const gl = c.getContext(`webgl`) || c.getContext(`experimental-webgl`);
      setSupports3D(!!gl);
    } catch (_e) {
      setSupports3D(false);
    }
  }, []);

  // ===== Multi-layer state =====
  const [layers, setLayers] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const activeLayer = layers.find((l) => l.id === activeId) || null;
  const [busy, setBusy] = useState(false);

  // ===== DOM refs =====
  const fileInputRef = useRef(null);
  const editorCanvasRef = useRef(null);
  const compositeCanvasRef = useRef(null);
  const flatPreviewRef = useRef(null);
  const threeMountRef = useRef(null);
  const sceneStateRef = useRef(null);

  // ===== Responsive editor width =====
  const [editorPxW, setEditorPxW] = useState(560);
  useEffect(() => {
    const onResize = () => {
      const w = Math.min(560, Math.max(280, (typeof window !== `undefined` ? window.innerWidth : 560) - 48));
      setEditorPxW(w);
    };
    onResize();
    window.addEventListener(`resize`, onResize);
    return () => window.removeEventListener(`resize`, onResize);
  }, []);
  const mmToPx = editorPxW / PRINT_W_MM;
  const editorPxH = Math.round(PRINT_H_MM * mmToPx);

  // ===== Per-layer helpers =====
  const widthMmAt1 = (img) => (img.naturalWidth / DPI) * 25.4;
  const heightMmAt1 = (img) => (img.naturalHeight / DPI) * 25.4;

  const maxScaleFor = (layer) => Math.max(
    PRINT_W_MM / Math.max(widthMmAt1(layer.img), 0.001),
    PRINT_H_MM / Math.max(heightMmAt1(layer.img), 0.001),
  );

  const clampLayerPos = (layer, x, y, s) => {
    const halfW = (widthMmAt1(layer.img) * s) / 2;
    const halfH = (heightMmAt1(layer.img) * s) / 2;
    const minX = halfW <= PRINT_W_MM / 2 ? halfW : PRINT_W_MM - halfW;
    const maxX = halfW <= PRINT_W_MM / 2 ? PRINT_W_MM - halfW : halfW;
    const minY = halfH <= PRINT_H_MM / 2 ? halfH : PRINT_H_MM - halfH;
    const maxY = halfH <= PRINT_H_MM / 2 ? PRINT_H_MM - halfH : halfH;
    return {
      x: Math.max(minX, Math.min(maxX, x)),
      y: Math.max(minY, Math.min(maxY, y)),
    };
  };

  const autoFitScale = (img) => {
    const fitW = (PRINT_W_MM * 0.7) / Math.max(1, widthMmAt1(img));
    const fitH = (PRINT_H_MM * 0.8) / Math.max(1, heightMmAt1(img));
    return Math.max(0.1, Math.min(3, Math.min(fitW, fitH, 1.5)));
  };

  const addLayerFromSrc = (src) => {
    const im = new Image();
    im.onload = () => {
      const newLayer = {
        id: `L${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        src,
        img: im,
        natW: im.naturalWidth,
        natH: im.naturalHeight,
        posMm: { x: PRINT_W_MM / 2, y: PRINT_H_MM / 2 },
        scale: autoFitScale(im),
        rotDeg: 0,
      };
      setLayers((ls) => [...ls, newLayer]);
      setActiveId(newLayer.id);
    };
    im.onerror = () => console.error(`Failed to load uploaded image`);
    im.src = src;
  };

  const onFileSelected = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => addLayerFromSrc(ev.target.result);
    reader.readAsDataURL(f);
    e.target.value = ``;
  };

  const removeLayer = (id) => {
    setLayers((ls) => {
      const next = ls.filter((l) => l.id !== id);
      if (activeId === id) setActiveId(next.length > 0 ? next[next.length - 1].id : null);
      return next;
    });
  };

  const updateActiveLayer = (patch) => {
    setLayers((ls) => ls.map((l) => l.id === activeId ? { ...l, ...patch } : l));
  };

  // ===== Drawing: editor canvas + composite (full circumference) texture =====
  useEffect(() => {
    const ed = editorCanvasRef.current;
    const comp = compositeCanvasRef.current;
    if (!ed || !comp) return;

    ed.width = Math.round(PRINT_W_MM * mmToPx);
    ed.height = Math.round(PRINT_H_MM * mmToPx);
    const ectx = ed.getContext(`2d`);
    ectx.fillStyle = `#ffffff`;
    ectx.fillRect(0, 0, ed.width, ed.height);
    ectx.strokeStyle = `rgba(0,0,0,0.08)`;
    ectx.lineWidth = 1;
    ectx.beginPath();
    ectx.moveTo(ed.width / 2, 0); ectx.lineTo(ed.width / 2, ed.height);
    ectx.moveTo(0, ed.height / 2); ectx.lineTo(ed.width, ed.height / 2);
    ectx.stroke();

    layers.forEach((layer) => {
      const pxW = widthMmAt1(layer.img) * layer.scale * mmToPx;
      const pxH = heightMmAt1(layer.img) * layer.scale * mmToPx;
      ectx.save();
      ectx.translate(layer.posMm.x * mmToPx, layer.posMm.y * mmToPx);
      ectx.rotate((layer.rotDeg * Math.PI) / 180);
      ectx.drawImage(layer.img, -pxW / 2, -pxH / 2, pxW, pxH);
      ectx.restore();
    });

    if (activeLayer) {
      const pxW = widthMmAt1(activeLayer.img) * activeLayer.scale * mmToPx;
      const pxH = heightMmAt1(activeLayer.img) * activeLayer.scale * mmToPx;
      ectx.save();
      ectx.translate(activeLayer.posMm.x * mmToPx, activeLayer.posMm.y * mmToPx);
      ectx.rotate((activeLayer.rotDeg * Math.PI) / 180);
      ectx.strokeStyle = `rgba(255,107,53,0.85)`;
      ectx.lineWidth = 1.5;
      ectx.setLineDash([4, 4]);
      ectx.strokeRect(-pxW / 2, -pxH / 2, pxW, pxH);
      ectx.setLineDash([]);
      ectx.restore();
    }

    ectx.strokeStyle = `#FF6B35`;
    ectx.setLineDash([8, 6]);
    ectx.lineWidth = 2;
    ectx.strokeRect(1, 1, ed.width - 2, ed.height - 2);
    ectx.setLineDash([]);

    const MUG_CIRC_MM = PRINT_W_MM / PRINT_ARC_FRAC;
    const MUG_HEIGHT_MM = 102;
    const SAFETY_MM = 2;
    const texW = 2048;
    const PX_PER_MM = texW / MUG_CIRC_MM;
    const texH = Math.round(MUG_HEIGHT_MM * PX_PER_MM);
    const printPxLeft = Math.round(((MUG_CIRC_MM - PRINT_W_MM) / 2 + SAFETY_MM) * PX_PER_MM);
    const printPxTop = Math.round(((MUG_HEIGHT_MM - PRINT_H_MM) / 2 + SAFETY_MM) * PX_PER_MM);
    const printPxWidth = Math.round((PRINT_W_MM - 2 * SAFETY_MM) * PX_PER_MM);
    const printPxHeight = Math.round((PRINT_H_MM - 2 * SAFETY_MM) * PX_PER_MM);
    comp.width = texW;
    comp.height = texH;
    const cctx = comp.getContext(`2d`);
    cctx.fillStyle = `#ffffff`;
    cctx.fillRect(0, 0, texW, texH);

    cctx.save();
    cctx.beginPath();
    cctx.rect(printPxLeft, printPxTop, printPxWidth, printPxHeight);
    cctx.clip();
    layers.forEach((layer) => {
      const pxW = widthMmAt1(layer.img) * layer.scale * PX_PER_MM;
      const pxH = heightMmAt1(layer.img) * layer.scale * PX_PER_MM;
      const cxPx = printPxLeft + layer.posMm.x * PX_PER_MM;
      const cyPx = printPxTop + layer.posMm.y * PX_PER_MM;
      cctx.save();
      cctx.translate(cxPx, cyPx);
      cctx.rotate((layer.rotDeg * Math.PI) / 180);
      cctx.drawImage(layer.img, -pxW / 2, -pxH / 2, pxW, pxH);
      cctx.restore();
    });
    cctx.restore();

    if (sceneStateRef.current && sceneStateRef.current.texture) {
      sceneStateRef.current.texture.needsUpdate = true;
    }

    if (flatPreviewRef.current && !supports3D) {
      const fp = flatPreviewRef.current;
      fp.width = ed.width;
      fp.height = ed.height;
      const fctx = fp.getContext(`2d`);
      fctx.drawImage(ed, 0, 0);
    }
  }, [layers, activeId, mmToPx, supports3D]);

  // ===== Drag the active layer inside the editor canvas =====
  const dragRef = useRef({ down: false, layerId: null, startPos: null, downX: 0, downY: 0, pxToMm: 1, startScale: 1 });
  const onEditorPointerDown = (e) => {
    if (!activeLayer) return;
    const r = editorCanvasRef.current.getBoundingClientRect();
    dragRef.current = {
      down: true,
      layerId: activeLayer.id,
      startPos: { x: activeLayer.posMm.x, y: activeLayer.posMm.y },
      downX: e.clientX,
      downY: e.clientY,
      pxToMm: PRINT_W_MM / r.width,
      startScale: activeLayer.scale,
    };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_e) {}
  };
  const onEditorPointerMove = (e) => {
    const d = dragRef.current;
    if (!d.down) return;
    const dxMm = (e.clientX - d.downX) * d.pxToMm;
    const dyMm = (e.clientY - d.downY) * d.pxToMm;
    setLayers((ls) => ls.map((l) => {
      if (l.id !== d.layerId) return l;
      const next = clampLayerPos(l, d.startPos.x + dxMm, d.startPos.y + dyMm, d.startScale);
      return { ...l, posMm: next };
    }));
  };
  const onEditorPointerUp = (e) => {
    dragRef.current.down = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_e) {}
  };

  // ===== 3D mug scene (raw three.js — STAYS lazy via dynamic import('three')) =====
  // This dynamic import becomes a SECOND chunk on top of the lazy MugStudio
  // chunk: three.js only ships when the user actually opens #mug-studio AND
  // the browser supports WebGL + has no reduced-motion preference.
  useEffect(() => {
    if (!supports3D) return;
    const mount = threeMountRef.current;
    if (!mount) return;

    let disposed = false;
    let cleanup = null;

    import(`three`).then((THREE) => {
      if (disposed || !mount) return;
      const w = Math.max(200, mount.clientWidth);
      const h = Math.max(200, mount.clientHeight);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(typeof window !== `undefined` ? window.devicePixelRatio : 1, 2));
      renderer.setSize(w, h);
      renderer.setClearColor(0x0f0f0f, 1);
      renderer.domElement.style.display = `block`;
      renderer.domElement.style.touchAction = `none`;
      renderer.domElement.style.cursor = `grab`;
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(32, w / h, 0.01, 100);
      camera.position.set(0, 0.5, 7.5);
      camera.lookAt(0, 0, 0);

      scene.add(new THREE.AmbientLight(0xffffff, 0.75));
      const key = new THREE.DirectionalLight(0xffffff, 0.6);
      key.position.set(3, 4, 5);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xffffff, 0.25);
      fill.position.set(-3, 1, -2);
      scene.add(fill);

      const texture = new THREE.CanvasTexture(compositeCanvasRef.current);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.offset.x = 0.5;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1;
      texture.needsUpdate = true;

      const mugGroup = new THREE.Group();

      const radius = 1.0;
      const height = 2.4;
      const cylGeo = new THREE.CylinderGeometry(radius, radius, height, 96, 1, false);
      const sideMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.45, metalness: 0.05 });
      const capMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.05 });
      const cyl = new THREE.Mesh(cylGeo, [sideMat, capMat, capMat]);
      mugGroup.add(cyl);

      const insideGeo = new THREE.CylinderGeometry(radius * 0.96, radius * 0.96, height * 0.98, 64, 1, true);
      const insideMat = new THREE.MeshStandardMaterial({ color: 0xdcdcdc, roughness: 0.6, side: THREE.BackSide });
      const inside = new THREE.Mesh(insideGeo, insideMat);
      mugGroup.add(inside);
      const wellGeo = new THREE.CircleGeometry(radius * 0.96, 64);
      const wellMat = new THREE.MeshStandardMaterial({ color: 0xc8c8c8, roughness: 0.6 });
      const well = new THREE.Mesh(wellGeo, wellMat);
      well.rotation.x = -Math.PI / 2;
      well.position.y = -height / 2 + 0.02;
      mugGroup.add(well);

      const handleR = 0.55;
      const handleTube = 0.12;
      const handleGeo = new THREE.TorusGeometry(handleR, handleTube, 20, 64, Math.PI);
      const handleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
      const handle = new THREE.Mesh(handleGeo, handleMat);
      handle.rotation.z = Math.PI / 2;
      const handleHolder = new THREE.Group();
      handleHolder.add(handle);
      handleHolder.rotation.y = -Math.PI / 2;
      handleHolder.position.set(0, 0, -radius);
      mugGroup.add(handleHolder);

      let rotationY = 0;
      let targetRotation = 0;
      mugGroup.rotation.y = rotationY;
      scene.add(mugGroup);

      let isDown = false;
      let lastX = 0;
      let lastInteract = Date.now();
      const dom = renderer.domElement;

      const onDown = (e) => {
        isDown = true;
        lastX = e.clientX;
        lastInteract = Date.now();
        dom.style.cursor = `grabbing`;
        try { dom.setPointerCapture(e.pointerId); } catch (_e) {}
      };
      const onMove = (e) => {
        if (!isDown) return;
        const dx = e.clientX - lastX;
        lastX = e.clientX;
        targetRotation += dx * 0.012;
        lastInteract = Date.now();
      };
      const onUp = (e) => {
        if (!isDown) return;
        isDown = false;
        lastInteract = Date.now();
        dom.style.cursor = `grab`;
        try { dom.releasePointerCapture(e.pointerId); } catch (_e) {}
      };
      dom.addEventListener(`pointerdown`, onDown);
      dom.addEventListener(`pointermove`, onMove);
      dom.addEventListener(`pointerup`, onUp);
      dom.addEventListener(`pointercancel`, onUp);
      dom.addEventListener(`pointerleave`, onUp);

      const onResize = () => {
        if (!mount) return;
        const w2 = Math.max(200, mount.clientWidth);
        const h2 = Math.max(200, mount.clientHeight);
        renderer.setSize(w2, h2);
        camera.aspect = w2 / h2;
        camera.updateProjectionMatrix();
      };
      window.addEventListener(`resize`, onResize);

      let animId = 0;
      const tick = () => {
        animId = requestAnimationFrame(tick);
        const idle = Date.now() - lastInteract;
        if (!isDown && idle > 1500) {
          targetRotation += 0.0025;
        }
        rotationY += (targetRotation - rotationY) * 0.12;
        mugGroup.rotation.y = rotationY;
        renderer.render(scene, camera);
      };
      tick();

      sceneStateRef.current = { texture, mugGroup };

      cleanup = () => {
        cancelAnimationFrame(animId);
        window.removeEventListener(`resize`, onResize);
        dom.removeEventListener(`pointerdown`, onDown);
        dom.removeEventListener(`pointermove`, onMove);
        dom.removeEventListener(`pointerup`, onUp);
        dom.removeEventListener(`pointercancel`, onUp);
        dom.removeEventListener(`pointerleave`, onUp);
        if (dom.parentNode) dom.parentNode.removeChild(dom);
        try { renderer.dispose(); } catch (_e) {}
        try { texture.dispose(); } catch (_e) {}
        try { cylGeo.dispose(); sideMat.dispose(); capMat.dispose(); insideGeo.dispose(); insideMat.dispose(); wellGeo.dispose(); wellMat.dispose(); handleGeo.dispose(); handleMat.dispose(); } catch (_e) {}
        sceneStateRef.current = null;
      };
    }).catch((err) => {
      console.error(`Failed to load three.js`, err);
      setSupports3D(false);
    });

    return () => {
      disposed = true;
      if (cleanup) cleanup();
    };
  }, [supports3D]);

  // ===== Bake the print-ready flat PNG (all layers, 300dpi, transparent bg) =====
  const renderPrintPNG = () => new Promise((resolve) => {
    const wPx = Math.round((PRINT_W_MM * DPI) / 25.4);
    const hPx = Math.round((PRINT_H_MM * DPI) / 25.4);
    const out = document.createElement(`canvas`);
    out.width = wPx;
    out.height = hPx;
    const octx = out.getContext(`2d`);
    octx.clearRect(0, 0, wPx, hPx);
    const pxPerMm = wPx / PRINT_W_MM;
    layers.forEach((layer) => {
      const pw = widthMmAt1(layer.img) * layer.scale * pxPerMm;
      const ph = heightMmAt1(layer.img) * layer.scale * pxPerMm;
      const cx = layer.posMm.x * pxPerMm;
      const cy = layer.posMm.y * pxPerMm;
      octx.save();
      octx.translate(cx, cy);
      octx.rotate((layer.rotDeg * Math.PI) / 180);
      octx.drawImage(layer.img, -pw / 2, -ph / 2, pw, ph);
      octx.restore();
    });
    out.toBlob((blob) => {
      if (!blob) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    }, `image/png`);
  });

  const renderMockupPNG = () => {
    const c = compositeCanvasRef.current;
    if (!c) return null;
    try { return c.toDataURL(`image/png`); } catch (_e) { return null; }
  };

  const effectiveDpi = layers.length === 0 ? null : Math.min(...layers.map((l) => {
    const imgWmm = widthMmAt1(l.img) * l.scale;
    return Math.round((l.natW / Math.max(0.1, imgWmm)) * 25.4);
  }));
  const lowDpi = effectiveDpi !== null && effectiveDpi < 150;

  const onDownload = async () => {
    if (layers.length === 0) return;
    const dataUrl = await renderPrintPNG();
    if (!dataUrl) return;
    const a = document.createElement(`a`);
    a.href = dataUrl;
    a.download = `mug-print-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const onAdd = async () => {
    if (layers.length === 0 || !onAddToCart) return;
    setBusy(true);
    try {
      const printPng = await renderPrintPNG();
      const mockupPng = renderMockupPNG();
      onAddToCart({
        printPng,
        mockupPng,
        layers: layers.map((l) => ({
          src: l.src,
          posMm: { x: l.posMm.x, y: l.posMm.y },
          scale: l.scale,
          rotDeg: l.rotDeg,
        })),
        printArea: { width_mm: PRINT_W_MM, height_mm: PRINT_H_MM, dpi: DPI, arc_frac: PRINT_ARC_FRAC },
      });
      setLayers([]);
      setActiveId(null);
      if (fileInputRef.current) fileInputRef.current.value = ``;
    } catch (e) {
      console.error(`Failed to add mug to cart`, e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      minHeight: `100vh`,
      background: COLORS.bg,
      color: COLORS.white,
      direction: isRTL ? `rtl` : `ltr`,
      fontFamily: `'Varela Round', sans-serif`,
      padding: `80px 20px 80px`,
    }}>
      <div style={{ maxWidth: 1180, margin: `0 auto` }}>
        <div style={{ textAlign: `center`, marginBottom: 28 }}>
          <h1 style={{
            fontFamily: `'Playfair Display', serif`,
            fontStyle: `italic`,
            fontWeight: 700,
            fontSize: `clamp(28px, 4vw, 44px)`,
            margin: `0 0 10px`,
            lineHeight: 1.1,
            color: COLORS.white,
            letterSpacing: `-0.01em`,
          }}>{t.title}</h1>
          <p style={{ color: COLORS.gray, margin: `0 auto`, fontSize: 15, maxWidth: 640, lineHeight: 1.55 }}>{t.subtitle}</p>
          <div style={{ display: `flex`, alignItems: `center`, justifyContent: `center`, gap: 10, marginTop: 16 }}>
            <div style={{ width: 40, height: 1, background: COLORS.accent }} />
            <div style={{ width: 6, height: 6, borderRadius: `50%`, background: COLORS.accent }} />
            <div style={{ width: 40, height: 1, background: COLORS.accent }} />
          </div>
        </div>

        <div style={{
          display: `grid`,
          gridTemplateColumns: editorPxW < 520 ? `1fr` : `minmax(0, 1fr) minmax(0, 1fr)`,
          gap: 24, alignItems: `flex-start`,
        }}>
          <div style={{
            background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 18,
          }}>
            <div style={{ fontSize: 13, color: COLORS.gray, marginBottom: 10 }}>
              {`${t.printArea} · ${PRINT_W_MM}×${PRINT_H_MM}mm @ ${DPI}dpi`}
            </div>

            <div style={{ width: editorPxW, maxWidth: `100%`, margin: `0 auto`, position: `relative` }}>
              <canvas
                ref={editorCanvasRef}
                onPointerDown={activeLayer ? onEditorPointerDown : undefined}
                onPointerMove={activeLayer ? onEditorPointerMove : undefined}
                onPointerUp={activeLayer ? onEditorPointerUp : undefined}
                onPointerCancel={activeLayer ? onEditorPointerUp : undefined}
                style={{
                  width: editorPxW,
                  height: editorPxH,
                  display: `block`,
                  background: `#ffffff`,
                  borderRadius: 6,
                  touchAction: `none`,
                  cursor: activeLayer ? `grab` : `default`,
                  boxShadow: `0 6px 24px rgba(0,0,0,0.35)`,
                }}
              />
              {layers.length === 0 && (
                <div style={{
                  position: `absolute`, inset: 0, display: `flex`, alignItems: `center`, justifyContent: `center`,
                  pointerEvents: `none`, color: COLORS.gray, fontSize: 14, textAlign: `center`, padding: 16,
                }}>
                  {t.uploadHint}
                </div>
              )}
            </div>

            <div style={{ display: `flex`, gap: 12, alignItems: `center`, marginTop: 14, flexWrap: `wrap` }}>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" onChange={onFileSelected} style={{ display: `none` }} />
              <button onClick={() => fileInputRef.current && fileInputRef.current.click()} style={{
                background: COLORS.accent, color: `#fff`, border: `none`,
                padding: `10px 16px`, borderRadius: 10, cursor: `pointer`, fontSize: 14, fontWeight: 600,
                fontFamily: `'Varela Round', sans-serif`,
              }}>{t.upload}</button>
              {effectiveDpi !== null && (
                <div style={{ marginInlineStart: `auto`, fontSize: 13, color: lowDpi ? COLORS.accent : COLORS.gray }}>
                  {`${t.dpiLabel}: ${effectiveDpi} dpi`}
                </div>
              )}
            </div>
            {lowDpi && (
              <div style={{
                marginTop: 10, padding: `10px 12px`, borderRadius: 8,
                background: `rgba(255,107,53,0.12)`, color: COLORS.accent, fontSize: 13,
              }}>{`⚠︎ ${t.lowDpi}`}</div>
            )}

            {layers.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 11, color: COLORS.gray, marginBottom: 8, fontWeight: 600, letterSpacing: 0.6, textTransform: `uppercase` }}>{t.designs}</div>
                <div style={{ display: `flex`, gap: 8, flexWrap: `wrap` }}>
                  {layers.map((l, i) => {
                    const isActive = l.id === activeId;
                    return (
                      <div key={l.id} style={{
                        display: `flex`, alignItems: `center`, gap: 6,
                        background: isActive ? `rgba(255,107,53,0.15)` : COLORS.bg,
                        border: `1px solid ${isActive ? COLORS.accent : COLORS.border}`,
                        borderRadius: 8, padding: `6px 8px`,
                      }}>
                        <button onClick={() => setActiveId(l.id)} style={{
                          background: `transparent`, border: `none`, padding: 0, cursor: `pointer`,
                          color: isActive ? COLORS.accent : COLORS.white, fontSize: 13, fontWeight: 600,
                          fontFamily: `'Varela Round', sans-serif`,
                        }}>{t.designN(i + 1)}</button>
                        <button onClick={() => removeLayer(l.id)} title={t.remove} aria-label={t.remove} style={{
                          background: `transparent`, border: `none`, padding: `2px 4px`, cursor: `pointer`,
                          color: COLORS.gray, fontSize: 14, lineHeight: 1,
                        }}>✕</button>
                      </div>
                    );
                  })}
                  <button onClick={() => fileInputRef.current && fileInputRef.current.click()} style={{
                    background: `transparent`, color: COLORS.accent, border: `1px dashed ${COLORS.accent}`,
                    padding: `6px 12px`, borderRadius: 8, cursor: `pointer`, fontSize: 13, fontWeight: 600,
                    fontFamily: `'Varela Round', sans-serif`,
                  }}>{t.addDesign}</button>
                </div>
              </div>
            )}

            {activeLayer && (
              <div style={{ marginTop: 18, display: `grid`, gap: 14 }}>
                <label style={{ display: `block`, fontSize: 13, color: `#cccccc` }}>
                  {`${t.scale}: ${activeLayer.scale.toFixed(2)}×`}
                  <input
                    type="range" min="0.1" max={maxScaleFor(activeLayer)} step="0.01"
                    value={Math.min(activeLayer.scale, maxScaleFor(activeLayer))}
                    onChange={(e) => {
                      const s = Math.min(parseFloat(e.target.value), maxScaleFor(activeLayer));
                      const next = clampLayerPos(activeLayer, activeLayer.posMm.x, activeLayer.posMm.y, s);
                      updateActiveLayer({ scale: s, posMm: next });
                    }}
                    style={{ width: `100%`, marginTop: 6, accentColor: COLORS.accent, direction: `ltr` }}
                  />
                </label>
                <label style={{ display: `block`, fontSize: 13, color: `#cccccc` }}>
                  {`${t.rotation}: ${Math.round(activeLayer.rotDeg)}°`}
                  <input
                    type="range" min="-180" max="180" step="1"
                    value={activeLayer.rotDeg}
                    onChange={(e) => updateActiveLayer({ rotDeg: parseInt(e.target.value, 10) })}
                    style={{ width: `100%`, marginTop: 6, accentColor: COLORS.accent, direction: `ltr` }}
                  />
                </label>
              </div>
            )}

            <div style={{ display: `flex`, gap: 10, marginTop: 18, flexWrap: `wrap` }}>
              <button
                onClick={onAdd}
                disabled={layers.length === 0 || busy}
                style={{
                  flex: `1 1 240px`,
                  background: layers.length === 0 ? COLORS.border : COLORS.accent,
                  color: `#fff`, border: `none`,
                  padding: `14px 18px`, borderRadius: 12,
                  cursor: layers.length === 0 || busy ? `not-allowed` : `pointer`,
                  fontSize: 15, fontWeight: 700,
                  fontFamily: `'Varela Round', sans-serif`,
                  boxShadow: layers.length === 0 ? `none` : `0 6px 18px rgba(255,107,53,0.3)`,
                  transition: `background 0.2s`,
                }}
              >{busy ? t.working : (layers.length === 0 ? t.missingDesign : `${t.addToCart} · ₪59`)}</button>
              <button
                onClick={onDownload}
                disabled={layers.length === 0}
                style={{
                  background: `transparent`,
                  color: layers.length === 0 ? COLORS.grayLight : COLORS.white,
                  border: `1px solid ${COLORS.border}`,
                  padding: `14px 16px`, borderRadius: 12,
                  cursor: layers.length === 0 ? `not-allowed` : `pointer`,
                  fontSize: 13, fontWeight: 600,
                  fontFamily: `'Varela Round', sans-serif`,
                }}
              >{t.download}</button>
            </div>
          </div>

          <div style={{
            background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 18,
          }}>
            <div style={{ fontSize: 13, color: COLORS.gray, marginBottom: 10, display: `flex`, justifyContent: `space-between`, alignItems: `center`, gap: 12, flexWrap: `wrap` }}>
              <span>{t.preview3d}</span>
              {supports3D && layers.length > 0 && <span style={{ fontSize: 12, color: COLORS.accent }}>{t.dragHint}</span>}
            </div>
            <div style={{
              width: `100%`,
              aspectRatio: `1 / 1`,
              background: COLORS.bg,
              borderRadius: 10,
              overflow: `hidden`,
              position: `relative`,
            }}>
              {supports3D ? (
                <div ref={threeMountRef} style={{ width: `100%`, height: `100%` }} />
              ) : (
                <div style={{ width: `100%`, height: `100%`, display: `flex`, flexDirection: `column`, alignItems: `center`, justifyContent: `center`, padding: 20, textAlign: `center` }}>
                  <canvas ref={flatPreviewRef} style={{ maxWidth: `100%`, maxHeight: `80%`, background: `#ffffff`, borderRadius: 6 }} />
                  <div style={{ marginTop: 12, color: COLORS.gray, fontSize: 13 }}>{t.noWebgl}</div>
                </div>
              )}
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: COLORS.grayLight, lineHeight: 1.6 }}>
              {`${t.dimensions}: ${PRINT_W_MM}mm × ${PRINT_H_MM}mm · ${DPI}dpi`}
            </div>
          </div>
        </div>
      </div>

      <canvas ref={compositeCanvasRef} style={{ display: `none` }} />
    </div>
  );
}
