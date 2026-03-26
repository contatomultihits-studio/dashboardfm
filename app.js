const dbKey = 'dashboardfm_v2';
const cfgKey = 'dashboardfm_supabase_cfg';

let hasSupabase = false;
let sb = null;

const state = { programas: [], premios: [], participacoes: [], prioridades: [] };

init();

async function init() {
  wireConfigButton();
  await bootstrapSupabase();
  await loadInitialData();
  wireTabs();
  wireForms();
  renderAll();
  updateDataModeBadge();
}

async function bootstrapSupabase() {
  const staticCfg = window.APP_CONFIG || {};
  const savedCfg = readSavedConfig();
  const envCfg = await readConfigFromServer();

  const cfg = {
    SUPABASE_URL: savedCfg.SUPABASE_URL || envCfg.SUPABASE_URL || staticCfg.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: savedCfg.SUPABASE_ANON_KEY || envCfg.SUPABASE_ANON_KEY || staticCfg.SUPABASE_ANON_KEY || ''
  };

  hasSupabase = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  sb = hasSupabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
}

function readSavedConfig() {
  try {
    const raw = JSON.parse(localStorage.getItem(cfgKey) || '{}');
    return {
      SUPABASE_URL: raw.SUPABASE_URL || '',
      SUPABASE_ANON_KEY: raw.SUPABASE_ANON_KEY || ''
    };
  } catch {
    return { SUPABASE_URL: '', SUPABASE_ANON_KEY: '' };
  }
}

async function readConfigFromServer() {
  try {
    const res = await fetch('/api/config', { cache: 'no-store' });
    if (!res.ok) return { SUPABASE_URL: '', SUPABASE_ANON_KEY: '' };
    const data = await res.json();
    return {
      SUPABASE_URL: data.supabaseUrl || '',
      SUPABASE_ANON_KEY: data.supabaseAnonKey || ''
    };
  } catch {
    return { SUPABASE_URL: '', SUPABASE_ANON_KEY: '' };
  }
}

function updateDataModeBadge() {
  const badge = document.getElementById('modo-dados');
  badge.textContent = hasSupabase ? 'Supabase conectado' : 'Modo local';
}

function wireConfigButton() {
  const btn = document.getElementById('btn-supabase');
  btn.addEventListener('click', () => {
    const url = prompt('Cole a URL do Supabase (https://xxxx.supabase.co):', '');
    if (!url) return;
    const key = prompt('Cole a ANON KEY do Supabase:', '');
    if (!key) return;

    localStorage.setItem(cfgKey, JSON.stringify({ SUPABASE_URL: url.trim(), SUPABASE_ANON_KEY: key.trim() }));
    alert('Configuração salva. A página vai recarregar para conectar.');
    location.reload();
  });
}

async function loadInitialData() {
  if (hasSupabase) {
    const queries = await Promise.allSettled([
      sb.from('programas').select('id,nome,cor_hex,ativo').order('nome'),
      sb.from('premios').select('id,programa_id,nome,descricao,estoque_inicial').order('nome'),
      sb.from('participacoes').select('id,programa_id,data_referencia,quantidade,tipo_registro'),
      sb.from('prioridades_ar').select('id,programa_id,data,conteudo,concluido'),
      sb.from('resumo_participacoes').select('programa,cor_hex,total_participacoes,dias_com_registro').order('total_participacoes', { ascending: false })
    ]);

    const [qProgramas, qPremios, qParticipacoes, qPrioridades, qResumo] = queries;

    if (qProgramas.status === 'fulfilled' && !qProgramas.value.error) {
      state.programas = (qProgramas.value.data || []).map((x) => ({ id: x.id, nome: x.nome, cor: x.cor_hex || '#2563eb', ativo: x.ativo }));
    }
    if (qPremios.status === 'fulfilled' && !qPremios.value.error) {
      state.premios = (qPremios.value.data || []).map((x) => ({ id: x.id, programaId: x.programa_id, nome: x.nome, descricao: x.descricao, estoque: x.estoque_inicial }));
    }
    if (qParticipacoes.status === 'fulfilled' && !qParticipacoes.value.error) {
      state.participacoes = (qParticipacoes.value.data || []).map((x) => ({ id: x.id, programaId: x.programa_id, data: x.data_referencia, quantidade: x.quantidade, tipo: x.tipo_registro }));
    }
    if (qPrioridades.status === 'fulfilled' && !qPrioridades.value.error) {
      state.prioridades = (qPrioridades.value.data || []).map((x) => ({ id: x.id, programaId: x.programa_id, data: x.data, conteudo: x.conteudo, concluido: x.concluido }));
    }

    if (!state.programas.length && qResumo.status === 'fulfilled' && !qResumo.value.error) {
      state.programas = (qResumo.value.data || []).map((x, i) => ({ id: `resumo-${i}`, nome: x.programa, cor: x.cor_hex || '#2563eb', ativo: true }));
      toast('Sem acesso à tabela programas. Exibindo nomes via resumo_participacoes.');
    }

    if (state.programas.length) return;
  }

  Object.assign(state, loadState());
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
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'gestor') await renderGestor();
    });
  });
}

