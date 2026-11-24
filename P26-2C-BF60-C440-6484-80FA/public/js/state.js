// Estado mínimo compartilhado entre os módulos + barramento de eventos.
const bus = new EventTarget();

export const state = {
  user: null,          // UserPublic | null (de /api/me)
  userKnown: false,    // true depois da primeira resposta de /api/me
  catalogDirty: false, // recarregar catálogo ao voltar para #catalogo
};

export function setUser(user) {
  state.user = user || null;
  state.userKnown = true;
  emit('user');
}

export function isMe(user) {
  return !!(state.user && user && user.user_id === state.user.user_id);
}

export function on(name, fn) { bus.addEventListener(name, fn); }
export function emit(name) { bus.dispatchEvent(new Event(name)); }
