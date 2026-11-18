// src/core/utils/autofill.ts
export function generateBannerAutofillSnippet(crns: string[]): string {
  const safeCrns = Array.from(new Set(crns.map((c) => c.trim()).filter((c) => /^\d{5}$/.test(c))));
  if (safeCrns.length === 0) return '// No valid 5-digit CRNs selected.';

  const serializedCrns = JSON.stringify(safeCrns);
  return `(() => {
  const crns = ${serializedCrns};
  const addBtn = document.querySelector('#addAnotherCrn, button[id*="addAnotherCrn"]');
  for (let i = 1; i < crns.length && addBtn; i++) { addBtn.click(); }
  setTimeout(() => {
    const inputs = Array.from(document.querySelectorAll('input[id^="txt_crn"], input.crn-input'));
    crns.forEach((crn, idx) => {
      const el = inputs[idx];
      if (!el) return;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter ? setter.call(el, crn) : (el.value = crn);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const submitBtn = document.querySelector('#addCrnBtn, button[id*="addCrnBtn"]');
    if (submitBtn) submitBtn.focus();
    console.info('[ClassOptimizer] Populated ' + crns.length + ' CRNs:', crns.join(', '));
  }, 150);
})();`;
}

export function isValidCrn(crn: string): boolean {
  return /^\d{5}$/.test(crn.trim());
}
