const dbKey = 'dashboardfm_v2';
const cfgKey = 'dashboardfm_supabase_cfg';

let hasSupabase = false;
let sb = null;
let showAllParticipacoes = false;
let hasGanhadorTelefoneColumn = true;
const editModalState = { tipo: null, id: null };
const tipoRegistroPadrao = window.APP_CONFIG?.TIPO_REGISTRO_PADRAO || 'DIARIO_REALTIME';
const state = { programas: [], premios: [], participacoes: [] };

init();

async function init() {
  wireConfigButton();
  await bootstrapSupabase();
  await loadInitialData();
  wireTabs();
  wireForms();
  wireEditModal();
  initDefaultDates();
  wireFilters();
  renderAll();
  setInterval(refreshAllData, 180000);
}

async function refreshAllData() {
  if (!hasSupabase) return;
  await loadInitialData();
  renderAll();
  toast('DADOS ATUALIZADOS');
}

async function bootstrapSupabase() {
  const staticCfg = window.APP_CONFIG || {};
  const savedCfg = JSON.parse(localStorage.getItem(cfgKey) || '{}');
  const envCfg = await readConfigFromServer();
  const cfg = {
    SUPABASE_URL: savedCfg.SUPABASE_URL || envCfg.SUPABASE_URL || staticCfg.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: savedCfg.SUPABASE_ANON_KEY || envCfg.SUPABASE_ANON_KEY || staticCfg.SUPABASE_ANON_KEY || ''
  };
  hasSupabase = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  sb = hasSupabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
}

async function readConfigFromServer() {
  try {
    const res = await fetch('/api/config', { cache: 'no-store' });
    if (!res.ok) return {};
    const data = await res.json();
    return { SUPABASE_URL: data.supabaseUrl || '', SUPABASE_ANON_KEY: data.supabaseAnonKey || '' };
  } catch { return {}; }
}

function wireConfigButton() {
  document.getElementById('btn-supabase').addEventListener('click', () => {
    const url = prompt('URL do Supabase:', '');
    if (!url) return;
    const key = prompt('ANON KEY:', '');
    if (!key) return;
    localStorage.setItem(cfgKey, JSON.stringify({ SUPABASE_URL: url.trim(), SUPABASE_ANON_KEY: key.trim() }));
    location.reload();
  });
}

async function loadInitialData() {
  if (hasSupabase) {
    const [p1, p2, p3] = await Promise.all([
      sb.from('programas').select('id,nome,cor_hex,ativo').order('nome'),
      sb.from('premios').select('*').order('inicio_vigencia', { ascending: true }),
      sb.from('participacoes').select('id,programa_id,data_referencia,quantidade,tipo_registro').order('data_referencia', { ascending: false })
    ]);
    if (p1.error || p2.error || p3.error) {
      toast(`ERRO SUPABASE: ${(p1.error || p2.error || p3.error).message}`);
      return;
    }
    state.programas = (p1.data || []).map((x) => ({ id: x.id, nome: x.nome, cor: x.cor_hex || '#2563eb', ativo: x.ativo }));
    state.premios = (p2.data || []).map((x) => ({
      id: x.id,
      nome: x.nome,
      descricao: x.descricao,
      inicio: x.inicio_vigencia,
      fim: x.fim_vigencia,
      ganhador: x.ganhador_nome || '',
      telefone: x.ganhador_telefone || ''
    }));
    state.participacoes = (p3.data || []).map((x) => ({ id: x.id, programaId: x.programa_id, data: x.data_referencia, quantidade: x.quantidade, tipo: x.tipo_registro }));
    return;
  }

  const local = JSON.parse(localStorage.getItem(dbKey) || '{"programas":[],"premios":[],"participacoes":[]}');
  Object.assign(state, local);
}

function persistLocal() { localStorage.setItem(dbKey, JSON.stringify(state)); }

function wireTabs() {
  document.querySelectorAll('[data-tab]').forEach((btn) => btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  }));
}

