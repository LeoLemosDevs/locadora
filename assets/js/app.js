/*
 * app.js — a vitrine da locadora.
 * Monta as prateleiras, a busca, a ficha do filme e o player.
 */
(function () {
  'use strict';

  var L = window.LOCADORA;
  var esc = L.escapar;

  var catalogo = L.catalogoVazio();
  var prefs = L.lerPrefs();
  var aba = 'acervo';       // 'acervo' | 'lista'
  var termo = '';
  var filmeAberto = null;

  var el = {
    prateleiras: document.getElementById('prateleiras'),
    avisosTopo: document.getElementById('avisos-topo'),
    devolucao: document.getElementById('devolucao'),
    estacao: document.getElementById('estacao'),
    estacaoTexto: document.getElementById('estacao-texto'),
    vhs: document.getElementById('vhs'),
    vhsNome: document.getElementById('vhs-nome'),
    vhsSelo: document.getElementById('vhs-selo'),
    visorEstado: document.getElementById('visor-estado'),
    visorTempo: document.getElementById('visor-tempo'),
    caixaConta: document.getElementById('caixa-conta'),
    btPagar: document.getElementById('bt-pagar'),
    btValor: document.getElementById('bt-valor'),
    caixaNota: document.getElementById('caixa-nota'),

    cobranca: document.getElementById('cobranca'),
    cobrancaTitulo: document.getElementById('cobranca-titulo'),
    cobrancaTexto: document.getElementById('cobranca-texto'),

    recibo: document.getElementById('recibo'),
    reciboAba: document.getElementById('recibo-aba'),
    reciboPapel: document.getElementById('recibo-papel'),
    reciboResumo: document.getElementById('recibo-resumo'),

    vcr: document.getElementById('vcr'),
    vcrEstado: document.getElementById('vcr-estado'),
    vcrContador: document.getElementById('vcr-contador'),
    vcrNota: document.getElementById('vcr-nota'),

    multa: document.getElementById('multa'),
    multaTexto: document.getElementById('multa-texto'),
    vazio: document.getElementById('vazio'),
    vazioTitulo: document.getElementById('vazio-titulo'),
    vazioTexto: document.getElementById('vazio-texto'),
    vazioBt: document.getElementById('vazio-bt'),
    busca: document.getElementById('busca'),
    contagem: document.getElementById('contagem'),
    marcaNome: document.getElementById('marca-nome'),
    marcaSub: document.getElementById('marca-sub'),

    vitrine: document.getElementById('vitrine'),
    vitTitulo: document.getElementById('vitrine-titulo'),
    vitMeta: document.getElementById('vitrine-meta'),
    vitSinopse: document.getElementById('vitrine-sinopse'),
    vitAssistir: document.getElementById('vitrine-assistir'),
    vitFicha: document.getElementById('vitrine-ficha'),

    ficha: document.getElementById('ficha'),
    fichaArte: document.getElementById('ficha-arte'),
    fichaTitulo: document.getElementById('ficha-titulo'),
    fichaMeta: document.getElementById('ficha-meta'),
    fichaSinopse: document.getElementById('ficha-sinopse'),
    fichaAssistir: document.getElementById('ficha-assistir'),
    fichaLista: document.getElementById('ficha-lista'),
    fichaExterno: document.getElementById('ficha-externo'),

    player: document.getElementById('player'),
    playerNome: document.getElementById('player-nome'),
    playerTela: document.getElementById('player-tela'),
    playerExterno: document.getElementById('player-externo')
  };

  /* ------------------------------------------------------------ ajudantes */

  function porId(id) {
    for (var i = 0; i < catalogo.filmes.length; i++) {
      if (catalogo.filmes[i].id === id) return catalogo.filmes[i];
    }
    return null;
  }

  function combina(filme, alvo) {
    if (!alvo) return true;
    var texto = L.normalizar(
      [filme.titulo, filme.tituloOriginal, filme.ano, filme.sinopse, filme.faixa]
        .concat(filme.generos).join(' ')
    );
    return alvo.split(/\s+/).every(function (p) { return texto.indexOf(p) >= 0; });
  }

  function visiveis() {
    var alvo = L.normalizar(termo);
    var base = catalogo.filmes;
    if (aba === 'lista') {
      base = prefs.lista
        .map(porId)
        .filter(Boolean);
    }
    return base.filter(function (f) { return combina(f, alvo); });
  }

  /* -------------------------------------------------------------- cartão */

  /** O adesivo metálico da faixa de preço. Vazio quando o filme não tem classe. */
  function medalhaHTML(faixa, classeExtra) {
    if (!faixa) return '';
    return '<span class="medalha medalha--' + L.normalizar(faixa) +
      (classeExtra ? ' ' + classeExtra : '') + '">' + esc(faixa) + '</span>';
  }

  function cartaoHTML(filme) {
    var capa = L.capaAutomatica(filme);
    var prog = prefs.progresso[filme.id];
    var pct = prog && prog.t ? Math.min(100, Math.round((prog.s / prog.t) * 100)) : 0;
    var novo = (Date.now() - new Date(filme.adicionadoEm).getTime()) < 12096e5; // 14 dias

    // O cartaz gerado fica sempre no DOM: aparece se não houver capa
    // ou se a imagem quebrar (link morto, hotlink bloqueado).
    var reserva = '<div class="fita__semcapa"' + (capa ? ' hidden' : '') + '>' +
      '<em>&#9633;</em><span>' + esc(filme.titulo) + '</span></div>';

    var miolo = (capa
      ? '<img class="fita__capa" src="' + esc(capa) + '" alt="" loading="lazy" decoding="async"' +
        ' onerror="this.hidden=true;this.nextElementSibling.hidden=false">'
      : '') + reserva;

    return '' +
      '<button type="button" class="fita" data-id="' + esc(filme.id) + '" title="' + esc(filme.titulo) + '">' +
        '<span class="fita__caixa">' +
          miolo +
          (novo ? '<span class="fita__selo">Novo</span>' : '') +
          medalhaHTML(filme.faixa, 'fita__faixa') +
          (filme.fonte ? '<span class="fita__selo fita__selo--fonte">' + esc(L.ROTULO_FONTE[filme.fonte] || filme.fonte) + '</span>' : '') +
          (pct > 1 ? '<span class="fita__progresso"><i style="width:' + pct + '%"></i></span>' : '') +
        '</span>' +
        '<span class="fita__legenda">' +
          '<span class="fita__titulo">' + esc(filme.titulo) + '</span>' +
          '<span class="fita__ano">' + esc([filme.ano, L.duracaoLegivel(filme.duracao)].filter(Boolean).join(' · ')) + '</span>' +
        '</span>' +
      '</button>';
  }

  function prateleiraHTML(nome, filmes) {
    return '' +
      '<section class="prateleira">' +
        '<div class="prateleira__topo">' +
          '<h2 class="prateleira__nome">' + esc(nome) + '</h2>' +
          '<span class="prateleira__contagem">' + filmes.length + ' ' + (filmes.length === 1 ? 'fita' : 'fitas') + '</span>' +
        '</div>' +
        '<div class="prateleira__trilho">' +
          '<button type="button" class="trilho__seta trilho__seta--esq" data-rola="-1" aria-label="Fitas anteriores" hidden><i>‹</i></button>' +
          '<div class="prateleira__fitas">' + filmes.map(cartaoHTML).join('') + '</div>' +
          '<button type="button" class="trilho__seta trilho__seta--dir" data-rola="1" aria-label="Próximas fitas" hidden><i>›</i></button>' +
        '</div>' +
        '<div class="prateleira__madeira"></div>' +
      '</section>';
  }

  /* -------------------------------------------------------------- avisos */

  /* Os cartazes pendurados entre as estantes. Para trocar os dizeres,
     é só mexer nesta lista — tipo: 'led', 'neon', 'papel' ou 'placa'. */
  var AVISOS = [
    {
      tipo: 'led',
      texto: '★ LANÇAMENTOS TODA TERÇA-FEIRA ★ MULTA POR ATRASO: R$ 2,00 AO DIA ' +
             '★ TRAGA UM AMIGO E GANHE UMA LOCAÇÃO ★ ACEITAMOS ENCOMENDAS ' +
             '★ FECHAMOS ÀS 22H, DOMINGO ATÉ ÀS 18H ★'
    },
    {
      tipo: 'neon',
      sub: 'atenção freguês',
      texto: 'Não esqueça de rebobinar a fita'
    },
    {
      tipo: 'papel',
      texto: 'Promoção de sexta!',
      sub: 'Pague 3 e leve 5 — devolver segunda até as 20h. Não vale para lançamentos.'
    },
    {
      tipo: 'placa',
      texto: 'Proibido fumar na loja'
    },
    {
      tipo: 'papel',
      texto: 'Fita devolvida sem rebobinar',
      sub: 'R$ 1,00 de taxa. É pouco, mas o moço aqui cansou de rebobinar as suas.'
    },
    {
      tipo: 'neon',
      sub: 'todo dia 18',
      texto: 'Dia do cliente: leve 2, pague 1'
    },
    {
      tipo: 'placa',
      texto: 'Não aceitamos cheque'
    }
  ];

  function avisoHTML(a) {
    if (a.tipo === 'led') {
      return '<aside class="aviso-loja aviso-loja--led"><p>' + esc(a.texto) + '</p></aside>';
    }
    if (a.tipo === 'neon') {
      return '<aside class="aviso-loja aviso-loja--neon">' +
        (a.sub ? '<small>' + esc(a.sub) + '</small>' : '') +
        '<b>' + esc(a.texto) + '</b></aside>';
    }
    if (a.tipo === 'papel') {
      return '<aside class="aviso-loja aviso-loja--papel"><b>' + esc(a.texto) + '</b>' +
        (a.sub ? '<span>' + esc(a.sub) + '</span>' : '') + '</aside>';
    }
    return '<aside class="aviso-loja aviso-loja--placa">' + esc(a.texto) + '</aside>';
  }

  /* ------------------------------------------------- cupom de locação */

  function tempoRestante(ms) {
    var horas = Math.ceil(ms / 36e5);
    if (horas <= 1) return 'falta menos de uma hora';
    if (horas <= 48) return 'faltam ' + horas + ' horas';
    return 'faltam ' + Math.ceil(horas / 24) + ' dias';
  }

  /**
   * O papelzinho da locação, pendurado na lateral: itens, promoção,
   * prazo e multas. Fica à mão em qualquer aba, para dar a sensação de
   * escolher as fitas com a conta correndo do lado.
   */
  function desenharCupom() {
    // sempre as fitas alugadas, independente do que a tela esteja mostrando
    var alugadas = prefs.lista.map(porId).filter(Boolean);

    document.body.classList.toggle('com-recibo', !!(alugadas.length && prefs.locacaoEm));

    if (!alugadas.length || !prefs.locacaoEm) {
      el.recibo.hidden = true;
      el.reciboPapel.innerHTML = '';
      return;
    }
    el.recibo.hidden = false;

    var c = L.montarCupom(alugadas, prefs.locacaoEm, prefs.multaRebobinar);
    var saida = new Date(prefs.locacaoEm);
    var atrasado = c.diasAtraso > 0;

    var itens = c.itens.map(function (i, n) {
      return '<div class="cupom__item' + (i.gratis ? ' cupom__item--gratis' : '') + '">' +
        '<b>' + esc((n + 1) + '. ' + i.titulo) + '</b>' +
        '<div class="cupom__linha">' +
          '<span>' + esc(i.faixa ? 'classe ' + i.faixa.toLowerCase() : 'sem classe') + '</span>' +
          '<span>' + (i.gratis ? 'GRÁTIS' : esc(L.dinheiro(i.valor))) + '</span>' +
        '</div></div>';
    }).join('');

    var somas = '<div class="cupom__linha"><span>Subtotal</span><span>' +
      esc(L.dinheiro(c.subtotal)) + '</span></div>';

    if (c.desconto) {
      somas += '<div class="cupom__linha cupom__item--gratis"><span>Pague 3 leve 5</span>' +
        '<span>-' + esc(L.dinheiro(c.desconto)) + '</span></div>';
    }
    if (c.multaRebobinar) {
      somas += '<div class="cupom__linha cupom__multa"><span>Multa rebobinagem</span><span>' +
        esc(L.dinheiro(c.multaRebobinar)) + '</span></div>';
    }
    if (c.multaAtraso) {
      somas += '<div class="cupom__linha cupom__multa"><span>Atraso · ' + c.diasAtraso +
        (c.diasAtraso === 1 ? ' dia' : ' dias') + '</span><span>' +
        esc(L.dinheiro(c.multaAtraso)) + '</span></div>';
    }

    var prazo = atrasado
      ? '<div class="cupom__prazo cupom__prazo--atrasado">' +
          '<b>Em atraso</b>' +
          '<small>venceu ' + esc(c.prazo.diaSemana + ', ' + L.dataCurta(c.prazo.data)) +
          ' · ' + c.diasAtraso + (c.diasAtraso === 1 ? ' dia' : ' dias') + '</small>' +
        '</div>'
      : '<div class="cupom__prazo">' +
          '<b>Devolver ' + esc(c.prazo.diaSemana) + '</b>' +
          '<small>' + esc(L.dataCurta(c.prazo.data)) + ' até as 20h · ' +
          esc(c.prazo.regra) + '</small>' +
        '</div>';

    // a abinha mostra o resumo mesmo com o recibo fechado
    el.reciboResumo.textContent = c.itens.length +
      (c.itens.length === 1 ? ' fita · ' : ' fitas · ') + L.dinheiro(c.total);

    el.reciboPapel.innerHTML =
      '<div class="cupom">' +
        '<div class="cupom__loja">' + esc(catalogo.nomeLocadora) + '</div>' +
        '<div class="cupom__sub">' + esc(catalogo.assinatura) + '</div>' +
        '<hr>' +
        '<div class="cupom__linha"><span>CUPOM DE LOCAÇÃO</span><span>' +
          esc(L.dataCurta(saida)) + '</span></div>' +
        '<div class="cupom__linha"><span>' + esc(c.itens.length +
          (c.itens.length === 1 ? ' fita' : ' fitas')) + '</span><span>' +
          esc(String(saida.getHours()).padStart(2, '0') + ':' +
              String(saida.getMinutes()).padStart(2, '0')) + '</span></div>' +
        '<hr>' + itens + '<hr>' + somas + '<hr>' +
        '<div class="cupom__linha cupom__total"><span>Total</span><span>' +
          esc(L.dinheiro(c.total)) + '</span></div>' +
        prazo +
        (atrasado ? '' : '<div class="cupom__rodape">' + esc(tempoRestante(c.prazo.data - Date.now())) + '</div>') +
        '<hr>' +
        '<div class="cupom__rodape">obrigado e volte sempre<br>rebobine a fita!</div>' +
      '</div>' +
      '<div class="cupom__acoes">' +
        '<button type="button" class="bt bt--principal" id="bt-entregar">Entregar as fitas</button>' +
      '</div>';
  }

  /* ------------------------------------------------------------ desenhar */

  function montarGrupos(lista) {
    var grupos = [];

    // Busca ativa ou aba "filmes alugados": uma prateleira só.
    if (termo.trim()) {
      grupos.push({ nome: 'Resultados para “' + termo.trim() + '”', filmes: lista });
      return grupos;
    }
    if (aba === 'lista') {
      grupos.push({ nome: 'Filmes alugados', filmes: lista });
      return grupos;
    }

    var usados = {};

    // Continuar assistindo
    var continuar = Object.keys(prefs.progresso)
      .map(porId)
      .filter(function (f) { return f && lista.indexOf(f) >= 0; });
    if (continuar.length) grupos.push({ nome: 'Continuar assistindo', filmes: continuar });

    // Novidades (últimos 14 adicionados, se o acervo já for grande o bastante)
    if (lista.length > 6) {
      var novos = lista.slice().sort(function (a, b) {
        return new Date(b.adicionadoEm) - new Date(a.adicionadoEm);
      }).slice(0, 14);
      grupos.push({ nome: 'Chegou na locadora', filmes: novos });
    }

    // As estantes por faixa de preço, do mais caro ao mais barato
    L.FAIXAS.forEach(function (faixa) {
      var daFaixa = lista.filter(function (f) { return f.faixa === faixa; });
      if (daFaixa.length) grupos.push({ nome: 'Classe ' + faixa, filmes: daFaixa });
    });

    // Uma prateleira por categoria do catálogo
    catalogo.categorias.forEach(function (cat) {
      var doGenero = lista.filter(function (f) {
        return f.generos.some(function (g) { return L.normalizar(g) === L.normalizar(cat); });
      });
      if (!doGenero.length) return;
      doGenero.forEach(function (f) { usados[f.id] = true; });
      grupos.push({ nome: cat, filmes: doGenero });
    });

    // Sobras: gêneros digitados à mão que não estão na lista de categorias
    var sobra = lista.filter(function (f) { return !usados[f.id]; });
    if (sobra.length) grupos.push({ nome: 'Sem categoria', filmes: sobra });

    return grupos;
  }

  function desenharVitrine(lista) {
    if (termo.trim() || aba === 'lista' || !lista.length) {
      el.vitrine.hidden = true;
      return;
    }

    var destaques = lista.filter(function (f) { return f.destaque; });
    var alvo = (destaques.length ? destaques : lista);
    // Muda sozinho a cada dia, sem precisar de sorteio salvo.
    var filme = alvo[Math.floor(Date.now() / 864e5) % alvo.length];

    var arte = filme.fundo || L.capaAutomatica(filme);
    el.vitrine.style.backgroundImage = arte ? 'url("' + arte.replace(/"/g, '%22') + '")' : '';
    el.vitTitulo.textContent = filme.titulo;
    el.vitSinopse.textContent = filme.sinopse || 'Sem sinopse cadastrada.';

    el.vitMeta.innerHTML = medalhaHTML(filme.faixa) + [
      filme.ano,
      L.duracaoLegivel(filme.duracao),
      filme.classificacao ? 'Classificação ' + filme.classificacao : '',
      filme.nota != null ? '★ ' + filme.nota : '',
      filme.generos.slice(0, 3).join(' · ')
    ].filter(Boolean).map(function (t) {
      return '<span class="selo">' + esc(t) + '</span>';
    }).join('');

    // Sem link cadastrado o player não abre — a ficha já avisa, o banner
    // também precisa, senão o botão fica clicável e não acontece nada.
    var semLink = L.reproducao(filme).tipo === 'nenhum';
    el.vitAssistir.disabled = semLink;
    el.vitAssistir.textContent = semLink ? 'Sem link cadastrado' : '▶ Assistir';

    el.vitrine.hidden = false;
    el.vitrine.dataset.id = filme.id;
  }

  function desenhar() {
    var lista = visiveis();

    desenharVitrine(lista);
    desenharCupom();
    desenharDevolucao();

    if (!lista.length) {
      el.prateleiras.innerHTML = '';
      el.avisosTopo.innerHTML = '';
      el.vazio.hidden = false;
      // O botão leva ao balcão, que é do dono. Numa busca sem resultado ou na
      // lista vazia quem está na tela é visitante, então ele não aparece.
      el.vazioBt.hidden = false;

      if (termo.trim()) {
        el.vazioTitulo.textContent = 'Nada encontrado';
        el.vazioTexto.textContent = 'Nenhuma fita bate com “' + termo.trim() + '”. Tente outro título ou gênero.';
        el.vazioBt.hidden = true;
      } else if (aba === 'lista') {
        el.vazioTitulo.textContent = 'Nenhuma fita alugada';
        el.vazioTexto.textContent = 'Abra a ficha de um filme e toque em “Alugar” para levar a fita para casa.';
        el.vazioBt.hidden = true;
      } else if (L.abertoDoDisco()) {
        // Dois cliques no index.html: o navegador proíbe ler o catálogo por CORS.
        // Monta o comando já com o caminho real desta pasta.
        var pasta = decodeURIComponent(location.pathname).replace(/\/[^/]*$/, '');
        var comando = 'cd "' + pasta + '" && python3 -m http.server 8080';

        el.vazioTitulo.textContent = 'Precisa abrir por um servidor';
        el.vazioTexto.innerHTML =
          'O navegador bloqueia a leitura do catálogo quando a página é aberta direto do disco ' +
          '(<code>file://</code>). Abra um terminal e rode:' +
          '<br><br><code class="comando">' + esc(comando) + '</code><br><br>' +
          'Só depois que ele estiver rodando é que <strong>localhost:8080</strong> funciona. ' +
          'No GitHub Pages nada disso é necessário.';
        el.vazioBt.textContent = '⧉ Copiar comando';
        el.vazioBt.href = '#';
        el.vazioBt.dataset.copiar = comando;
      } else {
        el.vazioTitulo.textContent = 'Prateleira vazia';
        el.vazioTexto.textContent = 'Ainda não há fitas no acervo. Vá até o balcão e cadastre o primeiro filme.';
        el.vazioBt.textContent = 'Ir para o balcão';
        el.vazioBt.href = 'admin.html';
        delete el.vazioBt.dataset.copiar;
      }
    } else {
      el.vazio.hidden = true;

      // Na busca e nos filmes alugados a tela fica limpa, sem cartazes.
      var comAvisos = !termo.trim() && aba === 'acervo';

      // Os dois primeiros ficam logo abaixo do banner: o letreiro de LED
      // e o neon, que é o que se vê ao entrar na loja.
      el.avisosTopo.innerHTML = comAvisos
        ? AVISOS.slice(0, 2).map(avisoHTML).join('')
        : '';

      var proximo = 2;   // os dois de cima já saíram do rodízio

      el.prateleiras.innerHTML = montarGrupos(lista).map(function (g, i) {
        var bloco = prateleiraHTML(g.nome, g.filmes);
        // os demais cartazes seguem pendurados entre as estantes
        if (comAvisos && i >= 1 && (i - 1) % 3 === 0) {
          bloco += avisoHTML(AVISOS[proximo++ % AVISOS.length]);
        }
        return bloco;
      }).join('');

      el.prateleiras.querySelectorAll('.prateleira__fitas').forEach(atualizarSetas);
    }

    var n = catalogo.filmes.length;
    el.contagem.textContent = n + (n === 1 ? ' fita no acervo' : ' fitas no acervo');
  }

  /* ---------------------------------------------------- setas do trilho */

  function atualizarSetas(trilho) {
    var pai = trilho.parentElement;
    var esq = pai.querySelector('.trilho__seta--esq');
    var dir = pai.querySelector('.trilho__seta--dir');
    var sobra = trilho.scrollWidth - trilho.clientWidth;
    var rolavel = sobra > 12;

    trilho.classList.toggle('rolavel', rolavel);
    esq.hidden = !rolavel || trilho.scrollLeft < 12;
    dir.hidden = !rolavel || trilho.scrollLeft > sobra - 12;
  }

  document.addEventListener('scroll', function (e) {
    if (e.target.classList && e.target.classList.contains('prateleira__fitas')) {
      atualizarSetas(e.target);
    }
  }, true);

  window.addEventListener('resize', function () {
    document.querySelectorAll('.prateleira__fitas').forEach(atualizarSetas);
  });

  /* Arrastar a prateleira com o mouse, como quem empurra as fitas na estante.
     No celular o dedo já rola sozinho, então isto vale só para mouse. */
  (function ligarArrasto() {
    var trilho = null, xInicial = 0, scrollInicial = 0, arrastou = false;

    document.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      var alvo = e.target.closest('.prateleira__fitas.rolavel');
      if (!alvo) return;
      trilho = alvo;
      xInicial = e.clientX;
      scrollInicial = alvo.scrollLeft;
      arrastou = false;
    });

    document.addEventListener('pointermove', function (e) {
      if (!trilho) return;
      var dx = e.clientX - xInicial;
      if (!arrastou) {
        if (Math.abs(dx) < 6) return;      // um clique trêmulo não é arrasto
        arrastou = true;
        trilho.classList.add('arrastando');
      }
      e.preventDefault();
      trilho.scrollLeft = scrollInicial - dx;
    });

    function soltar() {
      if (!trilho) return;
      trilho.classList.remove('arrastando');
      atualizarSetas(trilho);
      trilho = null;
    }
    document.addEventListener('pointerup', soltar);
    document.addEventListener('pointercancel', soltar);

    // Terminar um arrasto em cima de uma fita não deve abrir a ficha dela.
    document.addEventListener('click', function (e) {
      if (!arrastou) return;
      arrastou = false;
      if (e.target.closest('.prateleira__fitas')) {
        e.stopPropagation();
        e.preventDefault();
      }
    }, true);
  })();

  /* ---------------------------------------------------------------ficha */

  function abrirFicha(filme) {
    if (!filme) return;
    filmeAberto = filme;

    var arte = filme.fundo || L.capaAutomatica(filme);
    el.fichaArte.style.backgroundImage = arte ? 'url("' + arte.replace(/"/g, '%22') + '")' : '';
    el.fichaTitulo.textContent = filme.titulo;
    el.fichaSinopse.textContent = filme.sinopse || 'Sem sinopse cadastrada.';

    el.fichaMeta.innerHTML = medalhaHTML(filme.faixa) + [
      { t: filme.ano, c: '' },
      { t: L.duracaoLegivel(filme.duracao), c: '' },
      { t: filme.classificacao ? 'Class. ' + filme.classificacao : '', c: '' },
      { t: filme.nota != null ? '★ ' + filme.nota : '', c: ' selo--nota' },
      { t: L.ROTULO_FONTE[filme.fonte] || '', c: ' selo--fonte' }
    ].concat(filme.generos.map(function (g) { return { t: g, c: '' }; }))
      .filter(function (x) { return x.t; })
      .map(function (x) { return '<span class="selo' + x.c + '">' + esc(x.t) + '</span>'; })
      .join('');

    var rep = L.reproducao(filme);
    if (rep.externo) {
      el.fichaExterno.href = rep.externo;
      el.fichaExterno.hidden = false;
    } else {
      el.fichaExterno.hidden = true;
    }
    el.fichaAssistir.disabled = rep.tipo === 'nenhum';
    el.fichaAssistir.textContent = rep.tipo === 'nenhum' ? 'Sem link cadastrado' : '▶ Assistir';

    marcarBotaoLista(filme);
    el.ficha.showModal();
  }

  function marcarBotaoLista(filme) {
    var dentro = prefs.lista.indexOf(filme.id) >= 0;
    el.fichaLista.textContent = dentro ? '✓ Alugada — devolver' : '+ Alugar fita';
  }

  /* -------------------------------------------------------------- player */

  /* O videocassete só consegue comandar o que expõe controle: o player
     nativo (arquivo direto) e o YouTube, via a API de iframe deles.
     Drive, MEGA e afins tocam, mas com os botões da própria origem. */
  var controle = null;      // { play, pause, ir, tempo, duracao, tocando }
  var ytPlayer = null;
  var vcrTimer = null;
  var rebobinando = false;

  function relogio(seg) {
    seg = Math.max(0, Math.floor(seg || 0));
    return Math.floor(seg / 3600) + ':' +
      String(Math.floor(seg % 3600 / 60)).padStart(2, '0') + ':' +
      String(seg % 60).padStart(2, '0');
  }

  function controleDeVideo(v) {
    return {
      tipo: 'video',
      play: function () { v.play(); },
      pause: function () { v.pause(); },
      ir: function (t) { v.currentTime = Math.max(0, Math.min(t, v.duration || t)); },
      tempo: function () { return v.currentTime || 0; },
      duracao: function () { return v.duration || 0; },
      tocando: function () { return !v.paused; }
    };
  }

  function controleDeYoutube(p) {
    return {
      tipo: 'youtube',
      play: function () { p.playVideo(); },
      pause: function () { p.pauseVideo(); },
      // durante a rebobinagem pedimos seek "sem buscar adiante": evita que
      // cada passo dispare um carregamento novo e engasgue o vídeo
      ir: function (t, definitivo) { p.seekTo(Math.max(0, t), definitivo !== false); },
      tempo: function () { return p.getCurrentTime() || 0; },
      duracao: function () { return p.getDuration() || 0; },
      tocando: function () { return p.getPlayerState() === 1; }
    };
  }

  /** Carrega a API de iframe do YouTube uma única vez, sob demanda. */
  var ytCarregando = null;
  function carregarYT() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (ytCarregando) return ytCarregando;

    ytCarregando = new Promise(function (ok, falha) {
      var antes = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        if (typeof antes === 'function') antes();
        ok();
      };
      var s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = function () { falha(new Error('API do YouTube indisponível')); };
      document.head.appendChild(s);
      setTimeout(function () { falha(new Error('tempo esgotado')); }, 8000);
    });
    return ytCarregando;
  }

  function soltarControle() {
    clearInterval(vcrTimer);
    vcrTimer = null;
    rebobinando = false;
    el.playerTela.classList.remove('rebobinando');
    if (ytPlayer && ytPlayer.destroy) {
      try { ytPlayer.destroy(); } catch (e) { /* já foi */ }
    }
    ytPlayer = null;
    controle = null;
  }

  function ligarVCR() {
    el.vcr.querySelectorAll('[data-vcr]').forEach(function (b) { b.disabled = false; });
    el.vcrNota.hidden = true;
    clearInterval(vcrTimer);
    vcrTimer = setInterval(atualizarVisor, 500);
    atualizarVisor();
  }

  function desligarVCR(motivo) {
    el.vcr.querySelectorAll('[data-vcr]').forEach(function (b) { b.disabled = true; });
    el.vcrNota.textContent = motivo ||
      'Esta origem não deixa comandar de fora — use os botões do próprio player.';
    el.vcrNota.hidden = false;
    el.vcrEstado.textContent = 'SEM SINAL';
    el.vcrContador.textContent = '0:00:00';
  }

  function atualizarVisor() {
    if (!controle) return;
    el.vcrContador.textContent = relogio(controle.tempo());
    el.vcrEstado.textContent = rebobinando ? 'REW ◀◀'
      : (controle.tocando() ? 'PLAY ▶' : 'PAUSE ❚❚');
  }

  /** Puxa a fita de volta até o começo, com chuvisco na tela. */
  function rebobinar() {
    if (!controle || rebobinando) return;

    if (controle.tempo() < 1.5) { concluirRebobinagem(); return; }

    rebobinando = true;
    controle.pause();
    el.playerTela.classList.add('rebobinando');

    // O YouTube não aguenta um seek a cada 70ms sem travar, então lá o passo
    // é mais espaçado. Nos dois casos a fita chega ao início em ~6 segundos.
    var intervalo = controle.tipo === 'youtube' ? 150 : 70;
    var passo = Math.max(3, (controle.duracao() || 600) / (6000 / intervalo));
    var puxa = setInterval(function () {
      if (!controle) { clearInterval(puxa); return; }
      var t = controle.tempo();
      if (t <= passo) {
        clearInterval(puxa);
        controle.ir(0, true);
        concluirRebobinagem();
        return;
      }
      controle.ir(t - passo, false);
      atualizarVisor();
    }, intervalo);
  }

  function concluirRebobinagem() {
    rebobinando = false;
    el.playerTela.classList.remove('rebobinando');
    var id = el.player.dataset.id;
    if (id) {
      L.marcarRebobinada(id);
      prefs = L.lerPrefs();
    }
    el.vcrEstado.textContent = 'STOP';
    el.vcrContador.textContent = '0:00:00';
  }

  /** Cobra as fitas que o freguês deixou sem rebobinar. */
  function cobrarPendencias(idAtual) {
    var multadas = L.cobrarNaoRebobinadas(idAtual);
    prefs = L.lerPrefs();
    if (!multadas.length) return;

    var nomes = multadas.map(function (id) {
      var f = porId(id);
      return f ? f.titulo : 'uma fita';
    });
    var uma = nomes.length === 1;

    el.multaTexto.textContent =
      (uma ? 'A fita “' : 'As fitas “') + nomes.join('”, “') +
      (uma ? '” voltou sem rebobinar.' : '” voltaram sem rebobinar.') +
      ' São ' + L.dinheiro(multadas.length * L.MULTA_REBOBINAR) +
      ' lançados na sua conta. Da próxima vez, aperte REBOBINAR antes de sair.';

    el.multa.hidden = false;
  }

  async function abrirPlayer(filme) {
    if (!filme) return;
    var rep = L.reproducao(filme);
    if (rep.tipo === 'nenhum') return;

    soltarControle();
    el.player.dataset.id = filme.id;
    el.playerNome.textContent = filme.titulo;
    el.playerExterno.href = rep.externo || '#';
    el.playerExterno.hidden = !rep.externo;
    el.playerTela.innerHTML = '';
    desligarVCR('carregando…');
    el.player.showModal();

    L.registrarVisto(filme.id);
    cobrarPendencias(filme.id);

    // YouTube e Drive recusam embed quando a origem é null (file://).
    if (rep.tipo === 'iframe' && L.abertoDoDisco()) {
      mostrarAviso(
        'O vídeo não toca com a página aberta do disco',
        'YouTube e Google Drive bloqueiam a reprodução quando o endereço começa com ' +
        'file:// — é o “Erro 153”. Rode o servidor local (./abrir.sh) e use ' +
        'localhost, ou publique no GitHub Pages. Aí funciona normalmente.',
        rep.externo
      );
      desligarVCR('sem vídeo para comandar.');
      return;
    }

    var vid = filme.fonte === 'youtube' ? L.idYoutube(filme.url) : '';

    if (vid) {
      // com a API do YouTube os botões do videocassete funcionam de verdade
      var caixa = document.createElement('div');
      el.playerTela.appendChild(caixa);
      try {
        await carregarYT();
        ytPlayer = new YT.Player(caixa, {
          videoId: vid,
          playerVars: { autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1 },
          events: {
            onReady: function () {
              controle = controleDeYoutube(ytPlayer);
              L.marcarUsada(filme.id);
              prefs = L.lerPrefs();
              ligarVCR();
            }
          }
        });
      } catch (e) {
        // sem a API, ainda dá para assistir: cai no iframe simples
        el.playerTela.innerHTML = '';
        embutir(rep.src);
        desligarVCR('não consegui carregar a API do YouTube — os botões abaixo ficam fora do ar.');
      }

    } else if (rep.tipo === 'iframe') {
      embutir(rep.src);
      desligarVCR();

    } else if (rep.tipo === 'video') {
      var v = document.createElement('video');
      v.src = rep.src;
      v.controls = true;
      v.autoplay = true;
      v.playsInline = true;
      v.preload = 'metadata';

      var salvo = prefs.progresso[filme.id];
      if (salvo) {
        v.addEventListener('loadedmetadata', function () {
          if (salvo.s < v.duration - 15) v.currentTime = salvo.s;
        }, { once: true });
      }
      var ultimo = 0;
      v.addEventListener('timeupdate', function () {
        if (rebobinando || v.currentTime - ultimo < 5) return;
        ultimo = v.currentTime;
        L.salvarProgresso(filme.id, v.currentTime, v.duration);
        prefs = L.lerPrefs();
      });
      v.addEventListener('error', function () {
        mostrarAviso('Não consegui carregar o vídeo',
          'O link pode ter expirado, ser privado ou não permitir uso fora do site de origem.',
          rep.externo);
        desligarVCR('sem vídeo para comandar.');
      });

      el.playerTela.appendChild(v);
      controle = controleDeVideo(v);
      L.marcarUsada(filme.id);
      prefs = L.lerPrefs();
      ligarVCR();

    } else {
      var texto = rep.motivo === 'terabox'
        ? 'O TeraBox não permite que o vídeo toque embutido em outro site. Abra numa aba nova para assistir por lá.'
        : 'Este link não pode ser embutido. Abra numa aba nova para assistir na origem.';
      mostrarAviso('Precisa abrir fora', texto, rep.externo);
      desligarVCR('sem vídeo para comandar.');
    }
  }

  function embutir(src) {
    var frame = document.createElement('iframe');
    frame.src = src;
    frame.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    el.playerTela.appendChild(frame);
  }

  function mostrarAviso(titulo, texto, href) {
    el.playerTela.innerHTML =
      '<div class="player__aviso">' +
        '<p><strong>' + esc(titulo) + '</strong>' + esc(texto) + '</p>' +
        (href ? '<a class="bt bt--principal" href="' + esc(href) + '" target="_blank" rel="noopener">Abrir em nova aba ↗</a>' : '') +
      '</div>';
  }

  function fecharPlayer() {
    var v = el.playerTela.querySelector('video');
    if (v) {
      L.salvarProgresso(el.player.dataset.id || '', v.currentTime, v.duration);
      v.pause();
    }
    soltarControle();
    el.playerTela.innerHTML = '';   // derruba o iframe para parar o som
    prefs = L.lerPrefs();
    desenhar();
  }

  el.vcr.addEventListener('click', function (e) {
    var bt = e.target.closest('[data-vcr]');
    if (!bt || !controle) return;
    var acao = bt.dataset.vcr;
    if (rebobinando && acao !== 'rebobinar') return;

    bt.classList.add('apertado');
    setTimeout(function () { bt.classList.remove('apertado'); }, 130);

    if (acao === 'play') controle.play();
    else if (acao === 'pause') controle.pause();
    else if (acao === 'voltar') controle.ir(controle.tempo() - 10);
    else if (acao === 'avancar') controle.ir(controle.tempo() + 30);
    else if (acao === 'rebobinar') rebobinar();

    atualizarVisor();
  });

  document.getElementById('multa-ok').addEventListener('click', function () {
    el.multa.hidden = true;
  });

  /* ------------------------------------------- balcão de devolução */

  /* O aparelho da bancada: uma fita de cada vez em cima dele, até não
     sobrar nenhuma por rebobinar. */
  var maq = { id: null, pos: 0, total: 0, estado: 'stop', timer: null };

  var VELOCIDADE = { play: 2, avancar: 40, voltar: -40 };
  var ROTULO_MAQ = {
    stop: 'STOP ■', play: 'PLAY ▶', pause: 'PAUSE ❚❚',
    avancar: 'FF ▶▶', voltar: 'REW ◀', rebobinar: 'REW ◀◀'
  };

  /** Duração fictícia da fita: 90 a 120 min, sempre a mesma para o mesmo filme. */
  function duracaoFita(id) {
    var h = 0;
    for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return (90 + (h % 31)) * 60;
  }

  /** As fitas alugadas que foram assistidas e não voltaram ao início. */
  function pendentes() {
    return prefs.lista.map(porId).filter(function (f) {
      return f && prefs.fitas[f.id] && prefs.fitas[f.id].rebobinada === false;
    });
  }

  function pararMaquina() {
    clearInterval(maq.timer);
    maq.timer = null;
    maq.estado = 'stop';
  }

  function carregarFita(filme) {
    pararMaquina();
    maq.id = filme ? filme.id : null;
    maq.total = filme ? duracaoFita(filme.id) : 0;
    maq.pos = maq.total;                 // a fita ficou parada no fim
    el.vhsNome.textContent = filme ? filme.titulo : '—';
    el.vhs.classList.remove('vhs--rebobinando', 'vhs--pronta');
    el.vhsSelo.textContent = 'não rebobinada';
    atualizarVisorMaq();
  }

  function atualizarVisorMaq() {
    el.visorTempo.textContent = relogio(maq.pos);
    el.visorEstado.textContent = ROTULO_MAQ[maq.estado] || 'STOP ■';
  }

  function acionarMaquina(acao) {
    if (!maq.id) return;
    maq.estado = acao;
    clearInterval(maq.timer);

    el.vhs.classList.toggle('vhs--rebobinando', acao === 'rebobinar');

    if (acao === 'stop' || acao === 'pause') { atualizarVisorMaq(); return; }

    var passo = maq.total / 40;          // ~4 segundos até zerar

    maq.timer = setInterval(function () {
      if (maq.estado === 'rebobinar') {
        maq.pos = Math.max(0, maq.pos - passo);
        if (maq.pos <= 0) { fitaRebobinada(); return; }
      } else {
        maq.pos = Math.min(maq.total, Math.max(0, maq.pos + VELOCIDADE[maq.estado]));
        if (maq.pos >= maq.total || maq.pos <= 0) { acionarMaquina('stop'); return; }
      }
      atualizarVisorMaq();
    }, 100);

    atualizarVisorMaq();
  }

  function fitaRebobinada() {
    pararMaquina();
    maq.pos = 0;
    atualizarVisorMaq();
    el.vhs.classList.remove('vhs--rebobinando');
    el.vhs.classList.add('vhs--pronta');
    el.vhsSelo.textContent = 'rebobinada ✓';

    L.marcarRebobinada(maq.id);
    prefs = L.lerPrefs();

    // um instante para o freguês ver o selo verde, e vem a próxima
    setTimeout(function () {
      desenharDevolucao();
      desenharCupom();
    }, 1200);
  }

  /** Monta a bancada e o caixa da aba "filmes alugados". */
  function desenharDevolucao() {
    var alugadas = prefs.lista.map(porId).filter(Boolean);
    var mostrar = aba === 'lista' && alugadas.length > 0 && !!prefs.locacaoEm;

    el.devolucao.hidden = !mostrar;
    if (!mostrar) { pararMaquina(); return; }

    var fila = pendentes();
    el.estacao.hidden = fila.length === 0;

    if (fila.length) {
      el.estacaoTexto.textContent = fila.length === 1
        ? 'Falta 1 fita para rebobinar. Aperte REBOBINAR e espere o contador zerar.'
        : 'Faltam ' + fila.length + ' fitas para rebobinar — uma de cada vez, como manda o figurino.';
      if (maq.id !== fila[0].id) carregarFita(fila[0]);
    } else if (maq.id) {
      carregarFita(null);
    }

    // a conta do caixa já projeta a multa das fitas que ficarem sem rebobinar
    var aMultar = fila.filter(function (f) {
      return !(prefs.fitas[f.id] || {}).multada;
    }).length;
    var c = L.montarCupom(alugadas, prefs.locacaoEm,
      prefs.multaRebobinar + aMultar * L.MULTA_REBOBINAR);

    var conta = '<b>' + alugadas.length + (alugadas.length === 1 ? ' fita' : ' fitas') +
      '</b> na sua conta · total <b>' + esc(L.dinheiro(c.total)) + '</b>';
    if (c.multaAtraso) {
      conta += '<br><span class="devendo">inclui ' + esc(L.dinheiro(c.multaAtraso)) +
        ' de atraso (' + c.diasAtraso + (c.diasAtraso === 1 ? ' dia' : ' dias') + ')</span>';
    }
    if (c.multaRebobinar) {
      conta += '<br><span class="devendo">inclui ' + esc(L.dinheiro(c.multaRebobinar)) +
        ' de multa por rebobinagem</span>';
    }
    el.caixaConta.innerHTML = conta;
    el.btValor.textContent = L.dinheiro(c.total);

    el.caixaNota.textContent = fila.length
      ? 'Dá para entregar assim mesmo — mas aí entram ' +
        L.dinheiro(Math.max(aMultar, 1) * L.MULTA_REBOBINAR) + ' de multa por rebobinagem.'
      : 'Tudo rebobinado. Pode entregar de consciência limpa.';
  }

  el.estacao.addEventListener('click', function (e) {
    var bt = e.target.closest('[data-maq]');
    if (!bt || !maq.id) return;
    bt.classList.add('aceso');
    setTimeout(function () { bt.classList.remove('aceso'); }, 150);
    acionarMaquina(bt.dataset.maq);
  });

  el.btPagar.addEventListener('click', function () {
    var alugadas = prefs.lista.map(porId).filter(Boolean);
    if (!alugadas.length || !prefs.locacaoEm) return;

    var fila = pendentes();
    var aMultar = fila.filter(function (f) {
      return !(prefs.fitas[f.id] || {}).multada;
    }).length;
    var c = L.montarCupom(alugadas, prefs.locacaoEm,
      prefs.multaRebobinar + aMultar * L.MULTA_REBOBINAR);

    var recado = 'Entregar ' + alugadas.length +
      (alugadas.length === 1 ? ' fita' : ' fitas') + ' e pagar ' + L.dinheiro(c.total) + '?';
    if (c.multaAtraso) recado += '\n\nInclui ' + L.dinheiro(c.multaAtraso) + ' de atraso.';
    if (aMultar) {
      recado += '\n\n' + aMultar + (aMultar === 1 ? ' fita não rebobinada' : ' fitas não rebobinadas') +
        ': + ' + L.dinheiro(aMultar * L.MULTA_REBOBINAR);
    }
    if (!confirm(recado)) return;

    pararMaquina();
    maq.id = null;
    L.devolverTudo();
    prefs = L.lerPrefs();
    el.cobranca.hidden = true;
    abrirRecibo(false);
    desenhar();
    alert('Fitas entregues e conta quitada. Obrigado e volte sempre!');
  });

  /* ------------------------------- a cobrança ao entrar no site */

  var CHAVE_COBRADO = 'locadora:cobrado';

  function mostrarCobranca() {
    if (sessionStorage.getItem(CHAVE_COBRADO) === '1') return;
    if (!prefs.locacaoEm) return;

    var alugadas = prefs.lista.map(porId).filter(Boolean);
    if (!alugadas.length) return;

    var c = L.montarCupom(alugadas, prefs.locacaoEm, prefs.multaRebobinar);
    var fila = pendentes();
    var quantas = alugadas.length + (alugadas.length === 1 ? ' fita' : ' fitas');
    var texto;

    if (c.diasAtraso) {
      el.cobrancaTitulo.textContent = 'A locadora está cobrando!';
      texto = 'Você está com ' + quantas + ' em casa e o prazo venceu há ' +
        c.diasAtraso + (c.diasAtraso === 1 ? ' dia' : ' dias') + '. Já são ' +
        L.dinheiro(c.total) + ', subindo ' +
        L.dinheiro(L.MULTA_ATRASO_DIA * alugadas.length) + ' por dia.';
    } else {
      el.cobrancaTitulo.textContent = 'Você está com fitas em casa';
      texto = quantas.charAt(0).toUpperCase() + quantas.slice(1) +
        ' para devolver ' + c.prazo.diaSemana + ', ' + L.dataCurta(c.prazo.data) +
        ' até as 20h. Conta em ' + L.dinheiro(c.total) + '.';
    }
    if (fila.length) {
      texto += ' E tem ' + fila.length +
        (fila.length === 1 ? ' fita por rebobinar.' : ' fitas por rebobinar.');
    }

    el.cobrancaTexto.textContent = texto;
    el.cobranca.hidden = false;
  }

  function calarCobranca() {
    el.cobranca.hidden = true;
    try { sessionStorage.setItem(CHAVE_COBRADO, '1'); } catch (e) { /* ignora */ }
  }

  document.getElementById('cobranca-depois').addEventListener('click', calarCobranca);
  document.getElementById('cobranca-ir').addEventListener('click', function () {
    calarCobranca();
    irParaAba('lista');
  });

  /* -------------------------------------------------------------- eventos */

  function irParaAba(nome) {
    aba = nome;
    document.querySelectorAll('[data-aba]').forEach(function (b) {
      b.classList.toggle('ativo', b.dataset.aba === nome);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    desenhar();
  }

  /** Copia texto; em file:// a API moderna pode não existir, daí o plano B. */
  function copiarTexto(texto) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(texto);
    }
    return new Promise(function (ok, falha) {
      var campo = document.createElement('textarea');
      campo.value = texto;
      campo.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(campo);
      campo.select();
      var deu = document.execCommand('copy');
      document.body.removeChild(campo);
      deu ? ok() : falha(new Error('sem permissão'));
    });
  }

  document.addEventListener('click', function (e) {
    var copiar = e.target.closest('[data-copiar]');
    if (copiar) {
      e.preventDefault();
      copiarTexto(copiar.dataset.copiar).then(function () {
        copiar.textContent = '✓ Copiado — cole no terminal';
      }, function () {
        copiar.textContent = 'Copie o comando acima à mão';
      });
      return;
    }

    var fita = e.target.closest('.fita');
    if (fita) { abrirFicha(porId(fita.dataset.id)); return; }

    var seta = e.target.closest('[data-rola]');
    if (seta) {
      var trilho = seta.parentElement.querySelector('.prateleira__fitas');
      trilho.scrollBy({ left: seta.dataset.rola * trilho.clientWidth * 0.85, behavior: 'smooth' });
      return;
    }

    var fechar = e.target.closest('[data-fechar]');
    if (fechar) { document.getElementById(fechar.dataset.fechar).close(); return; }

    var abaBt = e.target.closest('[data-aba]');
    if (abaBt) irParaAba(abaBt.dataset.aba);
  });

  // clique no fundo escuro fecha o diálogo
  [el.ficha, el.player].forEach(function (d) {
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
  });

  el.player.addEventListener('close', fecharPlayer);

  el.busca.addEventListener('input', function () {
    termo = el.busca.value;
    desenhar();
  });

  function abrirRecibo(abrir) {
    el.recibo.classList.toggle('aberto', abrir);
    el.reciboAba.setAttribute('aria-expanded', abrir ? 'true' : 'false');
  }

  el.reciboAba.addEventListener('click', function () {
    abrirRecibo(!el.recibo.classList.contains('aberto'));
  });

  // devolver as fitas fecha a locação e limpa as multas
  el.reciboPapel.addEventListener('click', function (e) {
    if (!e.target.closest('#bt-entregar')) return;

    var alugadas = prefs.lista.map(porId).filter(Boolean);
    var c = L.montarCupom(alugadas, prefs.locacaoEm, prefs.multaRebobinar);
    var recado = 'Entregar ' + c.itens.length +
      (c.itens.length === 1 ? ' fita' : ' fitas') + ' e quitar ' +
      L.dinheiro(c.total) + '?';
    if (c.diasAtraso) recado += '\n\nInclui ' + L.dinheiro(c.multaAtraso) + ' de atraso.';
    if (!confirm(recado)) return;

    L.devolverTudo();
    prefs = L.lerPrefs();
    abrirRecibo(false);
    desenhar();
  });

  el.fichaAssistir.addEventListener('click', function () {
    el.ficha.close();
    el.player.dataset.id = filmeAberto.id;
    abrirPlayer(filmeAberto);
  });

  el.fichaLista.addEventListener('click', function () {
    var entrou = L.alternarLista(filmeAberto.id);
    prefs = L.lerPrefs();
    marcarBotaoLista(filmeAberto);
    desenhar();
    // ao pegar mais uma fita, o recibo abre para mostrar a conta subindo
    if (entrou) abrirRecibo(true);
  });

  el.vitAssistir.addEventListener('click', function () {
    var f = porId(el.vitrine.dataset.id);
    el.player.dataset.id = f.id;
    abrirPlayer(f);
  });

  el.vitFicha.addEventListener('click', function () {
    abrirFicha(porId(el.vitrine.dataset.id));
  });

  document.getElementById('bt-crt').addEventListener('click', function () {
    prefs.crt = !prefs.crt;
    L.salvarPrefs(prefs);
    document.body.classList.toggle('sem-crt', !prefs.crt);
  });

  // atalhos: "/" foca a busca, Esc limpa
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== el.busca) {
      e.preventDefault();
      el.busca.focus();
    }
    if (e.key === 'Escape' && document.activeElement === el.busca && termo) {
      el.busca.value = '';
      termo = '';
      desenhar();
    }
  });

  /* --------------------------------------------------------------- início */

  (async function iniciar() {
    document.body.classList.toggle('sem-crt', prefs.crt === false);

    var r = await L.carregar();
    catalogo = r.catalogo;

    if (catalogo.nomeLocadora) el.marcaNome.textContent = catalogo.nomeLocadora;
    if (catalogo.assinatura) el.marcaSub.textContent = catalogo.assinatura;
    document.title = catalogo.nomeLocadora + ' — ' + catalogo.assinatura;

    // limpa progresso de filmes que já saíram do acervo
    var mudou = false;
    Object.keys(prefs.progresso).forEach(function (id) {
      if (!porId(id)) { delete prefs.progresso[id]; mudou = true; }
    });
    if (mudou) L.salvarPrefs(prefs);

    desenhar();
    mostrarCobranca();
  })();
})();
