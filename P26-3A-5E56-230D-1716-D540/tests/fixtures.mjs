// Usuários, sessões e itens-semente dos testes de API (só no D1 LOCAL — ver tests/preparar.sh).
// Formato do hash de sessão: functions/_lib/sessao.js (SHA-256 hex minúsculo da string do token).
export const USUARIOS = {
  A: { user_id: "100000000000000001", username: "usuario_a", nome: "Usuária A", token: "tokenDeTesteUsuarioA0001" },
  B: { user_id: "100000000000000002", username: "usuario_b", nome: "Usuário B", token: "tokenDeTesteUsuarioB0002" },
  C: { user_id: "100000000000000003", username: "usuario_c", nome: "Usuário C", token: "tokenDeTesteUsuarioC0003" },
  D: { user_id: "100000000000000004", username: "usuario_d", nome: "Usuário D (limite)", token: "tokenDeTesteUsuarioD0004" },
  E: { user_id: "100000000000000005", username: "usuario_e", nome: "Usuário E (terceiro)", token: "tokenDeTesteUsuarioE0005" },
  F: { user_id: "100000000000000006", username: "usuario_f", nome: "Usuário F (logout)", token: "tokenDeTesteUsuarioF0006" },
  // Sessão EXPIRADA: o servidor deve tratá-la como "sem sessão".
  G: { user_id: "100000000000000007", username: "usuario_g", nome: "Usuário G (expirado)", token: "tokenDeTesteUsuarioG0007", expirada: true },
  // Autor dos itens-semente (sem sessão).
  S: { user_id: "100000000000000008", username: "usuario_semente", nome: "Semente", token: null },
};

// Marcador presente em todos os itens-semente para isolar a busca dos itens criados pelos testes.
export const TAG = "zebrafiltro";

// [tipo, categoria, titulo, descricao, local, dias atrás (data_ocorrencia), horas atrás (criado_em), status]
export const ITENS_SEMENTE = [
  ["perdi", "garrafas", "Garrafa azul térmica", `${TAG} garrafa de alumínio`, "Biblioteca central", 5, 10, "aberto"],
  ["encontrei", "garrafas", "Garrafa azul de plástico", `${TAG} achada perto da cantina`, "Cantina", 3, 9, "aberto"],
  ["perdi", "eletronicos", "Fone azul bluetooth", `${TAG} fone sem fio fonecinza`, "Bloco B", 2, 8, "aberto"],
  ["perdi", "garrafas", "Garrafa verde", `${TAG} squeeze verde`, "Ginásio", 10, 7, "aberto"],
  ["encontrei", "documentos", "Carteira de estudante", `${TAG} carteirinha azul`, "Bloco A", 20, 6, "encerrado"],
  ["perdi", "vestuario", "Casaco 100% lã", `${TAG} casaco_cinza`, "Auditório", 1, 5, "aberto"],
];
