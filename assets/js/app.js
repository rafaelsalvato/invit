/* InvIT — application without external dependencies. All operational data stays in the browser. */
(() => {
  "use strict";
  const M = window.InvITModel;
  const KEY = "invit.workspace.v1";
  const app = document.getElementById("app");
  const modal = document.getElementById("modal");
  const paths = window.InvITData.icons;
  const icon = (name) =>
    `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.file}</svg>`;
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (ch) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[ch],
    );
  const money = (n) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format((n || 0) / 100);
  const number = (n) => new Intl.NumberFormat("pt-BR").format(n);
  const date = (s) =>
    s
      ? new Intl.DateTimeFormat("pt-BR", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        })
          .format(M.parseDate(s))
          .replace(/ de /g, " ")
      : "—";
  const typeIcon = (a) =>
    a.type === "Servidor"
      ? "server"
      : a.type === "Desktop"
        ? "desktop"
        : "laptop";
  const guid = () =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const initialState = window.InvITData.initialState;
  const seedAsset = window.InvITData.seedAsset;
  let storageWorking = true;
  let bootMessage = "";
  function validateState(raw) {
    if (
      !raw ||
      raw.schemaVersion !== 1 ||
      !Array.isArray(raw.assets) ||
      raw.assets.length > 10000
    )
      throw new Error("Arquivo de backup incompatível.");
    M.parseDate(raw.referenceDate);
    const assets = raw.assets.map(M.normalizeAsset);
    if (new Set(assets.map((a) => a.id.toLowerCase())).size !== assets.length)
      throw new Error("O backup contém códigos de equipamentos duplicados.");
    const documents = Array.isArray(raw.documents)
      ? raw.documents
          .slice(0, 3000)
          .filter(
            (d) => d && typeof d.id === "string" && typeof d.text === "string",
          )
          .map((d) => ({
            id: d.id.slice(0, 80),
            assetId: String(d.assetId || "").slice(0, 32),
            kind: String(d.kind || "Análise").slice(0, 60),
            createdAt: String(d.createdAt || "").slice(0, 40),
            status: ["draft", "sent", "signed"].includes(d.status)
              ? d.status
              : "draft",
            text: d.text.slice(0, 30000),
          }))
      : [];
    const log = Array.isArray(raw.log)
      ? raw.log
          .slice(0, 1000)
          .filter((l) => l && typeof l.text === "string")
          .map((l) => ({
            at: String(l.at || "").slice(0, 40),
            text: l.text.slice(0, 300),
          }))
      : [];
    return {
      schemaVersion: 1,
      referenceDate: raw.referenceDate,
      assets,
      documents,
      log,
    };
  }
  function readState() {
    try {
      const stored = localStorage.getItem(KEY);
      return stored ? validateState(JSON.parse(stored)) : initialState();
    } catch (error) {
      bootMessage =
        "Não foi possível ler os dados locais. A base demonstrativa foi aberta; o arquivo anterior não foi sobrescrito.";
      storageWorking = false;
      return initialState();
    }
  }
  let state = readState();
  let view = "dashboard",
    selectedId =
      state.assets.find((a) => a.status === "idle")?.id ||
      state.assets[0]?.id ||
      "";
  let draft = null,
    search = "",
    filterStatus = "all",
    filterType = "all";
  const labels = {
    dashboard: "Visão geral",
    assets: "Contratos e ativos",
    simulator: "Simulador",
    documents: "Documentos",
    method: "Como calculamos",
  };
  let toastTimer;
  function toast(message) {
    const t = document.getElementById("toast");
    t.textContent = message;
    t.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("visible"), 4200);
  }
  function save(message) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      storageWorking = true;
      if (message) toast(message);
    } catch (error) {
      storageWorking = false;
      toast(
        "Os dados estão nesta sessão. Exporte um backup para preservá-los.",
      );
    }
  }
  function log(text) {
    state.log.unshift({ at: new Date().toISOString(), text });
    state.log = state.log.slice(0, 1000);
  }
  const assetById = (id) => state.assets.find((a) => a.id === id);
  const resultFor = (a) => M.assetEvaluation(a, state.referenceDate);
  const activeAssets = () =>
    state.assets.filter((a) => a.status !== "returned");
  const idleAssets = () =>
    state.assets.filter(
      (a) =>
        a.status === "idle" &&
        !M.contractInfo(a.startDate, state.referenceDate).future &&
        !M.contractInfo(a.startDate, state.referenceDate).expired,
    );
  const recommendations = {
    keep: ["Manter", "green"],
    transfer: ["Realocar", "blue"],
    return: ["Devolver", "red"],
    tie: ["Custos iguais", "amber"],
    expired: ["Contrato vencido", "amber"],
    "in-use": ["Em uso", "gray"],
    returned: ["Devolvido", "gray"],
    future: ["Contrato futuro", "gray"],
  };
  function badge(decision) {
    const [text, color] = recommendations[decision] || recommendations.tie;
    return `<span class="badge ${color}"><i class="status-dot"></i>${text}</span>`;
  }
  function assetLabel(a) {
    return `<div class="asset-label"><span class="device">${icon(typeIcon(a))}</span><div><strong>${esc(a.id)}</strong><small>${esc(a.model || a.type)}</small></div></div>`;
  }
  function btn(text, action, cls = "", ic = "") {
    return `<button type="button" class="btn ${cls}" data-action="${action}">${ic ? icon(ic) : ""}${text}</button>`;
  }
  function footer() {
    return `<footer class="footer-note"><span>InvIT · Grupo 1 / SI202 · Protótipo com dados simulados</span><button class="link-button" data-go="method">Modelo ${M.MODEL_VERSION} · premissas e limites ${icon("arrow")}</button></footer>`;
  }
  function shell() {
    app.innerHTML = `<div class="overlay" id="nav-overlay"></div><aside class="sidebar" id="sidebar">
      <a class="brand" href="#" data-go="dashboard" aria-label="InvIT, visão geral"><div class="brand-mark">iV</div><div class="brand-info"><div class="brand-name">Inv<span>IT</span></div><div class="brand-sub">Decisões de locação</div></div></a>
      <div class="nav-label">Espaço de trabalho</div><nav class="nav" aria-label="Principal">${[
        ["dashboard", "dashboard"],
        ["assets", "laptop"],
        ["simulator", "calculator"],
        ["documents", "file"],
      ]
        .map(
          ([v, i]) =>
            `<button class="nav-button ${view === v ? "active" : ""}" data-go="${v}" ${view === v ? 'aria-current="page"' : ""} title="${labels[v]}">${icon(i)}<span>${labels[v]}</span></button>`,
        )
        .join("")}</nav>
      <div class="sidebar-footer"><nav class="nav" aria-label="Apoio"><button class="nav-button ${view === "method" ? "active" : ""}" data-go="method" title="Como calculamos">${icon("book")}<span>Como calculamos</span></button><button class="nav-button" data-action="backup" title="Exportar backup">${icon("download")}<span>Exportar backup</span></button></nav>
      <div class="storage-status"><i class="status-dot"></i><span>${storageWorking ? "Dados salvos neste navegador." : "Armazenamento local indisponível."}<br>Exporte para levar ao grupo.</span></div><div class="sidebar-project"><span class="avatar">G1</span><div class="project-name"><div style="font-size:11px">Projeto Quinelato</div><small>FT / Unicamp</small></div></div></div></aside>
      <div class="workspace"><header class="topbar"><div class="breadcrumb"><button class="mobile-toggle" data-action="toggle-nav" aria-label="Abrir navegação">${icon("menu")}</button><span class="breadcrumb-label">Quinelato</span><span class="breadcrumb-label">/</span><b>${labels[view]}</b></div><div class="top-actions"><span class="base-pill">BASE DEMONSTRATIVA</span><label class="reference"><span>Referência</span><input type="date" id="reference-date" aria-label="Data de referência da análise" value="${state.referenceDate}"></label><span class="avatar" style="background:#e8eeee;color:#668278">G1</span></div></header><main id="main" tabindex="-1"></main></div>`;
    document.title = `${labels[view]} — InvIT`;
    const main = document.getElementById("main");
    if (view === "dashboard") main.innerHTML = dashboard();
    else if (view === "assets") main.innerHTML = assetsPage();
    else if (view === "simulator") main.innerHTML = simulatorPage();
    else if (view === "documents") main.innerHTML = documentsPage();
    else main.innerHTML = methodPage();
    main.insertAdjacentHTML("beforeend", footer());
    if (view === "simulator") bindSimulator();
  }
  function navigate(next, id) {
    if (id) selectedId = id;
    if (!labels[next]) return;
    view = next;
    draft = null;
    shell();
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function dashboard() {
    const idle = idleAssets();
    const results = idle.map((a) => ({ a, r: resultFor(a) }));
    const reduction = results.reduce((s, x) => s + x.r.keepSaving, 0);
    const currentCost = idle.reduce((s, a) => s + a.monthlyCents, 0);
    const transfers = results.filter((x) => x.r.decision === "transfer").length;
    const focus =
      results.find((x) => x.a.id === selectedId) ||
      results.find((x) => x.r.decision === "keep") ||
      results[0];
    const expiring = activeAssets()
      .filter((a) => !resultFor(a).contract.future)
      .sort((a, b) =>
        resultFor(a).contract.end.localeCompare(resultFor(b).contract.end),
      )
      .slice(0, 3);
    return `<section class="page-heading"><div><h1>Visão geral</h1><p>O equipamento ficou sem uso. Qual é a melhor decisão agora?</p></div><div class="actions">${btn("Exportar análise", "export-csv", "", "download")}${btn("Novo contrato", "new-asset", "primary", "plus")}</div></section>
      <section class="metric-grid" aria-label="Indicadores"><div class="metric"><div class="metric-top">Contratos em acompanhamento<span class="metric-icon">${icon("laptop")}</span></div><div class="metric-value">${number(activeAssets().length)}</div><div class="metric-sub">Notebooks, desktops e servidores</div></div>
      <div class="metric"><div class="metric-top">Equipamentos ociosos<span class="metric-icon">${icon("clock")}</span></div><div class="metric-value">${idle.length.toString().padStart(2, "0")}</div><div class="metric-sub">${transfers ? `${transfers} com realocação imediata` : "Aguardando a próxima utilização"}</div></div>
      <div class="metric"><div class="metric-top">Mensalidade dos ociosos<span class="metric-icon">${icon("coins")}</span></div><div class="metric-value">${money(currentCost)}</div><div class="metric-sub">Custo mensal dos contratos sem uso</div></div>
      <div class="metric highlight" title="Soma das reduções de custo dos cenários recomendados de devolução, comparados a manter os equipamentos. Depende das premissas de cada ativo."><div class="metric-top">Redução potencial de custo<span class="metric-icon">${icon("trend")}</span></div><div class="metric-value">${money(reduction)}</div><div class="metric-sub">Nos cenários, em relação a manter</div></div></section>
      <div class="dashboard-grid"><section class="card"><div class="card-header"><div><h2>Fila de decisões <span class="count">${idle.length}</span></h2><p>Recomendações condicionadas à previsão de uso.</p></div><button class="link-button" data-go="assets">Ver todos ${icon("arrow")}</button></div><div class="table-scroll"><table><thead><tr><th>Equipamento</th><th>Contrato</th><th>Recomendação</th><th></th></tr></thead><tbody>${
        results
          .slice(0, 5)
          .map(
            ({ a, r }) =>
              `<tr class="clickable" data-sim="${esc(a.id)}"><td>${assetLabel(a)}</td><td><b class="mono">${r.r} meses</b><div class="muted small">${money(a.monthlyCents)}/mês</div></td><td>${badge(r.decision)}</td><td><button class="icon-btn" data-sim="${esc(a.id)}" aria-label="Analisar ${esc(a.id)}">${icon("chevron")}</button></td></tr>`,
          )
          .join("") ||
        '<tr><td colspan="4"><div class="empty-state">Nenhum equipamento ocioso para analisar.</div></td></tr>'
      }</tbody></table></div><div class="table-footer"><span>Referência: ${date(state.referenceDate)}</span><span>Multa: 30% do saldo</span></div></section>
      ${focus ? spotlight(focus.a, focus.r) : `<section class="card card-pad spotlight"><h2>Comece por um equipamento</h2><p class="note">Cadastre um contrato ou marque um equipamento como ocioso.</p>${btn("Cadastrar contrato", "new-asset", "primary section-gap", "plus")}</section>`}</div>
      <div class="lower-grid"><section class="card card-pad"><h2>Vencimentos no radar</h2>${
        expiring
          .map((a) => {
            const r = resultFor(a);
            return `<div class="timeline-row"><div><b>${esc(a.id)}</b> <small>· ${esc(a.department)}</small><div class="timeline-track"><div class="timeline-fill" style="width:${Math.min(100, ((12 - r.r) / 12) * 100)}%"></div></div></div><div class="text-right"><b>${date(r.contract.end)}</b><br><small>${r.r ? "Faltam " + r.r + " meses" : "Contrato vencido"}</small></div></div>`;
          })
          .join("") || '<p class="note">Nenhum contrato cadastrado.</p>'
      }</section>
      <section class="card card-pad"><h2>Decisão com contexto</h2><div class="callout section-gap">${icon("shield")}<div><b>O custo vem acompanhado da regra.</b><br>A comparação inclui multas e eventual nova locação para atender à mesma demanda.</div></div><p class="note">Uma previsão pode mudar. Simule prazos e durações diferentes antes de formalizar a decisão.</p><button class="link-button section-gap" data-go="method">Entender o modelo ${icon("arrow")}</button></section></div>`;
  }
  function reason(a, r) {
    if (r.decision === "expired")
      return "O contrato atingiu o vencimento. Não há multa de rescisão antecipada neste modelo.";
    if (r.decision === "returned")
      return "Este equipamento foi registrado como devolvido. A simulação não altera seu contrato.";
    if (r.decision === "future")
      return "O contrato ainda não começou na data de referência. Confirme a data antes de decidir.";
    if (r.decision === "in-use")
      return "O equipamento está em uso. A recomendação de destinação se aplica quando ele ficar ocioso.";
    if (r.decision === "tie")
      return "As duas políticas têm o mesmo custo calculado. Considere a necessidade operacional para decidir.";
    if (!r.hasForecast)
      return "Sem reutilização prevista no período, devolver evita as mensalidades restantes, pagando a multa de 30% do saldo.";
    if (!r.compatible)
      return "O equipamento não atende à demanda indicada. A retenção não substitui a nova locação neste cenário.";
    if (!r.servedByCurrent)
      return "A demanda prevista não é coberta pelo contrato atual. Manter o equipamento adiciona custo sem reaproveitamento.";
    if (r.decision === "transfer")
      return "Há demanda compatível imediata. Reaproveitar o contrato atual é a política de menor custo neste cenário.";
    if (r.decision === "keep")
      return `A realocação em ${r.d} ${r.d === 1 ? "mês" : "meses"} permite aproveitar ${r.servedByCurrent} ${r.servedByCurrent === 1 ? "mês" : "meses"} do contrato atual com menor custo total.`;
    return "A multa atual e a locação substituta custam menos do que esperar e reaproveitar o equipamento, sob as premissas informadas.";
  }
  function compareMini(r) {
    const max = Math.max(r.keep.total, r.giveBack.total, 1);
    return `<div class="compare-mini">${[
      ["Manter", r.keep.total],
      ["Devolver", r.giveBack.total],
    ]
      .map(
        ([l, n]) =>
          `<div class="compare-mini-row"><span>${l}</span><div class="mini-bar-track"><div class="mini-bar ${n === Math.min(r.keep.total, r.giveBack.total) ? "best" : ""}" style="width:${Math.max(2, (n / max) * 100)}%"></div></div><b>${money(n)}</b></div>`,
      )
      .join("")}</div>`;
  }
  function spotlight(a, r) {
    return `<section class="card card-pad spotlight"><div class="eyebrow">Contrato em foco</div><div class="spotlight-header"><div><h2>${esc(a.id)}</h2><p class="spotlight-code">${esc(a.department)} · ${r.r} meses restantes</p></div><span class="device">${icon(typeIcon(a))}</span></div><div class="recommend-title ${r.decision === "return" ? "red" : ""}">${recommendations[r.decision][0]}${r.decision === "keep" ? " para realocar" : ""}</div><p class="recommend-description">${reason(a, r)}</p><div class="saving"><div><small>Diferença entre os cenários</small><br><strong>${money(r.saving)}</strong></div>${icon("trend")}</div>${compareMini(r)}<button class="btn primary full-width" data-sim="${esc(a.id)}">Explorar simulação ${icon("arrow")}</button><p class="note">${r.mode === "until-end" ? "Uso previsto até o fim do contrato atual." : "Uso por duração personalizada."} Multas de novas locações incluídas.</p></section>`;
  }
  function filteredAssets() {
    const q = search.trim().toLocaleLowerCase("pt-BR");
    return state.assets.filter(
      (a) =>
        (!q ||
          [a.id, a.model, a.department, a.responsible]
            .join(" ")
            .toLocaleLowerCase("pt-BR")
            .includes(q)) &&
        (filterStatus === "all" || a.status === filterStatus) &&
        (filterType === "all" || a.type === filterType),
    );
  }
  function assetsRows() {
    const assets = filteredAssets();
    return (
      assets
        .map((a) => {
          const r = resultFor(a);
          return `<tr><td>${assetLabel(a)}</td><td>${esc(a.department || "Não informado")}<div class="muted small">${esc(a.responsible || "Responsável não informado")}</div></td><td><b class="mono">${money(a.monthlyCents)}</b><div class="muted small">por mês</div></td><td>${date(r.contract.end)}<div class="muted small">${r.contract.future ? "Ainda não iniciado" : r.r + " meses a vencer"}</div></td><td>${badge(r.decision)}</td><td><div class="row-actions"><button class="btn small" data-sim="${esc(a.id)}">Analisar</button><button class="icon-btn" data-edit="${esc(a.id)}" aria-label="Editar ${esc(a.id)}">${icon("edit")}</button><button class="icon-btn" data-delete="${esc(a.id)}" aria-label="Remover ${esc(a.id)}">${icon("trash")}</button></div></td></tr>`;
        })
        .join("") ||
      '<tr><td colspan="6"><div class="empty-state"><span class="empty-icon">' +
        icon("search") +
        "</span><h3>Nenhum equipamento encontrado</h3>Ajuste a busca ou os filtros.</div></td></tr>"
    );
  }
  function assetsPage() {
    return `<section class="page-heading"><div><h1>Contratos e ativos</h1><p>Informações que sustentam cada decisão de locação.</p></div><div class="actions">${btn("Exportar análise", "export-csv", "", "download")}${btn("Novo contrato", "new-asset", "primary", "plus")}</div></section><section class="card"><div class="filterbar"><div class="search-field">${icon("search")}<input id="asset-search" type="search" placeholder="Buscar código, equipamento ou setor" aria-label="Buscar equipamento" value="${esc(search)}"></div><select id="filter-status" aria-label="Filtrar por situação"><option value="all">Todas as situações</option><option value="idle" ${filterStatus === "idle" ? "selected" : ""}>Ocioso</option><option value="in-use" ${filterStatus === "in-use" ? "selected" : ""}>Em uso</option><option value="returned" ${filterStatus === "returned" ? "selected" : ""}>Devolvido</option></select><select id="filter-type" aria-label="Filtrar por tipo"><option value="all">Todos os tipos</option>${["Notebook", "Desktop", "Servidor"].map((t) => `<option ${filterType === t ? "selected" : ""}>${t}</option>`).join("")}</select></div><div class="table-scroll"><table><thead><tr><th>Equipamento</th><th>Setor</th><th>Mensalidade</th><th>Vencimento</th><th>Destinação / situação</th><th>Ações</th></tr></thead><tbody id="asset-rows">${assetsRows()}</tbody></table></div><div class="table-footer"><span id="asset-count">${filteredAssets().length} de ${state.assets.length} equipamentos</span><span>Contratos de 12 meses</span></div></section><p class="toolbar-note">Datas parciais são arredondadas para períodos mensais a vencer, sem pró-rata. A data de referência pode ser alterada no topo.</p>`;
  }
  function currentDraft() {
    if (!draft || draft.id !== selectedId)
      draft = { ...(assetById(selectedId) || state.assets[0]) };
    return draft;
  }
  function simulatorPage() {
    if (!state.assets.length)
      return `<section class="page-heading"><div><h1>Simulador</h1><p>Comece cadastrando o contrato que será analisado.</p></div></section><section class="card empty-state"><h3>Nenhum contrato disponível</h3>${btn("Cadastrar contrato", "new-asset", "primary", "plus")}</section>`;
    if (!assetById(selectedId)) selectedId = state.assets[0].id;
    const a = currentDraft();
    return `<section class="page-heading"><div><h1>Uma decisão, todos os custos.</h1><p>Ajuste a previsão de uso e compare as duas políticas.</p></div><div class="actions">${btn("Salvar parâmetros", "save-parameters", "", "check")}${btn("Gerar análise", "create-document", "primary", "file")}</div></section><div class="simulator-grid"><section class="card card-pad"><h2 style="margin-bottom:18px">Premissas do cenário</h2><form id="sim-form" class="form-stack sim-fields" autocomplete="off">
      <div class="field"><label for="sim-asset">Equipamento</label><select id="sim-asset" name="asset">${state.assets.map((x) => `<option value="${esc(x.id)}" ${x.id === a.id ? "selected" : ""}>${esc(x.id)} · ${esc(x.department || x.type)}</option>`).join("")}</select><small>${esc(a.model)} · contrato até ${date(M.contractInfo(a.startDate, state.referenceDate).end)}</small></div>
      <div class="field-pair"><div class="field"><label for="sim-monthly">Mensalidade atual (R$)</label><input id="sim-monthly" name="monthly" type="number" min="0.01" max="1000000" step="0.01" value="${(a.monthlyCents / 100).toFixed(2)}"></div><div class="field"><label for="sim-replacement">Nova locação (R$/mês)</label><input id="sim-replacement" name="replacement" type="number" min="0.01" max="1000000" step="0.01" value="${(a.replacementCents / 100).toFixed(2)}"></div></div>
      <div class="divider"></div><div class="field"><label for="sim-forecast">Existe previsão de reutilização?</label><select id="sim-forecast" name="forecast"><option value="yes" ${a.hasForecast ? "selected" : ""}>Sim, analisar a demanda prevista</option><option value="no" ${!a.hasForecast ? "selected" : ""}>Sem demanda prevista no período</option></select></div>
      <div class="field"><label for="sim-delay">Prazo até a realocação (meses)</label><input id="sim-delay" name="delay" type="number" min="0" max="120" step="1" value="${a.delayMonths}" ${!a.hasForecast ? "disabled" : ""}><small>0 = reutilização imediata.</small></div>
      <div class="field"><label for="sim-usage">Duração da demanda</label><select id="sim-usage" name="usage" ${!a.hasForecast ? "disabled" : ""}><option value="until-end" ${a.usageMode === "until-end" ? "selected" : ""}>Até o fim do contrato atual</option><option value="custom" ${a.usageMode === "custom" ? "selected" : ""}>Informar duração de uso</option></select></div>
      ${a.usageMode === "custom" ? `<div class="field"><label for="sim-duration">Duração de uso (meses)</label><input id="sim-duration" name="duration" type="number" min="1" max="120" step="1" value="${a.durationMonths}" ${!a.hasForecast ? "disabled" : ""}></div>` : ""}
      <label class="checkbox"><input name="compatible" type="checkbox" ${a.compatible ? "checked" : ""} ${!a.hasForecast ? "disabled" : ""}>Equipamento compatível com a demanda</label><div class="callout">${icon("info")}<div>A previsão é uma premissa informada. O InvIT recalcula os cenários; não prevê contratações.</div></div></form></section><section id="sim-result">${simulatorResult(a)}</section></div>`;
  }
  function readSimForm() {
    const form = document.getElementById("sim-form");
    if (!form) return currentDraft();
    const f = form.elements;
    if (!f.monthly.value.trim() || !f.replacement.value.trim())
      throw new Error("Preencha as duas mensalidades para calcular.");
    if (f.forecast.value === "yes" && !f.delay.value.trim())
      throw new Error("Informe o prazo até a realocação.");
    if (
      f.forecast.value === "yes" &&
      f.usage.value === "custom" &&
      f.duration &&
      !f.duration.value.trim()
    )
      throw new Error("Informe a duração de uso.");
    const value = {
      ...currentDraft(),
      monthlyCents: M.cents(f.monthly.value),
      replacementCents: M.cents(f.replacement.value),
      hasForecast: f.forecast.value === "yes",
      delayMonths: Number(f.delay.value),
      usageMode: f.usage.value,
      durationMonths: f.duration
        ? Number(f.duration.value)
        : currentDraft().durationMonths,
      compatible: f.compatible.checked,
    };
    return M.normalizeAsset(value);
  }
  function bindSimulator() {
    const form = document.getElementById("sim-form");
    if (!form) return;
    form.addEventListener("submit", (e) => e.preventDefault());
    form.addEventListener("input", (e) => {
      if (["asset", "forecast", "usage"].includes(e.target.name)) return;
      try {
        draft = readSimForm();
        document.getElementById("sim-result").innerHTML =
          simulatorResult(draft);
      } catch (error) {
        document.getElementById("sim-result").innerHTML =
          `<div class="inline-error">${esc(error.message)}</div>`;
      }
    });
    form.addEventListener("change", (e) => {
      if (e.target.name === "asset") {
        selectedId = e.target.value;
        draft = null;
        shell();
        return;
      }
      if (["forecast", "usage"].includes(e.target.name)) {
        try {
          draft = readSimForm();
          shell();
        } catch (error) {
          toast(error.message);
        }
      }
    });
  }
  function costCard(title, scenario, best) {
    return `<div class="cost-card ${best ? "best" : ""}"><div class="cost-heading"><span>${title}</span>${best ? '<span class="badge green">Menor custo</span>' : ""}</div><div class="cost-total">${money(scenario.total)}</div><div class="cost-breakdown"><div><span>Mensalidades atuais</span><b>${money(scenario.currentRent)}</b></div><div><span>Multa atual</span><b>${money(scenario.currentPenalty)}</b></div><div><span>Nova locação / renovações</span><b>${money(scenario.replacementRent)}</b></div><div><span>Multa da nova locação</span><b>${money(scenario.replacementPenalty)}</b></div></div></div>`;
  }
  function simulatorResult(a) {
    const r = resultFor(a),
      halted = ["expired", "returned", "future", "in-use"].includes(r.decision);
    const headline = {
      keep: "Manter para realocar",
      transfer: "Realocar agora",
      return: "Devolver ao locador",
      tie: "Os custos são equivalentes",
      expired: "Contrato vencido",
      returned: "Devolução registrada",
      future: "Contrato ainda não iniciado",
      "in-use": "Equipamento em utilização",
    }[r.decision];
    const sensitivity = [];
    for (const delay of [0, 1, 2, 3, 4, 5, 6, 8, 10, 12]) {
      const x = M.evaluate({
        monthlyCents: a.monthlyCents,
        replacementCents: a.replacementCents,
        remaining: r.r,
        delay,
        duration: a.durationMonths,
        usageMode: a.usageMode,
        hasForecast: true,
        compatible: a.compatible,
      });
      sensitivity.push({ delay, x });
    }
    return `<div class="result-banner ${r.decision === "return" ? "return" : ""}"><div class="eyebrow">${halted ? "Situação do equipamento" : "Recomendação do cenário"} · ${esc(a.id)}</div><h2>${headline}</h2><p>${reason(a, r)}</p>${!halted ? `<div class="result-saving"><strong>${money(r.saving)}</strong>${r.saving ? "de diferença entre as políticas" : "de diferença calculada"}</div>` : ""}</div>
      ${halted ? `<div class="callout warning">${icon("info")}<div>${r.decision === "in-use" ? "A simulação financeira abaixo é exploratória. Edite a situação do ativo para Ocioso quando ele deixar de ser utilizado." : "A situação atual impede uma recomendação de destinação por ociosidade."}</div></div><div style="height:16px"></div>` : ""}
      <div class="cost-grid">${costCard("Manter o equipamento", r.keep, !halted && r.keep.total < r.giveBack.total)}${costCard("Devolver agora", r.giveBack, !halted && r.giveBack.total < r.keep.total)}</div>
      <div class="assumption-line">${icon("info")}<span>${r.hasForecast ? `Demanda em ${r.d} ${r.d === 1 ? "mês" : "meses"}, por ${r.u} ${r.u === 1 ? "mês" : "meses"}. ` : "Sem demanda futura considerada. "}${r.mode === "until-end" ? "Horizonte: vencimento do contrato atual." : "Horizonte: atendimento da duração informada."} Novas locações são encerradas ao fim do uso, com a multa aplicável.</span></div>
      <section class="card"><div class="card-header"><div><h2>E se a previsão mudar?</h2><p>Prazo de realocação × custo das alternativas</p></div><span class="badge gray">Sensibilidade</span></div><div class="table-scroll"><table class="sensitivity-table"><thead><tr><th>Reutilização em</th><th>Manter</th><th>Devolver</th><th>Resultado</th></tr></thead><tbody>${sensitivity.map(({ delay, x }) => `<tr class="${delay === a.delayMonths ? "current" : ""}"><td>${delay === 0 ? "Agora" : delay + " meses"}</td><td class="mono">${money(x.keep.total)}</td><td class="mono">${money(x.giveBack.total)}</td><td>${badge(x.decision)}</td></tr>`).join("")}</tbody></table></div><div class="table-footer"><span>${r.mode === "until-end" ? "A duração diminui conforme o vencimento se aproxima." : "Duração de uso fixa: " + a.durationMonths + " meses."}</span></div></section><div class="actions section-gap"><button class="btn" data-action="edit-selected">${icon("edit")}Editar contrato</button><button class="btn" data-action="download-current">${icon("download")}Baixar memória de cálculo</button></div>`;
  }
  function docStatus(status) {
    return `<span class="badge ${status === "signed" ? "green" : status === "sent" ? "blue" : "gray"}">${{ draft: "Minuta", sent: "Envio simulado", signed: "Assinatura simulada" }[status] || "Minuta"}</span>`;
  }
  function documentsPage() {
    return `<section class="page-heading"><div><h1>Documentos e decisões</h1><p>Registre o cenário aprovado e acompanhe sua formalização.</p></div><div class="actions">${btn("Nova análise", "go-simulator", "primary", "plus")}</div></section><div class="notice-strip">${icon("shield")}<div><b>Fluxo de assinatura em demonstração.</b> As minutas e mudanças de status são locais. Nenhum documento é enviado a uma plataforma e nenhuma assinatura jurídica é produzida.</div></div>
      <div class="docs-list">${state.documents.map((d) => `<article class="card doc-card"><div class="doc-info"><span class="doc-icon">${icon("file")}</span><div><h3>${esc(d.kind)} · ${esc(d.assetId)}</h3><p>${esc(d.id.slice(0, 8).toUpperCase())} · ${new Date(d.createdAt).toLocaleString("pt-BR")} · cenário preservado na criação</p></div></div><div class="doc-actions">${docStatus(d.status)}<button class="btn small" data-doc="${esc(d.id)}">Abrir ${icon("arrow")}</button></div></article>`).join("") || `<section class="card empty-state"><span class="empty-icon">${icon("file")}</span><h3>A primeira decisão começa no simulador</h3><p>Gere uma memória de análise e uma minuta de encaminhamento.</p>${btn("Abrir simulador", "go-simulator", "primary", "calculator")}</section>`}</div>
      <section class="card card-pad section-gap"><h2>Como funciona a formalização</h2><div class="method-step"><span class="step-number">1</span><div><h3>Conferir e registrar</h3><p>O responsável revisa a recomendação e gera uma análise com custos e premissas.</p></div></div><div class="method-step"><span class="step-number">2</span><div><h3>Encaminhar para assinatura</h3><p>O protótipo demonstra o encaminhamento. Uma integração real exige um serviço de backend e credenciais do provedor de assinatura.</p></div></div><div class="method-step"><span class="step-number">3</span><div><h3>Acompanhar o retorno</h3><p>Na integração efetiva, o retorno do provedor deverá confirmar o status. Aqui, a transição é identificada como simulada.</p></div></div></section>`;
  }
  function methodPage() {
    return `<section class="page-heading"><div><h1>Uma recomendação que você pode conferir.</h1><p>Dados do desafio, regras de cálculo e limites da simulação.</p></div><div class="actions">${btn("Verificar exemplos", "verify-examples", "primary", "check")}</div></section><div class="method-grid"><section class="card card-pad prose"><h2>O que estamos comparando</h2><p>As duas políticas atendem à mesma demanda: manter o equipamento atual para reaproveitá-lo ou devolvê-lo agora e contratar outro quando necessário. O resultado depende do prazo, duração e compatibilidade informados.</p><h3>1. Regras fornecidas pela Quinelato</h3><ul><li>Contratos de 12 meses para notebooks, desktops e servidores.</li><li>Multa de 30% do saldo das mensalidades restantes.</li><li>Notebooks: básica ${money(14828)}, intermediária ${money(15986)} e avançada ${money(16681)} por mês.</li></ul><div class="formula">Multa = mensalidade × meses restantes × 30%</div><h3>2. Como a demanda entra no cálculo</h3><p>No modo padrão, o uso termina no vencimento do contrato atual. No modo personalizado, você informa a duração e o cálculo inclui eventual contratação complementar após o vencimento.</p><p>Se o uso acabar antes do vencimento, a política de manter também devolve o equipamento antecipadamente e contabiliza sua multa. Se houver novos contratos, eles têm 12 meses; contratos completos não geram multa e o último contrato parcial é encerrado com multa sobre o saldo.</p><h3>3. Premissas de comparação</h3><ul><li>Valores nominais, sem juros ou desconto a valor presente.</li><li>Mensalidades em centavos; cada multa é arredondada por contrato.</li><li>Meses inteiros e parcelas parciais arredondadas para cima. Não há pró-rata.</li><li>Custos de transporte, impostos adicionais e manutenção não informados não são incluídos.</li><li>Previsão de uso informada pelo responsável; não é previsão automática nem probabilidade estimada.</li><li>O uso equivalente termina no horizonte definido. Todos os saldos de rescisão pertinentes são contabilizados.</li></ul><p>O modelo compara duas políticas determinadas. Ele não procura todas as datas possíveis de troca e rescisão. A escolha final deve revisar as premissas e as condições do contrato.</p></section>
      <div><section class="card card-pad"><h2>Um exemplo, sem atalhos</h2><p class="note">Notebook básico · 8 meses restantes · realocação em 2 meses · utilização por 6 meses.</p><dl class="detail-pairs"><div><dt>Manter o contrato atual</dt><dd>${money(118624)}</dd></div><div><dt>Multa da devolução atual</dt><dd>${money(35587)}</dd></div><div><dt>6 mensalidades da nova locação</dt><dd>${money(88968)}</dd></div><div><dt>Multa da nova locação no horizonte</dt><dd>${money(26690)}</dd></div><div style="border-top:1px solid var(--line);padding-top:9px"><dt>Total se devolver agora</dt><dd>${money(151245)}</dd></div></dl><div class="saving"><div><small>Diferença a favor de manter</small><br><strong>${money(32621)}</strong></div>${icon("check")}</div><p class="note">Comparar apenas mensalidades ociosas e multa atual deixaria de fora a nova locação e seus compromissos.</p></section>
      <section class="card card-pad section-gap"><h2>Dados e continuidade</h2><p class="note">A base inicial é simulada. As mensalidades dos notebooks vêm do enunciado; valores de desktops e servidores são demonstrativos. Cadastros, análises e documentos ficam neste navegador.</p><div class="actions section-gap">${btn("Exportar backup", "backup", "", "download")}<label class="btn file-button">${icon("upload")}Importar backup<input type="file" id="import-backup" accept="application/json,.json" aria-label="Importar backup JSON"></label></div><button class="link-button danger-text section-gap" data-action="reset-demo">Restaurar base demonstrativa</button></section><section class="card card-pad section-gap"><h2>Verificações de referência</h2><div id="test-results"><p class="note">Confira os exemplos-base, o uso curto, a continuidade da demanda e o vencimento contratual.</p></div></section></div></div>`;
  }
  function analysisText(a, r) {
    const lines = [
      "InvIT — MEMÓRIA DE ANÁLISE",
      "Modelo " + M.MODEL_VERSION,
      "Base: protótipo / dados informados pelo usuário",
      "",
      "Equipamento: " + a.id + " — " + (a.model || a.type),
      "Setor: " + (a.department || "Não informado"),
      "Referência: " + state.referenceDate,
      "Início: " + a.startDate,
      "Vencimento: " + r.contract.end,
      "Períodos mensais restantes: " + r.r,
      "Mensalidade atual: " + money(a.monthlyCents),
      "Nova mensalidade: " + money(a.replacementCents),
      "Previsão de demanda: " +
        (a.hasForecast
          ? "em " + r.d + " meses, por " + r.u + " meses"
          : "não considerada"),
      "Compatibilidade: " + (a.compatible ? "sim" : "não"),
      "",
      "POLÍTICA: MANTER",
      "Mensalidades atuais: " + money(r.keep.currentRent),
      "Multa atual ao fim do uso: " + money(r.keep.currentPenalty),
      "Mensalidades de locações complementares: " +
        money(r.keep.replacementRent),
      "Multas complementares: " + money(r.keep.replacementPenalty),
      "TOTAL: " + money(r.keep.total),
      "",
      "POLÍTICA: DEVOLVER AGORA",
      "Multa atual: " + money(r.giveBack.currentPenalty),
      "Mensalidades de nova locação: " + money(r.giveBack.replacementRent),
      "Multa da nova locação: " + money(r.giveBack.replacementPenalty),
      "TOTAL: " + money(r.giveBack.total),
      "",
      "RESULTADO: " + recommendations[r.decision][0].toUpperCase(),
      "Diferença entre as políticas: " + money(r.saving),
      reason(a, r),
      "",
      "PREMISSAS",
      "Contratos de12 meses; multa de30% do saldo; valores nominais; multas arredondadas por contrato.",
      "Meses inteiros, sem pró-rata. Nova locação encerrada ao final da demanda, com eventual multa.",
      "Custos não informados, como transporte, não foram incluídos. Previsão de uso não é garantia.",
      "As duas políticas atendem à mesma demanda. Não se trata de otimização global de todas as datas de troca.",
      "",
      "Documento de demonstração. Não é uma assinatura nem um envio a plataforma de assinatura.",
    ];
    return lines.join("\n");
  }
  function download(name, content, mime = "text/plain;charset=utf-8") {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportCsv() {
    const rows = [
      [
        "Código",
        "Tipo",
        "Setor",
        "Situação",
        "Mensalidade",
        "Vencimento",
        "Meses restantes",
        "Demanda em meses",
        "Uso em meses",
        "Custo manter",
        "Custo devolver",
        "Recomendação",
        "Diferença",
        "Data de referência",
        "Modelo",
      ],
    ];
    for (const a of state.assets) {
      const r = resultFor(a);
      rows.push([
        a.id,
        a.type,
        a.department,
        a.status,
        (a.monthlyCents / 100).toFixed(2),
        r.contract.end,
        r.r,
        a.hasForecast ? r.d : "Sem previsão",
        r.u,
        (r.keep.total / 100).toFixed(2),
        (r.giveBack.total / 100).toFixed(2),
        recommendations[r.decision][0],
        (r.saving / 100).toFixed(2),
        state.referenceDate,
        M.MODEL_VERSION,
      ]);
    }
    const cell = (x) => {
      let s = String(x);
      if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };
    download(
      "InvIT_analise_" + state.referenceDate + ".csv",
      "\ufeff" + rows.map((row) => row.map(cell).join(";")).join("\r\n"),
      "text/csv;charset=utf-8",
    );
    toast("Análise exportada em CSV.");
  }
  function openModal(title, body, foot = "") {
    modal.innerHTML = `<div class="modal-head"><h2 id="modal-title">${title}</h2><button type="button" class="icon-btn" data-action="close-modal" aria-label="Fechar janela">${icon("close")}</button></div>${body}${foot}`;
    modal.showModal();
  }
  function editAsset(id) {
    const existing = assetById(id);
    const a = existing || {
      ...seedAsset({
        id: "NOVO",
        model: "",
        hasForecast: false,
        startDate: state.referenceDate,
        department: "",
        note: "",
      }),
      id: "",
    };
    openModal(
      existing ? "Editar contrato" : "Novo contrato",
      `<form id="asset-form"><div class="modal-body"><p class="modal-description">Registre o contrato e a situação do equipamento. A previsão de uso pode ser ajustada no simulador.</p><div class="modal-grid"><div class="field"><label for="asset-id">Código do equipamento</label><input id="asset-id" name="id" required maxlength="32" placeholder="Ex.: NB-008" value="${esc(a.id)}" ${existing ? "readonly" : ""}></div><div class="field"><label for="asset-type">Tipo</label><select id="asset-type" name="type">${["Notebook", "Desktop", "Servidor"].map((t) => `<option ${a.type === t ? "selected" : ""}>${t}</option>`).join("")}</select></div><div class="field span-2"><label for="asset-model">Descrição / modelo</label><input id="asset-model" name="model" maxlength="120" required value="${esc(a.model)}" placeholder="Descrição do equipamento"></div><div class="field"><label for="asset-profile">Configuração de referência</label><select id="asset-profile" name="profile"><option value="personalizado">Valor personalizado</option>${[
        ["basica", "Básica · R$ 148,28"],
        ["intermediaria", "Intermediária · R$ 159,86"],
        ["avancada", "Avançada · R$ 166,81"],
      ]
        .map(
          ([v, l]) =>
            `<option value="${v}" ${a.profile === v ? "selected" : ""}>${l}</option>`,
        )
        .join(
          "",
        )}</select></div><div class="field"><label for="asset-monthly">Mensalidade (R$)</label><input id="asset-monthly" name="monthly" type="number" step="0.01" min="0.01" max="1000000" required value="${(a.monthlyCents / 100).toFixed(2)}"></div><div class="field"><label for="asset-start">Início do contrato</label><input id="asset-start" name="start" type="date" required value="${a.startDate}"><small>Prazo fixo de12 meses.</small></div><div class="field"><label for="asset-status">Situação</label><select id="asset-status" name="status"><option value="idle" ${a.status === "idle" ? "selected" : ""}>Ocioso</option><option value="in-use" ${a.status === "in-use" ? "selected" : ""}>Em uso</option><option value="returned" ${a.status === "returned" ? "selected" : ""}>Devolvido</option></select></div><div class="field"><label for="asset-department">Setor</label><input id="asset-department" name="department" maxlength="70" value="${esc(a.department)}" placeholder="Ex.: Administrativo"></div><div class="field"><label for="asset-responsible">Responsável</label><input id="asset-responsible" name="responsible" maxlength="70" value="${esc(a.responsible)}" placeholder="Opcional"></div><div class="field span-2"><label for="asset-note">Observações</label><textarea id="asset-note" name="note" maxlength="600" rows="2">${esc(a.note)}</textarea></div></div><div class="modal-error" id="asset-error" role="alert"></div></div><div class="modal-foot"><button type="button" class="btn" data-action="close-modal">Cancelar</button><button class="btn primary" type="submit">${existing ? "Salvar alterações" : "Cadastrar contrato"}</button></div></form>`,
    );
    const form = document.getElementById("asset-form");
    form.elements.profile.addEventListener("change", () => {
      const value = M.PROFILES[form.elements.profile.value];
      if (value) form.elements.monthly.value = (value / 100).toFixed(2);
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      try {
        const f = form.elements;
        const monthly = M.cents(f.monthly.value);
        const value = M.normalizeAsset({
          ...a,
          id: f.id.value,
          type: f.type.value,
          model: f.model.value,
          profile: f.profile.value,
          monthlyCents: monthly,
          replacementCents:
            existing && existing.replacementCents !== existing.monthlyCents
              ? existing.replacementCents
              : monthly,
          startDate: f.start.value,
          status: f.status.value,
          department: f.department.value,
          responsible: f.responsible.value,
          note: f.note.value,
        });
        if (
          !existing &&
          state.assets.some(
            (x) => x.id.toLowerCase() === value.id.toLowerCase(),
          )
        )
          throw new Error("Já existe um equipamento com esse código.");
        if (existing) state.assets[state.assets.indexOf(existing)] = value;
        else state.assets.push(value);
        log(
          `${existing ? "Contrato atualizado" : "Contrato cadastrado"}: ${value.id}.`,
        );
        selectedId = value.id;
        draft = null;
        save(existing ? "Contrato atualizado." : "Contrato cadastrado.");
        modal.close();
        shell();
      } catch (error) {
        document.getElementById("asset-error").textContent = error.message;
      }
    });
  }
  function deleteAsset(id) {
    const a = assetById(id);
    if (!a) return;
    openModal(
      "Remover equipamento",
      `<div class="modal-body"><p class="modal-description">Remover <b>${esc(id)}</b> desta base local? As análises já geradas serão preservadas em Documentos.</p><p class="note">Para manter o contrato no histórico, edite sua situação para Devolvido.</p></div>`,
      `<div class="modal-foot">${btn("Cancelar", "close-modal")}${btn("Remover registro", "confirm-delete", "danger", "trash")}</div>`,
    );
    modal
      .querySelector('[data-action="confirm-delete"]')
      .addEventListener("click", () => {
        state.assets = state.assets.filter((x) => x.id !== id);
        if (selectedId === id) selectedId = state.assets[0]?.id || "";
        draft = null;
        log("Registro removido: " + id);
        save("Registro removido.");
        modal.close();
        shell();
      });
  }
  function createDocument() {
    try {
      const a = view === "simulator" ? readSimForm() : assetById(selectedId);
      if (!a) throw new Error("Selecione um equipamento.");
      const r = resultFor(a);
      if (["expired", "returned", "future", "in-use"].includes(r.decision))
        throw new Error(
          "Selecione um contrato vigente de equipamento ocioso para gerar a decisão.",
        );
      const kind = {
        keep: "Análise de retenção",
        transfer: "Minuta de transferência",
        return: "Minuta de devolução",
        tie: "Análise de custos equivalentes",
      }[r.decision];
      const doc = {
        id: guid(),
        assetId: a.id,
        kind,
        createdAt: new Date().toISOString(),
        status: "draft",
        text: analysisText(a, r),
      };
      state.documents.unshift(doc);
      log("Análise registrada: " + a.id);
      save("Análise registrada com as premissas atuais.");
      navigate("documents");
      openDocument(doc.id);
    } catch (error) {
      toast(error.message);
    }
  }
  function openDocument(id) {
    const d = state.documents.find((x) => x.id === id);
    if (!d) return;
    const next =
      d.status === "draft"
        ? "Simular envio"
        : d.status === "sent"
          ? "Simular assinatura"
          : "";
    openModal(
      esc(d.kind),
      `<div class="modal-body"><div class="notice-strip">${icon("info")}<div>Documento de demonstração. Este fluxo não envia e-mails nem produz uma assinatura digital real.</div></div><div style="margin-bottom:12px">${docStatus(d.status)}</div><pre class="document-preview">${esc(d.text)}</pre></div>`,
      `<div class="modal-foot">${btn("Baixar texto", "download-doc", "", "download")}${next ? btn(next, "advance-doc", "primary", "arrow") : btn("Fechar", "close-modal")}</div>`,
    );
    modal
      .querySelector('[data-action="download-doc"]')
      .addEventListener("click", () =>
        download(`InvIT_${d.assetId}_${d.id.slice(0, 8)}.txt`, d.text),
      );
    modal
      .querySelector('[data-action="advance-doc"]')
      ?.addEventListener("click", () => {
        d.status = d.status === "draft" ? "sent" : "signed";
        log("Status demonstrativo atualizado: " + d.assetId + " — " + d.status);
        save("Status simulado atualizado.");
        modal.close();
        shell();
        openDocument(id);
      });
  }
  function verifyExamples() {
    const base = {
      monthlyCents: 14828,
      remaining: 8,
      hasForecast: true,
      compatible: true,
      usageMode: "until-end",
    };
    const examples = [
      [
        "Sem demanda: multa de R$355,87",
        () =>
          M.evaluate({ ...base, hasForecast: false }).giveBack.total === 35587,
      ],
      [
        "Realocação em2 meses: manter economiza R$326,21",
        () => M.evaluate({ ...base, delay: 2 }).saving === 32621,
      ],
      [
        "Realocação em6 meses: devolver economiza R$88,97",
        () => M.evaluate({ ...base, delay: 6 }).saving === 8897,
      ],
      [
        "Uso curto de2 meses: manter custa R$771,06",
        () =>
          M.evaluate({ ...base, delay: 2, usageMode: "custom", duration: 2 })
            .keep.total === 77106,
      ],
      [
        "Uso de12 meses após espera: devolução pode ser melhor",
        () =>
          M.evaluate({ ...base, delay: 2, usageMode: "custom", duration: 12 })
            .decision === "return",
      ],
      [
        "Contrato vencido: sem multa de antecipação",
        () => M.evaluate({ ...base, remaining: 0 }).decision === "expired",
      ],
      [
        "Novo contrato completo de12 meses: sem multa terminal",
        () => M.newLease(14828, 12).penalty === 0,
      ],
    ];
    const target = document.getElementById("test-results");
    if (!target) return;
    target.innerHTML = `<div class="test-results">${examples
      .map(([name, fn]) => {
        let ok = false;
        try {
          ok = fn();
        } catch {}
        return `<div class="test-result">${icon(ok ? "check" : "alert")}<span>${esc(name)} ${ok ? "· conferido" : "· divergência"}</span></div>`;
      })
      .join(
        "",
      )}</div><p class="note">Exemplos determinísticos do modelo. Não representam validação de economia real na empresa.</p>`;
  }
  function confirmReset() {
    openModal(
      "Restaurar demonstração",
      `<div class="modal-body"><p class="modal-description">Isso substituirá os contratos e documentos locais pelos exemplos iniciais. Exporte um backup antes se quiser preservar suas alterações.</p></div>`,
      `<div class="modal-foot">${btn("Cancelar", "close-modal")}${btn("Restaurar exemplos", "confirm-reset", "danger", "refresh")}</div>`,
    );
    modal
      .querySelector('[data-action="confirm-reset"]')
      .addEventListener("click", () => {
        state = initialState();
        selectedId = state.assets[0].id;
        draft = null;
        save("Base demonstrativa restaurada.");
        modal.close();
        shell();
      });
  }
  document.addEventListener("click", (e) => {
    const go = e.target.closest("[data-go]");
    if (go) {
      e.preventDefault();
      navigate(go.dataset.go);
      return;
    }
    const sim = e.target.closest("[data-sim]");
    if (sim) {
      navigate("simulator", sim.dataset.sim);
      return;
    }
    const edit = e.target.closest("[data-edit]");
    if (edit) {
      editAsset(edit.dataset.edit);
      return;
    }
    const del = e.target.closest("[data-delete]");
    if (del) {
      deleteAsset(del.dataset.delete);
      return;
    }
    const doc = e.target.closest("[data-doc]");
    if (doc) {
      openDocument(doc.dataset.doc);
      return;
    }
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (action === "close-modal") modal.close();
    else if (action === "new-asset") editAsset();
    else if (action === "edit-selected") editAsset(selectedId);
    else if (action === "go-simulator") navigate("simulator");
    else if (action === "export-csv") exportCsv();
    else if (action === "create-document") createDocument();
    else if (action === "download-current") {
      try {
        const a = readSimForm();
        download(
          "InvIT_" + a.id + "_analise.txt",
          analysisText(a, resultFor(a)),
        );
        toast("Memória de cálculo exportada.");
      } catch (error) {
        toast(error.message);
      }
    } else if (action === "backup") {
      download(
        "InvIT_backup_" + state.referenceDate + ".json",
        JSON.stringify(state, null, 2),
        "application/json",
      );
      toast("Backup exportado.");
    } else if (action === "save-parameters") {
      try {
        const a = readSimForm();
        const old = assetById(a.id);
        state.assets[state.assets.indexOf(old)] = a;
        draft = { ...a };
        log("Premissas atualizadas: " + a.id);
        save("Parâmetros salvos no equipamento.");
      } catch (error) {
        toast(error.message);
      }
    } else if (action === "toggle-nav") {
      document.getElementById("sidebar").classList.toggle("open");
      document.getElementById("nav-overlay").classList.toggle("open");
    } else if (action === "reset-demo") confirmReset();
    else if (action === "verify-examples") verifyExamples();
    if (e.target.id === "nav-overlay") {
      document.getElementById("sidebar").classList.remove("open");
      e.target.classList.remove("open");
    }
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "asset-search") {
      search = e.target.value;
      document.getElementById("asset-rows").innerHTML = assetsRows();
      document.getElementById("asset-count").textContent =
        `${filteredAssets().length} de ${state.assets.length} equipamentos`;
    }
  });
  document.addEventListener("change", (e) => {
    if (e.target.id === "reference-date") {
      try {
        M.parseDate(e.target.value);
        state.referenceDate = e.target.value;
        save("Data de referência atualizada.");
        shell();
      } catch (error) {
        e.target.value = state.referenceDate;
        toast(error.message);
      }
    }
    if (e.target.id === "filter-status" || e.target.id === "filter-type") {
      filterStatus = document.getElementById("filter-status").value;
      filterType = document.getElementById("filter-type").value;
      document.getElementById("asset-rows").innerHTML = assetsRows();
      document.getElementById("asset-count").textContent =
        `${filteredAssets().length} de ${state.assets.length} equipamentos`;
    }
    if (e.target.id === "import-backup" && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5000000) {
        toast("O backup deve ter até5 MB.");
        return;
      }
      file
        .text()
        .then((text) => {
          const replacement = validateState(JSON.parse(text));
          openModal(
            "Importar backup",
            `<div class="modal-body"><p class="modal-description">Substituir a base local por <b>${replacement.assets.length} equipamentos</b> e <b>${replacement.documents.length} documentos</b> do arquivo selecionado?</p></div>`,
            `<div class="modal-foot">${btn("Cancelar", "close-modal")}${btn("Importar dados", "confirm-import", "primary", "upload")}</div>`,
          );
          modal
            .querySelector('[data-action="confirm-import"]')
            .addEventListener("click", () => {
              state = replacement;
              draft = null;
              selectedId = state.assets[0]?.id || "";
              save("Backup importado.");
              modal.close();
              shell();
            });
        })
        .catch((error) => toast("Importação não realizada: " + error.message));
    }
  });
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      const r = modal.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        modal.close();
    }
  });
  shell();
  if (bootMessage) setTimeout(() => toast(bootMessage), 500);
})();