function wireForms() {
  document.getElementById('form-programa').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = { nome: val('g-programa-nome'), cor: val('g-programa-cor'), ativo: document.getElementById('g-programa-ativo').checked };
    if (hasSupabase) {
      const { error } = await sb.from('programas').insert({ nome: payload.nome, cor_hex: payload.cor, ativo: payload.ativo });
      if (error) return toast(`ERRO: ${error.message}`);
      await syncAfterMutation();
    } else { state.programas.push({ id: id(), ...payload }); persistLocal(); }
    e.target.reset(); renderAll();
  });

  document.getElementById('form-premio').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      nome: val('g-premio-nome'), descricao: val('g-premio-desc'),
      inicio: new Date(val('g-premio-inicio')).toISOString(), fim: new Date(val('g-premio-fim')).toISOString(),
      ganhador: val('g-premio-ganhador') || null, telefone: val('g-premio-telefone') || null
    };
    if (hasSupabase) {
      const { data, error } = await insertPremioSupabase(payload);
      if (error) return toast(`ERRO: ${error.message}`);
      if (!data?.id) return toast('ERRO: prêmio não retornou ID');
      await syncAfterMutation();
    } else { state.premios.push({ id: id(), ...payload }); persistLocal(); }
    e.target.reset();
    document.getElementById('g-premio-inicio').value = '';
    document.getElementById('g-premio-fim').value = '';
    renderAll();
  });

  document.getElementById('form-participacao').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = { programaId: val('p-programa'), data: val('p-data'), quantidade: Number(val('p-quantidade')), tipo: tipoRegistroPadrao };
    if (hasSupabase) {
      const { data, error } = await sb.from('participacoes').insert({ programa_id: payload.programaId, data_referencia: payload.data, quantidade: payload.quantidade, tipo_registro: payload.tipo }).select('id,programa_id,data_referencia,quantidade,tipo_registro').single();
      if (error) return toast(`ERRO: ${error.message}`);
      if (!data?.id) return toast('ERRO: participação não retornou ID');
      await syncAfterMutation();
    } else { state.participacoes.unshift({ id: id(), ...payload }); persistLocal(); }
    e.target.reset(); document.getElementById('p-data').value = todayISO(); renderAll();
  });

  document.getElementById('btn-toggle-participacoes').addEventListener('click', () => {
    showAllParticipacoes = !showAllParticipacoes;
    renderParticipacoes();
  });
}

function wireEditModal() {
  document.getElementById('btn-close-modal').addEventListener('click', closeEditModal);
  document.getElementById('edit-modal').addEventListener('click', (e) => {
    if (e.target.id === 'edit-modal') closeEditModal();
  });
  document.getElementById('edit-modal-form').addEventListener('submit', submitEditModal);
}

function wireFilters() {
  document.getElementById('btn-aplicar-filtro').addEventListener('click', () => renderDashboard());
  document.getElementById('btn-refresh').addEventListener('click', async () => refreshAllData());
}

function initDefaultDates() {
  const start = firstDayOfMonthISO();
  const end = todayISO();
  document.getElementById('p-data').value = end;
  document.getElementById('filtro-de').value = start;
  document.getElementById('filtro-ate').value = end;
}

function renderAll() {
  fillProgramSelect('p-programa');
  renderProgramas();
  renderPremiosGerenciamento();
  renderParticipacoes();
  renderDashboard();
}

function fillProgramSelect(idSel) {
  const sel = document.getElementById(idSel);
  sel.innerHTML = '<option value="">SELECIONE...</option>' + state.programas.map((p) => `<option value="${p.id}">${p.nome}</option>`).join('');
}

function renderParticipacoes() {
  const items = showAllParticipacoes ? state.participacoes : state.participacoes.slice(0, 5);
  document.getElementById('btn-toggle-participacoes').textContent = showAllParticipacoes ? 'MOSTRAR SÓ AS 5 ÚLTIMAS' : 'VER MAIS ANTIGAS';
  const t = document.getElementById('tabela-participacoes');
  t.innerHTML = `<thead><tr><th>DATA</th><th>PROGRAMA</th><th>QTD</th><th>AÇÕES</th></tr></thead><tbody>${items.map((p)=>{const pr=state.programas.find(x=>x.id===p.programaId);return `<tr><td>${p.data}</td><td>${pr?.nome||'-'}</td><td>${p.quantidade}</td><td><button data-edit-part='${p.id}'>EDITAR</button> <button data-del-part='${p.id}'>EXCLUIR</button></td></tr>`}).join('')}</tbody>`;
  t.querySelectorAll('[data-edit-part]').forEach((b)=>b.addEventListener('click', ()=>openEditModal('participacao', b.dataset.editPart)));
  t.querySelectorAll('[data-del-part]').forEach((b)=>b.addEventListener('click', async()=>{
    const idp=b.dataset.delPart;
    if(!confirm('TEM CERTEZA QUE DESEJA EXCLUIR ESTA PARTICIPAÇÃO?')) return;
    state.participacoes=state.participacoes.filter(x=>x.id!==idp);
    if(hasSupabase){
      const { error } = await sb.from('participacoes').delete().eq('id',idp);
      if (error) return toast(`ERRO: ${error.message}`);
      await syncAfterMutation();
    } else persistLocal();
    renderAll();
  }));
}

