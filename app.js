const dbKey = 'dashboardfm_v2';
const cfgKey = 'dashboardfm_supabase_cfg';

let hasSupabase = false;
let sb = null;
let showAllParticipacoes = false;
let hasGanhadorTelefoneColumn = true;
let prioridadeCarouselStart = 0;
let convidadoCarouselStart = 0;
const editModalState = { tipo: null, id: null };
let dashboardRefreshInterval = null;
const tipoRegistroPadrao = window.APP_CONFIG?.TIPO_REGISTRO_PADRAO || 'DIARIO_REALTIME';
const state = { programas: [], premios: [], participacoes: [], prioridades: [], convidados: [] };

init();

async function init() {
  wireConfigButton();
  await bootstrapSupabase();
  await loadInitialData();
  wireTabs();
  wireForms();
  wireEditModal();
  wireRichEditors();
  initDefaultDates();
  wireFilters();
  wireGerenciamentoTools();
  renderAll();
  updateDashboardAutoRefresh();
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
    const [p1, p2, p3, p4, p5] = await Promise.all([
      sb.from('programas').select('id,nome,cor_hex,ativo').order('nome'),
      sb.from('premios').select('*').order('inicio_vigencia', { ascending: true }),
      sb.from('participacoes').select('id,programa_id,data_referencia,quantidade,tipo_registro').order('data_referencia', { ascending: false }),
      sb.from('prioridades_ar').select('*').order('data', { ascending: false }),
      sb.from('gestao_convidados').select('*').order('data_visita', { ascending: true }).order('horario_visita', { ascending: true })
    ]);
    if (p1.error || p2.error || p3.error || p4.error || p5.error) {
      toast(`ERRO SUPABASE: ${(p1.error || p2.error || p3.error || p4.error || p5.error).message}`);
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
    state.prioridades = (p4.data || []).map((x) => ({ id: x.id, data: x.data, programaId: x.programa_id, conteudo: x.conteudo, concluido: Boolean(x.concluido), imagemUrl: x.imagem_url || '' }));
    state.convidados = (p5.data || []).map((x) => ({ id: x.id, nome: x.nome_convidado || '', data: x.data_visita || '', hora: x.horario_visita || '', miniPautaHtml: x.mini_pauta_html || '', imagemUrl: x.imagem_url || '', concluido: Boolean(x.concluido) }));
    return;
  }

  const local = JSON.parse(localStorage.getItem(dbKey) || '{"programas":[],"premios":[],"participacoes":[],"prioridades":[],"convidados":[]}');
  Object.assign(state, local);
}

function persistLocal() { localStorage.setItem(dbKey, JSON.stringify(state)); }

