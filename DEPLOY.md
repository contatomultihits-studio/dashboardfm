# Como colocar no ar (Supabase + Vercel)

São uns 10 minutos. Você só precisa de uma conta no **Supabase** e uma na **Vercel**, as duas podem ser as suas pessoais.

> Se for pedir para outro Claude fazer isso por você, passe este arquivo para ele.

---

## 1. Supabase: criar o banco

1. Entre em <https://supabase.com/dashboard> e crie um projeto (**New project**).
   Nome sugerido: `dashboardfm`. Região: **South America (São Paulo)**. Guarde a senha do banco num lugar seguro.
2. Com o projeto aberto, vá em **SQL Editor → New query**.
3. Copie **todo** o conteúdo do arquivo [`supabase/schema.sql`](supabase/schema.sql), cole e clique em **Run**.
   Deve aparecer *"Success. No rows returned"*. Se rodar de novo, não tem problema: nada é apagado.

Isso cria as tabelas `prioridades`, `recados`, `conexoes`, `pautas`, `pautas_realizadas`, `locutores`, `escala`, `convidados` e `eventos`, o espaço de fotos `imagens` e as regras de acesso.

## 2. Supabase: fechar o cadastro público e exigir senha forte

Em **Authentication → Sign In / Providers → Email** (ou **Authentication → Settings**, dependendo da versão do painel):

- **Desligue** a opção **"Allow new users to sign up"** e salve.
- **Minimum password length**: `8`. **Password requirements**: letras e números (*Letters and digits*).
- **Prevent use of leaked passwords**: ligado (se o seu plano permitir).

Assim só entra quem o administrador cadastrar. Mesmo que alguém consiga criar conta, não vê nada sem um perfil ativo.

## 3. Supabase: publicar a função de usuários

A função [`supabase/functions/admin-usuarios`](supabase/functions/admin-usuarios/index.ts) é a única que cria, renova a senha e exclui logins.
Ela usa a chave secreta, que fica **só no servidor do Supabase** (o site nunca a recebe).

