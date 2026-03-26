# Dashboard FM — estático (GitHub + Vercel) com tema musical

Versão reconstruída para abrir fácil na Vercel e agora com visual inspirado no projeto musical (`monitoramentoradios`): paleta azul clara, cards limpos e navegação em tabs.

## Deploy (simples)

1. Suba no GitHub.
2. Importe na Vercel.
3. Build Command vazio.
4. Output Directory vazio.
5. Deploy.

## Integração Supabase (opcional)

Sim, agora está preparada para Supabase também.

1. Abra `config.js`.
2. Preencha:

```js
window.APP_CONFIG = {
  SUPABASE_URL: 'https://SEU-PROJETO.supabase.co',
  SUPABASE_ANON_KEY: 'SUA_ANON_KEY'
};
```

3. Deploy novamente.

Sem essas chaves, o app roda em modo local com `localStorage`.
