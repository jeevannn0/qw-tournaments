const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let activeTransition = null;

export function transitionUpdate(update) {
  if (reducedMotion.matches || typeof document.startViewTransition !== "function") {
    update();
    return null;
  }

  try {
    activeTransition?.skipTransition?.();
    const transition = document.startViewTransition(update);
    activeTransition = transition;
    Promise.allSettled([
      transition.ready,
      transition.updateCallbackDone,
      transition.finished
    ]).finally(() => {
      if (activeTransition === transition) activeTransition = null;
    });
    return transition;
  } catch {
    update();
    return null;
  }
}

function initializeReveals(root) {
  const items = [...root.querySelectorAll("[data-reveal]")].filter((item) => item.dataset.revealReady !== "true");
  if (!items.length) return;
  items.forEach((item) => { item.dataset.revealReady = "true"; });

  if (reducedMotion.matches || !("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  document.documentElement.classList.add("motion-ready");
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -5%" });

  items.forEach((item, index) => {
    item.style.setProperty("--reveal-order", String(index % 4));
    const bounds = item.getBoundingClientRect();
    if (bounds.top < window.innerHeight * 0.96) {
      window.requestAnimationFrame(() => item.classList.add("is-visible"));
    } else {
      observer.observe(item);
    }
  });
}

function initializeSpotlights(root) {
  if (reducedMotion.matches || !window.matchMedia("(pointer: fine)").matches) return;
  const surfaces = [...root.querySelectorAll("[data-spotlight]")].filter((surface) => surface.dataset.spotlightReady !== "true");
  surfaces.forEach((surface) => {
    surface.dataset.spotlightReady = "true";
    surface.addEventListener("pointermove", (event) => {
      const bounds = surface.getBoundingClientRect();
      surface.style.setProperty("--spot-x", `${event.clientX - bounds.left}px`);
      surface.style.setProperty("--spot-y", `${event.clientY - bounds.top}px`);
    });
  });
}

function initializeParallax(root) {
  if (reducedMotion.matches || !window.matchMedia("(pointer: fine)").matches) return;
  const items = [...root.querySelectorAll("[data-parallax]")].filter((item) => item.dataset.parallaxReady !== "true");
  items.forEach((item) => {
    item.dataset.parallaxReady = "true";
    item.addEventListener("pointermove", (event) => {
      const bounds = item.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * -12;
      const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * -12;
      item.style.setProperty("--parallax-x", `${x.toFixed(2)}px`);
      item.style.setProperty("--parallax-y", `${y.toFixed(2)}px`);
    });
    item.addEventListener("pointerleave", () => {
      item.style.setProperty("--parallax-x", "0px");
      item.style.setProperty("--parallax-y", "0px");
    });
  });
}

export function initializeMotion(root = document) {
  initializeReveals(root);
  initializeSpotlights(root);
  initializeParallax(root);
}
