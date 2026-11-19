const recordsList = document.getElementById("recordsList");
const statusMessage = document.getElementById("statusMessage");
const bookForm = document.getElementById("bookForm");

const receivedLoansList = document.getElementById("receivedLoansList");
const myLoansList = document.getElementById("myLoansList");

const trocasSection = document.getElementById("trocasSection");
const trocasRecebidasList = document.getElementById("trocasRecebidasList");
const minhasTrocasList = document.getElementById("minhasTrocasList");

const trocaModal = document.getElementById("trocaModal");
const trocaForm = document.getElementById("trocaForm");
const livroDesejadoTexto = document.getElementById("livroDesejadoTexto");
const livroOfertadoSelect = document.getElementById("livroOfertadoSelect");
const trocaMensagem = document.getElementById("trocaMensagem");
const trocaStatusMessage = document.getElementById("trocaStatusMessage");
const cancelarTrocaBtn = document.getElementById("cancelarTrocaBtn");

let usuarioAtual = null;
let livrosAtuais = [];
let livroAlvoTroca = null;
let logoutButton = null;

const intervalosChat = new Set();

async function sairDaConta() {
  if (!logoutButton) return;

  logoutButton.disabled = true;
  logoutButton.textContent = "Saindo...";

  try {
    const response = await fetch("/api/auth/logout", {
      method: "POST"
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error || data.erro || "Não foi possível sair da conta."
      );
    }

    usuarioAtual = null;
    limparIntervalosChat();

    await atualizarDados();

  } catch (error) {
    alert(error.message || "Ocorreu um erro ao sair da conta.");
  } finally {
    if (logoutButton) {
      logoutButton.disabled = false;
      logoutButton.textContent = "Sair";
    }
  }
}

function configurarBotaoLogout() {
  const profile = document.getElementById("discordProfile");

  if (!profile) return null;

  let botao = document.getElementById("discordLogoutBtn");

  if (!botao) {
    botao = document.createElement("button");
    botao.id = "discordLogoutBtn";
    botao.type = "button";
    botao.className = "btn-secondary";
    botao.textContent = "Sair";

    profile.appendChild(botao);
  }

  botao.onclick = sairDaConta;

  return botao;
}

async function carregarUsuario() {
  const profileText = document.getElementById("discordUserText");
  const loginLink = document.getElementById("discordLoginLink");

  try {
    const response = await fetch("/api/me");
    const data = await response.json();

    if (response.ok && data.ok && data.data) {
      usuarioAtual = data.data;

      if (profileText) {
        profileText.textContent =
          "Discord: " + (usuarioAtual.global_name || usuarioAtual.username);
      }

      if (loginLink) {
        loginLink.href = "#";
        loginLink.onclick = (event) => {
          event.preventDefault();
        };
      }

      logoutButton = configurarBotaoLogout();

      if (logoutButton) {
        logoutButton.hidden = false;
      }

      return true;
    }

    usuarioAtual = null;

    if (profileText) {
      profileText.textContent = "Entrar com Discord OAuth2";
    }

    if (loginLink) {
      loginLink.href = "/api/auth/discord";
      loginLink.onclick = null;
    }

    if (logoutButton) {
      logoutButton.hidden = true;
    }

    return false;

  } catch {
    usuarioAtual = null;

    if (profileText) {
      profileText.textContent = "Não foi possível verificar o login";
    }

    if (logoutButton) {
      logoutButton.hidden = true;
    }

    return false;
  }
}

async function carregarStatus() {
  try {
    const response = await fetch("/api/status");
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error("Falha ao consultar status.");
    }

    return data;
  } catch {
    return null;
  }
}

function criarElemento(tag, texto, classe) {
  const elemento = document.createElement(tag);

  if (texto !== undefined && texto !== null) {
    elemento.textContent = texto;
  }

  if (classe) {
    elemento.className = classe;
  }

  return elemento;
}

function criarBotao(texto, acao, classe = "btn-secondary") {
  const botao = document.createElement("button");

  botao.type = "button";
  botao.textContent = texto;
  botao.className = classe;

  botao.addEventListener("click", async () => {
    botao.disabled = true;

    try {
      await acao();
    } catch (error) {
      alert(error.message || "Ocorreu um erro.");
    } finally {
      botao.disabled = false;
    }
  });

  return botao;
}

