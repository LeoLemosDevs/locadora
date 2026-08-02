/*
 * admin.js — o balcão.
 * Cadastra, edita e remove fitas; ajusta a locadora; publica no GitHub.
 */
(function () {
  'use strict';

  var L = window.LOCADORA;
  var esc = L.escapar;

  var CHAVE_SENHA = 'locadora:senha';
  var CHAVE_SESSAO = 'locadora:aberto';

  var catalogo = L.catalogoVazio();
  var editandoId = null;
  var filtroAcervo = '';

  var $ = function (id) { return document.getElementById(id); };

  /* ============================================================== tranca */

  /** SHA-256 quando disponível; senão, um hash simples (file:// não tem crypto.subtle). */
  async function hash(texto) {
    var sal = 'locadora::' + texto;
    if (window.crypto && crypto.subtle) {
      try {
        var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sal));
        return Array.from(new Uint8Array(buf))
          .map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      } catch (e) { /* cai no plano B */ }
    }
    var h = 5381;
    for (var i = 0; i < sal.length; i++) h = ((h << 5) + h + sal.charCodeAt(i)) | 0;
    return 'simples:' + (h >>> 0).toString(16);
  }

  async function destrancar(senha) {
    var guardada = localStorage.getItem(CHAVE_SENHA);
    var h = await hash(senha);
    if (!guardada) {                       // primeira vez: define a senha
      localStorage.setItem(CHAVE_SENHA, h);
    } else if (guardada !== h) {
      return false;
    }
    sessionStorage.setItem(CHAVE_SESSAO, '1');
    return true;
  }

  function mostrarBalcao() {
    $('tranca').hidden = true;
    $('area').hidden = false;
    iniciar();
  }

  function iniciarTranca() {
    if (sessionStorage.getItem(CHAVE_SESSAO) === '1') { mostrarBalcao(); return; }

    $('tranca').hidden = false;
    if (!localStorage.getItem(CHAVE_SENHA)) {
      $('tranca-texto').textContent = 'Primeira visita: escolha a senha que vai abrir o balcão neste navegador.';
      $('tranca-senha').setAttribute('autocomplete', 'new-password');
    }

    $('tranca-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var ok = await destrancar($('tranca-senha').value);
      if (ok) mostrarBalcao();
      else {
        $('tranca-erro').hidden = false;
        $('tranca-senha').value = '';
        $('tranca-senha').focus();
      }
    });
  }

  /* ============================================================= recados */

  var tempoRecado;
  function recado(texto, tipo) {
    var ok = $('msg-ok'), erro = $('msg-erro');
    ok.hidden = true; erro.hidden = true;
    var alvo = tipo === 'erro' ? erro : ok;
    alvo.innerHTML = texto;
    alvo.hidden = false;
    clearTimeout(tempoRecado);
    if (tipo !== 'erro') tempoRecado = setTimeout(function () { alvo.hidden = true; }, 6000);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ============================================================ persistir */

  function guardar() {
    L.salvarRascunho(catalogo);
    atualizarEstado();
  }

  function atualizarEstado() {
    var n = catalogo.filmes.length;
    var quando = new Date(catalogo.atualizadoEm);
    $('estado-linha').textContent =
      n + (n === 1 ? ' fita' : ' fitas') + ' · última alteração ' +
      quando.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  /* ========================================================== formulário */

  function desenharGeneros(marcados) {
    marcados = (marcados || []).map(L.normalizar);
    var extras = marcados.filter(function (g) {
      return !catalogo.categorias.some(function (c) { return L.normalizar(c) === g; });
    });

    $('f-generos').innerHTML = catalogo.categorias.concat(extras).map(function (cat) {
      var on = marcados.indexOf(L.normalizar(cat)) >= 0;
      return '<label><input type="checkbox" value="' + esc(cat) + '"' + (on ? ' checked' : '') + '>' + esc(cat) + '</label>';
    }).join('');
  }

  function generosMarcados() {
    return Array.prototype.map.call(
      $('f-generos').querySelectorAll('input:checked'),
      function (i) { return i.value; }
    );
  }

  function atualizarPrevia() {
    var url = $('f-capa').value.trim() || L.capaAutomatica({ url: $('f-url').value, capa: '' });
    var box = $('f-previa');
    if (url) {
      box.style.backgroundImage = 'url("' + url.replace(/"/g, '%22') + '")';
      box.textContent = '';
    } else {
      box.style.backgroundImage = '';
      box.textContent = 'sem capa';
    }
  }

  /** Conta ao dono o que a vitrine vai fazer com o link que ele colou. */
  function atualizarDicaFonte() {
    var url = $('f-url').value.trim();
    var dica = $('f-url-dica');

    if (!url) { dica.textContent = 'A origem é identificada sozinha.'; return; }

    var forcado = $('f-fonte').value;
    var fonte = forcado || L.detectarFonte(url);
    var rep = L.reproducao({ url: url, fonte: forcado });

    var comoToca = {
      iframe: 'toca embutido na vitrine.',
      video: 'toca no player nativo, marcando onde você parou.',
      externo: 'não aceita ser embutido; a vitrine vai abrir em nova aba.'
    }[rep.tipo] || '';

    var ressalva = {
      drive: ' O arquivo precisa estar como "qualquer pessoa com o link".',
      terabox: ' A trava é do próprio TeraBox, não tem como contornar.',
      mega: ' O link tem que incluir a chave (o trecho depois do #).',
      link: ' Nenhum site conhecido nesta URL.'
    }[fonte] || '';

    dica.textContent = (L.ROTULO_FONTE[fonte] || 'Link externo') + ' — ' + comoToca + ressalva;
  }

  function limparForm() {
    editandoId = null;
    $('form-filme').reset();
    $('form-titulo').textContent = 'Cadastrar fita';
    $('bt-salvar').textContent = 'Salvar fita';
    $('bt-cancelar').hidden = true;
    desenharGeneros([]);
    atualizarPrevia();
    atualizarDicaFonte();
    document.querySelectorAll('.item--editando').forEach(function (i) {
      i.classList.remove('item--editando');
    });
  }

  function editar(id) {
    var f = catalogo.filmes.find(function (x) { return x.id === id; });
    if (!f) return;
    editandoId = id;

    $('f-url').value = f.url || '';
    $('f-fonte').value = f.fonte || '';
    $('f-titulo').value = f.titulo || '';
    $('f-original').value = f.tituloOriginal || '';
    $('f-ano').value = f.ano || '';
    $('f-duracao').value = f.duracao || '';
    $('f-classificacao').value = f.classificacao || '';
    $('f-nota').value = f.nota != null ? f.nota : '';
    $('f-faixa').value = f.faixa || '';
    $('f-sinopse').value = f.sinopse || '';
    $('f-capa').value = f.capa || '';
    $('f-fundo').value = f.fundo || '';
    $('f-destaque').checked = !!f.destaque;
    desenharGeneros(f.generos);

    $('form-titulo').textContent = 'Editando: ' + f.titulo;
    $('bt-salvar').textContent = 'Salvar alterações';
    $('bt-cancelar').hidden = false;
    atualizarPrevia();
    atualizarDicaFonte();

    $('form-filme').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('f-titulo').focus();
    desenharAcervo();
  }

  function salvarFilme(e) {
    e.preventDefault();

    var titulo = $('f-titulo').value.trim();
    if (!titulo) { recado('O título é obrigatório.', 'erro'); return; }

    var url = $('f-url').value.trim();
    var dados = {
      titulo: titulo,
      tituloOriginal: $('f-original').value.trim(),
      ano: $('f-ano').value ? parseInt($('f-ano').value, 10) : null,
      duracao: $('f-duracao').value ? parseInt($('f-duracao').value, 10) : null,
      classificacao: $('f-classificacao').value.trim(),
      nota: $('f-nota').value !== '' ? Number($('f-nota').value) : null,
      faixa: L.faixaValida($('f-faixa').value),
      sinopse: $('f-sinopse').value.trim(),
      capa: $('f-capa').value.trim(),
      fundo: $('f-fundo').value.trim(),
      generos: generosMarcados(),
      destaque: $('f-destaque').checked,
      url: url,
      fonte: $('f-fonte').value || L.detectarFonte(url)
    };

    if (editandoId) {
      var i = catalogo.filmes.findIndex(function (x) { return x.id === editandoId; });
      catalogo.filmes[i] = Object.assign(catalogo.filmes[i], dados);
      recado('“' + esc(titulo) + '” atualizado. Não esqueça de <strong>publicar</strong> para valer nos outros aparelhos.');
    } else {
      dados.id = L.id();
      dados.adicionadoEm = L.agora();
      catalogo.filmes.unshift(dados);
      recado('“' + esc(titulo) + '” entrou no acervo. Não esqueça de <strong>publicar</strong> para valer nos outros aparelhos.');
    }

    guardar();
    limparForm();
    desenharAcervo();
  }

  function excluir(id) {
    var f = catalogo.filmes.find(function (x) { return x.id === id; });
    if (!f) return;
    if (!confirm('Tirar “' + f.titulo + '” da prateleira?\n\nIsso não apaga o vídeo na origem, só o cadastro aqui.')) return;

    catalogo.filmes = catalogo.filmes.filter(function (x) { return x.id !== id; });
    if (editandoId === id) limparForm();
    guardar();
    desenharAcervo();
    recado('“' + esc(f.titulo) + '” foi removido do acervo.');
  }

  /* ============================================================== acervo */

  function desenharAcervo() {
    var alvo = L.normalizar(filtroAcervo);
    var lista = catalogo.filmes.filter(function (f) {
      if (!alvo) return true;
      return L.normalizar(f.titulo + ' ' + f.tituloOriginal + ' ' + f.generos.join(' ') + ' ' + f.ano)
        .indexOf(alvo) >= 0;
    });

    $('acervo-contagem').textContent = lista.length === catalogo.filmes.length
      ? catalogo.filmes.length + (catalogo.filmes.length === 1 ? ' fita cadastrada' : ' fitas cadastradas')
      : lista.length + ' de ' + catalogo.filmes.length + ' fitas';

    if (!lista.length) {
      $('acervo-lista').innerHTML =
        '<p style="color:var(--cinza-fraco);padding:14px 2px">' +
        (catalogo.filmes.length ? 'Nenhuma fita bate com o filtro.' : 'Nenhuma fita cadastrada ainda. Use o formulário acima.') +
        '</p>';
      return;
    }

    $('acervo-lista').innerHTML = lista.map(function (f) {
      var capa = L.capaAutomatica(f);
      var sub = [
        f.ano,
        L.duracaoLegivel(f.duracao),
        f.faixa ? 'Classe ' + f.faixa : '',
        L.ROTULO_FONTE[f.fonte] || '',
        f.generos.join(', ')
      ].filter(Boolean).join('  ·  ');

      return '' +
        '<div class="item' + (editandoId === f.id ? ' item--editando' : '') + '">' +
          (capa
            ? '<img class="item__capa" src="' + esc(capa) + '" alt="" loading="lazy">'
            : '<div class="item__capa"></div>') +
          '<div class="item__info">' +
            '<div class="item__titulo">' + esc(f.titulo) + (f.destaque ? ' ★' : '') + '</div>' +
            '<div class="item__sub">' + esc(sub || 'sem informações') + '</div>' +
          '</div>' +
          '<div class="item__bts">' +
            '<button type="button" class="bt bt--pequeno" data-editar="' + esc(f.id) + '">Editar</button>' +
            '<button type="button" class="bt bt--pequeno bt--perigo" data-excluir="' + esc(f.id) + '">Excluir</button>' +
          '</div>' +
        '</div>';
    }).join('');
  }

  /* ======================================================== configuração */

  function carregarConfigNaTela() {
    $('c-nome').value = catalogo.nomeLocadora || '';
    $('c-assinatura').value = catalogo.assinatura || '';
    $('c-categorias').value = catalogo.categorias.join('\n');
  }

  function salvarConfig() {
    var cats = $('c-categorias').value.split('\n')
      .map(function (s) { return s.trim(); })
      .filter(Boolean);

    if (!cats.length) { recado('Deixe ao menos uma prateleira cadastrada.', 'erro'); return; }

    catalogo.nomeLocadora = $('c-nome').value.trim() || 'Locadora';
    catalogo.assinatura = $('c-assinatura').value.trim() || 'vídeo clube particular';
    catalogo.categorias = cats;

    guardar();
    desenharGeneros(editandoId ? generosMarcados() : []);
    desenharAcervo();
    recado('Ajustes salvos.');
  }

  /* ============================================================= GitHub */

  function carregarGithubNaTela() {
    var g = L.lerGithub();
    $('gh-usuario').value = g.usuario;
    $('gh-repo').value = g.repo;
    $('gh-branch').value = g.branch;
    $('gh-caminho').value = g.caminho;
    $('gh-token').value = g.token;
    if (!g.token || !g.usuario) $('cfg-github').open = true;
  }

  function lerGithubDaTela() {
    return {
      usuario: $('gh-usuario').value.trim(),
      repo: $('gh-repo').value.trim(),
      branch: $('gh-branch').value.trim() || 'main',
      caminho: $('gh-caminho').value.trim() || L.CAMINHO_JSON,
      token: $('gh-token').value.trim()
    };
  }

  async function publicar() {
    var cfg = lerGithubDaTela();
    L.salvarGithub(cfg);

    var bt = $('bt-publicar');
    var rotulo = bt.textContent;
    bt.disabled = true;
    bt.textContent = 'Publicando…';

    try {
      await L.publicarNoGithub(catalogo, cfg, 'Atualiza catálogo (' + catalogo.filmes.length + ' fitas)');
      recado('Publicado! O GitHub Pages costuma levar até 1 minuto para atualizar a vitrine.');
    } catch (err) {
      recado('Não deu para publicar: ' + esc(err.message), 'erro');
    } finally {
      bt.disabled = false;
      bt.textContent = rotulo;
    }
  }

  /* ============================================================= backup */

  function baixar(nome, texto) {
    var blob = new Blob([texto], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function importar(arquivo) {
    var leitor = new FileReader();
    leitor.onload = function () {
      try {
        var novo = L.sanear(JSON.parse(leitor.result));
        if (!confirm('Substituir o acervo atual (' + catalogo.filmes.length + ' fitas) pelo do arquivo (' + novo.filmes.length + ' fitas)?')) return;
        catalogo = novo;
        guardar();
        carregarConfigNaTela();
        desenharGeneros([]);
        desenharAcervo();
        recado('Backup importado: ' + novo.filmes.length + ' fitas.');
      } catch (err) {
        recado('Arquivo inválido: ' + esc(err.message), 'erro');
      }
    };
    leitor.readAsText(arquivo);
  }

  /* ------------------------------ preencher dados a partir do YouTube -- */

  async function tentarPreencherDoYoutube() {
    var url = $('f-url').value.trim();
    if (!url || !L.idYoutube(url)) return;
    if ($('f-titulo').value.trim()) return;   // não sobrescreve o que já foi digitado

    try {
      var resp = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(url));
      if (!resp.ok) return;
      var dados = await resp.json();
      if (dados.title) $('f-titulo').value = dados.title;
      atualizarPrevia();
    } catch (e) {
      // sem internet ou bloqueado: o dono digita à mão, sem alarde
    }
  }

  /* ============================================================= eventos */

  function ligarEventos() {
    $('form-filme').addEventListener('submit', salvarFilme);
    $('bt-limpar').addEventListener('click', limparForm);
    $('bt-cancelar').addEventListener('click', limparForm);

    $('f-url').addEventListener('input', function () {
      atualizarDicaFonte();
      atualizarPrevia();
    });
    $('f-url').addEventListener('change', tentarPreencherDoYoutube);
    $('f-fonte').addEventListener('change', atualizarDicaFonte);
    $('f-capa').addEventListener('input', atualizarPrevia);

    $('acervo-lista').addEventListener('click', function (e) {
      var ed = e.target.closest('[data-editar]');
      if (ed) { editar(ed.dataset.editar); return; }
      var ex = e.target.closest('[data-excluir]');
      if (ex) excluir(ex.dataset.excluir);
    });

    $('acervo-busca').addEventListener('input', function () {
      filtroAcervo = this.value;
      desenharAcervo();
    });

    $('bt-salvar-config').addEventListener('click', salvarConfig);

    $('bt-salvar-gh').addEventListener('click', function () {
      L.salvarGithub(lerGithubDaTela());
      recado('Conexão com o GitHub salva neste navegador.');
    });

    $('bt-esquecer-gh').addEventListener('click', function () {
      var cfg = lerGithubDaTela();
      cfg.token = '';
      L.salvarGithub(cfg);
      $('gh-token').value = '';
      recado('Token apagado deste navegador.');
    });

    $('bt-publicar').addEventListener('click', publicar);

    $('bt-baixar').addEventListener('click', function () {
      baixar('catalogo.json', JSON.stringify(catalogo, null, 2) + '\n');
      recado('Arquivo baixado. Substitua <code>dados/catalogo.json</code> no repositório para publicar.');
    });

    $('bt-exportar').addEventListener('click', function () {
      var dia = new Date().toISOString().slice(0, 10);
      baixar('locadora-backup-' + dia + '.json', JSON.stringify(catalogo, null, 2) + '\n');
    });

    $('bt-importar').addEventListener('click', function () { $('arquivo-importar').click(); });
    $('arquivo-importar').addEventListener('change', function () {
      if (this.files[0]) importar(this.files[0]);
      this.value = '';
    });

    $('bt-senha').addEventListener('click', async function () {
      var nova = prompt('Nova senha do balcão (deixe em branco para cancelar):');
      if (!nova) return;
      localStorage.setItem(CHAVE_SENHA, await hash(nova));
      recado('Senha trocada.');
    });

    $('bt-descartar').addEventListener('click', async function () {
      if (!confirm('Descartar tudo que foi alterado e ainda não publicado?\n\nO acervo volta ao que está no catalogo.json publicado.')) return;
      L.limparRascunho();
      var pub = await L.carregarPublicado();
      catalogo = pub || L.catalogoVazio();
      carregarConfigNaTela();
      limparForm();
      desenharAcervo();
      atualizarEstado();
      recado('Alterações locais descartadas.');
    });

    $('bt-sair').addEventListener('click', function () {
      sessionStorage.removeItem(CHAVE_SESSAO);
      location.reload();
    });

    // Ctrl/Cmd+S salva o formulário
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        $('form-filme').requestSubmit();
      }
    });
  }

  /* ============================================================== início */

  async function iniciar() {
    var prefs = L.lerPrefs();
    document.body.classList.toggle('sem-crt', prefs.crt === false);

    var r = await L.carregar();
    catalogo = r.catalogo;

    if (L.abertoDoDisco()) {
      recado('<strong>Esta página foi aberta direto do disco.</strong> Assim o navegador bloqueia a ' +
        'leitura do <code>catalogo.json</code>, e qualquer cadastro que você fizer aqui não vai ' +
        'enxergar o acervo já publicado. Abra um terminal na pasta <strong>Locadora</strong>, rode ' +
        '<code>python3 -m http.server 8080</code> e use ' +
        '<a href="http://localhost:8080/admin.html">localhost:8080/admin.html</a>.', 'erro');
    } else if (r.origem === 'novo') {
      recado('Não achei <code>dados/catalogo.json</code>. Trabalhando com um acervo em branco — ' +
        'ele será criado quando você publicar no GitHub.', 'erro');
    }

    // as opções de classe saem da lista do núcleo, para não divergirem
    $('f-faixa').innerHTML = '<option value="">— sem classe —</option>' +
      L.FAIXAS.map(function (f) {
        return '<option value="' + esc(f) + '">' + esc(f) + '</option>';
      }).join('');

    carregarConfigNaTela();
    carregarGithubNaTela();
    desenharGeneros([]);
    desenharAcervo();
    atualizarEstado();
    atualizarPrevia();
    ligarEventos();
  }

  iniciarTranca();
})();
