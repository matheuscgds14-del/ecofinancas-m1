# EcoFinanças — Plataforma Web de Planejamento Financeiro Sustentável

Aplicação web desenvolvida como produto mínimo viável (MVP) para o **Projeto Integrador (Módulo 1)** do curso de Análise e Desenvolvimento de Sistemas (UniFOA)[cite: 5].

O objetivo do sistema é oferecer uma ferramenta acessível de controle financeiro pessoal que ajude os usuários a organizarem suas receitas e despesas mensais, definirem metas de economia e adotarem hábitos de consumo consciente no dia a dia[cite: 5].

**Equipe:**
- Matheus Carlos 
- Jose Gabriel 

---

## Funcionalidades

- **Autenticação de usuários:** Cadastro e login com validação de dados e senhas criptografadas (`bcryptjs` + `JWT`).
- **Dashboard financeiro:** Resumo mensal automático com cálculo de receitas totais, despesas, saldo disponível e taxa de economia.
- **Gestão de lançamentos (CRUD):** Inclusão, listagem, edição e exclusão de receitas e despesas com filtro por mês e ano[cite: 15].
- **Análise por categoria:** Gráfico visual exibindo o peso de cada categoria de gasto (alimentação, moradia, transporte, contas, lazer, entre outras)[cite: 12].
- **Metas financeiras:** Criação e acompanhamento do progresso de objetivos de economia[cite: 12, 15].
- **Consumo consciente:** Painel educativo com orientações práticas para redução de desperdício doméstico e equilíbrio financeiro[cite: 12, 15].

---

## Tecnologias Utilizadas

- **Front-end:** HTML5, CSS3 e JavaScript (Vanilla JS com Fetch API)[cite: 12, 15]
- **Back-end:** Node.js com framework Express (API REST)[cite: 15]
- **Banco de Dados:** SQLite (`sql.js`) com persistência local em arquivo[cite: 15]
- **Segurança:** Criptografia de senhas (`bcryptjs`), autenticação via token (`jsonwebtoken`), proteção de cabeçalhos (`helmet`) e limitação de requisições (`express-rate-limit`)[cite: 15]

---

## Estrutura de Pastas

```text
ecofinancas-m1/
├── data/               # Armazenamento do banco de dados SQLite[cite: 8, 15]
├── public/             # Arquivos do front-end (HTML, CSS e JS)[cite: 12]
│   ├── index.html      # Estrutura das telas (Login e Dashboard)[cite: 12, 13]
│   ├── style.css       # Estilização e layout responsivo[cite: 12, 15]
│   └── app.js          # Lógica de interface e consumo da API[cite: 12]
├── .env.example        # Modelo de variáveis de ambiente[cite: 7]
├── package.json        # Dependências e scripts do projeto[cite: 14]
└── server.js           # Servidor Express, rotas da API e regras de negócio[cite: 15]