function wireTabs() {
  document.querySelectorAll('[data-tab]').forEach((btn) => btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
    updateDashboardAutoRefresh();
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
    const dia = val('g-premio-data');
    const hInicio = val('g-premio-inicio-hora');
    const hFim = val('g-premio-fim-hora');
    const inicio = new Date(`${dia}T${hInicio}:00`);
    const fim = new Date(`${dia}T${hFim}:00`);
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) return toast('DATA/HORA INVÁLIDA');
    if (fim <= inicio) return toast('HORA FIM DEVE SER MAIOR QUE INÍCIO');
    const payload = {
      nome: val('g-premio-nome'), descricao: val('g-premio-desc'),
      inicio: inicio.toISOString(), fim: fim.toISOString(),
      ganhador: val('g-premio-ganhador') || null, telefone: val('g-premio-telefone') || null
    };
    if (hasSupabase) {
      const { data, error } = await insertPremioSupabase(payload);
      if (error) return toast(`ERRO: ${error.message}`);
      if (!data?.id) return toast('ERRO: prêmio não retornou ID');
      await syncAfterMutation();
    } else { state.premios.push({ id: id(), ...payload }); persistLocal(); }
    e.target.reset();
    presetPremioFormDateTime();
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

  document.getElementById('form-prioridade').addEventListener('submit', async (e) => {
    e.preventDefault();
    const conteudoHtml = getEditorHtml('ar-editor');
    if (!stripHtml(conteudoHtml).trim()) return toast('CONTEÚDO É OBRIGATÓRIO');
    const file = document.getElementById('ar-imagem')?.files?.[0] || null;
    let imagemUrl = null;
    if (hasSupabase && file) {
      const upload = await uploadPrioridadeImageSupabase(file);
      if (upload.error) return toast(`ERRO UPLOAD: ${upload.error.message}`);
      imagemUrl = upload.url || null;
    }
    if (!hasSupabase && file) imagemUrl = await fileInputToDataUrl('ar-imagem');
    const payload = { data: val('ar-data'), programaId: null, conteudo: conteudoHtml, concluido: false, imagemUrl: imagemUrl || null };
    if (hasSupabase) {
      const { data, error } = await insertPrioridadeSupabase(payload);
      if (error) return toast(`ERRO: ${error.message}`);
      if (!data?.id) return toast('SEM PERMISSÃO PARA CRIAR PRIORIDADE (RLS).');
      await syncAfterMutation();
    } else { state.prioridades.unshift({ id: id(), ...payload }); persistLocal(); }
    e.target.reset();
    setEditorHtml('ar-editor', '');
    document.getElementById('ar-data').value = todayISO();
    renderAll();
  });

  document.getElementById('form-convidado').addEventListener('submit', async (e) => {
    e.preventDefault();
    const miniPautaHtml = getEditorHtml('conv-editor');
    if (!stripHtml(miniPautaHtml).trim()) return toast('MINI PAUTA É OBRIGATÓRIA');
    const file = document.getElementById('conv-imagem')?.files?.[0] || null;
    let imagemUrl = null;
    if (hasSupabase && file) {
      const upload = await uploadPrioridadeImageSupabase(file);
      if (upload.error) return toast(`ERRO UPLOAD: ${upload.error.message}`);
      imagemUrl = upload.url || null;
    }
    if (!hasSupabase && file) imagemUrl = await fileInputToDataUrl('conv-imagem');
    const payload = { nome: val('conv-nome'), data: val('conv-data'), hora: val('conv-hora'), miniPautaHtml, imagemUrl: imagemUrl || null, concluido: false };
    if (hasSupabase) {
      const { data, error } = await insertConvidadoSupabase(payload);
      if (error) return toast(`ERRO: ${error.message}`);
      if (!data?.id) return toast('SEM PERMISSÃO PARA CRIAR CONVIDADO (RLS).');
      await syncAfterMutation();
    } else { state.convidados.push({ id: id(), ...payload }); persistLocal(); }
    e.target.reset();
    setEditorHtml('conv-editor', '');
    document.getElementById('conv-data').value = todayISO();
    renderAll();
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
  document.getElementById('btn-prev-dia').addEventListener('click', () => shiftDashboardDate(-1));
  document.getElementById('btn-next-dia').addEventListener('click', () => shiftDashboardDate(1));
  document.getElementById('btn-hoje').addEventListener('click', () => { document.getElementById('dashboard-date').value = todayISO(); renderDashboard(); });
  document.getElementById('btn-refresh').addEventListener('click', async () => refreshAllData());
  document.getElementById('btn-close-premio-modal').addEventListener('click', () => document.getElementById('premio-modal').classList.add('hidden'));
  document.getElementById('premio-modal').addEventListener('click', (e) => { if (e.target.id === 'premio-modal') document.getElementById('premio-modal').classList.add('hidden'); });
  document.getElementById('btn-close-prioridade-modal').addEventListener('click', () => document.getElementById('prioridade-modal').classList.add('hidden'));
  document.getElementById('prioridade-modal').addEventListener('click', (e) => { if (e.target.id === 'prioridade-modal') document.getElementById('prioridade-modal').classList.add('hidden'); });
  document.getElementById('btn-close-convidado-modal').addEventListener('click', () => document.getElementById('convidado-modal').classList.add('hidden'));
  document.getElementById('convidado-modal').addEventListener('click', (e) => { if (e.target.id === 'convidado-modal') document.getElementById('convidado-modal').classList.add('hidden'); });
  document.getElementById('btn-prio-prev')?.addEventListener('click', () => shiftPrioridadesDashboard(-1));
  document.getElementById('btn-prio-next')?.addEventListener('click', () => shiftPrioridadesDashboard(1));
  document.getElementById('btn-conv-prev')?.addEventListener('click', () => shiftConvidadosDashboard(-1));
  document.getElementById('btn-conv-next')?.addEventListener('click', () => shiftConvidadosDashboard(1));
}

function initDefaultDates() {
  const end = todayISO();
  document.getElementById('p-data').value = end;
  document.getElementById('dashboard-date').value = end;
  document.getElementById('gmt-date').value = end;
  document.getElementById('ar-data').value = end;
  document.getElementById('conv-data').value = end;
  setEditorHtml('ar-editor', '');
  setEditorHtml('conv-editor', '');
  presetPremioFormDateTime();
}

function renderAll() {
  fillProgramSelect('p-programa');
  renderProgramas();
  renderPremiosGerenciamento();
  renderWinnerSearch();
  renderParticipacoes();
  renderPrioridadesAr();
  renderConvidadosGestao();
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
  const day = document.getElementById('gmt-date')?.value || todayISO();
  const premiosDia = filterPremiosByDay(state.premios, day);
  const t=document.getElementById('tabela-premios-gerenciamento');
  t.innerHTML=`<thead><tr><th>PRÊMIO</th><th>GANHADOR</th><th>DATA</th><th>HORÁRIO</th><th>AÇÕES</th></tr></thead><tbody>${premiosDia.map((p)=>`<tr><td>${p.nome}</td><td>${p.ganhador||'-'}</td><td>${fmtDateOnly(p.inicio)}</td><td>${fmtHour(p.inicio)} - ${fmtHour(p.fim)}</td><td><button data-edit-premio='${p.id}'>EDITAR</button> <button data-del-premio='${p.id}'>EXCLUIR</button></td></tr>`).join('')}</tbody>`;
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

function wireGerenciamentoTools() {
  document.getElementById('btn-gmt-prev').addEventListener('click', () => shiftDateInput('gmt-date', -1));
  document.getElementById('btn-gmt-next').addEventListener('click', () => shiftDateInput('gmt-date', 1));
  document.getElementById('btn-gmt-hoje').addEventListener('click', () => { document.getElementById('gmt-date').value = todayISO(); renderPremiosGerenciamento(); });
  document.getElementById('gmt-date').addEventListener('change', () => renderPremiosGerenciamento());
  document.getElementById('winner-search').addEventListener('input', () => renderWinnerSearch());
}

function renderWinnerSearch() {
  const term = (document.getElementById('winner-search')?.value || '').trim().toLowerCase();
  const table = document.getElementById('tabela-busca-ganhador');
  if (!table) return;
  if (!term) {
    table.innerHTML = '<thead><tr><th>GANHADOR</th><th>PRÊMIO</th><th>DATA</th></tr></thead><tbody><tr><td colspan="3">DIGITE AS INICIAIS PARA BUSCAR.</td></tr></tbody>';
    return;
  }
  const rows = state.premios
    .filter((p) => (p.ganhador || '').toLowerCase().includes(term))
    .sort((a, b) => (b.fim || '').localeCompare(a.fim || ''));
  table.innerHTML = `<thead><tr><th>GANHADOR</th><th>PRÊMIO</th><th>DATA</th></tr></thead><tbody>${
    rows.length ? rows.map((p) => `<tr><td>${p.ganhador || '-'}</td><td>${p.nome}</td><td>${fmtDateOnly(p.fim || p.inicio)}</td></tr>`).join('') : '<tr><td colspan="3">NENHUM GANHADOR ENCONTRADO.</td></tr>'
  }</tbody>`;
}

function presetPremioFormDateTime() {
  const hoje = todayISO();
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const start = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const endD = new Date(now.getTime() + 60 * 60 * 1000);
  const end = `${pad(endD.getHours())}:${pad(endD.getMinutes())}`;
  document.getElementById('g-premio-data').value = hoje;
  document.getElementById('g-premio-inicio-hora').value = start;
  document.getElementById('g-premio-fim-hora').value = end;
}

function renderDashboard() {
  const dashboardDate = document.getElementById('dashboard-date').value || todayISO();
  document.getElementById('periodo-label').textContent = `DADOS: ${new Date(`${dashboardDate}T00:00:00`).toLocaleDateString('pt-BR')}`;
  renderPrioridadesCards(dashboardDate);
  renderConvidadosCards(dashboardDate);

  const de = firstDayOfMonthISOFrom(dashboardDate);
  const ate = lastDayOfMonthISOFrom(dashboardDate);
  let regs=[...state.participacoes];
  regs=regs.filter(r=>r.data>=de && r.data<=ate);
  const resumo=state.programas.map((p)=>{const r=regs.filter(x=>x.programaId===p.id);return {nome:p.nome,total:r.reduce((a,b)=>a+b.quantidade,0),dias:new Set(r.map(x=>x.data)).size};}).sort((a,b)=>b.total-a.total);
  document.getElementById('kpis').innerHTML='';
  const max=Math.max(1,...resumo.map(r=>r.total));
  document.getElementById('bars').innerHTML=resumo.map(r=>`<div class='bar-row'><small>${r.nome}</small><div class='bar' style='width:${(r.total/max)*100}%'></div><small>${r.total}</small></div>`).join('');

  const dayStart = `${dashboardDate}T00:00:00.000Z`;
  const dayEnd = `${dashboardDate}T23:59:59.999Z`;
  const nowRef = currentClockOnDate(dashboardDate).toISOString();
  const premiosDia = state.premios.filter((p) => {
    const inicio = p.inicio || dayStart;
    const fim = p.fim || dayEnd;
    return inicio <= dayEnd && fim >= dayStart;
  });
  const ativos=premiosDia.filter(p=>(!p.inicio||p.inicio<=nowRef)&&(!p.fim||p.fim>=nowRef));
  const futuros=premiosDia.filter(p=>p.inicio&&p.inicio>nowRef).sort((a,b)=>a.inicio.localeCompare(b.inicio));
  const passados=premiosDia.filter(p=>p.fim&&p.fim<nowRef).sort((a,b)=>b.fim.localeCompare(a.fim));
  const atual=ativos[0]||null;
  const semPremioAgora = !ativos.length;

  document.getElementById('premio-vigente-card').classList.toggle('clickable-featured', Boolean(atual));
  document.getElementById('premio-vigente-card').onclick = atual ? () => showPremioHistorico(atual.id) : null;
  document.getElementById('premio-vigente-titulo').textContent=semPremioAgora?'SEM PRÊMIO PROGRAMADO PARA ESSA HORA':atual.nome;
  document.getElementById('premio-vigente-desc').textContent=semPremioAgora?'SELECIONE OUTRO DIA PARA VER A PROGRAMAÇÃO.':(atual.descricao||'SEM DESCRIÇÃO');
  document.getElementById('premio-vigente-ganhador').textContent=atual?.ganhador||'SEM GANHADOR';
  document.getElementById('premio-vigente-telefone').textContent=phoneMask(atual?.telefone);

  document.getElementById('proximos-premios').innerHTML=(futuros.slice(0,2).map(p=>`<div class='next-item row-click' data-preview-premio='${p.id}'><strong>${p.nome}</strong><br/><small>${fmtHour(p.inicio)} - ${fmtHour(p.fim)}</small></div>`).join('')||'<small>SEM PRÓXIMOS PRÊMIOS</small>');
  document.getElementById('ultimos-premios-hora').innerHTML=(passados.slice(0,2).map(p=>`<div class='next-item row-click' data-preview-premio='${p.id}'><strong>${p.nome}</strong><br/><small>ENCERRADO: ${fmtHour(p.fim)}</small></div>`).join('')||'<small>SEM PRÊMIOS ENCERRADOS</small>');
  document.getElementById('tabela-historico-premios').innerHTML=`<thead><tr><th>PRÊMIO</th><th>GANHADOR</th><th>FIM</th></tr></thead><tbody>${passados.slice(0,20).map(p=>`<tr data-hist-premio='${p.id}' class='row-click'><td>${p.nome}</td><td>${p.ganhador||'-'}</td><td>${fmtHour(p.fim)}</td></tr>`).join('')}</tbody>`;
  document.querySelectorAll('[data-hist-premio]').forEach((row)=>row.addEventListener('click',()=>showPremioHistorico(row.dataset.histPremio)));
  document.querySelectorAll('[data-preview-premio]').forEach((el)=>el.addEventListener('click',()=>showPremioHistorico(el.dataset.previewPremio)));
}

function phoneMask(phone){if(!phone)return 'TEL: --';const d=String(phone).replace(/\D/g,'');return `TEL: ****${d.slice(-4)}`;}
function fmtHour(iso){if(!iso)return '--';return new Date(iso).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});}
function toDatetimeLocal(iso){if(!iso)return '';const d=new Date(iso);const pad=(n)=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;}
function monthName(dateISO){const d=dateISO?new Date(`${dateISO}T00:00:00`):new Date();return d.toLocaleDateString('pt-BR',{month:'long'});}
function todayISO(){return new Date().toISOString().slice(0,10);}
function firstDayOfMonthISO(){const d=new Date();d.setDate(1);return d.toISOString().slice(0,10);}
function firstDayOfMonthISOFrom(baseISO){const d=new Date(`${baseISO}T00:00:00`);d.setDate(1);return d.toISOString().slice(0,10);}
function lastDayOfMonthISOFrom(baseISO){const d=new Date(`${baseISO}T00:00:00`);d.setMonth(d.getMonth()+1,0);return d.toISOString().slice(0,10);}
function currentClockOnDate(baseISO){const now=new Date();const d=new Date(`${baseISO}T00:00:00`);d.setHours(now.getHours(),now.getMinutes(),now.getSeconds(),0);return d;}
function shiftDateInput(idInput, days){const el=document.getElementById(idInput);const d=new Date(`${(el.value||todayISO())}T00:00:00`);d.setDate(d.getDate()+days);el.value=d.toISOString().slice(0,10);if(idInput==='gmt-date')renderPremiosGerenciamento();if(idInput==='dashboard-date')renderDashboard();}
function fmtDateOnly(iso){if(!iso)return '--';return new Date(iso).toLocaleDateString('pt-BR');}
function filterPremiosByDay(premios, dayISO){const start=`${dayISO}T00:00:00.000Z`;const end=`${dayISO}T23:59:59.999Z`;return premios.filter((p)=>{const i=p.inicio||start;const f=p.fim||end;return i<=end&&f>=start;});}
function val(idEl){return document.getElementById(idEl).value;}

function renderPrioridadesAr() {
  const t = document.getElementById('tabela-prioridades-ar');
  if (!t) return;
  t.innerHTML = `<thead><tr><th>DATA</th><th>CONTEÚDO</th><th>IMAGEM</th><th>AÇÕES</th></tr></thead><tbody>${state.prioridades.map((p)=>`<tr><td>${p.data}</td><td>${escapeHtml(stripHtml(p.conteudo||'').slice(0,140))}</td><td>${p.imagemUrl?`<a href='${p.imagemUrl}' target='_blank' rel='noreferrer'>VER</a>`:'-'}</td><td><button data-edit-prio='${p.id}'>EDITAR</button> <button data-del-prio='${p.id}'>EXCLUIR</button></td></tr>`).join('')}</tbody>`;
  t.querySelectorAll('[data-edit-prio]').forEach((b)=>b.addEventListener('click', async()=>openEditModal('prioridade', b.dataset.editPrio)));
  t.querySelectorAll('[data-del-prio]').forEach((b)=>b.addEventListener('click', async()=>deletePrioridade(b.dataset.delPrio)));
}

function renderConvidadosGestao() {
  const t = document.getElementById('tabela-convidados');
  if (!t) return;
  const rows = [...state.convidados].sort((a, b) => `${a.data}T${a.hora}`.localeCompare(`${b.data}T${b.hora}`));
  t.innerHTML = `<thead><tr><th>NOME</th><th>DATA</th><th>HORA</th><th>CONCLUÍDO</th><th>AÇÕES</th></tr></thead><tbody>${
    rows.map((c) => `<tr><td>${escapeHtml(c.nome || '-')}</td><td>${fmtDateOnly(c.data)}</td><td>${c.hora || '--:--'}</td><td><input type="checkbox" data-conv-done="${c.id}" ${c.concluido ? 'checked' : ''} /></td><td><button data-edit-conv="${c.id}">EDITAR</button> <button data-del-conv="${c.id}">EXCLUIR</button></td></tr>`).join('')
  }</tbody>`;
  t.querySelectorAll('[data-edit-conv]').forEach((b) => b.addEventListener('click', () => openEditModal('convidado', b.dataset.editConv)));
  t.querySelectorAll('[data-del-conv]').forEach((b) => b.addEventListener('click', async () => deleteConvidado(b.dataset.delConv)));
  t.querySelectorAll('[data-conv-done]').forEach((el) => el.addEventListener('change', async () => toggleConvidadoConcluido(el.dataset.convDone, el.checked)));
}

async function fileInputToDataUrl(idInput) {
  const input = document.getElementById(idInput);
  const file = input?.files?.[0];
  if (!file) return '';
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao ler imagem'));
    reader.readAsDataURL(file);
  });
}

