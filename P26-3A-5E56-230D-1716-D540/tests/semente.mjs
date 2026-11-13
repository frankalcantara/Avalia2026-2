// Gera o SQL de semente (usuários, sessões e itens) para o D1 LOCAL. Uso: node tests/semente.mjs > semente.sql
import { createHash } from "node:crypto";
import { ITENS_SEMENTE, USUARIOS } from "./fixtures.mjs";

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const linhas = [];
for (const u of Object.values(USUARIOS)) {
  linhas.push(
    `INSERT INTO usuarios (user_id, username, nome_exibicao, avatar_url) VALUES (${q(u.user_id)}, ${q(u.username)}, ${q(u.nome)}, 'https://cdn.discordapp.com/embed/avatars/0.png');`,
  );
  if (u.token) {
    const hash = createHash("sha256").update(u.token, "utf8").digest("hex");
    const expira = u.expirada ? "datetime('now', '-1 hour')" : "datetime('now', '+1 day')";
    linhas.push(`INSERT INTO sessoes (token_hash, user_id, expira_em) VALUES (${q(hash)}, ${q(u.user_id)}, ${expira});`);
  }
}
for (const [tipo, categoria, titulo, descricao, local, dias, horas, status] of ITENS_SEMENTE) {
  const encerrado = status === "encerrado" ? "datetime('now')" : "NULL";
  linhas.push(
    `INSERT INTO itens (autor_id, tipo, categoria, titulo, descricao, local, data_ocorrencia, status, criado_em, atualizado_em, encerrado_em) VALUES (${q(USUARIOS.S.user_id)}, ${q(tipo)}, ${q(categoria)}, ${q(titulo)}, ${q(descricao)}, ${q(local)}, date('now', '-${dias} days'), ${q(status)}, datetime('now', '-${horas} hours'), datetime('now', '-${horas} hours'), ${encerrado});`,
  );
}
process.stdout.write(linhas.join("\n") + "\n");