function renderProgramas() {
  const t=document.getElementById('tabela-programas');
  t.innerHTML=`<thead><tr><th>NOME</th><th>COR</th><th>STATUS</th><th>AÇÕES</th></tr></thead><tbody>${state.programas.map((p)=>`<tr><td>${p.nome}</td><td>${p.cor}</td><td>${p.ativo?'ATIVO':'INATIVO'}</td><td><button data-edit-prog='${p.id}'>EDITAR</button> <button data-del-prog='${p.id}'>EXCLUIR</button></td></tr>`).join('')}</tbody>`;
  t.querySelectorAll('[data-edit-prog]').forEach((b)=>b.addEventListener('click', ()=>openEditModal('programa', b.dataset.editProg)));
  t.querySelectorAll('[data-del-prog]').forEach((b)=>b.addEventListener('click', async()=>{
    const idp=b.dataset.delProg;
    if(!confirm('TEM CERTEZA QUE DESEJA EXCLUIR ESTE PROGRAMA?')) return;
    state.programas=state.programas.filter(x=>x.id!==idp);
    state.participacoes=state.participacoes.filter(x=>x.programaId!==idp);
    if(hasSupabase){
      const { error } = await sb.from('programas').delete().eq('id',idp);
      if (error) return toast(`ERRO: ${error.message}`);
      await syncAfterMutation();
    } else persistLocal();
    renderAll();
  }));
}

function renderPremiosGerenciamento() {
  const t=document.getElementById('tabela-premios-gerenciamento');
  t.innerHTML=`<thead><tr><th>PRÊMIO</th><th>GANHADOR</th><th>AÇÕES</th></tr></thead><tbody>${state.premios.map((p)=>`<tr><td>${p.nome}</td><td>${p.ganhador||'-'}</td><td><button data-edit-premio='${p.id}'>EDITAR</button> <button data-del-premio='${p.id}'>EXCLUIR</button></td></tr>`).join('')}</tbody>`;
  t.querySelectorAll('[data-edit-premio]').forEach((b)=>b.addEventListener('click', ()=>openEditModal('premio', b.dataset.editPremio)));
  t.querySelectorAll('[data-del-premio]').forEach((b)=>b.addEventListener('click', async()=>{
    const idp=b.dataset.delPremio;
    if(!confirm('TEM CERTEZA QUE DESEJA EXCLUIR ESTE PRÊMIO?')) return;
    state.premios=state.premios.filter(x=>x.id!==idp);
    if(hasSupabase){
      const { error } = await sb.from('premios').delete().eq('id',idp);
      if (error) return toast(`ERRO: ${error.message}`);
      await syncAfterMutation();
    } else persistLocal();
    renderAll();
  }));
}

