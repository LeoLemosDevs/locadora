/*
 * nucleo.js — camada compartilhada entre a vitrine (index) e o balcão (admin).
 * Cuida de: carregar/salvar o catálogo, entender os links de vídeo e guardar
 * as preferências do usuário (fitas alugadas, histórico, progresso).
 */
window.LOCADORA = (function () {
  'use strict';

  var CAMINHO_JSON = 'dados/catalogo.json';
  var CHAVE_RASCUNHO = 'locadora:rascunho';
  var CHAVE_PREFS = 'locadora:prefs';
  var CHAVE_GITHUB = 'locadora:github';

  var CATEGORIAS_PADRAO = [
    'Ação', 'Aventura', 'Artes Marciais', 'Clássicos', 'Animes', 'Faroeste',
    'Comédia', 'Terror', 'Ficção Científica', 'Drama', 'Suspense',
    'Documentário', 'Infantil'
  ];

  /* As faixas de preço das locadoras antigas — a fita saía com um selo
     colorido na capa indicando quanto custava a diária. Ordem do mais
     caro para o mais barato, que é como as prateleiras eram dispostas. */
  var FAIXAS = ['Diamante', 'Ouro', 'Prata', 'Bronze'];

  /* ---------------------------------------------------------------- utils */

  function id() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID().slice(0, 8);
    return Math.random().toString(36).slice(2, 10);
  }

  function agora() {
    return new Date().toISOString();
  }

  function escapar(texto) {
    return String(texto == null ? '' : texto)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** Remove acentos e caixa para busca tolerante. */
  function normalizar(texto) {
    return String(texto || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().trim();
  }

  function duracaoLegivel(minutos) {
    var m = parseInt(minutos, 10);
    if (!m || m < 1) return '';
    var h = Math.floor(m / 60);
    var r = m % 60;
    if (!h) return r + ' min';
    return h + 'h' + (r ? String(r).padStart(2, '0') : '');
  }

  /* -------------------------------------------------------------- fontes */

  var RX_ARQUIVO = /\.(mp4|webm|ogv|ogg|m4v|mov|mkv|m3u8)(\?|#|$)/i;

  /**
   * Catálogo de origens reconhecidas. Cada item sabe identificar uma URL e
   * traduzi-la no que o player precisa:
   *   'iframe'  → embute o player do próprio site
   *   'video'   → toca no player nativo (e marca onde você parou)
   *   'externo' → só dá para abrir em outra aba
   * A ordem importa: quem vem antes ganha. Para somar um site novo,
   * basta acrescentar um item aqui — o resto do sistema se ajusta sozinho.
   */
  var FONTES = [
    {
      id: 'youtube', nome: 'YouTube',
      rx: /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
      montar: function (url, m) {
        var lista = (url.match(/[?&]list=([A-Za-z0-9_-]+)/) || [])[1];
        return {
          tipo: 'iframe',
          src: 'https://www.youtube-nocookie.com/embed/' + m[1] +
               '?autoplay=1&rel=0&modestbranding=1&playsinline=1' + (lista ? '&list=' + lista : ''),
          externo: 'https://www.youtube.com/watch?v=' + m[1]
        };
      }
    },
    {
      id: 'youtube', nome: 'YouTube',
      rx: /youtube\.com\/(?:playlist\?|.*[?&])list=([A-Za-z0-9_-]+)/,
      montar: function (url, m) {
        return {
          tipo: 'iframe',
          src: 'https://www.youtube-nocookie.com/embed/videoseries?list=' + m[1] + '&autoplay=1',
          externo: url
        };
      }
    },
    {
      id: 'drive', nome: 'Google Drive',
      rx: /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:.*&)?id=)([A-Za-z0-9_-]{10,})/,
      montar: function (url, m) {
        return {
          tipo: 'iframe',
          src: 'https://drive.google.com/file/d/' + m[1] + '/preview',
          externo: 'https://drive.google.com/file/d/' + m[1] + '/view'
        };
      }
    },
    {
      id: 'dailymotion', nome: 'Dailymotion',
      rx: /(?:dailymotion\.com\/(?:video|embed\/video|hub\/[^/]+\/video)\/|dai\.ly\/)([A-Za-z0-9]+)/,
      montar: function (url, m) {
        return {
          tipo: 'iframe',
          src: 'https://www.dailymotion.com/embed/video/' + m[1] + '?autoplay=1',
          externo: 'https://www.dailymotion.com/video/' + m[1]
        };
      }
    },
    {
      id: 'vimeo', nome: 'Vimeo',
      rx: /vimeo\.com\/(?:video\/|channels\/[^/]+\/|groups\/[^/]+\/videos\/)?(\d{6,})(?:\/([0-9a-zA-Z]+))?/,
      montar: function (url, m) {
        // vídeos não listados exigem o "h" (a chave que vem depois da barra)
        return {
          tipo: 'iframe',
          src: 'https://player.vimeo.com/video/' + m[1] + '?autoplay=1' + (m[2] ? '&h=' + m[2] : ''),
          externo: url
        };
      }
    },
    {
      id: 'archive', nome: 'Internet Archive',
      rx: /archive\.org\/(?:details|embed)\/([^/?#&]+)/,
      montar: function (url, m) {
        return {
          tipo: 'iframe',
          src: 'https://archive.org/embed/' + m[1] + '?autoplay=1',
          externo: 'https://archive.org/details/' + m[1]
        };
      }
    },
    {
      id: 'okru', nome: 'OK.ru',
      rx: /ok\.ru\/(?:video|videoembed)\/(\d+)/,
      montar: function (url, m) {
        return {
          tipo: 'iframe',
          src: 'https://ok.ru/videoembed/' + m[1] + '?autoplay=1',
          externo: 'https://ok.ru/video/' + m[1]
        };
      }
    },
    {
      id: 'streamable', nome: 'Streamable',
      rx: /streamable\.com\/(?:e\/)?([A-Za-z0-9]+)/,
      montar: function (url, m) {
        return {
          tipo: 'iframe',
          src: 'https://streamable.com/e/' + m[1] + '?autoplay=1',
          externo: 'https://streamable.com/' + m[1]
        };
      }
    },
    {
      id: 'mega', nome: 'MEGA',
      rx: /mega\.nz\/(?:file|embed)\/([^#?/]+)#([^&\s]+)/,
      montar: function (url, m) {
        return {
          tipo: 'iframe',
          src: 'https://mega.nz/embed/' + m[1] + '#' + m[2],
          externo: 'https://mega.nz/file/' + m[1] + '#' + m[2]
        };
      }
    },
    {
      id: 'pixeldrain', nome: 'Pixeldrain',
      rx: /pixeldrain\.com\/(?:u|api\/file)\/([A-Za-z0-9]+)/,
      montar: function (url, m) {
        // a API entrega o arquivo cru, então cai no player nativo
        return {
          tipo: 'video',
          src: 'https://pixeldrain.com/api/file/' + m[1],
          externo: 'https://pixeldrain.com/u/' + m[1]
        };
      }
    },
    {
      id: 'dropbox', nome: 'Dropbox',
      rx: /dropbox\.com\/(?:s|scl)\//,
      montar: function (url) {
        // dl=0 abre a página; raw=1 entrega o arquivo para a tag <video>
        var direto = url.replace(/[?&](dl|raw)=\d/g, '');
        direto += (direto.indexOf('?') >= 0 ? '&' : '?') + 'raw=1';
        return { tipo: 'video', src: direto, externo: url };
      }
    },
    {
      id: 'terabox', nome: 'TeraBox',
      rx: /(?:terabox|teraboxapp|1024tera|4funbox|mirrobox|nephobox)\.[a-z.]+\/(?:s\/|sharing\/link\?surl=)([A-Za-z0-9_-]+)/i,
      montar: function (url) {
        // O TeraBox bloqueia embutir a página dele em outro site.
        return { tipo: 'externo', src: url, externo: url, motivo: 'terabox' };
      }
    },
    {
      id: 'arquivo', nome: 'Arquivo direto',
      rx: RX_ARQUIVO,
      montar: function (url) {
        return { tipo: 'video', src: url, externo: url };
      }
    }
  ];

  /** Rótulo bonito de cada origem, para os selos da vitrine. */
  var ROTULO_FONTE = { link: 'Link externo' };
  FONTES.forEach(function (f) { ROTULO_FONTE[f.id] = f.nome; });

  /** Acha a primeira origem que reconhece a URL. */
  function casarFonte(url) {
    for (var i = 0; i < FONTES.length; i++) {
      var m = String(url || '').match(FONTES[i].rx);
      if (m) return { def: FONTES[i], m: m };
    }
    return null;
  }

  /** Descobre sozinho de onde vem o vídeo a partir da URL colada. */
  function detectarFonte(url) {
    if (!String(url || '').trim()) return '';
    var achado = casarFonte(url);
    return achado ? achado.def.id : 'link';
  }

  function idYoutube(url) {
    var m = String(url || '').match(FONTES[0].rx);
    return m ? m[1] : '';
  }

  function idDrive(url) {
    var s = String(url || '');
    var m = s.match(FONTES[2].rx) || s.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
    return m ? m[1] : '';
  }

  /**
   * Traduz um filme no que o player precisa renderizar.
   * tipo: 'iframe' (embute), 'video' (tag <video>), 'externo' (abre fora)
   * ou 'nenhum' (sem link cadastrado).
   */
  function reproducao(filme) {
    var url = String((filme && filme.url) || '').trim();
    if (!url) return { tipo: 'nenhum' };

    // Escolha manual do dono no balcão vence a detecção automática.
    var forcado = filme && filme.fonte;
    if (forcado === 'arquivo') return { tipo: 'video', src: url, externo: url };
    if (forcado === 'link') return { tipo: 'externo', src: url, externo: url };

    var achado = casarFonte(url);
    if (achado) return achado.def.montar(url, achado.m);

    return { tipo: 'externo', src: url, externo: url };
  }

  /** Capa automática quando o dono não informou uma. */
  function capaAutomatica(filme) {
    if (filme && filme.capa) return filme.capa;
    var vid = idYoutube((filme && filme.url) || '');
    if (vid) return 'https://i.ytimg.com/vi/' + vid + '/hqdefault.jpg';
    return '';
  }

  /* ---------------------------------------------------- catálogo: leitura */

  function catalogoVazio() {
    return {
      versao: 1,
      nomeLocadora: 'Locadora',
      assinatura: 'vídeo clube particular',
      atualizadoEm: agora(),
      categorias: CATEGORIAS_PADRAO.slice(),
      filmes: []
    };
  }

  /** Aceita a faixa em qualquer caixa/acento; devolve '' se não reconhecer. */
  function faixaValida(valor) {
    var alvo = normalizar(valor);
    for (var i = 0; i < FAIXAS.length; i++) {
      if (normalizar(FAIXAS[i]) === alvo) return FAIXAS[i];
    }
    return '';
  }

  /** Garante que todo campo esperado existe, mesmo em JSON antigo/editado à mão. */
  function sanear(bruto) {
    var base = catalogoVazio();
    if (!bruto || typeof bruto !== 'object') return base;

    base.versao = bruto.versao || 1;
    base.nomeLocadora = bruto.nomeLocadora || base.nomeLocadora;
    base.assinatura = bruto.assinatura || base.assinatura;
    base.atualizadoEm = bruto.atualizadoEm || base.atualizadoEm;

    if (Array.isArray(bruto.categorias) && bruto.categorias.length) {
      base.categorias = bruto.categorias.filter(Boolean);
    }

    base.filmes = (Array.isArray(bruto.filmes) ? bruto.filmes : []).map(function (f) {
      var generos = Array.isArray(f.generos) ? f.generos
        : (f.genero ? String(f.genero).split(/\s*[,;/]\s*/) : []);
      return {
        id: f.id || id(),
        titulo: String(f.titulo || 'Sem título'),
        tituloOriginal: f.tituloOriginal || '',
        ano: f.ano ? parseInt(f.ano, 10) : null,
        generos: generos.filter(Boolean),
        sinopse: f.sinopse || '',
        capa: f.capa || '',
        fundo: f.fundo || '',
        duracao: f.duracao ? parseInt(f.duracao, 10) : null,
        classificacao: f.classificacao || '',
        nota: f.nota != null && f.nota !== '' ? Number(f.nota) : null,
        faixa: faixaValida(f.faixa),
        destaque: !!f.destaque,
        demo: !!f.demo,
        fonte: f.fonte || detectarFonte(f.url),
        url: f.url || '',
        adicionadoEm: f.adicionadoEm || agora()
      };
    });

    return base;
  }

  function lerRascunho() {
    try {
      var cru = localStorage.getItem(CHAVE_RASCUNHO);
      return cru ? sanear(JSON.parse(cru)) : null;
    } catch (e) {
      return null;
    }
  }

  function salvarRascunho(catalogo) {
    catalogo.atualizadoEm = agora();
    try {
      localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(catalogo));
      return true;
    } catch (e) {
      console.warn('Não consegui salvar o rascunho local:', e);
      return false;
    }
  }

  function limparRascunho() {
    try { localStorage.removeItem(CHAVE_RASCUNHO); } catch (e) { /* ignora */ }
  }

  /** true quando a página foi aberta com dois cliques, sem servidor. */
  function abertoDoDisco() {
    return location.protocol === 'file:';
  }

  async function carregarPublicado() {
    // Em file:// o navegador bloqueia fetch por CORS — nem adianta tentar.
    if (abertoDoDisco()) return null;
    try {
      var resp = await fetch(CAMINHO_JSON + '?v=' + Date.now(), { cache: 'no-store' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return sanear(await resp.json());
    } catch (e) {
      console.warn('Não consegui ler ' + CAMINHO_JSON + ':', e.message);
      return null;
    }
  }

  /**
   * Fonte da verdade para as telas: o rascunho local vence quando é mais novo,
   * assim as edições aparecem na hora mesmo antes de publicar no GitHub.
   */
  async function carregar() {
    var publicado = await carregarPublicado();
    var rascunho = lerRascunho();

    if (!publicado && !rascunho) return { catalogo: catalogoVazio(), origem: 'novo' };
    if (!publicado) return { catalogo: rascunho, origem: 'rascunho' };
    if (!rascunho) return { catalogo: publicado, origem: 'publicado' };

    var maisNovo = new Date(rascunho.atualizadoEm) > new Date(publicado.atualizadoEm);
    return maisNovo
      ? { catalogo: rascunho, origem: 'rascunho' }
      : { catalogo: publicado, origem: 'publicado' };
  }

  /* ------------------------------------------------- preferências do dono */

  function lerPrefs() {
    try {
      var p = JSON.parse(localStorage.getItem(CHAVE_PREFS) || '{}');
      return {
        lista: Array.isArray(p.lista) ? p.lista : [],
        historico: Array.isArray(p.historico) ? p.historico : [],
        progresso: p.progresso && typeof p.progresso === 'object' ? p.progresso : {},
        crt: p.crt !== false,
        // quando a locação atual começou (ISO) — define o prazo de devolução
        locacaoEm: p.locacaoEm || null,
        // por fita: { rebobinada: bool, multada: bool }
        fitas: p.fitas && typeof p.fitas === 'object' ? p.fitas : {},
        multaRebobinar: Number(p.multaRebobinar) || 0
      };
    } catch (e) {
      return {
        lista: [], historico: [], progresso: {}, crt: true,
        locacaoEm: null, fitas: {}, multaRebobinar: 0
      };
    }
  }

  function salvarPrefs(p) {
    try { localStorage.setItem(CHAVE_PREFS, JSON.stringify(p)); } catch (e) { /* ignora */ }
  }

  function alternarLista(filmeId) {
    var p = lerPrefs();
    var i = p.lista.indexOf(filmeId);
    if (i >= 0) p.lista.splice(i, 1); else p.lista.unshift(filmeId);

    // a locação abre quando a primeira fita sai e fecha quando a última volta
    if (p.lista.length && !p.locacaoEm) p.locacaoEm = agora();
    if (!p.lista.length) p.locacaoEm = null;

    salvarPrefs(p);
    return i < 0;
  }

  /** Devolve tudo: zera a lista, o prazo e as multas. */
  function devolverTudo() {
    var p = lerPrefs();
    p.lista = [];
    p.locacaoEm = null;
    p.multaRebobinar = 0;
    p.fitas = {};
    salvarPrefs(p);
  }

  /** Registra que a fita entrou em reprodução (logo, saiu do rebobinado). */
  function marcarUsada(filmeId) {
    var p = lerPrefs();
    p.fitas[filmeId] = p.fitas[filmeId] || {};
    p.fitas[filmeId].rebobinada = false;
    salvarPrefs(p);
  }

  function marcarRebobinada(filmeId) {
    var p = lerPrefs();
    p.fitas[filmeId] = p.fitas[filmeId] || {};
    p.fitas[filmeId].rebobinada = true;
    p.fitas[filmeId].multada = false;
    salvarPrefs(p);
  }

  /**
   * Cobra R$ 1,00 pelas fitas que ficaram sem rebobinar quando o freguês
   * vai pegar outra. Cada fita só é multada uma vez, até ser rebobinada.
   * Devolve os ids recém-multados.
   */
  function cobrarNaoRebobinadas(exceto) {
    var p = lerPrefs();
    var novas = [];

    Object.keys(p.fitas).forEach(function (id) {
      var f = p.fitas[id];
      if (id === exceto || f.rebobinada !== false || f.multada) return;
      f.multada = true;
      p.multaRebobinar += MULTA_REBOBINAR;
      novas.push(id);
    });

    if (novas.length) salvarPrefs(p);
    return novas;
  }

  function registrarVisto(filmeId) {
    var p = lerPrefs();
    p.historico = [filmeId].concat(p.historico.filter(function (x) { return x !== filmeId; })).slice(0, 30);
    salvarPrefs(p);
  }

  function salvarProgresso(filmeId, segundos, total) {
    if (!total || segundos < 30) return;
    var p = lerPrefs();
    // Perto do fim conta como assistido: some da fila de "continuar".
    if (segundos / total > 0.95) delete p.progresso[filmeId];
    else p.progresso[filmeId] = { s: Math.floor(segundos), t: Math.floor(total) };
    salvarPrefs(p);
  }

  /* =============================================== locação, prazo e multas
     A brincadeira de locadora: cada fita tem uma diária conforme a classe,
     o prazo sai do dia real da semana e o atraso custa caro. Tudo fica no
     navegador — não há servidor nem IP envolvido.
     ====================================================================== */

  var PRECOS = { diamante: 5, ouro: 4, prata: 3, bronze: 2 };
  var PRECO_SEM_CLASSE = 3;
  var MULTA_ATRASO_DIA = 2;      // por fita, por dia de atraso
  var MULTA_REBOBINAR = 1;       // por fita devolvida sem rebobinar

  var DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

  function precoDaFita(filme) {
    return PRECOS[normalizar(filme && filme.faixa)] || PRECO_SEM_CLASSE;
  }

  function dinheiro(valor) {
    return 'R$ ' + Number(valor || 0).toFixed(2).replace('.', ',');
  }

  function dataCurta(d) {
    return String(d.getDate()).padStart(2, '0') + '/' +
           String(d.getMonth() + 1).padStart(2, '0');
  }

  /**
   * Prazo de devolução a partir do dia real em que a fita saiu.
   * Sexta e sábado caem na segunda; o resto é 24 horas. Sempre até as 20h.
   */
  function prazoDevolucao(inicioISO, quantidade) {
    var saida = new Date(inicioISO);
    var fim = new Date(saida);
    var regra;

    if (saida.getDay() === 5) {              // sexta
      fim.setDate(saida.getDate() + 3);      // → segunda
      regra = quantidade >= 5 ? 'promoção de sexta' : 'fim de semana';
    } else if (saida.getDay() === 6) {       // sábado
      fim.setDate(saida.getDate() + 2);      // → segunda
      regra = 'fim de semana';
    } else {
      fim.setDate(saida.getDate() + 1);      // 24 horas
      regra = '24 horas';
    }

    fim.setHours(20, 0, 0, 0);
    return { data: fim, regra: regra, diaSemana: DIAS[fim.getDay()] };
  }

  /** Monta o cupom inteiro: itens, promoção, atraso e total. */
  function montarCupom(filmes, inicioISO, multaRebobinar) {
    var itens = filmes.map(function (f) {
      return {
        id: f.id,
        titulo: f.titulo,
        faixa: f.faixa,
        valor: precoDaFita(f),
        gratis: false
      };
    });

    var prazo = prazoDevolucao(inicioISO, itens.length);
    var naSexta = new Date(inicioISO).getDay() === 5;

    // "pague 3, leve 5": as duas mais baratas de cada cinco saem de graça
    var gratis = (naSexta && itens.length >= 5) ? Math.floor(itens.length / 5) * 2 : 0;
    if (gratis) {
      itens.slice()
        .sort(function (a, b) { return a.valor - b.valor; })
        .slice(0, gratis)
        .forEach(function (i) { i.gratis = true; });
    }

    var subtotal = 0, desconto = 0;
    itens.forEach(function (i) {
      subtotal += i.valor;
      if (i.gratis) desconto += i.valor;
    });

    // atraso conta em dias cheios depois do prazo
    var atrasoMs = Date.now() - prazo.data.getTime();
    var diasAtraso = atrasoMs > 0 ? Math.ceil(atrasoMs / 864e5) : 0;
    var multaAtraso = diasAtraso * MULTA_ATRASO_DIA * itens.length;

    multaRebobinar = multaRebobinar || 0;

    return {
      itens: itens,
      prazo: prazo,
      subtotal: subtotal,
      desconto: desconto,
      diasAtraso: diasAtraso,
      multaAtraso: multaAtraso,
      multaRebobinar: multaRebobinar,
      total: subtotal - desconto + multaAtraso + multaRebobinar
    };
  }

  /* ---------------------------------------------------- config do GitHub */

  function lerGithub() {
    try {
      var g = JSON.parse(localStorage.getItem(CHAVE_GITHUB) || '{}');
      return {
        usuario: g.usuario || '',
        repo: g.repo || '',
        branch: g.branch || 'main',
        caminho: g.caminho || CAMINHO_JSON,
        token: g.token || ''
      };
    } catch (e) {
      return { usuario: '', repo: '', branch: 'main', caminho: CAMINHO_JSON, token: '' };
    }
  }

  function salvarGithub(cfg) {
    try { localStorage.setItem(CHAVE_GITHUB, JSON.stringify(cfg)); } catch (e) { /* ignora */ }
  }

  /** Codifica UTF-8 em base64 (o btoa cru quebra com acento). */
  function paraBase64(texto) {
    var bytes = new TextEncoder().encode(texto);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  /** Faz o commit do catálogo.json no repositório via API do GitHub. */
  async function publicarNoGithub(catalogo, cfg, mensagem) {
    if (!cfg.usuario || !cfg.repo || !cfg.token) {
      throw new Error('Preencha usuário, repositório e token antes de publicar.');
    }

    var base = 'https://api.github.com/repos/' + cfg.usuario + '/' + cfg.repo +
      '/contents/' + cfg.caminho.replace(/^\/+/, '');
    var cabecalho = {
      'Authorization': 'Bearer ' + cfg.token,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };

    // O GitHub exige o SHA do arquivo atual para sobrescrever.
    var sha = null;
    var atual = await fetch(base + '?ref=' + encodeURIComponent(cfg.branch), { headers: cabecalho });
    if (atual.ok) {
      sha = (await atual.json()).sha;
    } else if (atual.status === 401) {
      throw new Error('Token recusado (401). Gere um novo com permissão de escrita em Contents.');
    } else if (atual.status === 404) {
      sha = null; // arquivo ainda não existe: será criado
    } else if (atual.status !== 404) {
      throw new Error('Não consegui ler o arquivo no GitHub (HTTP ' + atual.status + ').');
    }

    var corpo = {
      message: mensagem || 'Atualiza catálogo da locadora',
      content: paraBase64(JSON.stringify(catalogo, null, 2) + '\n'),
      branch: cfg.branch
    };
    if (sha) corpo.sha = sha;

    var envio = await fetch(base, {
      method: 'PUT',
      headers: Object.assign({ 'Content-Type': 'application/json' }, cabecalho),
      body: JSON.stringify(corpo)
    });

    if (!envio.ok) {
      var detalhe = '';
      try { detalhe = (await envio.json()).message || ''; } catch (e) { /* ignora */ }
      if (envio.status === 409) {
        throw new Error('Conflito: o arquivo mudou no GitHub. Recarregue a página e tente de novo.');
      }
      throw new Error('Falha ao publicar (HTTP ' + envio.status + '). ' + detalhe);
    }

    return await envio.json();
  }

  /* ------------------------------------------------------------- exporta */

  return {
    CAMINHO_JSON: CAMINHO_JSON,
    CATEGORIAS_PADRAO: CATEGORIAS_PADRAO,
    FAIXAS: FAIXAS,
    faixaValida: faixaValida,
    ROTULO_FONTE: ROTULO_FONTE,

    id: id,
    agora: agora,
    escapar: escapar,
    normalizar: normalizar,
    duracaoLegivel: duracaoLegivel,

    detectarFonte: detectarFonte,
    idYoutube: idYoutube,
    idDrive: idDrive,
    FONTES: FONTES,
    reproducao: reproducao,
    capaAutomatica: capaAutomatica,

    catalogoVazio: catalogoVazio,
    sanear: sanear,
    abertoDoDisco: abertoDoDisco,
    carregar: carregar,
    carregarPublicado: carregarPublicado,
    lerRascunho: lerRascunho,
    salvarRascunho: salvarRascunho,
    limparRascunho: limparRascunho,

    lerPrefs: lerPrefs,
    salvarPrefs: salvarPrefs,
    alternarLista: alternarLista,
    registrarVisto: registrarVisto,
    salvarProgresso: salvarProgresso,

    MULTA_ATRASO_DIA: MULTA_ATRASO_DIA,
    MULTA_REBOBINAR: MULTA_REBOBINAR,
    precoDaFita: precoDaFita,
    dinheiro: dinheiro,
    dataCurta: dataCurta,
    prazoDevolucao: prazoDevolucao,
    montarCupom: montarCupom,
    devolverTudo: devolverTudo,
    marcarUsada: marcarUsada,
    marcarRebobinada: marcarRebobinada,
    cobrarNaoRebobinadas: cobrarNaoRebobinadas,

    lerGithub: lerGithub,
    salvarGithub: salvarGithub,
    publicarNoGithub: publicarNoGithub
  };
})();
