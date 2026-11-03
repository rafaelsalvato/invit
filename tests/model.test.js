const assert = require("node:assert/strict");
const M = require("../assets/js/model.js");
let count = 0;
function test(name, fn) {
  fn();
  count++;
  console.log("✓ " + name);
}
const base = {
  monthlyCents: 14828,
  remaining: 8,
  hasForecast: true,
  compatible: true,
  usageMode: "until-end",
};
test("Multa de 30% do saldo, sem demanda", () => {
  const r = M.evaluate({ ...base, hasForecast: false });
  assert.equal(r.giveBack.total, 35587);
  assert.equal(r.keep.total, 118624);
  assert.equal(r.decision, "return");
});
test("Realocação imediata: penalidade terminal do contrato substituto", () => {
  const r = M.evaluate({ ...base, delay: 0 });
  assert.equal(r.giveBack.total, 172005);
  assert.equal(r.keep.total, 118624);
  assert.equal(r.decision, "transfer");
});
test("Realocação em dois meses: R$326,21 a favor de manter", () => {
  const r = M.evaluate({ ...base, delay: 2 });
  assert.equal(r.giveBack.total, 151245);
  assert.equal(r.saving, 32621);
  assert.equal(r.decision, "keep");
});
test("Realocação em seis meses: R$88,97 a favor de devolver", () => {
  const r = M.evaluate({ ...base, delay: 6 });
  assert.equal(r.giveBack.total, 109727);
  assert.equal(r.saving, 8897);
  assert.equal(r.decision, "return");
});
test("Uso personalizado curto: devolução antecipada em ambos os cenários", () => {
  const r = M.evaluate({ ...base, delay: 2, usageMode: "custom", duration: 2 });
  assert.equal(r.keep.total, 77106);
  assert.equal(r.giveBack.total, 109727);
});
test("Demanda fora do contrato: nova locação é comum às duas políticas", () => {
  const r = M.evaluate({ ...base, delay: 8, usageMode: "custom", duration: 4 });
  assert.equal(r.keep.total, 213523);
  assert.equal(r.giveBack.total, 130486);
  assert.equal(r.servedByCurrent, 0);
});
test("Demanda atravessa vencimento: contratação complementar contabilizada", () => {
  const r = M.evaluate({
    ...base,
    delay: 2,
    usageMode: "custom",
    duration: 12,
  });
  assert.equal(r.keep.total, 234282);
  assert.equal(r.giveBack.total, 213523);
  assert.equal(r.decision, "return");
});
test("Empate de custos explícito", () => {
  const r = M.evaluate({
    ...base,
    delay: 0,
    usageMode: "custom",
    duration: 12,
  });
  assert.equal(r.decision, "tie");
  assert.equal(r.saving, 0);
});
test("Equipamento incompatível nunca cobre a demanda", () => {
  const r = M.evaluate({ ...base, delay: 0, compatible: false });
  assert.equal(r.servedByCurrent, 0);
  assert.equal(r.keep.total - r.giveBack.total, 83037);
});
test("Renovações a cada12 meses e multa somente no último contrato parcial", () => {
  assert.equal(M.newLease(14828, 12).total, 177936);
  assert.equal(M.newLease(14828, 13).total, 241696);
  assert.equal(M.newLease(14828, 24).penalty, 0);
});
test("Contrato vencido: estado próprio e nenhuma multa", () => {
  const r = M.evaluate({ ...base, remaining: 0 });
  assert.equal(r.decision, "expired");
  assert.equal(r.giveBack.total, 0);
});
test("Três configurações: recomendações consistentes no cenário-base", () => {
  for (const monthlyCents of Object.values(M.PROFILES)) {
    assert.equal(
      M.evaluate({ ...base, monthlyCents, delay: 2 }).decision,
      "keep",
    );
    assert.equal(
      M.evaluate({ ...base, monthlyCents, delay: 6 }).decision,
      "return",
    );
  }
});
test("Calendário: meses completos, parcela incompleta e ano bissexto", () => {
  assert.equal(M.contractInfo("2026-07-03", "2026-11-03").remaining, 8);
  assert.equal(M.contractInfo("2026-07-03", "2026-11-04").remaining, 8);
  assert.equal(M.contractInfo("2026-07-03", "2027-07-03").remaining, 0);
  assert.equal(M.addMonths("2024-02-29", 12), "2025-02-28");
  assert.equal(M.contractInfo("2027-07-03", "2026-11-03").future, true);
});
test("Validação rejeita dados monetários, datas e períodos inválidos", () => {
  assert.throws(() => M.cents(-1));
  assert.throws(() => M.parseDate("2026-02-30"));
  assert.throws(() => M.evaluate({ ...base, delay: -1 }));
  assert.throws(() =>
    M.evaluate({ ...base, usageMode: "custom", duration: 0 }),
  );
  assert.equal(M.cents("148,28"), 14828);
});
test("Arredondamento de multas por contrato", () => {
  const r = M.evaluate({ ...base, monthlyCents: 15986, delay: 2 });
  assert.equal(r.giveBack.currentPenalty, 38366);
  assert.equal(r.giveBack.replacementPenalty, 28775);
  assert.equal(r.giveBack.total, 163057);
});
console.log(`\n${count} verificações aprovadas.`);
