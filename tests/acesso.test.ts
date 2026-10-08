import { describe, expect, it } from "vitest";
import { destinoSeguro, entraNoArtistico, inicioDe, mensagemAcesso, pode, problemaSenha, type Acesso } from "../src/lib/acesso";

const base: Acesso = { nome: "X", email: "x@y.z", tipo: "equipe", ativo: true, senha_alterada: true, permissoes: {} };

describe("pode", () => {
  it("admin pode tudo", () => {
    expect(pode({ ...base, tipo: "admin" }, "promocao", "editar")).toBe(true);
  });
  it("locutor não entra em área nenhuma", () => {
    const l = { ...base, tipo: "locutor" as const, permissoes: { promocao: "editar" as const } };
    expect(pode(l, "promocao")).toBe(false);
    expect(entraNoArtistico(l)).toBe(false);
    expect(inicioDe(l)).toBe("/");
  });
  it("equipe: ver aceita ver ou editar; editar só editar", () => {
    const e = { ...base, permissoes: { jornalismo: "editar" as const, relatorios: "ver" as const } };
    expect(pode(e, "jornalismo", "editar")).toBe(true);
    expect(pode(e, "relatorios")).toBe(true);
    expect(pode(e, "relatorios", "editar")).toBe(false);
    expect(pode(e, "partiu")).toBe(false);
    expect(inicioDe(e)).toBe("/artistico");
  });
  it("inativo ou sem login não pode nada", () => {
    expect(pode({ ...base, tipo: "admin", ativo: false }, "recados")).toBe(false);
    expect(pode(null, "recados")).toBe(false);
    expect(entraNoArtistico({ ...base })).toBe(false);
  });
});

describe("destinoSeguro", () => {
  it("aceita caminhos do site", () => {
    expect(destinoSeguro("/promocao")).toBe("/promocao");
    expect(destinoSeguro("/artistico?x=1")).toBe("/artistico?x=1");
  });
  it("recusa outros sites e voltas para login", () => {
    expect(destinoSeguro("//mal.com")).toBe("/");
    expect(destinoSeguro("https://mal.com")).toBe("/");
    expect(destinoSeguro("/\\mal.com")).toBe("/");
    expect(destinoSeguro("/login")).toBe("/");
    expect(destinoSeguro("/trocar-senha?redirect=/")).toBe("/");
    expect(destinoSeguro(null, "/artistico")).toBe("/artistico");
  });
});

describe("problemaSenha", () => {
  it("exige 8 caracteres com letras e números", () => {
    expect(problemaSenha("abc123", "abc123")).toMatch(/8 caracteres/);
    expect(problemaSenha("abcdefgh", "abcdefgh")).toMatch(/letras e números/);
    expect(problemaSenha("12345678", "12345678")).toMatch(/letras e números/);
  });
  it("recusa senhas óbvias e confirmação diferente", () => {
    expect(problemaSenha("senha1234", "senha1234")).toMatch(/fácil/);
    expect(problemaSenha("Ouvinte2026", "Ouvinte2025")).toMatch(/não são iguais/);
  });
  it("aceita senha boa", () => {
    expect(problemaSenha("Ouvinte2026", "Ouvinte2026")).toBeNull();
  });
});

it("mensagemAcesso traz link, e-mail e senha", () => {
  const m = mensagemAcesso("Raquel Sousa", "r@radiod.com.br", "Ab3dEf7hJk9m", "https://dashboardfm.vercel.app");
  expect(m).toContain("Olá, Raquel!");
  expect(m).toContain("https://dashboardfm.vercel.app/login");
  expect(m).toContain("r@radiod.com.br");
  expect(m).toContain("Ab3dEf7hJk9m");
});