function mostrarMensagem(container, mensagem) {
  container.replaceChildren(
    criarElemento("p", mensagem)
  );
}

async function carregarLivros() {
  recordsList.replaceChildren();

  try {
    const response = await fetch("/api/livros");
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || data.erro || "Erro ao carregar catálogo.");
    }

    const livros = data.livros || [];
    livrosAtuais = livros;

    if (!livros.length) {
      recordsList.appendChild(
        criarElemento("li", "Nenhum livro cadastrado ainda.")
      );
      return;
    }

    livros.forEach((livro) => {
      const li = document.createElement("li");

      const titulo = criarElemento("strong", livro.titulo);

      const detalhes = criarElemento(
        "p",
        "Autor: " + livro.autor +
        " | Categoria: " + livro.categoria +
        " | Modalidade: " + livro.modalidade
      );

      const dono = criarElemento(
        "p",
        "Disponibilizado por: " +
        (livro.dono_global_name || livro.dono_username || "Usuário")
      );

      const status = criarElemento("p", "Status: " + livro.status);

      li.append(titulo, detalhes, dono, status);

      const ehMeuLivro =
        usuarioAtual && livro.dono_id === usuarioAtual.user_id;

      const disponivel = livro.status === "Disponível";

      const podeSolicitarEmprestimo =
        usuarioAtual &&
        !ehMeuLivro &&
        disponivel &&
        ["Emprestar", "Ambos"].includes(livro.modalidade);

      const podeProporTroca =
        usuarioAtual &&
        !ehMeuLivro &&
        disponivel &&
        ["Trocar", "Ambos"].includes(livro.modalidade);

      if (podeSolicitarEmprestimo) {
        const mensagem = document.createElement("textarea");
        mensagem.className = "input-text";
        mensagem.placeholder = "Mensagem opcional para o dono do livro";
        mensagem.maxLength = 500;
        mensagem.rows = 2;

        const botao = criarBotao(
          "Solicitar empréstimo",
          async () => {
            await enviarSolicitacao(livro.id, mensagem.value);
            await atualizarDados();
          },
          "btn-primary"
        );

        li.append(mensagem, botao);
      }

      if (podeProporTroca) {
        const botaoTroca = criarBotao(
          "Propor troca",
          async () => {
            abrirModalTroca(livro);
          },
          "btn-secondary"
        );

        li.appendChild(botaoTroca);
      }

      if (!usuarioAtual) {
        li.appendChild(
          criarElemento(
            "p",
            "Entre com Discord para solicitar empréstimos ou propor trocas."
          )
        );
      }

      recordsList.appendChild(li);
    });
  } catch (error) {
    recordsList.appendChild(
      criarElemento("li", error.message)
    );
  }
}

// Retorna o dia seguinte no horário local do navegador.
// A devolução precisa estar marcada para uma data futura.
function obterDataLocalHoje() {
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);

  const ano = amanha.getFullYear();
  const mes = String(amanha.getMonth() + 1).padStart(2, "0");
  const dia = String(amanha.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function formatarDataPrevista(data) {
  if (!data) return "";

  const [ano, mes, dia] = data.split("-");

  if (!ano || !mes || !dia) {
    return data;
  }

  return `${dia}/${mes}/${ano}`;
}

async function enviarSolicitacao(livroId, mensagem) {
  const response = await fetch("/api/emprestimos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      livro_id: livroId,
      mensagem: mensagem.trim()
    })
  });

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(
      data.error || data.erro || "Não foi possível enviar a solicitação."
    );
  }

  alert(data.message || "Solicitação enviada com sucesso!");
}

