# 📼 Locadora

Um "Netflix" particular com cara de vídeo clube de bairro. Site estático puro — sem
servidor, sem banco de dados, sem mensalidade. Os filmes continuam onde já estão
(YouTube, Google Drive, TeraBox ou um `.mp4` direto); aqui ficam só os cadastros.

```
Locadora/
├── abrir.sh                atalho: sobe o servidor local e abre o navegador
├── index.html              a vitrine (prateleiras, busca, player)
├── admin.html              o balcão (cadastro e publicação)
├── dados/
│   ├── catalogo.json       o acervo inteiro — este é o "banco de dados"
│   └── exemplo.json        10 fitas fictícias, só para ver o visual (opcional)
├── assets/
│   ├── css/estilo.css
│   └── js/
│       ├── nucleo.js       leitura/gravação do catálogo e leitura dos links
│       ├── app.js          a vitrine
│       └── admin.js        o balcão
└── README.md
```

---

## 1. Rodar no seu computador

⚠️ **Não abra o `index.html` com dois cliques.** Por segurança, o navegador
proíbe uma página vinda do disco (`file://`) de ler outros arquivos — inclusive o
`catalogo.json`. O acervo apareceria sempre vazio. Isso é regra do navegador, não
defeito do projeto, e **não acontece no GitHub Pages**.

Use o atalho, que sobe um servidor local e já abre o navegador:

```bash
./abrir.sh
```

Ou faça na mão:

```bash
cd Locadora
python3 -m http.server 8080
```

Depois acesse:

- Vitrine → <http://localhost:8080/>
- Balcão → <http://localhost:8080/admin.html>

Na primeira visita ao balcão você escolhe a senha que vai destrancá-lo.

O acervo começa vazio. Se quiser ver como a vitrine fica cheia antes de cadastrar
os seus filmes, vá em **Cópia de segurança → ⬆ Importar backup** e escolha
`dados/exemplo.json`. Para voltar ao acervo em branco depois, use
**Descartar alterações locais**.

---

## 2. Colocar no ar de graça (GitHub Pages)

1. Crie uma conta em <https://github.com> (grátis).
2. Crie um repositório **público** chamado, por exemplo, `locadora`.
3. Envie os arquivos desta pasta para ele (botão *Add file → Upload files* já resolve).
4. No repositório: **Settings → Pages → Build and deployment**
   - *Source*: `Deploy from a branch`
   - *Branch*: `main` / pasta `/ (root)` → **Save**
5. Em cerca de 1 minuto o site fica em:

```
https://SEU-USUARIO.github.io/locadora/
```

Endereço grátis, HTTPS incluso, sem domínio para pagar.

> **Quer o endereço mais curto?** Nomeie o repositório como
> `SEU-USUARIO.github.io` — aí o site fica em `https://SEU-USUARIO.github.io/`.

---

## 3. Cadastrar e publicar filmes

Abra `/admin.html`, preencha o formulário e salve. **As alterações valem na hora,
mas só neste navegador** — elas ficam guardadas localmente até você publicar.

Para valer em qualquer aparelho, há dois caminhos:

### A) Publicar com um clique (recomendado)

No painel **Publicação → Configurar conexão com o GitHub**, preencha:

| Campo | Exemplo |
|---|---|
| Usuário | `seu-usuario` |
| Repositório | `locadora` |
| Branch | `main` |
| Caminho do arquivo | `dados/catalogo.json` |
| Token | `github_pat_…` |

Para gerar o token:

1. <https://github.com/settings/personal-access-tokens> → **Generate new token**
2. *Repository access* → **Only select repositories** → escolha `locadora`
3. *Permissions → Repository permissions → **Contents: Read and write***
4. Gere, copie e cole no balcão.

Pronto: o botão **↥ Publicar no GitHub** faz o commit sozinho e o Pages atualiza
em menos de um minuto.

> O token fica só no `localStorage` do seu navegador — nunca é enviado para o
> repositório nem aparece no site. Ainda assim, gere-o com acesso a **um único
> repositório**, e use **Esquecer token** se for mexer num computador emprestado.

### B) Sem token, no braço

Clique em **⬇ Baixar catalogo.json** e substitua o arquivo `dados/catalogo.json`
no repositório pelo baixado. Mesmo resultado, só que manual.

---

## 4. De onde vêm os filmes

O balcão identifica a origem sozinho quando você cola o link. Suporte atual:

| Site | Como toca | Observação |
|---|---|---|
| **YouTube** | embutido | vídeos, shorts e playlists; título e capa vêm sozinhos |
| **Google Drive** | embutido | precisa estar como "qualquer pessoa com o link" |
| **Dailymotion** | embutido | `dailymotion.com/video/…` e `dai.ly/…` |
| **Vimeo** | embutido | inclui não listados (com a chave depois da barra) |
| **Internet Archive** | embutido | ótimo para filmes antigos em domínio público |
| **OK.ru** | embutido | |
| **Streamable** | embutido | |
| **MEGA** | embutido | cole o link inteiro, **com a chave depois do `#`** |
| **Pixeldrain** | player nativo | vira link direto; marca onde você parou |
| **Dropbox** | player nativo | convertido para link cru automaticamente |
| **Arquivo direto** | player nativo | `.mp4`, `.webm`, `.mkv`, `.m3u8`… |
| **TeraBox** | abre em nova aba | eles bloqueiam embutir; não há como contornar |
| **Qualquer outro link** | abre em nova aba | |

Só "embutido" e "player nativo" tocam dentro da vitrine. O **player nativo** é o
único que guarda onde você parou e alimenta a prateleira *Continuar assistindo*.

> **Para acrescentar outro site:** a lista fica em `FONTES`, no topo de
> `assets/js/nucleo.js`. Cada item tem um `rx` (a regra que reconhece a URL) e um
> `montar` (o endereço de embed). Somando um item ali, o balcão e a vitrine se
> ajustam sozinhos — não precisa mexer em mais nada.

### YouTube — o melhor caso

Cole qualquer formato (`youtube.com/watch?v=…`, `youtu.be/…`, `/shorts/…`, ou uma
playlist). Toca embutido, sem limite de banda, e o título e a capa são preenchidos
automaticamente.

### Google Drive

1. No Drive: botão direito no arquivo → **Compartilhar**
2. Em *Acesso geral*, mude para **Qualquer pessoa com o link** → *Leitor*
3. Copie o link e cole no balcão.

Toca embutido, com os controles do próprio Drive.

⚠️ O Drive tem uma **cota diária de download por arquivo**. Para uso pessoal
raramente incomoda, mas se um filme ficar muito assistido pode aparecer
*"não é possível visualizar no momento"* por algumas horas.

### TeraBox

Cole o link de compartilhamento (`terabox.com/s/…`). O TeraBox **bloqueia
tecnicamente a reprodução embutida em outros sites** — não é limitação deste
projeto, é uma trava deles. Então a vitrine mostra a ficha do filme normalmente e
oferece o botão **"Abrir em nova aba"**, que leva ao player do TeraBox.

Se quiser tudo tocando dentro do site, prefira YouTube ou Drive.

### Arquivo direto (`.mp4`, `.webm`, `.m3u8`)

Qualquer link que termine em vídeo toca no player nativo — e este é o único caso
em que a vitrine **marca onde você parou** e mostra a barrinha de "continuar
assistindo".

Lugares gratuitos para hospedar o arquivo em si:

- **[archive.org](https://archive.org)** — ilimitado e permanente, para filmes em
  domínio público. Basta colar o link da página (`/details/…`), que já toca
  embutido. Se preferir a barrinha de "continuar assistindo", pegue o `.mp4`
  direto em *Show all files*.
- **[pixeldrain.com](https://pixeldrain.com)** — upload sem cadastro; o link
  `/u/…` já vira player nativo aqui.
- **Cloudflare R2** / **Backblaze B2** — camada gratuita generosa, exige cartão no
  cadastro.

---

## 5. Como o acervo se organiza

Cada filme carrega uma lista de gêneros, e **cada gênero vira uma prateleira** na
vitrine, na ordem definida em *A locadora → Prateleiras*. Um filme marcado como
"Ação" e "Clássicos" aparece nas duas.

### A classe da fita

Cada filme pode receber uma das quatro faixas de preço das locadoras antigas:

| Classe | Selo |
|---|---|
| **Diamante** | azul gelo, com brilho |
| **Ouro** | dourado |
| **Prata** | prateado |
| **Bronze** | acobreado |

O selo aparece no canto da capa, na ficha do filme e no banner de destaque — e
cada classe ganha uma prateleira própria (*Classe Diamante*, *Classe Ouro*…),
listada do mais caro para o mais barato, antes das prateleiras de gênero. Buscar
por "ouro" também filtra por ela. O campo é opcional: filme sem classe
simplesmente não ganha selo.

Para mudar as faixas, edite `FAIXAS` no topo de `assets/js/nucleo.js` — o formulário
do balcão e as prateleiras se ajustam sozinhos. Se acrescentar uma faixa nova,
crie também a cor dela em `assets/css/estilo.css` (procure por `.medalha--ouro`).

### A brincadeira de locação

Ao alugar a primeira fita, abre uma locação e um recibo fica
**pendurado na lateral direita** da tela. Fechado, é só uma abinha de cartolina
mostrando *"3 fitas · R$ 12,00"*; clicando, o papel desliza para fora com a conta
inteira. Ele acompanha você em qualquer aba, então dá para escolher os filmes
vendo o total subir — e abre sozinho toda vez que uma fita nova entra.

A diária vem da classe da fita: Diamante R$ 5,00 · Ouro R$ 4,00 · Prata R$ 3,00 ·
Bronze R$ 2,00 · sem classe R$ 3,00.

**Prazo**, calculado sobre o dia real em que a primeira fita saiu:

| Saiu | Devolver | Regra |
|---|---|---|
| segunda a quinta | dia seguinte, 20h | 24 horas |
| **sexta** | segunda, 20h | fim de semana |
| **sexta com 5+ fitas** | segunda, 20h | promoção: as 2 mais baratas de cada 5 saem de graça |
| **sábado** | segunda, 20h | fim de semana |
| domingo | segunda, 20h | 24 horas |

Passou do prazo, o carimbo do cupom começa a piscar **EM ATRASO** e entra
R$ 2,00 por fita por dia.

### O balcão de devolução

A aba **Filmes alugados** é onde a locação se encerra. Ela tem:

**A bancada de rebobinar** — aparece só quando há fita pendente. É um
videocassete desenhado em CSS com uma fita apoiada em cima, etiqueta escrita na
caneta azul do balconista com o nome do filme e um carimbo vermelho
*"não rebobinada"*. O visor de LED mostra uma metragem entre 1h30 e 2h (estável
para cada filme). As teclas são **Rebobinar · Voltar · Play · Pause · Stop ·
Avançar** e todas mexem no contador — dar play gasta mais fita, e aí sobra mais
para rebobinar.

No **Rebobinar** o contador despenca até zerar em uns 4 segundos, com os
carretéis girando ao contrário. Ao chegar em `0:00:00` o carimbo vira verde
*"rebobinada ✓"*, e um instante depois a próxima fita pendente sobe no aparelho —
até não sobrar nenhuma.

**O caixa** — mostra a conta e o botão verde-dinheiro **Pagar e entregar** com o
valor estampado. Dá para entregar sem rebobinar, mas aí a multa de R$ 1,00 por
fita entra no total, e o botão avisa quanto vai custar. Ao confirmar, as fitas
saem da lista, as multas zeram e a página fica vazia.

### A cobrança

Enquanto houver fita em casa, toda vez que você abre o site aparece um recado de
papel no rodapé. Se estiver no prazo é só um lembrete com a data; **se estiver
atrasado**, o selo vira *"A locadora está cobrando!"* com o total devido e quanto
sobe por dia. Os botões são **Ir ao balcão** e **Depois** — o "depois" cala o
recado até você fechar a aba, e ele volta na próxima visita. Só some de vez
quando você paga e entrega.

### O videocassete

Abaixo do vídeo há um painel de VCR com visor de LED verde e teclas de plástico:
**Rebobinar · Voltar · Play · Pause · Avançar**. O Rebobinar puxa a fita de volta
ao início em uns 6 segundos, com chuvisco na tela e o contador correndo para trás.

Os botões comandam de verdade o **player nativo** (arquivo direto, Pixeldrain,
Dropbox) e o **YouTube**, via a API de iframe deles. Google Drive, MEGA e as
demais origens não permitem controle externo — nesse caso as teclas ficam
apagadas e você usa os controles do próprio player.

**A multa por não rebobinar:** ao dar play numa fita, ela sai do estado
rebobinado. Se você for assistir outro filme sem ter rebobinado a anterior,
aparece uma janelinha cobrando R$ 1,00, que entra no cupom. Cada fita só é
multada uma vez, até ser rebobinada.

> Tudo isso fica no `localStorage` **daquele navegador** — não há servidor nem
> rastreio de IP. Trocou de aparelho ou limpou os dados do navegador, a locação
> recomeça do zero.

### Os cartazes da loja

Entre as estantes ficam pendurados os avisos de locadora, em quatro modelos:

| Modelo | Como é |
|---|---|
| `led` | painel de LED vermelho com o texto rolando e malha de pontinhos |
| `neon` | letreiro de neon rosa que pisca em tempos irregulares, como tubo velho |
| `papel` | folha creme torta, presa com fita adesiva, escrita a caneta |
| `placa` | plaquinha esmaltada azul com borda creme |

Os dois primeiros da lista (o LED e o neon) ficam **logo abaixo do banner de
destaque**, como a fachada da loja. Os demais seguem pendurados entre as
estantes, um a cada três, rodando a lista. Na busca e em "Filmes alugados" a tela
fica limpa, sem cartazes.

Para trocar os dizeres, mexa na lista **`AVISOS`** em `assets/js/app.js` — cada
item tem `tipo` (um dos quatro acima), `texto` e, quando cabe, `sub`. Acrescentar
ou remover avisos ajusta o rodízio sozinho.

### Rolando a prateleira

Quando a fileira tem mais fitas do que cabe na tela, aparece um botão redondo em
cada ponta — o da esquerda só surge depois que você já andou um pouco. Além dele:

- **arrastar com o mouse**, empurrando as fitas pela estante
- **shift + roda do mouse**, que o navegador já converte em rolagem horizontal
- **setas do teclado**, depois de clicar numa fita
- **deslizar o dedo**, no celular (aí os botões somem, para não cobrir a capa)

### As prateleiras automáticas

A vitrine ainda monta sozinha:

- **Continuar assistindo** — filmes de arquivo direto deixados pela metade
- **Chegou na locadora** — os últimos cadastrados (aparece a partir de 7 fitas)
- **Classe Diamante / Ouro / Prata / Bronze** — as fitas de cada faixa de preço
- **Sem categoria** — gêneros digitados que não estão na lista de prateleiras
- **Destaque da semana** — sorteado entre os marcados com ★, muda a cada dia

E guarda, só no seu navegador: sua lista, o histórico e o efeito CRT ligado/desligado.

---

## 6. Quando o vídeo não toca

**"Erro 153" no player do YouTube** — a página está aberta como `file://`. O YouTube
recusa reproduzir quando a origem chega como `null`, que é o caso de qualquer
arquivo aberto direto do disco. Vale para o Google Drive também. Use
`./abrir.sh` e o endereço `localhost`, ou publique no GitHub Pages.

> ⚠️ **Atenção ao trocar de endereço:** o que você cadastrou em `file://` **não
> aparece** em `localhost`, e vice-versa. O navegador guarda os dados separados
> por endereço. Para levar o acervo de um para o outro, use **Exportar backup**
> num e **Importar backup** no outro.

**"Vídeo indisponível" ou "Assista no YouTube"** — o dono do vídeo desativou a
reprodução em outros sites. Não há como contornar; use o botão **Abrir fora ↗**
para assistir no YouTube, ou procure outra cópia do filme.

**Google Drive dizendo que não pode exibir** — ou o arquivo não está como
"qualquer pessoa com o link", ou bateu a cota diária de download daquele arquivo
(nesse caso volta sozinho em algumas horas).

---

## 7. Coisas que é bom saber

- **A senha do balcão é uma trava leve.** Ela roda no navegador, então impede um
  curioso, não um técnico. Como o site é estático, não existe segurança real do
  lado do servidor — o `admin.html` e o `catalogo.json` ficam acessíveis a quem
  souber o endereço. A proteção que importa está nos vídeos: quem não tem acesso
  ao Drive/TeraBox não assiste nada.
- **Repositório público:** exigido para o GitHub Pages ser gratuito. Ninguém vai
  achar seu site sem o link, mas ele não é secreto.
- **A senha e a lista pessoal são por navegador.** Trocou de aparelho, define de novo.
- **Faça backup.** Botão *Exportar backup* no fim do balcão. Se publicar no GitHub,
  o histórico de commits já é um backup automático de cada versão.

---

## 8. Ajustes rápidos

| O que mudar | Onde |
|---|---|
| Nome do letreiro de neon | Balcão → *A locadora* |
| Prateleiras e a ordem delas | Balcão → *A locadora → Prateleiras* |
| Cores do tema | `assets/css/estilo.css`, bloco `:root` no topo |
| Tamanho das capas | `assets/css/estilo.css`, variável `--capa-l` |
| Desligar o efeito CRT | Link no rodapé da vitrine |