async function insertPrioridadeSupabase(payload) {
  const base = { data: payload.data, programa_id: payload.programaId || null, conteudo: payload.conteudo, concluido: false };
  const firstTry = await sb.from('prioridades_ar').insert({ ...base, imagem_url: payload.imagemUrl || null }).select('id').maybeSingle();
  if (!firstTry.error || !String(firstTry.error?.message || '').toLowerCase().includes('imagem_url')) return firstTry;
  return sb.from('prioridades_ar').insert(base).select('id').maybeSingle();
}

async function insertConvidadoSupabase(payload) {
  return sb.from('gestao_convidados').insert({
    nome_convidado: payload.nome,
    data_visita: payload.data,
    horario_visita: payload.hora,
    mini_pauta_html: payload.miniPautaHtml,
    imagem_url: payload.imagemUrl || null,
    concluido: Boolean(payload.concluido)
  }).select('id').maybeSingle();
}

async function updateConvidadoSupabase(idConvidado, payload) {
  return sb.from('gestao_convidados').update({
    nome_convidado: payload.nome,
    data_visita: payload.data,
    horario_visita: payload.hora,
    mini_pauta_html: payload.miniPautaHtml,
    imagem_url: payload.imagemUrl || null,
    concluido: Boolean(payload.concluido)
  }).eq('id', idConvidado).select('id').maybeSingle();
}

