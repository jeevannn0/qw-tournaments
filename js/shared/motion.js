const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = window.matchMedia("(pointer: fine)");
let activeTransition = null;

export function preferredScrollBehavior() {
  return reducedMotion.matches ? "auto" : "smooth";
}

export function transitionUpdate(update) {
  if (reducedMotion.matches || typeof document.startViewTransition !== "function") {
    update();
    return null;
  }

  try {
    activeTransition?.skipTransition?.();
    const transition = document.startViewTransition(update);
    activeTransition = transition;
    Promise.allSettled([transition.ready, transition.updateCallbackDone, transition.finished]).finally(() => {
      if (activeTransition === transition) activeTransition = null;
    });
    return transition;
  } catch {
    update();
    return null;
  }
}

function initializeParallax(root) {
  if (reducedMotion.matches || !finePointer.matches) return;
  root.querySelectorAll("[data-parallax]").forEach((surface) => {
    if (surface.dataset.parallaxReady === "true") return;
    surface.dataset.parallaxReady = "true";
    let frame = 0;

    const update = (event) => {
      const bounds = surface.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 8;
      const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 5;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        surface.style.setProperty("--aim-x", `${x.toFixed(2)}px`);
        surface.style.setProperty("--aim-y", `${y.toFixed(2)}px`);
      });
    };

    const reset = () => {
      window.cancelAnimationFrame(frame);
      surface.style.setProperty("--aim-x", "0px");
      surface.style.setProperty("--aim-y", "0px");
    };

    surface.addEventListener("pointermove", update, { passive: true });
    surface.addEventListener("pointerleave", reset);
  });
}

function initializeImageFallbacks(root) {
  root.querySelectorAll("img").forEach((image) => {
    if (image.dataset.fallbackReady === "true") return;
    image.dataset.fallbackReady = "true";
    image.addEventListener("error", () => {
      image.classList.add("image-unavailable");
      image.removeAttribute("src");
      image.alt = image.alt || "Artwork unavailable";
    }, { once: true });
  });
}

export function initializeMotion(root = document) {
  root.querySelectorAll("[data-reveal]").forEach((item) => item.classList.add("is-visible"));
  initializeImageFallbacks(root);
  initializeParallax(root);
}
