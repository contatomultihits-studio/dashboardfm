const dbKey = 'dashboardfm_v2';
const cfg = window.APP_CONFIG || {};
const hasSupabase = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
const sb = hasSupabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

const state = { programas: [], premios: [], participacoes: [], prioridades: [] };

init();

async function init() {
  await loadInitialData();
  wireTabs();
  wireForms();
  renderAll();
  document.getElementById('modo-dados').textContent = hasSupabase ? 'Supabase conectado' : 'Modo local';
}

async function loadInitialData() {
  if (hasSupabase) {
    try {
      const [programas, premios, participacoes, prioridades] = await Promise.all([
        sb.from('programas').select('id,nome,cor_hex,ativo').order('nome'),
        sb.from('premios').select('id,programa_id,nome,descricao,estoque_inicial').order('nome'),
        sb.from('participacoes').select('id,programa_id,data_referencia,quantidade,tipo_registro'),
        sb.from('prioridades_ar').select('id,programa_id,data,conteudo,concluido')
      ]);

      state.programas = (programas.data || []).map((x) => ({ id: x.id, nome: x.nome, cor: x.cor_hex || '#2563eb', ativo: x.ativo }));
      state.premios = (premios.data || []).map((x) => ({ id: x.id, programaId: x.programa_id, nome: x.nome, descricao: x.descricao, estoque: x.estoque_inicial }));
      state.participacoes = (participacoes.data || []).map((x) => ({ id: x.id, programaId: x.programa_id, data: x.data_referencia, quantidade: x.quantidade, tipo: x.tipo_registro }));
      state.prioridades = (prioridades.data || []).map((x) => ({ id: x.id, programaId: x.programa_id, data: x.data, conteudo: x.conteudo, concluido: x.concluido }));
      if (!state.programas.length) seedIfNeeded();
      return;
    } catch {
      toast('Falha no Supabase. Entrando em modo local.');
    }
  }

  const local = loadState();
  Object.assign(state, local);
  seedIfNeeded();
}

function loadState() {
  const raw = localStorage.getItem(dbKey);
  if (!raw) return { programas: [], premios: [], participacoes: [], prioridades: [] };
  try { return JSON.parse(raw); } catch { return { programas: [], premios: [], participacoes: [], prioridades: [] }; }
}

function persistLocal() { localStorage.setItem(dbKey, JSON.stringify(state)); }

function seedIfNeeded() {
  if (state.programas.length) return;
  state.programas = [
    { id: id(), nome: 'Manhã Hits', cor: '#2563eb', ativo: true },
    { id: id(), nome: 'Tarde Total', cor: '#0ea5e9', ativo: true }
  ];
  if (!hasSupabase) persistLocal();
}

function wireTabs() {
  document.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'gestor') renderGestor();
    });
  });
}

function wireForms() {
  document.getElementById('form-programa').addEventListener('submit', async (e) => {
    e.preventDefault();
    const item = { id: id(), nome: val('g-programa-nome'), cor: val('g-programa-cor'), ativo: document.getElementById('g-programa-ativo').checked };
    state.programas.push(item);
    if (hasSupabase) {
      await sb.from('programas').insert({ nome: item.nome, cor_hex: item.cor, ativo: item.ativo });
    } else {
      persistLocal();
    }
    e.target.reset();
    document.getElementById('g-programa-cor').value = '#2563eb';
    document.getElementById('g-programa-ativo').checked = true;
    renderAll();
    toast('Programa adicionado.');
  });

  document.getElementById('form-premio').addEventListener('submit', async (e) => {
    e.preventDefault();
    const item = { id: id(), programaId: val('g-premio-programa'), nome: val('g-premio-nome'), descricao: val('g-premio-desc'), estoque: Number(val('g-premio-estoque')) };
    state.premios.push(item);
    if (hasSupabase) {
      await sb.from('premios').insert({ programa_id: item.programaId, nome: item.nome, descricao: item.descricao, estoque_inicial: item.estoque });
    } else {
      persistLocal();
    }
    e.target.reset();
    renderAll();
    toast('Prêmio adicionado.');
  });

  document.getElementById('form-participacao').addEventListener('submit', async (e) => {
    e.preventDefault();
    const item = { id: id(), programaId: val('p-programa'), data: val('p-data'), quantidade: Number(val('p-quantidade')), tipo: val('p-tipo') };
    state.participacoes.push(item);
    if (hasSupabase) {
      await sb.from('participacoes').insert({ programa_id: item.programaId, data_referencia: item.data, quantidade: item.quantidade, tipo_registro: item.tipo });
    } else {
      persistLocal();
    }
    e.target.reset();
    renderGestor();
    toast('Participação registrada.');
  });

  document.getElementById('form-prioridade').addEventListener('submit', async (e) => {
    e.preventDefault();
    const item = { id: id(), programaId: val('pr-programa'), data: val('pr-data'), conteudo: val('pr-conteudo'), concluido: false };
    state.prioridades.push(item);
    if (hasSupabase) {
      await sb.from('prioridades_ar').insert({ programa_id: item.programaId, data: item.data, conteudo: item.conteudo, concluido: false });
    } else {
      persistLocal();
    }
    e.target.reset();
    toast('Prioridade salva.');
  });
}

