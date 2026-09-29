(() => {
  "use strict";

  document.documentElement.classList.add("js");

  let theme = "dark";
  try {
    const savedTheme = window.localStorage.getItem("qw-theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      theme = savedTheme;
    }
  } catch {
    theme = "dark";
  }

  document.documentElement.dataset.theme = theme;
})();
