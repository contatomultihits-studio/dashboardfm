import { createServerClient } from "@supabase/ssr";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

// Mantém a sessão do Supabase atualizada e manda para o login quem não entrou (só o /login fica aberto).
// O que cada pessoa pode ver é conferido depois, no site (meu_acesso) e nas regras do banco.
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let response = NextResponse.next({ request });
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  // Supabase fora do ar: deixa a página abrir (ela mostra a última versão guardada; o banco segue protegido).
  const semConexao = !!error && (isAuthRetryableFetchError(error) || !error.status || error.status >= 500);

  const { pathname, search } = request.nextUrl;
  if (!data.user && !semConexao && pathname !== "/login") {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = pathname === "/" ? "" : `?redirect=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  // Todas as páginas, menos arquivos do Next, ícones e a API pública do YouTube.
  matcher: ["/((?!_next/static|_next/image|api/|icon.svg|favicon.ico|robots.txt).*)"],
};
