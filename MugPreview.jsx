// ============ MUG PREVIEW — read-only 3D mug for admin ============
// Reconstructs the customer-arranged mug from the order's baked print PNG
// (orders.design_url). Drag-to-rotate works; no editing controls. Lazy-
// loaded by App.jsx via React.lazy so it (and its dynamic `import('three')`)
// stay off the main bundle.
//
// Why a single texture works for multi-design orders: the order's design_url
// is the 300dpi composite already produced by the studio with EVERY layer
// (Part C) baked at exact position/scale/rotation. Placing it 1:1 inside the
// composite's print region therefore reproduces the customer's arrangement
// pixel-for-pixel — no per-layer compositing needed here.
import { useState, useRef, useEffect } from "react";

export default function MugPreview({ printDesignUrl, printArea, height = 260 }) {
  // Defaults match MugStudio's print geometry so old orders without an
  // explicit printArea still reconstruct correctly.
  const PRINT_W_MM = (printArea && Number(printArea.width_mm)) || 230;
  const PRINT_H_MM = (printArea && Number(printArea.height_mm)) || 102;
  const PRINT_ARC_FRAC = (printArea && Number(printArea.arc_frac)) || 0.85;

  const [supports3D, setSupports3D] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const compositeCanvasRef = useRef(null);
  const threeMountRef = useRef(null);
  const sceneStateRef = useRef(null);

  // Capability detection — same gate as the studio.
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

  // Build the full-mug-surface composite once the design image loads.
  useEffect(() => {
    const comp = compositeCanvasRef.current;
    if (!comp) return;

    // Print-area mapping matches the studio (no SAFETY pull-in) so admin's
    // 3D reconstruction reproduces the customer's arrangement at the exact
    // same fraction-of-print-area as the studio + export.
    const MUG_CIRC_MM = PRINT_W_MM / PRINT_ARC_FRAC;
    const MUG_HEIGHT_MM = 102;
    const texW = 2048;
    const PX_PER_MM = texW / MUG_CIRC_MM;
    const texH = Math.round(MUG_HEIGHT_MM * PX_PER_MM);
    const printPxLeft = Math.round(((MUG_CIRC_MM - PRINT_W_MM) / 2) * PX_PER_MM);
    const printPxTop = Math.round(((MUG_HEIGHT_MM - PRINT_H_MM) / 2) * PX_PER_MM);
    const printPxWidth = Math.round(PRINT_W_MM * PX_PER_MM);
    const printPxHeight = Math.round(PRINT_H_MM * PX_PER_MM);

    comp.width = texW;
    comp.height = texH;
    const ctx = comp.getContext(`2d`);
    ctx.fillStyle = `#ffffff`;
    ctx.fillRect(0, 0, texW, texH);

    if (!printDesignUrl) return;

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = `anonymous`; // Supabase public bucket allows cross-origin reads.
    img.onload = () => {
      if (cancelled) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(printPxLeft, printPxTop, printPxWidth, printPxHeight);
      ctx.clip();
      ctx.drawImage(img, printPxLeft, printPxTop, printPxWidth, printPxHeight);
      ctx.restore();
      if (sceneStateRef.current && sceneStateRef.current.texture) {
        sceneStateRef.current.texture.needsUpdate = true;
      }
    };
    img.onerror = () => { if (!cancelled) setLoadError(true); };
    img.src = printDesignUrl;
    return () => { cancelled = true; };
  }, [printDesignUrl, PRINT_W_MM, PRINT_H_MM, PRINT_ARC_FRAC]);

  // 3D scene — identical setup to MugStudio's read-only side, minus the
  // editor / pointer drag for layers. Drag-to-rotate the mug itself stays.
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
      const heightU = 2.4;
      const cylGeo = new THREE.CylinderGeometry(radius, radius, heightU, 96, 1, false);
      const sideMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.45, metalness: 0.05 });
      const capMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.05 });
      const cyl = new THREE.Mesh(cylGeo, [sideMat, capMat, capMat]);
      mugGroup.add(cyl);

      const insideGeo = new THREE.CylinderGeometry(radius * 0.96, radius * 0.96, heightU * 0.98, 64, 1, true);
      const insideMat = new THREE.MeshStandardMaterial({ color: 0xdcdcdc, roughness: 0.6, side: THREE.BackSide });
      const inside = new THREE.Mesh(insideGeo, insideMat);
      mugGroup.add(inside);
      const wellGeo = new THREE.CircleGeometry(radius * 0.96, 64);
      const wellMat = new THREE.MeshStandardMaterial({ color: 0xc8c8c8, roughness: 0.6 });
      const well = new THREE.Mesh(wellGeo, wellMat);
      well.rotation.x = -Math.PI / 2;
      well.position.y = -heightU / 2 + 0.02;
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
      const onDown = (e) => { isDown = true; lastX = e.clientX; lastInteract = Date.now(); dom.style.cursor = `grabbing`; try { dom.setPointerCapture(e.pointerId); } catch (_e) {} };
      const onMove = (e) => { if (!isDown) return; const dx = e.clientX - lastX; lastX = e.clientX; targetRotation += dx * 0.012; lastInteract = Date.now(); };
      const onUp = (e) => { if (!isDown) return; isDown = false; lastInteract = Date.now(); dom.style.cursor = `grab`; try { dom.releasePointerCapture(e.pointerId); } catch (_e) {} };
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
        if (!isDown && idle > 1500) { targetRotation += 0.0025; }
        rotationY += (targetRotation - rotationY) * 0.12;
        mugGroup.rotation.y = rotationY;
        renderer.render(scene, camera);
      };
      tick();

      sceneStateRef.current = { texture, mugGroup };
      // The composite may have been drawn before the texture existed (image
      // already cached). Force a refresh so it picks up the current pixels.
      texture.needsUpdate = true;

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

  if (!supports3D) {
    // No WebGL / reduced motion → fall back to the flat composite shown as an image.
    return (
      <div style={{ width: `100%`, height, background: `#0f0f0f`, borderRadius: 8, display: `flex`, alignItems: `center`, justifyContent: `center`, color: `#888`, fontSize: 11 }}>
        {printDesignUrl
          ? <img src={printDesignUrl} alt="design" crossOrigin="anonymous" style={{ maxWidth: `100%`, maxHeight: `100%`, objectFit: `contain` }} />
          : `no design`}
      </div>
    );
  }

  return (
    <div style={{ width: `100%`, height, background: `#0f0f0f`, borderRadius: 8, overflow: `hidden`, position: `relative` }}>
      <div ref={threeMountRef} style={{ width: `100%`, height: `100%` }} />
      <canvas ref={compositeCanvasRef} style={{ display: `none` }} />
      {loadError && (
        <div style={{ position: `absolute`, top: 8, left: 8, color: `#FF6B35`, fontSize: 11, background: `rgba(0,0,0,0.7)`, padding: `4px 8px`, borderRadius: 4 }}>
          image load error
        </div>
      )}
    </div>
  );
}