async function executarAcaoEmprestimo(
  id,
  acao,
  dataPrevistaDevolucao = null
) {
  const corpo = { acao };

  if (acao === "aprovar") {
    corpo.data_prevista_devolucao = dataPrevistaDevolucao;
  }

  const response = await fetch(`/api/emprestimos/${id}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(corpo)
  });

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(
      data.erro || data.error || "Não foi possível executar a ação."
    );
  }

  alert(data.mensagem || data.message || "Operação realizada com sucesso.");

  await atualizarDados();
}

function limparIntervalosChat() {
  for (const intervalo of intervalosChat) {
    clearInterval(intervalo);
  }

  intervalosChat.clear();
}

function formatarDataMensagem(data) {
  if (!data) return "";

  const dataConvertida = new Date(
    data.includes("T") ? data : data.replace(" ", "T") + "Z"
  );

  if (Number.isNaN(dataConvertida.getTime())) {
    return data;
  }

  return dataConvertida.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function criarChat(card, item) {
  const chat = criarElemento("section", null, "chat-container");
  chat.hidden = true;

  const titulo = criarElemento("h4", "Conversa da solicitação");
  const mensagens = criarElemento("div", null, "chat-messages");
  mensagens.setAttribute("aria-live", "polite");

  const aviso = criarElemento("p", "", "chat-error");

  const formulario = document.createElement("form");
  formulario.className = "chat-form";

  const campo = document.createElement("textarea");
  campo.placeholder = "Escreva sua mensagem...";
  campo.maxLength = 1000;
  campo.rows = 2;
  campo.required = true;

  const podeEnviar = ["Pendente", "Aprovado"].includes(item.status);

  const enviar = document.createElement("button");
  enviar.type = "submit";
  enviar.className = "btn-primary";
  enviar.textContent = "Enviar";
  enviar.disabled = !podeEnviar;

  if (!podeEnviar) {
    campo.disabled = true;
    campo.placeholder = "Esta conversa está encerrada.";
  }

  formulario.append(campo, enviar);
  chat.append(titulo, mensagens);

  if (podeEnviar) {
    chat.appendChild(formulario);
  } else {
    chat.appendChild(
      criarElemento(
        "p",
        "Esta solicitação foi encerrada. Você pode consultar o histórico, mas não enviar novas mensagens."
      )
    );
  }

  chat.appendChild(aviso);

  const elementosChat = {
    mensagens,
    aviso,
    campo,
    enviar
  };

  let intervaloAtual = null;

  const botaoAbrir = criarBotao(
    "Abrir conversa",
    async () => {
      chat.hidden = !chat.hidden;

      if (!chat.hidden) {
        await carregarMensagensChat(item.id, elementosChat);

        if (!intervaloAtual) {
          intervaloAtual = setInterval(() => {
            if (!chat.hidden) {
              carregarMensagensChat(item.id, elementosChat);
            }
          }, 5000);

          intervalosChat.add(intervaloAtual);
        }

        botaoAbrir.textContent = "Fechar conversa";
      } else {
        if (intervaloAtual) {
          clearInterval(intervaloAtual);
          intervalosChat.delete(intervaloAtual);
          intervaloAtual = null;
        }

        botaoAbrir.textContent = "Abrir conversa";
      }
    },
    "btn-secondary"
  );

  formulario.addEventListener("submit", async (event) => {
    event.preventDefault();

    const conteudo = campo.value.trim();

    if (!conteudo) return;

    enviar.disabled = true;
    aviso.textContent = "";

    try {
      const response = await fetch("/api/mensagens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          emprestimo_id: item.id,
          conteudo
        })
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.erro || data.error || "Não foi possível enviar a mensagem."
        );
      }

      campo.value = "";

      await carregarMensagensChat(item.id, elementosChat);
    } catch (error) {
      aviso.textContent = error.message;
    } finally {
      enviar.disabled = false;
    }
  });

  card.append(botaoAbrir, chat);
}

async function carregarMensagensChat(emprestimoId, elementos) {
  if (elementos.carregando) return;

  elementos.carregando = true;

  try {
    const response = await fetch(
      `/api/mensagens?emprestimo_id=${encodeURIComponent(emprestimoId)}`
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.erro || data.error || "Erro ao carregar conversa.");
    }

    elementos.aviso.textContent = "";

    const mensagens = data.mensagens || [];

    const estavaNoFinal =
      elementos.mensagens.scrollHeight -
      elementos.mensagens.scrollTop -
      elementos.mensagens.clientHeight < 50;

    elementos.mensagens.replaceChildren();

    if (!mensagens.length) {
      elementos.mensagens.appendChild(
        criarElemento(
          "p",
          "Nenhuma mensagem ainda. Comece a conversa!",
          "chat-empty"
        )
      );
    }

    mensagens.forEach((mensagem) => {
      const minhaMensagem =
        usuarioAtual &&
        mensagem.remetente_id === usuarioAtual.user_id;

      const bolha = criarElemento(
        "div",
        null,
        "chat-message " + (minhaMensagem ? "mine" : "other")
      );

      const nome = minhaMensagem
        ? "Você"
        : (mensagem.global_name || mensagem.username || "Usuário");

      const autor = criarElemento("strong", nome);
      const conteudo = criarElemento("p", mensagem.conteudo);
      const horario = criarElemento(
        "time",
        formatarDataMensagem(mensagem.criada_em)
      );

      bolha.append(autor, conteudo, horario);
      elementos.mensagens.appendChild(bolha);
    });

    if (estavaNoFinal || mensagens.length <= 1) {
      elementos.mensagens.scrollTop =
        elementos.mensagens.scrollHeight;
    }

  } catch (error) {
    elementos.aviso.textContent = error.message;
  } finally {
    elementos.carregando = false;
  }
}

async function carregarEmprestimos() {
  limparIntervalosChat();

  receivedLoansList.replaceChildren();
  myLoansList.replaceChildren();

  if (!usuarioAtual) {
    mostrarMensagem(
      receivedLoansList,
      "Entre com Discord para visualizar as solicitações recebidas."
    );

    mostrarMensagem(
      myLoansList,
      "Entre com Discord para visualizar seus empréstimos."
    );

    return;
  }

  try {
    const response = await fetch("/api/emprestimos");
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || data.erro || "Erro ao carregar empréstimos.");
    }

    const emprestimos = data.emprestimos || [];

    const recebidos = emprestimos.filter(
      (item) => item.dono_id === usuarioAtual.user_id
    );

    const solicitados = emprestimos.filter(
      (item) => item.solicitante_id === usuarioAtual.user_id
    );

    renderizarRecebidos(recebidos);
    renderizarMeusEmprestimos(solicitados);

  } catch (error) {
    mostrarMensagem(receivedLoansList, error.message);
    mostrarMensagem(myLoansList, error.message);
  }
}

function renderizarRecebidos(emprestimos) {
  receivedLoansList.replaceChildren();

  if (!emprestimos.length) {
    mostrarMensagem(
      receivedLoansList,
      "Você ainda não recebeu solicitações de empréstimo."
    );
    return;
  }

  emprestimos.forEach((item) => {
    const card = criarElemento("article", null, "loan-card");

    card.appendChild(criarElemento("h3", item.titulo));
    card.appendChild(criarElemento("p", "Autor: " + item.autor));

    card.appendChild(
      criarElemento(
        "p",
        "Solicitante: " +
        (item.solicitante_global_name || item.solicitante_username)
      )
    );

    card.appendChild(criarElemento("p", "Status: " + item.status));

    if (item.mensagem) {
      card.appendChild(
        criarElemento("p", "Mensagem inicial: " + item.mensagem)
      );
    }

    // O dono escolhe a data prevista antes de aprovar.
    if (item.status === "Pendente") {
      const rotuloData = document.createElement("label");
      rotuloData.textContent = "Data prevista para devolução:";
      rotuloData.htmlFor = `data-devolucao-${item.id}`;

      const campoData = document.createElement("input");
      campoData.type = "date";
      campoData.id = `data-devolucao-${item.id}`;
      campoData.min = obterDataLocalHoje();
      campoData.required = true;
      campoData.className = "input-text";

      card.appendChild(rotuloData);
      card.appendChild(campoData);

      card.appendChild(
        criarBotao(
          "Aprovar",
          async () => {
            if (!campoData.value) {
              campoData.focus();
              throw new Error("Escolha a data prevista para devolução.");
            }

            if (campoData.value < obterDataLocalHoje()) {
              campoData.focus();
              throw new Error("A data de devolução precisa ser futura.");
            }

            await executarAcaoEmprestimo(
              item.id,
              "aprovar",
              campoData.value
            );
          },
          "btn-primary"
        )
      );

      card.appendChild(
        criarBotao(
          "Recusar",
          () => executarAcaoEmprestimo(item.id, "recusar"),
          "btn-danger"
        )
      );
    }

    // O dono também consegue consultar o prazo depois da aprovação.
    if (item.status === "Aprovado" && item.data_prevista_devolucao) {
      card.appendChild(
        criarElemento(
          "p",
          "Devolução prevista para: " +
          formatarDataPrevista(item.data_prevista_devolucao)
        )
      );
    }

    if (item.status === "Aprovado" && item.devolucao_solicitada_em) {
      card.appendChild(
        criarElemento(
          "p",
          "O solicitante pediu a devolução. Confirme quando receber o livro."
        )
      );

      card.appendChild(
        criarBotao(
          "Confirmar devolução",
          () => executarAcaoEmprestimo(item.id, "confirmar_devolucao"),
          "btn-primary"
        )
      );
    }

    criarChat(card, item);
    receivedLoansList.appendChild(card);
  });
}

function renderizarMeusEmprestimos(emprestimos) {
  myLoansList.replaceChildren();

  if (!emprestimos.length) {
    mostrarMensagem(
      myLoansList,
      "Você ainda não solicitou nenhum empréstimo."
    );
    return;
  }

  emprestimos.forEach((item) => {
    const card = criarElemento("article", null, "loan-card");

    card.appendChild(criarElemento("h3", item.titulo));
    card.appendChild(criarElemento("p", "Autor: " + item.autor));

    card.appendChild(
      criarElemento(
        "p",
        "Dono: " + (item.dono_global_name || item.dono_username)
      )
    );

    card.appendChild(criarElemento("p", "Status: " + item.status));

    if (item.status === "Pendente") {
      card.appendChild(
        criarElemento("p", "Aguardando aprovação do dono do livro.")
      );
    }

    if (item.status === "Aprovado") {
      // O solicitante consegue consultar a data escolhida pelo dono.
      if (item.data_prevista_devolucao) {
        card.appendChild(
          criarElemento(
            "p",
            "Devolução prevista para: " +
            formatarDataPrevista(item.data_prevista_devolucao)
          )
        );
      }

      if (item.devolucao_solicitada_em) {
        card.appendChild(
          criarElemento(
            "p",
            "Devolução solicitada. Aguardando confirmação do dono."
          )
        );
      } else {
        card.appendChild(
          criarBotao(
            "Solicitar devolução",
            () => executarAcaoEmprestimo(item.id, "solicitar_devolucao"),
            "btn-primary"
          )
        );
      }
    }

    if (item.status === "Recusado") {
      card.appendChild(
        criarElemento("p", "O dono recusou esta solicitação.")
      );
    }

    if (item.status === "Devolvido") {
      card.appendChild(
        criarElemento("p", "Livro devolvido.")
      );
    }

    criarChat(card, item);
    myLoansList.appendChild(card);
  });
}

function abrirModalTroca(livro) {
  if (!usuarioAtual) {
    alert("Entre com Discord para propor uma troca.");
    return;
  }

  livroAlvoTroca = livro;

  livroDesejadoTexto.textContent =
    "Livro que você deseja: " + livro.titulo +
    " — " + livro.autor;

  livroOfertadoSelect.replaceChildren();

  const opcaoInicial = document.createElement("option");
  opcaoInicial.value = "";
  opcaoInicial.textContent = "Selecione um livro";
  livroOfertadoSelect.appendChild(opcaoInicial);

  const meusLivros = livrosAtuais.filter((item) =>
    item.dono_id === usuarioAtual.user_id &&
    item.id !== livro.id &&
    item.status === "Disponível" &&
    ["Trocar", "Ambos"].includes(item.modalidade)
  );

  if (!meusLivros.length) {
    const opcao = document.createElement("option");
    opcao.value = "";
    opcao.textContent = "Você não possui livros disponíveis para troca";
    livroOfertadoSelect.appendChild(opcao);
    livroOfertadoSelect.disabled = true;
  } else {
    livroOfertadoSelect.disabled = false;

    meusLivros.forEach((meuLivro) => {
      const opcao = document.createElement("option");
      opcao.value = meuLivro.id;
      opcao.textContent =
        meuLivro.titulo + " — " + meuLivro.autor;

      livroOfertadoSelect.appendChild(opcao);
    });
  }

  trocaMensagem.value = "";
  trocaStatusMessage.textContent = "";
  trocaModal.hidden = false;
  trocaModal.scrollIntoView({ behavior: "smooth", block: "center" });
}

function fecharModalTroca() {
  trocaModal.hidden = true;
  trocaForm.reset();
  livroAlvoTroca = null;
  livroOfertadoSelect.disabled = false;
  trocaStatusMessage.textContent = "";
}

cancelarTrocaBtn?.addEventListener("click", fecharModalTroca);

trocaForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!usuarioAtual || !livroAlvoTroca) {
    trocaStatusMessage.textContent =
      "Não foi possível identificar a proposta. Atualize a página.";
    return;
  }

  const livroOfertadoId = Number(livroOfertadoSelect.value);

  if (!Number.isInteger(livroOfertadoId) || livroOfertadoId <= 0) {
    trocaStatusMessage.textContent =
      "Selecione um livro seu para oferecer.";
    return;
  }

  const botaoEnviar = trocaForm.querySelector('button[type="submit"]');
  botaoEnviar.disabled = true;
  trocaStatusMessage.textContent = "Enviando proposta...";

  try {
    const response = await fetch("/api/trocas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        livro_alvo_id: livroAlvoTroca.id,
        livro_ofertado_id: livroOfertadoId,
        mensagem: trocaMensagem.value.trim()
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.erro || data.error || "Não foi possível enviar a proposta."
      );
    }

    alert(data.mensagem || "Proposta de troca enviada!");

    fecharModalTroca();
    await atualizarDados();

  } catch (error) {
    trocaStatusMessage.textContent = error.message;
  } finally {
    botaoEnviar.disabled = false;
  }
});

async function executarAcaoTroca(id, acao) {
  const response = await fetch(`/api/trocas/${id}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ acao })
  });

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(
      data.erro || data.error || "Não foi possível executar a ação."
    );
  }

  alert(data.mensagem || "Operação realizada com sucesso.");

  await atualizarDados();
}

