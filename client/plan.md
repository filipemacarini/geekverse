Aqui está o arquivo **`plan.md`** completo e detalhado. Você pode salvá-lo na raiz ou pasta do seu projeto e apontar para o Cline seguir passo a passo:

```markdown
# 📋 Plano de Ação: Correção de CORS e Hotlink da MangaDex (TanStack Start)

## 📌 Contexto & Diagnóstico
- **Sintoma:** O navegador baixa o payload da MangaDex com status `200 OK`, mas bloqueia o acesso via JavaScript com o erro:
  `Response body is not available to scripts (Reason: CORS Missing Allow Origin)`.
- **Causa Raiz:** A API `api.mangadex.org` proíbe intencionalmente o consumo direto via browser (`fetch`) de origens de terceiros (não envia o cabeçalho `Access-Control-Allow-Origin`). Além disso, o servidor interno Nitro do TanStack Start intercepta requisições locais antes que o proxy do Vite (`server.proxy`) possa agir.
- **Solução Arquitetural:** Utilizar **Server Functions (`createServerFn`)** nativas do TanStack Start. A requisição HTTP passa a ser disparada pelo ambiente de servidor (Node.js/Nitro/Vercel Serverless Function), onde restrições de CORS não existem. Adicionalmente, configurar `referrerPolicy="no-referrer"` nos elementos de imagem para contornar a proteção contra hotlink das CDNs da MangaDex.

---

## 🎯 Escopo das Modificações
- **Arquivo principal:** `client/src/routes/obra.$id.tsx`
- **Ações:**
  1. Importar `createServerFn` de `@tanstack/react-start`.
  2. Implementar `fetchMangaChapters` no servidor para obter o feed de capítulos.
  3. Implementar `fetchMangaPages` no servidor para resolver as URLs do `@home/server`.
  4. Sanitizar o identificador UUID da obra a partir de `t.source`.
  5. Refatorar as queries `useQuery` de capítulos e de páginas para chamar as Server Functions.
  6. Injetar `referrerPolicy="no-referrer"` em todas as tags `<img>` no leitor de mangá (`MangaReader`).

---

## 🛠️ Passo a Passo de Implementação

### Etapa 1: Atualização dos Imports e Server Functions
No topo de `client/src/routes/obra.$id.tsx`:
1. Adicionar o import do `createServerFn`:
   ```tsx
   import { createServerFn } from "@tanstack/react-start";
   ```

2. Declarar as Server Functions fora dos componentes React:
   ```tsx
   // 1. Busca de capítulos no servidor (Bypass de CORS)
   const fetchMangaChapters = createServerFn({ method: "GET" })
     .validator((mangaId: string) => mangaId)
     .handler(async ({ data: mangaId }) => {
       const url = `https://api.mangadex.org/manga/${mangaId}/feed?translatedLanguage[]=pt-br&translatedLanguage[]=pt&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic&order[chapter]=asc&limit=500`;
       const r = await fetch(url, {
         headers: {
           "User-Agent": "GeekVerse/1.0 (contact@geekverse.com)",
         },
       });
       if (!r.ok) {
         throw new Error(`Falha ao buscar capítulos no MangaDex (Status ${r.status})`);
       }
       return (await r.json()) as { data: MdChapter[] };
     });

   // 2. Busca de metadados das páginas do capítulo no servidor (Bypass de CORS)
   const fetchMangaPages = createServerFn({ method: "GET" })
     .validator((chapterId: string) => chapterId)
     .handler(async ({ data: chapterId }) => {
       const r = await fetch(`https://api.mangadex.org/at-home/server/${chapterId}`, {
         headers: {
           "User-Agent": "GeekVerse/1.0 (contact@geekverse.com)",
         },
       });
       if (!r.ok) {
         throw new Error(`Falha ao carregar páginas no MangaDex (Status ${r.status})`);
       }
       return (await r.json()) as { baseUrl: string; chapter: { hash: string; data: string[] } };
     });
   ```

---

### Etapa 2: Sanitização de `mangaId` e Integração da Query `md`
Dentro do componente `TitlePage`:
1. Sanitizar `t?.source` para extrair apenas o UUID (caso links completos tenham sido inseridos):
   ```tsx
   const mangaId = useMemo(() => {
     if (!t?.source) return undefined;
     const match = t.source.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
     return match ? match[0] : t.source.trim();
   }, [t?.source]);
   ```

2. Atualizar a query `md` para invocar a Server Function:
   ```tsx
   const md = useQuery({
     queryKey: ["mangadex-feed", mangaId],
     enabled: isManga && Boolean(mangaId),
     queryFn: async () => {
       const j = await fetchMangaChapters({ data: mangaId! });
       const seen = new Set<string>();
       return j.data
         .filter((x) => x.attributes.pages > 0 && !x.attributes.externalUrl)
         .filter((x) => {
           const k = x.attributes.chapter ?? x.id;
           if (seen.has(k)) return false;
           seen.add(k);
           return true;
         })
         .map((x): ViewContent => ({
           id: x.id,
           title_id: t!.id,
           title: x.attributes.title ?? "",
           season: Number(x.attributes.volume) || 1,
           episode: Number(x.attributes.chapter) || 0,
           language: "none",
           source_url: "",
         }));
     },
   });
   ```

---

### Etapa 3: Atualização do `MangaReader` (Páginas e Imagens)
Dentro do componente `MangaReader`:
1. Atualizar a query `pages` para invocar `fetchMangaPages`:
   ```tsx
   const pages = useQuery({
     queryKey: ["mangadex-pages", chapterId],
     staleTime: 10 * 60 * 1000,
     queryFn: async () => {
       const j = await fetchMangaPages({ data: chapterId });
       return j.chapter.data.map((f) => `${j.baseUrl}/data/${j.chapter.hash}/${f}`);
     },
   });
   ```

2. Garantir `referrerPolicy="no-referrer"` em todas as tags `<img>` do componente:
   - **Modo Cascata (Vertical):**
     ```tsx
     {list.map((src, i) => (
       <img
         key={src}
         src={src}
         alt={`Página ${i + 1}`}
         loading={i < 3 ? "eager" : "lazy"}
         referrerPolicy="no-referrer"
         className="w-full"
       />
     ))}
     ```
   - **Modo Paginado (Horizontal / Folhear):**
     ```tsx
     {list[page] && (
       <img
         src={list[page]}
         alt={`Página ${page + 1}`}
         referrerPolicy="no-referrer"
         className="max-h-full max-w-full object-contain"
       />
     )}
     ```

---

## ✅ Critérios de Aceite
1. **Compilação TypeScript / Build:** 
   - Executar `npm run build` na pasta `client` com 0 erros de tipagem ou de bundling.
2. **Navegador (Network / Console):**
   - Na rota `/obra/:id` de um mangá, a listagem de capítulos deve carregar sem erros de CORS (`Response body is not available to scripts` extinto).
3. **Leitor (Reader):**
   - Ao clicar em um capítulo, as imagens das páginas devem carregar sem erro `403 Forbidden` ou imagens placeholder de aviso da MangaDex.
```