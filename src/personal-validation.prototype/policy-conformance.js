/* Benign browser-policy fixture, never runs Python or handles user data. */
(() => {
  const violations = [];
  addEventListener('securitypolicyviolation', event => violations.push(event.effectiveDirective));
  onmessage = async () => {
    let connection = 'allowed', childWorker = 'allowed';
    try { await fetch('/policy-target'); } catch { connection = 'denied'; }
    try {
      const child = new Worker('/policy-target');
      childWorker = await new Promise(resolve => {
        const timer = setTimeout(() => resolve('unknown'), 1000);
        child.onerror = event => { event.preventDefault(); clearTimeout(timer); resolve('denied'); };
      });
      child.terminate();
    } catch { childWorker = 'denied'; }
    setTimeout(() => postMessage({connection, childWorker, violations}), 100);
  };
})();
