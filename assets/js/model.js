(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.InvITModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const MODEL_VERSION = "1.0";
  const PROFILES = { basica: 14828, intermediaria: 15986, avancada: 16681 };
  const PENALTY_RATE = 30;
  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }
  function cents(value) {
    const number =
      typeof value === "number"
        ? value
        : Number(String(value).trim().replace(",", "."));
    assert(
      Number.isFinite(number) && number > 0 && number <= 1000000,
      "A mensalidade deve ser maior que zero e até R$ 1.000.000.",
    );
    return Math.round(number * 100);
  }
  function integer(value, min, max, name) {
    const n = Number(value);
    assert(
      Number.isInteger(n) && n >= min && n <= max,
      `${name} deve ser um inteiro entre ${min} e ${max}.`,
    );
    return n;
  }
  function parseDate(value) {
    assert(
      /^\d{4}-\d{2}-\d{2}$/.test(String(value)),
      "Informe uma data válida.",
    );
    const [y, m, d] = value.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d, 12));
    assert(
      date.getUTCFullYear() === y &&
        date.getUTCMonth() === m - 1 &&
        date.getUTCDate() === d,
      "Informe uma data válida.",
    );
    return date;
  }
  function iso(date) {
    return date.toISOString().slice(0, 10);
  }
  function addMonths(value, months) {
    const date = parseDate(value);
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + months);
    const last = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12),
    ).getUTCDate();
    date.setUTCDate(Math.min(day, last));
    return iso(date);
  }
  function contractInfo(start, reference) {
    const s = parseDate(start),
      ref = parseDate(reference),
      endString = addMonths(start, 12),
      end = parseDate(endString);
    if (ref < s)
      return { end: endString, remaining: 12, future: true, expired: false };
    if (ref >= end)
      return { end: endString, remaining: 0, future: false, expired: true };
    let months =
      (end.getUTCFullYear() - ref.getUTCFullYear()) * 12 +
      end.getUTCMonth() -
      ref.getUTCMonth();
    if (addMonths(reference, months) < endString) months++;
    return {
      end: endString,
      remaining: Math.min(12, months),
      future: false,
      expired: false,
    };
  }
  // Monetary amounts are integer cents. Each contract's penalty is rounded independently.
  function penalty(monthlyCents, remaining) {
    return Math.round((monthlyCents * remaining * PENALTY_RATE) / 100);
  }
  function newLease(monthlyCents, months) {
    const used = integer(months, 0, 120, "Duração de uso");
    if (!used)
      return { rent: 0, penalty: 0, total: 0, contracts: 0, months: 0 };
    const tail = used % 12;
    const rent = monthlyCents * used;
    const fee = tail ? penalty(monthlyCents, 12 - tail) : 0;
    return {
      rent,
      penalty: fee,
      total: rent + fee,
      contracts: Math.ceil(used / 12),
      months: used,
    };
  }
  function policy(currentRent, currentPenalty, replacement) {
    return {
      currentRent,
      currentPenalty,
      replacementRent: replacement.rent,
      replacementPenalty: replacement.penalty,
      replacementContracts: replacement.contracts,
      replacementMonths: replacement.months,
      total: currentRent + currentPenalty + replacement.total,
    };
  }
  function evaluate(params) {
    const p = integer(
      params.monthlyCents,
      1,
      100000000,
      "Mensalidade em centavos",
    );
    const n = integer(
      params.replacementCents || p,
      1,
      100000000,
      "Nova mensalidade em centavos",
    );
    const r = integer(params.remaining, 0, 12, "Meses restantes");
    const d = integer(params.delay || 0, 0, 120, "Prazo de realocação");
    const mode = params.usageMode === "custom" ? "custom" : "until-end";
    const hasForecast = !!params.hasForecast;
    const compatible = params.compatible !== false;
    const requestedUse =
      mode === "custom"
        ? integer(params.duration, 1, 120, "Duração de uso")
        : Math.max(0, r - d);
    const u = hasForecast ? requestedUse : 0;
    const empty = newLease(n, 0);
    if (!r)
      return {
        version: MODEL_VERSION,
        p,
        n,
        r,
        d,
        u,
        mode,
        hasForecast,
        compatible,
        expired: true,
        keep: policy(0, 0, empty),
        giveBack: policy(0, 0, empty),
        decision: "expired",
        saving: 0,
        keepSaving: 0,
        servedByCurrent: 0,
      };
    const replacementReturn = newLease(n, u);
    const giveBack = policy(0, penalty(p, r), replacementReturn);
    let keep,
      servedByCurrent = 0;
    if (hasForecast && u > 0 && compatible && d < r) {
      servedByCurrent = Math.min(u, r - d);
      const paidMonths = Math.min(r, d + u);
      keep = policy(
        p * paidMonths,
        penalty(p, r - paidMonths),
        newLease(n, u - servedByCurrent),
      );
    } else {
      keep = policy(p * r, 0, replacementReturn);
    }
    const diff = keep.total - giveBack.total;
    const decision =
      diff > 0
        ? "return"
        : diff < 0
          ? d === 0 && servedByCurrent
            ? "transfer"
            : "keep"
          : "tie";
    return {
      version: MODEL_VERSION,
      p,
      n,
      r,
      d,
      u,
      mode,
      hasForecast,
      compatible,
      expired: false,
      keep,
      giveBack,
      decision,
      saving: Math.abs(diff),
      keepSaving: Math.max(0, diff),
      servedByCurrent,
    };
  }
  function assetEvaluation(asset, reference) {
    const info = contractInfo(asset.startDate, reference);
    const result = evaluate({
      monthlyCents: asset.monthlyCents,
      replacementCents: asset.replacementCents,
      remaining: info.remaining,
      delay: asset.delayMonths,
      duration: asset.durationMonths,
      usageMode: asset.usageMode,
      hasForecast: asset.hasForecast,
      compatible: asset.compatible,
    });
    result.contract = info;
    if (asset.status === "returned") result.decision = "returned";
    else if (info.future) result.decision = "future";
    else if (info.expired) result.decision = "expired";
    else if (asset.status === "in-use") result.decision = "in-use";
    return result;
  }
  function normalizeAsset(input) {
    const text = (v, max = 120) =>
      String(v || "")
        .trim()
        .slice(0, max);
    const id = text(input.id, 32);
    assert(
      /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/.test(id),
      "Use um código com letras, números, ponto, hífen ou sublinhado.",
    );
    const type = ["Notebook", "Desktop", "Servidor"].includes(input.type)
      ? input.type
      : "Notebook";
    const monthlyCents = integer(
      input.monthlyCents,
      1,
      100000000,
      "Mensalidade em centavos",
    );
    const startDate = text(input.startDate, 10);
    parseDate(startDate);
    return {
      id,
      type,
      model: text(input.model),
      profile: text(input.profile, 30),
      monthlyCents,
      replacementCents: integer(
        input.replacementCents || monthlyCents,
        1,
        100000000,
        "Nova mensalidade em centavos",
      ),
      startDate,
      department: text(input.department, 70),
      responsible: text(input.responsible, 70),
      status: ["idle", "in-use", "returned"].includes(input.status)
        ? input.status
        : "idle",
      hasForecast: !!input.hasForecast,
      compatible: input.compatible !== false,
      delayMonths: integer(
        input.delayMonths || 0,
        0,
        120,
        "Prazo de realocação",
      ),
      usageMode: input.usageMode === "custom" ? "custom" : "until-end",
      durationMonths: integer(
        input.durationMonths || 6,
        1,
        120,
        "Duração de uso",
      ),
      note: text(input.note, 600),
    };
  }
  return {
    MODEL_VERSION,
    PROFILES,
    PENALTY_RATE,
    cents,
    integer,
    parseDate,
    iso,
    addMonths,
    contractInfo,
    penalty,
    newLease,
    evaluate,
    assetEvaluation,
    normalizeAsset,
  };
});
