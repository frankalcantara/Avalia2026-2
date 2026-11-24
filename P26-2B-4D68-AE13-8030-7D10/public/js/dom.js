import { FALLBACK_AVATAR } from "./text.js";

export const byId = (id) => document.getElementById(id);

export function element(tag, { className, text, attrs = {}, on = {} } = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    node.setAttribute(name, value === true ? "" : String(value));
  }
  for (const [type, handler] of Object.entries(on)) node.addEventListener(type, handler);
  node.append(...children);
  return node;
}

export function avatarImage(src, className = "avatar") {
  return element("img", {
    className,
    attrs: { alt: "", loading: "lazy", referrerpolicy: "no-referrer", src: src || FALLBACK_AVATAR },
  });
}

export function emptyState(text, className = "empty-state") {
  return element("div", { className, text });
}

export function setMessage(node, message, success = false) {
  node.textContent = message;
  node.classList.toggle("success", success);
}
