# Power — Controle de Produção

Sistema interno estático inspirado no vídeo enviado, construído com HTML, CSS e JavaScript puro. Não há backend: modelos, lançamentos e sessão ficam no `localStorage` do navegador.

## Acesso

A senha simples configurada no front-end é `205431`. Ela está declarada em `app.js` conforme solicitado e não deve ser tratada como uma autenticação segura para dados sensíveis.

## Rodar localmente

Abra `index.html` diretamente no navegador ou sirva a pasta com qualquer servidor estático. Uma opção rápida:

```bash
python3 -m http.server 3000
```

Depois acesse `http://localhost:3000`.

## Publicar na Vercel

Importe o repositório na Vercel e selecione o preset **Other**. Não é necessário comando de build: a raiz do projeto já contém o `index.html`. Também é possível publicar pela CLI:

```bash
vercel --prod
```

## Publicar no GitHub Pages

Envie todos os arquivos para a branch `main`, abra **Settings → Pages**, selecione **Deploy from a branch**, escolha `main` e a pasta `/root`.

## Backup

A aba **Backup** gera um JSON com `models` e `entries`. Use **Copiar backup** para guardar o texto e **Restaurar do texto** para carregar os dados em outro navegador.