async function carregarTrocas() {
  if (!trocasSection) return;

  if (!usuarioAtual) {
    trocasSection.hidden = true;
    return;
  }

  trocasSection.hidden = false;

  mostrarMensagem(trocasRecebidasList, "Carregando propostas...");
  mostrarMensagem(minhasTrocasList, "Carregando propostas...");

  try {
    const response = await fetch("/api/trocas");
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.erro || data.error || "Não foi possível carregar as trocas."
      );
    }

    const trocas = data.trocas || [];

    const recebidas = trocas.filter(
      (item) => item.dono_alvo_id === usuarioAtual.user_id
    );

    const enviadas = trocas.filter(
      (item) => item.proponente_id === usuarioAtual.user_id
    );

    renderizarTrocasRecebidas(recebidas);
    renderizarMinhasTrocas(enviadas);

  } catch (error) {
    mostrarMensagem(trocasRecebidasList, error.message);
    mostrarMensagem(minhasTrocasList, error.message);
  }
}


function criarCardTroca(item, recebida) {
  const card = criarElemento("article", null, "loan-card");

  const titulo = recebida
    ? "Proposta recebida"
    : "Proposta enviada";

  card.appendChild(criarElemento("h3", titulo));

  card.appendChild(
    criarElemento(
      "p",
      "Livro desejado: " +
      item.titulo_alvo + " — " + item.autor_alvo
    )
  );

  card.appendChild(
    criarElemento(
      "p",
      "Livro oferecido: " +
      item.titulo_ofertado + " — " + item.autor_ofertado
    )
  );

  const nomeOutraPessoa = recebida
    ? (item.proponente_global_name || item.proponente_username)
    : (item.dono_global_name || item.dono_username);

  card.appendChild(
    criarElemento(
      "p",
      (recebida ? "Proponente: " : "Dono do livro: ") +
      (nomeOutraPessoa || "Usuário")
    )
  );

  card.appendChild(
    criarElemento("p", "Status: " + item.status)
  );

  if (item.mensagem) {
    card.appendChild(
      criarElemento("p", "Mensagem: " + item.mensagem)
    );
  }

  // Botões para quem recebeu a proposta
  if (recebida && item.status === "Pendente") {
    card.appendChild(
      criarBotao(
        "Aceitar proposta",
        () => executarAcaoTroca(item.id, "aceitar"),
        "btn-primary"
      )
    );

    card.appendChild(
      criarBotao(
        "Recusar proposta",
        () => executarAcaoTroca(item.id, "recusar"),
        "btn-danger"
      )
    );
  }

  // Botão para quem enviou a proposta
  if (!recebida && item.status === "Pendente") {
    card.appendChild(
      criarBotao(
        "Cancelar proposta",
        async () => {
          const confirmar = confirm(
            "Tem certeza de que deseja cancelar esta proposta?"
          );

          if (!confirmar) return;

          await executarAcaoTroca(item.id, "cancelar");
        },
        "btn-danger"
      )
    );
  }

  if (item.status === "Aceita") {
    const minhaConfirmacao = recebida
      ? item.confirmada_dono_em
      : item.confirmada_proponente_em;

    const outraConfirmacao = recebida
      ? item.confirmada_proponente_em
      : item.confirmada_dono_em;

    card.appendChild(
      criarElemento(
        "p",
        minhaConfirmacao
          ? "Você já confirmou a conclusão."
          : "Aguardando sua confirmação de conclusão."
      )
    );

    card.appendChild(
      criarElemento(
        "p",
        outraConfirmacao
          ? "A outra pessoa já confirmou."
          : "Aguardando confirmação da outra pessoa."
      )
    );

    if (!minhaConfirmacao) {
      card.appendChild(
        criarBotao(
          "Confirmar conclusão da troca",
          () => executarAcaoTroca(item.id, "confirmar_conclusao"),
          "btn-primary"
        )
      );
    }
  }

  if (item.status === "Concluida") {
    card.appendChild(
      criarElemento(
        "p",
        "Troca concluída! Os livros foram transferidos."
      )
    );
  }

  if (item.status === "Recusada") {
    card.appendChild(
      criarElemento("p", "Esta proposta foi recusada.")
    );
  }

  if (item.status === "Cancelada") {
    card.appendChild(
      criarElemento("p", "Esta proposta foi cancelada.")
    );
  }

  return card;
}