Com a [Supabase CLI](https://supabase.com/docs/guides/cli): `supabase functions deploy admin-usuarios --no-verify-jwt`
(a própria função confere o login e se quem pede é o administrador).

## 4. Supabase: criar o administrador

Em **Authentication → Users → Add user → Create new user**, crie o **seu** usuário (marque **Auto Confirm User**).
Depois, no **SQL Editor**, rode (trocando o e-mail e o nome):

```sql
insert into public.perfis (user_id, nome, email, tipo, senha_alterada)
select id, 'Seu nome', email, 'admin', true from auth.users
where email = 'voce@exemplo.com'
on conflict (user_id) do nothing;
```

Os outros usuários você cria pelo site, em **Usuários** (só o administrador vê essa página):

- **Locutor**: só a dashboard (ex.: a conta do estúdio).
- **Equipe**: escolha as áreas, cada uma com **Só ver** ou **Editar** (há modelos prontos: Jornalismo, Promoção, Gestor, Produção).
- O site cria uma senha aleatória e mostra uma mensagem pronta com link, e-mail e senha para você mandar.
- No primeiro acesso a pessoa é obrigada a criar a própria senha.

## 5. Supabase: copiar as duas chaves

Clique no botão **Connect** no topo do projeto (ou vá em **Project Settings → API Keys**) e copie:

| O quê | Onde aparece | Exemplo |
|---|---|---|
| **Project URL** | "Project URL" | `https://abcdxyz.supabase.co` |
| **Chave pública** | `anon` / `public`, ou **Publishable key** | `eyJhbGciOi…` ou `sb_publishable_…` |

> ⚠️ **Nunca** use a chave `service_role` ou a **Secret key**. Ela ignora todas as regras de acesso.

## 6. Vercel: publicar

1. Entre em <https://vercel.com/new> (**Add New → Project**).
2. Em **Import Git Repository**, escolha `dashboardfm`.
   Se ele não aparecer, clique em **Adjust GitHub App Permissions** e dê acesso a esse repositório.
3. O **Framework Preset** deve aparecer como **Next.js**. Não mude mais nada.
4. Abra **Environment Variables** e adicione:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | a Project URL do passo 5 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | a chave pública do passo 5 |

5. Clique em **Deploy**.

A Vercel publica a branch `main`. Se o código ainda estiver em outra branch, junte na `main` antes (via Pull Request no GitHub),
ou mude em **Settings → Git → Production Branch**.

> Se mudar alguma variável depois, vá em **Deployments → ⋯ → Redeploy**. As variáveis só entram num deploy novo.

## 7. Testar

1. Abra o endereço que a Vercel deu (ex.: `dashboardfm.vercel.app`). Deve ir direto para o login.
2. Entre com o administrador do passo 4 e cadastre uma prioridade com foto.
3. Volte para **Dashboard**: ela aparece em até 1 minuto (ou clique em **Atualizar**).
4. Em **Usuários**, crie a conta do estúdio (tipo Locutor) e teste o primeiro acesso numa janela anônima.

## Atualizações do banco

Quando uma mudança nova precisa alterar o banco, ela vem num arquivo em [`supabase/migrations/`](supabase/migrations/).
Rode no **SQL Editor** só os arquivos que ainda não rodou, na ordem do número. Quem for instalar do zero roda apenas o `schema.sql`,
que já vem com tudo.

| Arquivo | O que muda |
|---|---|
| `002_prioridades_periodo.sql` | Prioridades passam a ter período no ar (entra / sai) em vez de uma data só. |
| `003_prioridades_titulo.sql` | Prioridades ganham um título curto, que aparece no card. |
| `004_recados.sql` | Nova tabela de recados rápidos (sem imagem, com período e destaque). |
| `005_horarios.sql` | Horário de entrada e saída (opcionais) em prioridades e recados. |
| `006_conexoes_pautas.sql` | Conexões (institucional, pode ficar sem prazo) e Partiu Rádio Disney: pautas com cliente, locutor, horário e tipo, e o "feito" do locutor para o relatório. |
| `007_locutores_escala.sql` | Locutores (foto, cor, horário fixo da semana) e escala por data (fins de semana e trocas); a pauta passa a guardar o locutor escolhido. |
| `008_fixar.sql` | "Fixar em primeiro" nas prioridades e conexões. |
| `009_leituras.sql` | Registro de cada leitura de prioridade/conexão na dashboard (relatório de leituras). |
| `010_jornalismo.sql` | Jornalismo: pautas com seção própria (ESPN, Nota, Conta Tudo…) e aviso de 5 min opcional. |
| `011_promocao.sql` | Promoção: prêmios, grade por horário (com aviso opcional), ouvintes, bloqueados e ganhadores (regra dos 30 dias no banco). |
| `012_camarote.sql` | Eventos: novo vínculo "Camarote Rádio Disney". |
| `013_faixa_premio.sql` | Promoção: prêmio com faixa de horário (das 06h às 09h). |
| `014_final_telefone.sql` | Promoção: a tela do locutor mostra o final do telefone de quem ganhou. |
| `015_acessos.sql` | Acessos por pessoa: perfis (admin, equipe, locutor), áreas com "ver" ou "editar" e troca de senha no primeiro acesso. Só acrescenta. |
| `016_fechar_acesso_publico.sql` | A virada: nada abre sem login autorizado. Rode **depois** de criar o administrador (passo 4). Para desfazer: `supabase/backup/restaurar_acesso_publico.sql`. |
| `017_promocao_v2.sql` | Promoção: validade e parceria do prêmio, "Concluído" do locutor (relatório de entregas), busca de ouvintes do locutor e histórico de alterações (só o admin vê). |
| `018_versao_dados.sql` | A tela do locutor só baixa os dados de novo quando algo mudou (economiza tráfego). |
| `019_recados_repetir.sql` | Recados: opção de aparecer só em alguns dias da semana e num horário diário. |

### Deu problema?

| Sintoma | Causa provável |
|---|---|
| Aviso "Supabase não configurado" | Faltou alguma variável no passo 6, ou não foi feito Redeploy depois de criar. |
| "Acesso não autorizado" | O usuário existe no login, mas não tem perfil ativo: crie/libere em **Usuários**. |
| "Você entrou como …, mas não tem acesso a esta página" | A pessoa não tem nenhuma área liberada (ou não é o administrador, na página Usuários). |
| "E-mail ou senha incorretos" | Confira o usuário em Authentication → Users (e se está confirmado). Esqueceu a senha: **Usuários → Nova senha**. |
| Erro ao salvar ou "row-level security" | A pessoa só pode **ver** essa área, ou o `schema.sql` não rodou inteiro. |
| Erro ao criar usuário | A função `admin-usuarios` não foi publicada (passo 3). |
| Erro ao enviar imagem | Imagem maior que 5 MB ou formato diferente de JPG/PNG/WEBP/GIF. |