function wireForms() {
  document.getElementById('form-programa').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = { nome: val('g-programa-nome'), cor: val('g-programa-cor'), ativo: document.getElementById('g-programa-ativo').checked };

    if (hasSupabase) {
      const { data, error } = await sb.from('programas').insert({ nome: payload.nome, cor_hex: payload.cor, ativo: payload.ativo }).select('id,nome,cor_hex,ativo').single();
      if (error) return toast(`Erro: ${error.message}`);
      state.programas.push({ id: data.id, nome: data.nome, cor: data.cor_hex || '#2563eb', ativo: data.ativo });
    } else {
      state.programas.push({ id: id(), ...payload });
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
    const payload = { programaId: val('g-premio-programa'), nome: val('g-premio-nome'), descricao: val('g-premio-desc'), estoque: Number(val('g-premio-estoque')) };

    if (hasSupabase) {
      if (hasSyntheticProgramId(payload.programaId)) return toast('Sem permissão na tabela programas para cadastro via prêmio.');
      const { data, error } = await sb.from('premios').insert({ programa_id: payload.programaId, nome: payload.nome, descricao: payload.descricao, estoque_inicial: payload.estoque }).select('id,programa_id,nome,descricao,estoque_inicial').single();
      if (error) return toast(`Erro: ${error.message}`);
      state.premios.push({ id: data.id, programaId: data.programa_id, nome: data.nome, descricao: data.descricao, estoque: data.estoque_inicial });
    } else {
      state.premios.push({ id: id(), ...payload });
      persistLocal();
    }

    e.target.reset();
    renderAll();
    toast('Prêmio adicionado.');
  });

  document.getElementById('form-participacao').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = { programaId: val('p-programa'), data: val('p-data'), quantidade: Number(val('p-quantidade')), tipo: val('p-tipo') };

    if (hasSupabase) {
      if (hasSyntheticProgramId(payload.programaId)) return toast('Sem permissão na tabela programas para lançar participação.');
      const { data, error } = await sb.from('participacoes').insert({ programa_id: payload.programaId, data_referencia: payload.data, quantidade: payload.quantidade, tipo_registro: payload.tipo }).select('id,programa_id,data_referencia,quantidade,tipo_registro').single();
      if (error) return toast(`Erro: ${error.message}`);
      state.participacoes.push({ id: data.id, programaId: data.programa_id, data: data.data_referencia, quantidade: data.quantidade, tipo: data.tipo_registro });
    } else {
      state.participacoes.push({ id: id(), ...payload });
      persistLocal();
    }

    e.target.reset();
    renderGestor();
    toast('Participação registrada.');
  });

  document.getElementById('form-prioridade').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = { programaId: val('pr-programa'), data: val('pr-data'), conteudo: val('pr-conteudo'), concluido: false };

    if (hasSupabase) {
      if (hasSyntheticProgramId(payload.programaId)) return toast('Sem permissão na tabela programas para lançar prioridade.');
      const { data, error } = await sb.from('prioridades_ar').insert({ programa_id: payload.programaId, data: payload.data, conteudo: payload.conteudo, concluido: false }).select('id,programa_id,data,conteudo,concluido').single();
      if (error) return toast(`Erro: ${error.message}`);
      state.prioridades.push({ id: data.id, programaId: data.programa_id, data: data.data, conteudo: data.conteudo, concluido: data.concluido });
    } else {
      state.prioridades.push({ id: id(), ...payload });
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
      if (hasSupabase) await sb.from('programas').delete().eq('id', idp);
      else persistLocal();
      renderAll();
      toast('Programa removido.');
    });
  });
}

function renderPremios() {
  const table = document.getElementById('tabela-premios');
  table.innerHTML = `<thead><tr><th>Programa</th><th>Nome</th><th>Descrição</th><th>Estoque</th></tr></thead><tbody>${state.premios.map((p) => { const prg = state.programas.find((x) => x.id === p.programaId); return `<tr><td>${prg?.nome || '-'}</td><td>${p.nome}</td><td>${p.descricao}</td><td>${p.estoque}</td></tr>`; }).join('')}</tbody>`;
}

async function renderGestor() {
  let resumo = [];
  if (hasSupabase) {
    const { data } = await sb.from('resumo_participacoes').select('programa,cor_hex,total_participacoes,dias_com_registro').order('total_participacoes', { ascending: false });
    if (data?.length) resumo = data.map((r) => ({ nome: r.programa, cor: r.cor_hex || '#2563eb', total: Number(r.total_participacoes), dias: Number(r.dias_com_registro) }));
  }

  if (!resumo.length) {
    resumo = state.programas.map((programa) => {
      const regs = state.participacoes.filter((p) => p.programaId === programa.id);
      return { nome: programa.nome, cor: programa.cor, total: regs.reduce((a, b) => a + b.quantidade, 0), dias: new Set(regs.map((r) => r.data)).size };
    }).sort((a, b) => b.total - a.total);
  }

  const total = resumo.reduce((acc, r) => acc + r.total, 0);
  const dias = resumo.reduce((acc, r) => acc + r.dias, 0);
  const lider = resumo[0]?.nome || '—';

  document.getElementById('kpis').innerHTML = `<div class="card"><small>Total de participações</small><div class="kpi-value">${total}</div></div><div class="card"><small>Dias com registro</small><div class="kpi-value">${dias}</div></div><div class="card"><small>Programa líder</small><div class="kpi-value">${lider}</div></div>`;

  const max = Math.max(1, ...resumo.map((r) => r.total));
  document.getElementById('bars').innerHTML = resumo.map((r) => `<div class="bar-row"><small>${r.nome}</small><div class="bar" style="width:${(r.total / max) * 100}%"></div><small>${r.total}</small></div>`).join('');
  document.getElementById('tabela-ranking').innerHTML = `<thead><tr><th>Programa</th><th>Total</th><th>Dias</th></tr></thead><tbody>${resumo.map((r) => `<tr><td>${r.nome}</td><td>${r.total}</td><td>${r.dias}</td></tr>`).join('')}</tbody>`;
}


function hasSyntheticProgramId(idPrograma) { return String(idPrograma || "").startsWith("resumo-"); }

function val(idEl) { return document.getElementById(idEl).value; }
function id() { return Math.random().toString(36).slice(2, 10); }
function toast(text) { const el = document.getElementById('toast'); el.textContent = text; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 1700); }
