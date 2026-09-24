document.addEventListener("click", function (event) {
  const button = event.target.closest("[data-password-toggle]");
  if (!button) return;

  const field = button.closest(".password-toggle-field");
  const input = field ? field.querySelector("input") : null;
  if (!input) return;

  const shouldShow = input.type === "password";
  input.type = shouldShow ? "text" : "password";
  button.setAttribute("aria-label", shouldShow ? "Ocultar senha" : "Mostrar senha");
  button.classList.toggle("is-showing", shouldShow);
});