function renderDashboard() {
  const de = document.getElementById('filtro-de').value;
  const ate = document.getElementById('filtro-ate').value;
  document.getElementById('periodo-label').textContent = `DADOS DE ${monthName(ate).toUpperCase()} • ${hasSupabase ? 'SUPABASE' : 'LOCAL'}`;

  let regs=[...state.participacoes];
  if(de) regs=regs.filter(r=>r.data>=de);
  if(ate) regs=regs.filter(r=>r.data<=ate);
  const resumo=state.programas.map((p)=>{const r=regs.filter(x=>x.programaId===p.id);return {nome:p.nome,total:r.reduce((a,b)=>a+b.quantidade,0),dias:new Set(r.map(x=>x.data)).size};}).sort((a,b)=>b.total-a.total);
  const total=resumo.reduce((a,b)=>a+b.total,0), dias=resumo.reduce((a,b)=>a+b.dias,0), lider=resumo[0]?.nome||'—';
  document.getElementById('kpis').innerHTML=`<div class='card'><small>TOTAL DE PARTICIPAÇÕES</small><div class='kpi-value'>${total}</div></div><div class='card'><small>DIAS COM REGISTRO</small><div class='kpi-value'>${dias}</div></div><div class='card'><small>PROGRAMA LÍDER</small><div class='kpi-value'>${lider}</div></div>`;
  const max=Math.max(1,...resumo.map(r=>r.total));
  document.getElementById('bars').innerHTML=resumo.map(r=>`<div class='bar-row'><small>${r.nome}</small><div class='bar' style='width:${(r.total/max)*100}%'></div><small>${r.total}</small></div>`).join('');
  document.getElementById('tabela-ranking').innerHTML=`<thead><tr><th>PROGRAMA</th><th>TOTAL</th><th>DIAS</th></tr></thead><tbody>${resumo.map(r=>`<tr><td>${r.nome}</td><td>${r.total}</td><td>${r.dias}</td></tr>`).join('')}</tbody>`;

  const now=new Date().toISOString();
  const ativos=state.premios.filter(p=>(!p.inicio||p.inicio<=now)&&(!p.fim||p.fim>=now));
  const futuros=state.premios.filter(p=>p.inicio&&p.inicio>now).sort((a,b)=>a.inicio.localeCompare(b.inicio));
  const passados=state.premios.filter(p=>p.fim&&p.fim<now).sort((a,b)=>b.fim.localeCompare(a.fim));
  const atual=ativos[0]||futuros[0]||state.premios[0];

  document.getElementById('premio-vigente-titulo').textContent=atual?atual.nome:'NENHUM PRÊMIO';
  document.getElementById('premio-vigente-desc').textContent=atual?(atual.descricao||'SEM DESCRIÇÃO'):'CADASTRE PRÊMIOS';
  document.getElementById('premio-vigente-ganhador').textContent=atual?.ganhador||'SEM GANHADOR';
  document.getElementById('premio-vigente-telefone').textContent=phoneMask(atual?.telefone);

  document.getElementById('proximos-premios').innerHTML=(futuros.slice(0,2).map(p=>`<div class='next-item'><strong>${p.nome}</strong><br/><small>${fmtHour(p.inicio)} - ${fmtHour(p.fim)}</small></div>`).join('')||'<small>SEM PRÓXIMOS PRÊMIOS</small>');
  document.getElementById('tabela-historico-premios').innerHTML=`<thead><tr><th>PRÊMIO</th><th>GANHADOR</th><th>FIM</th></tr></thead><tbody>${passados.slice(0,20).map(p=>`<tr><td>${p.nome}</td><td>${p.ganhador||'-'}</td><td>${fmtHour(p.fim)}</td></tr>`).join('')}</tbody>`;
}

function phoneMask(phone){if(!phone)return 'TEL: --';const d=String(phone).replace(/\D/g,'');return `TEL: ****${d.slice(-4)}`;}
function fmtHour(iso){if(!iso)return '--';return new Date(iso).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});}
function toDatetimeLocal(iso){if(!iso)return '';const d=new Date(iso);const pad=(n)=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;}
function monthName(dateISO){const d=dateISO?new Date(`${dateISO}T00:00:00`):new Date();return d.toLocaleDateString('pt-BR',{month:'long'});}
function todayISO(){return new Date().toISOString().slice(0,10);}
function firstDayOfMonthISO(){const d=new Date();d.setDate(1);return d.toISOString().slice(0,10);}
function val(idEl){return document.getElementById(idEl).value;}
function id(){return Math.random().toString(36).slice(2,10);}
function toast(text){const el=document.getElementById('toast');el.textContent=text;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1700);}

async function insertPremioSupabase(payload){
  const basePayload = {
    nome: payload.nome,
    descricao: payload.descricao,
    inicio_vigencia: payload.inicio,
    fim_vigencia: payload.fim,
    ganhador_nome: payload.ganhador,
    programa_id: null
  };

  if (hasGanhadorTelefoneColumn) {
    const firstTry = await sb.from('premios').insert({ ...basePayload, ganhador_telefone: payload.telefone }).select('*').single();
    if (!firstTry.error || !isMissingTelefoneColumnError(firstTry.error)) return firstTry;
    hasGanhadorTelefoneColumn = false;
  }

  return sb.from('premios').insert(basePayload).select('*').single();
}

async function updatePremioSupabase(idPremio, payload){
  const basePayload = {
    nome: payload.nome,
    descricao: payload.descricao,
    inicio_vigencia: payload.inicio,
    fim_vigencia: payload.fim,
    ganhador_nome: payload.ganhador
  };

  if (hasGanhadorTelefoneColumn) {
    const firstTry = await sb.from('premios').update({ ...basePayload, ganhador_telefone: payload.telefone }).eq('id', idPremio);
    if (!firstTry.error || !isMissingTelefoneColumnError(firstTry.error)) return firstTry;
    hasGanhadorTelefoneColumn = false;
  }

  return sb.from('premios').update(basePayload).eq('id', idPremio);
}

function isMissingTelefoneColumnError(error) {
  return String(error?.message || '').toLowerCase().includes('ganhador_telefone');
}

async function syncAfterMutation() {
  if (hasSupabase) await loadInitialData();
  else persistLocal();
}

