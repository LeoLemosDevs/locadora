#!/usr/bin/env bash
# Abre a Locadora no navegador com um servidor local.
# Use este atalho em vez de dar dois cliques no index.html: o navegador
# bloqueia a leitura do catálogo quando a página vem direto do disco.

cd "$(dirname "$0")" || exit 1

PORTA=8080
# se a 8080 estiver ocupada, procura a próxima livre
while ss -ltn 2>/dev/null | grep -q ":$PORTA " || \
      netstat -ltn 2>/dev/null | grep -q ":$PORTA "; do
  PORTA=$((PORTA + 1))
  [ "$PORTA" -gt 8100 ] && { echo "Nenhuma porta livre entre 8080 e 8100."; exit 1; }
done

echo "📼 Locadora no ar em http://localhost:$PORTA"
echo "   Vitrine → http://localhost:$PORTA/"
echo "   Balcão  → http://localhost:$PORTA/admin.html"
echo
echo "Feche esta janela (ou Ctrl+C) para desligar."

python3 -m http.server "$PORTA" >/dev/null 2>&1 &
SERVIDOR=$!
trap 'kill $SERVIDOR 2>/dev/null' EXIT INT TERM

sleep 1
xdg-open "http://localhost:$PORTA/" >/dev/null 2>&1 || \
  echo "Abra o endereço acima no navegador."

wait $SERVIDOR
