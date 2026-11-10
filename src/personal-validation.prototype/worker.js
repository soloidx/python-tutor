/* Disposable runtime. Only its private port carries bounded observations. */
(() => {
  'use strict';
  const P = ValidationProtocol;
  const finite = Number.isFinite, abs = Math.abs;
  const decoder = new TextDecoder();
  let booted = false;
  self.onmessage = async ({data}) => {
    if (booted || !P.fields(data, ['v', 'type', 'assets', 'port']) || data.v !== 1 || data.type !== 'bootstrap' || !(data.port instanceof MessagePort)) return;
    booted = true;
    self.onmessage = null;
    const port = data.port;
    const send = port.postMessage.bind(port);
    const assets = new Map();
    let phase = 'loading', output = '', errors = '', overflow = false, python;
    const emit = message => { if (P.workerReply(message)) send(message); };
    const problem = (type, message) => ({v: 1, type, message: message.slice(0, 20000), output: output.trimEnd()});
    const append = (channel, text) => {
      const next = typeof text === 'string' ? text : '';
      const previous = channel === 'out' ? output : errors;
      if (previous.length + next.length + 1 > 20000) overflow = true;
      const value = previous + next.slice(0, Math.max(0, 20000 - previous.length)) + (previous.length + next.length < 20000 ? '\n' : '');
      if (channel === 'out') output = value; else errors = value;
    };
    self.fetch = async url => {
      const key = String(url).replace('https://prototype-runtime.invalid/', '');
      if (!assets.has(key)) throw new Error('Recurso no incluido en el prototipo.');
      return new Response(assets.get(key), {headers: {'Content-Type': key.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream'}});
    };
    try {
      if (!P.fields(data.assets, ['pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json'])) throw new Error('Assets incompletos.');
      for (const [key, value] of Object.entries(data.assets)) {
        if (!(value instanceof ArrayBuffer) || value.byteLength > 64 * 1024 * 1024) throw new Error('Asset fuera de perfil.');
        assets.set(key, value);
      }
      python = await loadPyodide({
        indexURL: 'https://prototype-runtime.invalid/', lockFileContents: decoder.decode(assets.get('pyodide-lock.json')), jsglobals: {},
        stdout: text => append('out', text), stderr: text => append('err', text),
        stdin: () => { throw new Error('Este perfil no admite input().'); },
      });
      if (python.version !== '0.28.3') throw new Error('Se requiere Pyodide 0.28.3.');
      const namespace = python.globals.get('dict')();
      const readValue = namespace.get.bind(namespace);
      const flush = () => python.runPython('import sys, os; sys.stdout.flush(); sys.stderr.flush(); os.fsync(1); os.fsync(2)');
      flush(); output = ''; errors = ''; overflow = false;
      port.onmessage = async ({data: request}) => {
        if (phase !== 'ready' || !P.fields(request, ['v', 'type', 'code', 'names']) || request.v !== 1 || request.type !== 'run' || !P.text(request.code, 16000) || !Array.isArray(request.names) || request.names.length > 20 || !request.names.every(P.name)) return;
        phase = 'running';
        try {
          const result = await python.runPythonAsync(request.code, {globals: namespace});
          result?.destroy?.();
          flush();
          const variables = Object.create(null);
          for (const name of request.names) {
            const value = readValue(name), type = typeof value;
            if (type === 'string' && value.length <= 20000 || type === 'boolean' || type === 'number' && finite(value) && abs(value) <= 9007199254740991) variables[name] = {type, value};
            else {
              value?.destroy?.();
              emit(problem('unsupported', 'Variable ausente o fuera del perfil: solo texto, booleanos y números finitos dentro del rango admitido.'));
              return;
            }
          }
          if (overflow) emit(problem('limit', 'La salida superó 20.000 caracteres; el caso no se valida.'));
          else if (errors) emit(problem('execution-error', errors));
          else emit({v: 1, type: 'observations', output: output.trimEnd(), variables});
        } catch (error) {
          try { flush(); } catch {}
          emit(problem(overflow ? 'limit' : 'execution-error', overflow ? 'La salida superó el límite.' : String(error)));
        } finally { phase = 'closed'; namespace.destroy(); }
      };
      port.start();
      phase = 'ready';
      emit({v: 1, type: 'ready', version: python.version});
    } catch (error) { phase = 'closed'; emit(problem('load-error', String(error))); }
  };
})();
