/* Dados iniciais e ícones do InvIT. */
(() => {
  const M = window.InvITModel;
  const paths = {
    dashboard:
      '<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/>',
    laptop:
      '<rect x="5" y="4" width="14" height="12" rx="1.5"/><path d="M2 19h20l-2 2H4z"/>',
    desktop:
      '<rect x="3" y="3" width="18" height="13" rx="2"/><path d="M12 16v5m-4 0h8"/>',
    server:
      '<rect x="4" y="3" width="16" height="7" rx="2"/><rect x="4" y="14" width="16" height="7" rx="2"/><path d="M8 6.5h.01M8 17.5h.01m4-11h5m-5 11h5"/>',
    calculator:
      '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 5h8v4H8zm0 8h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8m-8 4h6"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 3H20v19H6.5A2.5 2.5 0 0 1 4 19.5v-14A2.5 2.5 0 0 1 6.5 3z"/><path d="M8 7h8m-8 4h6"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    trend: '<path d="m3 16 6-6 4 4 8-9m-6 0h6v6"/>',
    coins:
      '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    edit: '<path d="m16 3 5 5-12 12-6 1 1-6zM14 5l5 5"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3m-10 0 1 15h12l1-15M10 10v7m4-7v7"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    shield:
      '<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6z"/><path d="m8 12 3 3 5-6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
    refresh:
      '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 7a7 7 0 0 1 11.6-2L20 8M4 16l2.3 3A7 7 0 0 0 18 17"/>',
    transfer: '<path d="M3 7h16m-4-4 4 4-4 4M21 17H5m4-4-4 4 4 4"/>',
    calendar:
      '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    export: '<path d="M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5"/>',
    history: '<path d="M3 3v6h6M3 9a9 9 0 1 1 .7 8M12 7v5l4 2"/>',
    print: '<path d="M6 8V3h12v5M6 17H3V8h18v9h-3M6 14h12v7H6zM17 11h.01"/>',
    alert: '<path d="m12 3 10 18H2zM12 9v5m0 3h.01"/>',
  };
  const seedAsset = (values) =>
    M.normalizeAsset({
      type: "Notebook",
      model: "Notebook corporativo",
      profile: "basica",
      monthlyCents: 14828,
      replacementCents: 14828,
      startDate: "2026-07-03",
      department: "Administrativo",
      responsible: "",
      status: "idle",
      hasForecast: true,
      compatible: true,
      delayMonths: 2,
      usageMode: "until-end",
      durationMonths: 6,
      note: "Registro simulado para demonstração.",
      ...values,
    });
  function initialState() {
    return {
      schemaVersion: 1,
      referenceDate: "2026-11-03",
      assets: [
        seedAsset({
          id: "NB-001",
          model: "Notebook · configuração básica",
          department: "Administrativo",
          delayMonths: 2,
        }),
        seedAsset({
          id: "NB-002",
          model: "Notebook · configuração básica",
          department: "Financeiro",
          delayMonths: 6,
        }),
        seedAsset({
          id: "NB-003",
          model: "Notebook · configuração avançada",
          department: "Engenharia",
          profile: "avancada",
          monthlyCents: 16681,
          replacementCents: 16681,
          delayMonths: 0,
        }),
        seedAsset({
          id: "NB-004",
          model: "Notebook · configuração intermediária",
          department: "Comercial",
          profile: "intermediaria",
          monthlyCents: 15986,
          replacementCents: 15986,
          status: "in-use",
          hasForecast: false,
        }),
        seedAsset({
          id: "SV-001",
          type: "Servidor",
          model: "Servidor · valor demonstrativo",
          department: "Infraestrutura",
          profile: "personalizado",
          monthlyCents: 65000,
          replacementCents: 65000,
          startDate: "2026-02-03",
          hasForecast: false,
        }),
        seedAsset({
          id: "DT-001",
          type: "Desktop",
          model: "Desktop · valor demonstrativo",
          department: "Operações",
          profile: "personalizado",
          monthlyCents: 22000,
          replacementCents: 22000,
          startDate: "2026-05-03",
          status: "in-use",
          hasForecast: false,
        }),
        seedAsset({
          id: "NB-005",
          model: "Notebook · configuração básica",
          department: "Qualidade",
          hasForecast: false,
        }),
      ],
      documents: [],
      log: [],
    };
  }
  window.InvITData = { icons: paths, initialState, seedAsset };
})();