async function deletePrioridade(idPrio) {
  if(!confirm('EXCLUIR PRIORIDADE DO AR?')) return;
  if (hasSupabase) {
    const { data, error } = await sb.from('prioridades_ar').delete().eq('id', idPrio).select('id').maybeSingle();
    if (error) return toast(`ERRO: ${error.message}`);
    if (!data?.id) return toast('SEM PERMISSÃO PARA EXCLUIR ESTA PRIORIDADE (RLS).');
    await syncAfterMutation();
  } else {
    state.prioridades = state.prioridades.filter((x)=>x.id!==idPrio);
    persistLocal();
  }
  renderAll();
}

async function deleteConvidado(idConvidado) {
  if (!confirm('EXCLUIR CONVIDADO?')) return;
  if (hasSupabase) {
    const { data, error } = await sb.from('gestao_convidados').delete().eq('id', idConvidado).select('id').maybeSingle();
    if (error) return toast(`ERRO: ${error.message}`);
    if (!data?.id) return toast('SEM PERMISSÃO PARA EXCLUIR ESTE CONVIDADO (RLS).');
    await syncAfterMutation();
  } else {
    state.convidados = state.convidados.filter((x) => x.id !== idConvidado);
    persistLocal();
  }
  renderAll();
}

async function toggleConvidadoConcluido(idConvidado, concluido) {
  const item = state.convidados.find((x) => x.id === idConvidado);
  if (!item) return;
  item.concluido = Boolean(concluido);
  if (hasSupabase) {
    const { data, error } = await sb.from('gestao_convidados').update({ concluido: item.concluido }).eq('id', idConvidado).select('id').maybeSingle();
    if (error) return toast(`ERRO: ${error.message}`);
    if (!data?.id) return toast('SEM PERMISSÃO PARA EDITAR ESTE CONVIDADO (RLS).');
    await syncAfterMutation();
  } else persistLocal();
  renderAll();
}

