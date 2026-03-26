# Dashboard FM — estático (GitHub + Vercel) com tema musical

Layout inspirado no projeto musical, agora com:
- visual claro em tons de azul
- conexão opcional com Supabase
- botão "Conectar Supabase" dentro da própria tela (sem precisar editar código)

## Deploy (simples)

1. Suba no GitHub.
2. Importe na Vercel.
3. Build Command vazio.
4. Output Directory vazio.
5. Deploy.

## Supabase (dados reais)

### Opção 1 — pela interface
Clique em **Conectar Supabase** no topo e cole:
- URL do projeto
- ANON KEY

A configuração fica salva no navegador.

### Opção 2 — fixa no código
Edite `config.js`:

```js
window.APP_CONFIG = {
  SUPABASE_URL: 'https://SEU-PROJETO.supabase.co',
  SUPABASE_ANON_KEY: 'SUA_ANON_KEY'
};
```

## O que puxa do Supabase
- `programas`
- `premios`
- `participacoes`
- `prioridades_ar`
- `resumo_participacoes` (usada na área de gestor para Big Numbers)

Sem Supabase, roda em `localStorage`.
