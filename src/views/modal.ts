/**
 * Custom modal dialogs replacing window.prompt/confirm/alert.
 * iOS standalone (home-screen installed) web apps have historically had
 * unreliable support for native browser dialogs, so this app never depends
 * on them.
 */
function overlay(): { back: HTMLDivElement; box: HTMLDivElement } {
  const back = document.createElement("div");
  back.className = "modal-backdrop";
  const box = document.createElement("div");
  box.className = "modal-box";
  back.appendChild(box);
  document.body.appendChild(back);
  return { back, box };
}

export function showPrompt(message: string, defaultValue = ""): Promise<string | null> {
  return new Promise((resolve) => {
    const { back, box } = overlay();
    const label = document.createElement("p");
    label.textContent = message;
    const input = document.createElement("input");
    input.type = "text";
    input.value = defaultValue;
    input.className = "modal-input";
    const actions = document.createElement("div");
    actions.className = "modal-actions";
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Vazgeç";
    const okBtn = document.createElement("button");
    okBtn.textContent = "Tamam";
    okBtn.className = "modal-primary";

    const close = (value: string | null) => {
      back.remove();
      resolve(value);
    };
    cancelBtn.addEventListener("click", () => close(null));
    okBtn.addEventListener("click", () => close(input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") close(input.value);
      if (e.key === "Escape") close(null);
    });

    actions.append(cancelBtn, okBtn);
    box.append(label, input, actions);
    document.body.appendChild(back);
    input.focus();
    input.select();
  });
}

export function showConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const { back, box } = overlay();
    const label = document.createElement("p");
    label.textContent = message;
    const actions = document.createElement("div");
    actions.className = "modal-actions";
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Vazgeç";
    const okBtn = document.createElement("button");
    okBtn.textContent = "Evet, Sil";
    okBtn.className = "modal-danger";

    const close = (value: boolean) => {
      back.remove();
      resolve(value);
    };
    cancelBtn.addEventListener("click", () => close(false));
    okBtn.addEventListener("click", () => close(true));

    actions.append(cancelBtn, okBtn);
    box.append(label, actions);
  });
}

export function showAlert(message: string): Promise<void> {
  return new Promise((resolve) => {
    const { back, box } = overlay();
    const label = document.createElement("p");
    label.textContent = message;
    const actions = document.createElement("div");
    actions.className = "modal-actions";
    const okBtn = document.createElement("button");
    okBtn.textContent = "Tamam";
    okBtn.className = "modal-primary";
    okBtn.addEventListener("click", () => {
      back.remove();
      resolve();
    });
    actions.append(okBtn);
    box.append(label, actions);
    okBtn.focus();
  });
}