async function uploadPrioridadeImageSupabase(file) {
  const safeName = String(file.name || 'imagem').replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${todayISO()}/${Date.now()}-${safeName}`;
  const storage = sb.storage.from('prioridades');
  const up = await storage.upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || 'image/jpeg' });
  if (up.error) return { error: up.error };
  const pub = storage.getPublicUrl(path);
  return { url: pub.data?.publicUrl || '', error: null };
}
function id(){return Math.random().toString(36).slice(2,10);}
function toast(text){const el=document.getElementById('toast');el.textContent=text;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1700);}
function showPremioHistorico(idPremio){const p=state.premios.find((x)=>x.id===idPremio);if(!p)return;document.getElementById('premio-modal-title').textContent='DETALHES DO PRÊMIO DA HORA';document.getElementById('premio-modal-body').innerHTML=`<div class="premio-hero"><small>🎵 PRÊMIO DA HORA</small><h2>${escapeHtml(p.nome||'-')}</h2><div class="premio-tags"><span class="tag">${fmtDateTime(p.inicio)}</span><span class="tag">${fmtDateTime(p.fim)}</span></div></div><div class="premio-info"><p><strong>DESCRIÇÃO</strong><br/>${escapeHtml(p.descricao||'-')}</p><p><strong>GANHADOR</strong><br/>${escapeHtml(p.ganhador||'-')}</p><p><strong>TELEFONE</strong><br/>${escapeHtml(phoneMask(p.telefone))}</p></div>`;document.getElementById('premio-modal').classList.remove('hidden');}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,(m)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));}
function fmtDateTime(iso){if(!iso)return '--';return new Date(iso).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}
function shiftDashboardDate(days){const el=document.getElementById('dashboard-date');const d=new Date(`${el.value||todayISO()}T00:00:00`);d.setDate(d.getDate()+days);el.value=d.toISOString().slice(0,10);renderDashboard();}
function shiftPrioridadesDashboard(step){prioridadeCarouselStart=Math.max(0, prioridadeCarouselStart+step);renderDashboard();}
function shiftConvidadosDashboard(step){convidadoCarouselStart=Math.max(0, convidadoCarouselStart+step);renderDashboard();}

function renderPrioridadesCards(dashboardDate){
  const box = document.getElementById('prioridades-cards');
  if (!box) return;
  const doDia = state.prioridades.filter((p)=>p.data===dashboardDate);
  const source = doDia.length ? doDia : [...state.prioridades];
  const pageSize = 3;
  const maxStart = Math.max(0, source.length - pageSize);
  if (prioridadeCarouselStart > maxStart) prioridadeCarouselStart = maxStart;
  const items = source.slice(prioridadeCarouselStart, prioridadeCarouselStart + pageSize);
  box.innerHTML = items.length ? items.map((p)=>`<button class="card prioridade-card" data-prio-card="${p.id}" type="button"><div class="prioridade-thumb-wrap">${p.imagemUrl?`<img src="${p.imagemUrl}" alt="Prioridade" class="prioridade-thumb" />`:'<div class="prioridade-thumb-placeholder">SEM IMAGEM</div>'}</div><div class="prioridade-title">${escapeHtml(stripHtml(p.conteudo||'').slice(0,56) || 'PRIORIDADE DO AR')}</div></button>`).join('') : `<div class="card"><strong>SEM PRIORIDADES PARA ESTE DIA.</strong></div>`;
  box.querySelectorAll('[data-prio-card]').forEach((el)=>el.addEventListener('click',()=>showPrioridadeDetalhe(el.dataset.prioCard)));
  const info = document.getElementById('prioridades-page-info');
  if (info) {
    if (!source.length) info.textContent = '0 de 0';
    else info.textContent = `${prioridadeCarouselStart + 1}-${Math.min(source.length, prioridadeCarouselStart + pageSize)} de ${source.length}`;
  }
  const prevBtn = document.getElementById('btn-prio-prev');
  const nextBtn = document.getElementById('btn-prio-next');
  if (prevBtn) prevBtn.disabled = prioridadeCarouselStart <= 0;
  if (nextBtn) nextBtn.disabled = prioridadeCarouselStart >= maxStart;
}

function renderConvidadosCards(dashboardDate) {
  const box = document.getElementById('convidados-cards');
  if (!box) return;
  const hoje = todayISO();
  const source = state.convidados
    .filter((c) => (c.data || '') >= hoje && !c.concluido)
    .sort((a, b) => `${a.data}T${a.hora}`.localeCompare(`${b.data}T${b.hora}`));
  const pageSize = 3;
  const maxStart = Math.max(0, source.length - pageSize);
  if (convidadoCarouselStart > maxStart) convidadoCarouselStart = maxStart;
  const items = source.slice(convidadoCarouselStart, convidadoCarouselStart + pageSize);
  box.innerHTML = items.length ? items.map((c) => {
    const subtitulo = `${fmtDateOnly(c.data)} às ${c.hora || '--:--'}`;
    return `<button class="card prioridade-card" data-conv-card="${c.id}" type="button"><div class="prioridade-thumb-wrap">${c.imagemUrl ? `<img src="${c.imagemUrl}" alt="Convidado" class="prioridade-thumb" />` : '<div class="prioridade-thumb-placeholder">SEM IMAGEM</div>'}</div><div class="prioridade-title">${escapeHtml(c.nome || 'CONVIDADO')}</div><small>${escapeHtml(subtitulo)}</small></button>`;
  }).join('') : `<div class="card"><strong>SEM CONVIDADOS FUTUROS.</strong></div>`;
  box.querySelectorAll('[data-conv-card]').forEach((el) => el.addEventListener('click', () => showConvidadoDetalhe(el.dataset.convCard)));
  const info = document.getElementById('convidados-page-info');
  if (info) info.textContent = source.length ? `${convidadoCarouselStart + 1}-${Math.min(source.length, convidadoCarouselStart + pageSize)} de ${source.length}` : '0 de 0';
  const prevBtn = document.getElementById('btn-conv-prev');
  const nextBtn = document.getElementById('btn-conv-next');
  if (prevBtn) prevBtn.disabled = convidadoCarouselStart <= 0;
  if (nextBtn) nextBtn.disabled = convidadoCarouselStart >= maxStart;
}

function showPrioridadeDetalhe(idPrio){
  const p = state.prioridades.find((x)=>x.id===idPrio);
  if(!p) return;
  document.getElementById('prioridade-modal-title').textContent = `PRIORIDADE DO AR • ${fmtDateOnly(p.data)}`;
  document.getElementById('prioridade-modal-body').innerHTML = `<div class="prioridade-hero">${p.imagemUrl?`<img src="${p.imagemUrl}" alt="Imagem prioridade" class="prioridade-modal-img" />`:'<div class="prioridade-modal-noimg">SEM IMAGEM</div>'}</div><div class="prioridade-texto"><strong>CONTEÚDO</strong><div class="rich-render">${renderRichText(p.conteudo||'-')}</div></div>`;
  document.getElementById('prioridade-modal').classList.remove('hidden');
}

function showConvidadoDetalhe(idConvidado) {
  const c = state.convidados.find((x) => x.id === idConvidado);
  if (!c) return;
  document.getElementById('convidado-modal-title').textContent = `${c.nome || 'CONVIDADO'} • ${fmtDateOnly(c.data)} ${c.hora || ''}`;
  document.getElementById('convidado-modal-body').innerHTML = `<div class="prioridade-hero">${c.imagemUrl ? `<img src="${c.imagemUrl}" alt="Imagem convidado" class="prioridade-modal-img" />` : '<div class="prioridade-modal-noimg">SEM IMAGEM</div>'}</div><div class="prioridade-texto"><strong>MINI PAUTA</strong><div class="rich-render">${renderRichText(c.miniPautaHtml || '-')}</div></div>`;
  document.getElementById('convidado-modal').classList.remove('hidden');
}

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
    const firstTry = await sb.from('premios').update({ ...basePayload, ganhador_telefone: payload.telefone }).eq('id', idPremio).select('id').maybeSingle();
    if (!firstTry.error || !isMissingTelefoneColumnError(firstTry.error)) return firstTry;
    hasGanhadorTelefoneColumn = false;
  }

  return sb.from('premios').update(basePayload).eq('id', idPremio).select('id').maybeSingle();
}

function isMissingTelefoneColumnError(error) {
  return String(error?.message || '').toLowerCase().includes('ganhador_telefone');
}

async function syncAfterMutation() {
  if (hasSupabase) await loadInitialData();
  else persistLocal();
}

function updateDashboardAutoRefresh() {
  const dashboardActive = document.getElementById('dashboard')?.classList.contains('active');
  if (dashboardActive && !dashboardRefreshInterval) {
    dashboardRefreshInterval = setInterval(() => refreshAllData(), 30000);
    return;
  }
  if (!dashboardActive && dashboardRefreshInterval) {
    clearInterval(dashboardRefreshInterval);
    dashboardRefreshInterval = null;
  }
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
    setEditGroupState('edit-fields-programa', true);
    document.getElementById('e-programa-nome').value = item.nome || '';
    document.getElementById('e-programa-cor').value = item.cor || '#2563eb';
    document.getElementById('e-programa-ativo').checked = Boolean(item.ativo);
  }

  if (tipo === 'premio') {
    const item = state.premios.find((x) => x.id === itemId);
    if (!item) return;
    title.textContent = 'EDITAR PRÊMIO';
    setEditGroupState('edit-fields-premio', true);
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
    setEditGroupState('edit-fields-participacao', true);
    const sel = document.getElementById('e-participacao-programa');
    sel.innerHTML = state.programas.map((p) => `<option value="${p.id}">${p.nome}</option>`).join('');
    sel.value = item.programaId || '';
    document.getElementById('e-participacao-data').value = item.data || '';
    document.getElementById('e-participacao-qtd').value = item.quantidade || 0;
  }

  if (tipo === 'prioridade') {
    const item = state.prioridades.find((x) => x.id === itemId);
    if (!item) return;
    title.textContent = 'EDITAR PRIORIDADE';
    setEditGroupState('edit-fields-prioridade', true);
    document.getElementById('e-prio-data').value = item.data || '';
    document.getElementById('e-prio-imagem-url').value = item.imagemUrl || '';
    document.getElementById('e-prio-imagem-file').value = '';
    setEditorHtml('e-prio-editor', item.conteudo || '');
  }

  if (tipo === 'convidado') {
    const item = state.convidados.find((x) => x.id === itemId);
    if (!item) return;
    title.textContent = 'EDITAR CONVIDADO';
    setEditGroupState('edit-fields-convidado', true);
    document.getElementById('e-conv-nome').value = item.nome || '';
    document.getElementById('e-conv-data').value = item.data || '';
    document.getElementById('e-conv-hora').value = item.hora || '';
    document.getElementById('e-conv-imagem-url').value = item.imagemUrl || '';
    document.getElementById('e-conv-imagem-file').value = '';
    document.getElementById('e-conv-concluido').checked = Boolean(item.concluido);
    setEditorHtml('e-conv-editor', item.miniPautaHtml || '');
  }

  modal.classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.add('hidden');
  editModalState.tipo = null;
  editModalState.id = null;
}

function hideEditGroups() {
  setEditGroupState('edit-fields-programa', false);
  setEditGroupState('edit-fields-premio', false);
  setEditGroupState('edit-fields-participacao', false);
  setEditGroupState('edit-fields-prioridade', false);
  setEditGroupState('edit-fields-convidado', false);
}

function setEditGroupState(groupId, active) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.classList.toggle('hidden', !active);
  group.querySelectorAll('input,select,textarea').forEach((el) => {
    const needsRequired = el.dataset.required === 'true';
    if (active) {
      el.disabled = false;
      if (needsRequired) el.required = true;
    } else {
      if (el.required) el.dataset.required = 'true';
      el.required = false;
      el.disabled = true;
    }
  });
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
      const { data, error } = await sb.from('programas').update({ nome, cor_hex: cor, ativo }).eq('id', item.id).select('id').maybeSingle();
      if (error) return toast(`ERRO: ${error.message}`);
      if (!data?.id) return toast('SEM PERMISSÃO PARA EDITAR ESTE PROGRAMA (RLS).');
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
      const { data, error } = await updatePremioSupabase(item.id, { nome, descricao, inicio, fim, ganhador, telefone });
      if (error) return toast(`ERRO: ${error.message}`);
      if (!data?.id) return toast('SEM PERMISSÃO PARA EDITAR ESTE PRÊMIO (RLS).');
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
      const { data: upData, error } = await sb.from('participacoes').update({ programa_id: programaId, data_referencia: data, quantidade }).eq('id', item.id).select('id').maybeSingle();
      if (error) return toast(`ERRO: ${error.message}`);
      if (!upData?.id) return toast('SEM PERMISSÃO PARA EDITAR ESTA PARTICIPAÇÃO (RLS).');
      await syncAfterMutation();
    } else persistLocal();
  }

  if (editModalState.tipo === 'prioridade') {
    const item = state.prioridades.find((x) => x.id === editModalState.id);
    if (!item) return;
    const novaData = document.getElementById('e-prio-data').value;
    const novoConteudo = getEditorHtml('e-prio-editor');
    const imagemUrlInput = document.getElementById('e-prio-imagem-url').value.trim();
    const file = document.getElementById('e-prio-imagem-file')?.files?.[0] || null;
    if (!stripHtml(novoConteudo).trim()) return toast('CONTEÚDO É OBRIGATÓRIO');
    let imagemUrlFinal = imagemUrlInput || item.imagemUrl || '';
    if (file) {
      if (hasSupabase) {
        const upload = await uploadPrioridadeImageSupabase(file);
        if (upload.error) return toast(`ERRO UPLOAD: ${upload.error.message}`);
        imagemUrlFinal = upload.url || imagemUrlFinal;
      } else {
        imagemUrlFinal = await fileInputToDataUrl('e-prio-imagem-file');
      }
    }
    Object.assign(item, { data: novaData, conteudo: novoConteudo, imagemUrl: imagemUrlFinal || '' });
    if (hasSupabase) {
      const base = { data: novaData, conteudo: novoConteudo, programa_id: null };
      const firstTry = await sb.from('prioridades_ar').update({ ...base, imagem_url: imagemUrlFinal || null }).eq('id', item.id).select('id').maybeSingle();
      if (firstTry.error && !String(firstTry.error?.message || '').toLowerCase().includes('imagem_url')) return toast(`ERRO: ${firstTry.error.message}`);
      if (firstTry.error) {
        const fallback = await sb.from('prioridades_ar').update(base).eq('id', item.id).select('id').maybeSingle();
        if (fallback.error) return toast(`ERRO: ${fallback.error.message}`);
        if (!fallback.data?.id) return toast('SEM PERMISSÃO PARA EDITAR ESTA PRIORIDADE (RLS).');
      } else if (!firstTry.data?.id) {
        return toast('SEM PERMISSÃO PARA EDITAR ESTA PRIORIDADE (RLS).');
      }
      await syncAfterMutation();
    } else persistLocal();
  }

  if (editModalState.tipo === 'convidado') {
    const item = state.convidados.find((x) => x.id === editModalState.id);
    if (!item) return;
    const nome = document.getElementById('e-conv-nome').value.trim();
    const data = document.getElementById('e-conv-data').value;
    const hora = document.getElementById('e-conv-hora').value;
    const miniPautaHtml = getEditorHtml('e-conv-editor');
    const imagemUrlInput = document.getElementById('e-conv-imagem-url').value.trim();
    const concluido = document.getElementById('e-conv-concluido').checked;
    const file = document.getElementById('e-conv-imagem-file')?.files?.[0] || null;
    if (!nome) return toast('NOME DO CONVIDADO É OBRIGATÓRIO');
    if (!stripHtml(miniPautaHtml).trim()) return toast('MINI PAUTA É OBRIGATÓRIA');
    let imagemUrlFinal = imagemUrlInput || item.imagemUrl || '';
    if (file) {
      if (hasSupabase) {
        const upload = await uploadPrioridadeImageSupabase(file);
        if (upload.error) return toast(`ERRO UPLOAD: ${upload.error.message}`);
        imagemUrlFinal = upload.url || imagemUrlFinal;
      } else {
        imagemUrlFinal = await fileInputToDataUrl('e-conv-imagem-file');
      }
    }
    Object.assign(item, { nome, data, hora, miniPautaHtml, imagemUrl: imagemUrlFinal, concluido });
    if (hasSupabase) {
      const { data: upData, error } = await updateConvidadoSupabase(item.id, { nome, data, hora, miniPautaHtml, imagemUrl: imagemUrlFinal, concluido });
      if (error) return toast(`ERRO: ${error.message}`);
      if (!upData?.id) return toast('SEM PERMISSÃO PARA EDITAR ESTE CONVIDADO (RLS).');
      await syncAfterMutation();
    } else persistLocal();
  }

  closeEditModal();
  renderAll();
}

function wireRichEditors() {
  document.querySelectorAll('.rich-toolbar button[data-cmd]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const editorId = btn.closest('.rich-toolbar')?.dataset.editor;
      const editor = document.getElementById(editorId || '');
      if (!editor) return;
      editor.focus();
      document.execCommand(btn.dataset.cmd, false, null);
    });
  });
  document.querySelectorAll('.rich-toolbar button[data-style-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const editorId = btn.closest('.rich-toolbar')?.dataset.editor;
      const editor = document.getElementById(editorId || '');
      if (!editor) return;
      editor.focus();
      applyPresetStyle(btn.dataset.stylePreset);
    });
  });
  document.querySelectorAll('.font-picker[data-font-target]').forEach((picker) => {
    picker.addEventListener('change', () => {
      const editor = document.getElementById(picker.dataset.fontTarget || '');
      if (!editor) return;
      editor.focus();
      document.execCommand('fontName', false, picker.value);
    });
  });
}

function applyPresetStyle(preset) {
  if (preset === 'textRed') return document.execCommand('foreColor', false, '#dc2626');
  if (preset === 'textBlack') return document.execCommand('foreColor', false, '#111111');
  if (preset === 'bgYellow') return document.execCommand('hiliteColor', false, '#fef08a');
  if (preset === 'fontUp') return wrapSelectionWithStyle('font-size:1.15em');
  if (preset === 'fontDown') return wrapSelectionWithStyle('font-size:0.9em');
}

function wrapSelectionWithStyle(styleText) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  if (!range || range.collapsed) return;
  const selectedText = range.toString();
  const safeText = escapeHtml(selectedText);
  document.execCommand('insertHTML', false, `<span style="${styleText}">${safeText}</span>`);
}

function getEditorHtml(idEditor) {
  const editor = document.getElementById(idEditor);
  if (!editor) return '';
  const clean = sanitizeRichText(editor.innerHTML || '');
  const hiddenInputId = idEditor === 'ar-editor' ? 'ar-conteudo'
    : idEditor === 'e-prio-editor' ? 'e-prio-conteudo'
    : idEditor === 'conv-editor' ? 'conv-pauta'
    : idEditor === 'e-conv-editor' ? 'e-conv-pauta'
    : '';
  if (hiddenInputId) document.getElementById(hiddenInputId).value = clean;
  return clean;
}

function setEditorHtml(idEditor, value) {
  const editor = document.getElementById(idEditor);
  if (!editor) return;
  editor.innerHTML = sanitizeRichText(value || '');
}

function renderRichText(value) {
  const content = String(value || '');
  if (content.includes('<')) return sanitizeRichText(content);
  return escapeHtml(content).replace(/\n/g, '<br/>');
}

function sanitizeRichText(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html || ''}</div>`, 'text/html');
  const root = doc.body.firstChild;
  const allowedTags = new Set(['DIV', 'P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'SPAN']);
  const allowedFonts = ['Arial', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Georgia'];
  const allowedColors = ['#dc2626', '#111111', 'rgb(220, 38, 38)', 'rgb(17, 17, 17)'];
  const allowedHighlights = ['#fef08a', 'rgb(254, 240, 138)'];
  const allowedFontSizes = ['0.9em', '1.15em'];

  const walk = (node) => {
    [...node.children].forEach((child) => {
      if (!allowedTags.has(child.tagName)) {
        child.replaceWith(...child.childNodes);
        return;
      }
      const style = child.getAttribute('style') || '';
      const keep = [];
      const fontMatch = style.match(/font-family:\s*([^;]+)/i);
      if (fontMatch) {
        const picked = fontMatch[1].replace(/['"]/g, '').split(',')[0].trim();
        if (allowedFonts.includes(picked)) keep.push(`font-family:${picked}`);
      }
      const alignMatch = style.match(/text-align:\s*(left|center|right)/i);
      if (alignMatch) keep.push(`text-align:${alignMatch[1].toLowerCase()}`);
      const colorMatch = style.match(/color:\s*([^;]+)/i);
      if (colorMatch) {
        const color = colorMatch[1].trim().toLowerCase();
        if (allowedColors.includes(color)) keep.push(`color:${color}`);
      }
      const bgMatch = style.match(/background-color:\s*([^;]+)/i);
      if (bgMatch) {
        const bg = bgMatch[1].trim().toLowerCase();
        if (allowedHighlights.includes(bg)) keep.push(`background-color:${bg}`);
      }
      const sizeMatch = style.match(/font-size:\s*([^;]+)/i);
      if (sizeMatch) {
        const sz = sizeMatch[1].trim().toLowerCase();
        if (allowedFontSizes.includes(sz)) keep.push(`font-size:${sz}`);
      }
      if (keep.length) child.setAttribute('style', keep.join(';'));
      else child.removeAttribute('style');
      [...child.attributes].forEach((attr) => {
        if (attr.name !== 'style') child.removeAttribute(attr.name);
      });
      walk(child);
    });
  };
  walk(root);
  return root.innerHTML.trim();
}

function stripHtml(value) {
  const decoded = decodeHtmlEntities(String(value || ''));
  return decoded.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(value) {
  const txt = document.createElement('textarea');
  txt.innerHTML = value;
  return txt.value;
}