function openEditModal(tipo, itemId) {
  editModalState.tipo = tipo;
  editModalState.id = itemId;
  hideEditGroups();
  const modal = document.getElementById('edit-modal');
  const title = document.getElementById('edit-modal-title');

  if (tipo === 'programa') {
    const item = state.programas.find((x) => x.id === itemId);
    if (!item) return;
    title.textContent = 'EDITAR PROGRAMA';
    document.getElementById('edit-fields-programa').classList.remove('hidden');
    document.getElementById('e-programa-nome').value = item.nome || '';
    document.getElementById('e-programa-cor').value = item.cor || '#2563eb';
    document.getElementById('e-programa-ativo').checked = Boolean(item.ativo);
  }

  if (tipo === 'premio') {
    const item = state.premios.find((x) => x.id === itemId);
    if (!item) return;
    title.textContent = 'EDITAR PRÊMIO';
    document.getElementById('edit-fields-premio').classList.remove('hidden');
    document.getElementById('e-premio-nome').value = item.nome || '';
    document.getElementById('e-premio-desc').value = item.descricao || '';
    document.getElementById('e-premio-inicio').value = toDatetimeLocal(item.inicio);
    document.getElementById('e-premio-fim').value = toDatetimeLocal(item.fim);
    document.getElementById('e-premio-ganhador').value = item.ganhador || '';
    document.getElementById('e-premio-telefone').value = item.telefone || '';
  }

  if (tipo === 'participacao') {
    const item = state.participacoes.find((x) => x.id === itemId);
    if (!item) return;
    title.textContent = 'EDITAR PARTICIPAÇÃO';
    document.getElementById('edit-fields-participacao').classList.remove('hidden');
    const sel = document.getElementById('e-participacao-programa');
    sel.innerHTML = state.programas.map((p) => `<option value="${p.id}">${p.nome}</option>`).join('');
    sel.value = item.programaId || '';
    document.getElementById('e-participacao-data').value = item.data || '';
    document.getElementById('e-participacao-qtd').value = item.quantidade || 0;
  }

  modal.classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.add('hidden');
  editModalState.tipo = null;
  editModalState.id = null;
}

function hideEditGroups() {
  document.getElementById('edit-fields-programa').classList.add('hidden');
  document.getElementById('edit-fields-premio').classList.add('hidden');
  document.getElementById('edit-fields-participacao').classList.add('hidden');
}

async function submitEditModal(e) {
  e.preventDefault();
  if (!editModalState.tipo || !editModalState.id) return;

  if (editModalState.tipo === 'programa') {
    const item = state.programas.find((x) => x.id === editModalState.id);
    if (!item) return;
    const nome = document.getElementById('e-programa-nome').value;
    const cor = document.getElementById('e-programa-cor').value;
    const ativo = document.getElementById('e-programa-ativo').checked;
    Object.assign(item, { nome, cor, ativo });
    if (hasSupabase) {
      const { error } = await sb.from('programas').update({ nome, cor_hex: cor, ativo }).eq('id', item.id);
      if (error) return toast(`ERRO: ${error.message}`);
      await syncAfterMutation();
    } else persistLocal();
  }

  if (editModalState.tipo === 'premio') {
    const item = state.premios.find((x) => x.id === editModalState.id);
    if (!item) return;
    const nome = document.getElementById('e-premio-nome').value;
    const descricao = document.getElementById('e-premio-desc').value;
    const inicio = new Date(document.getElementById('e-premio-inicio').value).toISOString();
    const fim = new Date(document.getElementById('e-premio-fim').value).toISOString();
    const ganhador = document.getElementById('e-premio-ganhador').value || null;
    const telefone = document.getElementById('e-premio-telefone').value || null;
    Object.assign(item, { nome, descricao, inicio, fim, ganhador, telefone });
    if (hasSupabase) {
      const { error } = await updatePremioSupabase(item.id, { nome, descricao, inicio, fim, ganhador, telefone });
      if (error) return toast(`ERRO: ${error.message}`);
      await syncAfterMutation();
    } else persistLocal();
  }

  if (editModalState.tipo === 'participacao') {
    const item = state.participacoes.find((x) => x.id === editModalState.id);
    if (!item) return;
    const programaId = document.getElementById('e-participacao-programa').value;
    const data = document.getElementById('e-participacao-data').value;
    const quantidade = Number(document.getElementById('e-participacao-qtd').value);
    Object.assign(item, { programaId, data, quantidade });
    if (hasSupabase) {
      const { error } = await sb.from('participacoes').update({ programa_id: programaId, data_referencia: data, quantidade }).eq('id', item.id);
      if (error) return toast(`ERRO: ${error.message}`);
      await syncAfterMutation();
    } else persistLocal();
  }

  closeEditModal();
  renderAll();
}
