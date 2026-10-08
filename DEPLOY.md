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

## 2. Supabase: fechar o cadastro público

Em **Authentication → Sign In / Providers → Email** (ou **Authentication → Settings**, dependendo da versão do painel):

- **Desligue** a opção **"Allow new users to sign up"** e salve.

Assim só entra quem você cadastrar. Mesmo que alguém consiga criar conta, não consegue editar nada sem estar na equipe (passo 4).

## 3. Supabase: criar os usuários da equipe

Em **Authentication → Users → Add user → Create new user**:

- Coloque o e-mail e uma senha.
- Marque **Auto Confirm User**.
- Repita para cada pessoa da produção que vai cadastrar coisas.

## 4. Supabase: liberar esses usuários para editar

No **SQL Editor**, rode uma vez para cada pessoa, trocando o e-mail e o nome:

```sql
insert into public.equipe (user_id, nome)
select id, 'Nome da pessoa' from auth.users
where email = 'pessoa@exemplo.com'
on conflict (user_id) do nothing;
```

Para ver quem já está liberado: `select * from public.equipe;`
Para tirar alguém: `delete from public.equipe where user_id = (select id from auth.users where email = 'pessoa@exemplo.com');`

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

1. Abra o endereço que a Vercel deu (ex.: `dashboardfm.vercel.app`). A dashboard deve abrir vazia, com "Sem prioridades para este dia."
2. Clique em **Artístico**. Deve ir para o login.
3. Entre com um usuário do passo 3 e cadastre uma prioridade com foto.
4. Volte para **Dashboard**: ela aparece em até 1 minuto (ou clique em **Atualizar**).

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

### Deu problema?

| Sintoma | Causa provável |
|---|---|
| Aviso "Supabase não configurado" | Faltou alguma variável no passo 6, ou não foi feito Redeploy depois de criar. |
| "Você entrou como …, mas esse usuário ainda não foi liberado" | Falta o passo 4 para esse e-mail. |
| "E-mail ou senha incorretos" | Confira o usuário em Authentication → Users (e se está confirmado). |
| Erro ao salvar ou "row-level security" | O `schema.sql` não rodou inteiro, ou o usuário não está na equipe. |
| Erro ao enviar imagem | Imagem maior que 5 MB ou formato diferente de JPG/PNG/WEBP/GIF. |
