# Dashboard FM — versão estática (zero build)

Este projeto foi reconstruído do zero para funcionar diretamente com **GitHub + Vercel**, sem depender de build, Node ou configuração avançada.

## Como funciona

- Stack: `HTML + CSS + JavaScript` puro.
- Persistência: `localStorage` no navegador.
- Módulos:
  - Início
  - Colaborador
  - Gerenciamento
  - Gestor (Big Numbers)

## Deploy na Vercel

1. Suba este repositório no GitHub.
2. Na Vercel, clique em **New Project** e importe o repo.
3. **Framework Preset**: pode deixar `Other` ou auto detect.
4. **Build Command**: vazio.
5. **Output Directory**: vazio.
6. Deploy.

> Como é estático, deve abrir imediatamente sem erro 404 de build/app.

## Dados

Todos os dados ficam no navegador local do usuário (localStorage).