function renderizarTrocasRecebidas(trocas) {
  trocasRecebidasList.replaceChildren();

  if (!trocas.length) {
    mostrarMensagem(
      trocasRecebidasList,
      "Você ainda não recebeu propostas de troca."
    );
    return;
  }

  trocas.forEach((item) => {
    trocasRecebidasList.appendChild(
      criarCardTroca(item, true)
    );
  });
}

function renderizarMinhasTrocas(trocas) {
  minhasTrocasList.replaceChildren();

  if (!trocas.length) {
    mostrarMensagem(
      minhasTrocasList,
      "Você ainda não enviou propostas de troca."
    );
    return;
  }

  trocas.forEach((item) => {
    minhasTrocasList.appendChild(
      criarCardTroca(item, false)
    );
  });
}

async function atualizarDados() {
  await carregarUsuario();

  await Promise.all([
    carregarLivros(),
    carregarEmprestimos(),
    carregarTrocas()
  ]);
}

bookForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const autenticado = await carregarUsuario();

  if (!autenticado) {
    statusMessage.textContent =
      "Faça login com Discord antes de cadastrar um livro.";
    return;
  }

  const titulo = document.getElementById("bookTitle").value.trim();
  const autor = document.getElementById("bookAuthor").value.trim();
  const categoria = document.getElementById("bookCategory").value;
  const modalidade = document.getElementById("bookModality").value;

  statusMessage.textContent = "Cadastrando livro...";

  const sendButton = document.getElementById("sendBtn");
  sendButton.disabled = true;

  try {
    const response = await fetch("/api/livros", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        titulo,
        autor,
        categoria,
        modalidade
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error || data.erro || "Não foi possível cadastrar o livro."
      );
    }

    bookForm.reset();
    statusMessage.textContent = "✓ Livro cadastrado com sucesso!";

    await atualizarDados();

  } catch (error) {
    statusMessage.textContent = error.message;
  } finally {
    sendButton.disabled = false;
  }
});

async function iniciarPagina() {
  await carregarUsuario();

  await Promise.all([
    carregarStatus(),
    carregarLivros(),
    carregarEmprestimos(),
    carregarTrocas()
  ]);
}


function mostrarPagina(nomePagina) {
  const paineis = document.querySelectorAll("[data-page-panel]");
  const botoes = document.querySelectorAll("[data-page]");

  const painelSelecionado = document.querySelector(
    `[data-page-panel="${nomePagina}"]`
  );

  if (!painelSelecionado) return;

  paineis.forEach((painel) => {
    painel.hidden = painel !== painelSelecionado;
  });

  botoes.forEach((botao) => {
    const ativo = botao.dataset.page === nomePagina;

    botao.classList.toggle("active", ativo);

    if (ativo) {
      botao.setAttribute("aria-current", "page");
    } else {
      botao.removeAttribute("aria-current");
    }
  });
}

document.querySelectorAll("[data-page], [data-go-page]")
  .forEach((botao) => {
    botao.addEventListener("click", () => {
      const pagina =
        botao.dataset.page || botao.dataset.goPage;

      mostrarPagina(pagina);
    });
  });

mostrarPagina("inicio");

iniciarPagina();