function renderAll() {
  fillProgramSelect('p-programa');
  fillProgramSelect('pr-programa');
  fillProgramSelect('g-premio-programa');
  renderProgramas();
  renderPremios();
  renderGestor();
}

function fillProgramSelect(idSel) {
  const sel = document.getElementById(idSel);
  sel.innerHTML = '<option value="">Selecione...</option>' + state.programas.map((p) => `<option value="${p.id}">${p.nome}</option>`).join('');
}

function renderProgramas() {
  const table = document.getElementById('tabela-programas');
  table.innerHTML = `<thead><tr><th>Nome</th><th>Cor</th><th>Status</th><th></th></tr></thead><tbody>${state.programas.map((p) => `<tr><td>${p.nome}</td><td><span style="display:inline-block;width:10px;height:10px;border-radius:999px;background:${p.cor}"></span> ${p.cor}</td><td>${p.ativo ? 'Ativo' : 'Inativo'}</td><td><button data-rm-programa="${p.id}">Excluir</button></td></tr>`).join('')}</tbody>`;

  table.querySelectorAll('[data-rm-programa]').forEach((b) => {
    b.addEventListener('click', async () => {
      const idp = b.dataset.rmPrograma;
      state.programas = state.programas.filter((p) => p.id !== idp);
      if (hasSupabase) {
        await sb.from('programas').delete().eq('id', idp);
      } else {
        persistLocal();
      }
      renderAll();
      toast('Programa removido.');
    });
  });
}

function renderPremios() {
  const table = document.getElementById('tabela-premios');
  table.innerHTML = `<thead><tr><th>Programa</th><th>Nome</th><th>Descrição</th><th>Estoque</th></tr></thead><tbody>${state.premios.map((p) => { const prg = state.programas.find((x) => x.id === p.programaId); return `<tr><td>${prg?.nome || '-'}</td><td>${p.nome}</td><td>${p.descricao}</td><td>${p.estoque}</td></tr>`; }).join('')}</tbody>`;
}

function renderGestor() {
  const resumo = state.programas.map((programa) => {
    const regs = state.participacoes.filter((p) => p.programaId === programa.id);
    return { nome: programa.nome, cor: programa.cor, total: regs.reduce((a, b) => a + b.quantidade, 0), dias: new Set(regs.map((r) => r.data)).size };
  }).sort((a, b) => b.total - a.total);

  const total = resumo.reduce((acc, r) => acc + r.total, 0);
  const dias = resumo.reduce((acc, r) => acc + r.dias, 0);
  const lider = resumo[0]?.nome || '—';

  document.getElementById('kpis').innerHTML = `<div class="card"><small>Total de participações</small><div class="kpi-value">${total}</div></div><div class="card"><small>Dias com registro</small><div class="kpi-value">${dias}</div></div><div class="card"><small>Programa líder</small><div class="kpi-value">${lider}</div></div>`;

  const max = Math.max(1, ...resumo.map((r) => r.total));
  document.getElementById('bars').innerHTML = resumo.map((r) => `<div class="bar-row"><small>${r.nome}</small><div class="bar" style="width:${(r.total / max) * 100}%"></div><small>${r.total}</small></div>`).join('');
  document.getElementById('tabela-ranking').innerHTML = `<thead><tr><th>Programa</th><th>Total</th><th>Dias</th></tr></thead><tbody>${resumo.map((r) => `<tr><td>${r.nome}</td><td>${r.total}</td><td>${r.dias}</td></tr>`).join('')}</tbody>`;
}

function val(idEl) { return document.getElementById(idEl).value; }
function id() { return Math.random().toString(36).slice(2, 10); }
function toast(text) { const el = document.getElementById('toast'); el.textContent = text; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 1700); }
