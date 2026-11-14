#!/bin/bash
# MAWD 로컬 실행: 백엔드(8000) + 프론트(3000)를 한 번에 켠다.
# Finder에서 더블클릭하거나 터미널에서 ./run-local.command  (끄기: Ctrl+C)
cd "$(dirname "$0")" || exit 1
ROOT=$(pwd)

# 더블클릭으로 열면 .zshrc를 안 읽어서 brew·nvm 경로를 직접 잡아준다.
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.homebrew/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1

fail() { echo; echo "❌ $1"; echo; read -r -p "엔터를 누르면 닫힙니다."; exit 1; }

# ---------- 준비물 확인 ----------
PY=""
for c in python3.13 python3.12 python3.11 python3.10 python3; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(sys.version_info < (3, 10))'; then PY=$c; break; fi
done
[ -n "$PY" ] || fail "Python 3.10 이상이 필요해요. 예: brew install python@3.12"
command -v npm >/dev/null 2>&1 || fail "Node.js(npm)를 찾을 수 없어요. 예: brew install node"

if lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  fail "3000번 포트를 이미 쓰고 있어요. 켜져 있는 npm run dev를 먼저 끄고 다시 실행해 주세요."
fi

# ---------- 백엔드 ----------
cd "$ROOT/backend" || exit 1
[ -f .env ] || { cp .env.example .env; echo "· backend/.env를 만들었어요 (AI 키는 비어 있음 → AI 기능은 예시 응답)"; }
if [ ! -x .venv/bin/python ]; then
  echo "· 파이썬 가상환경 만드는 중..."
  "$PY" -m venv .venv || fail "가상환경을 만들지 못했어요."
fi
if [ ! -f .venv/.deps_installed ] || [ requirements.txt -nt .venv/.deps_installed ]; then
  echo "· 백엔드 패키지 설치 중..."
  .venv/bin/pip install -q -r requirements.txt || fail "백엔드 패키지 설치에 실패했어요."
  touch .venv/.deps_installed
fi

BACK_PID=""
if curl -s -o /dev/null http://localhost:8000/health; then
  echo "· 백엔드가 이미 8000번에서 켜져 있어 그대로 씁니다."
else
  .venv/bin/uvicorn main:app --reload --port 8000 &
  BACK_PID=$!
  trap '[ -n "$BACK_PID" ] && kill "$BACK_PID" 2>/dev/null' EXIT
  for _ in $(seq 1 40); do
    curl -s -o /dev/null http://localhost:8000/health && break
    kill -0 "$BACK_PID" 2>/dev/null || fail "백엔드가 켜지지 않았어요. 위 오류를 확인해 주세요."
    sleep 0.5
  done
fi

# ---------- 테스트용 브랜드(store_id) ----------
SID_FILE="$ROOT/backend/.venv/local_store_id"
SID=$(cat "$SID_FILE" 2>/dev/null)
if [ -z "$SID" ] || [ "$(curl -s -o /dev/null -w '%{http_code}' -H "X-Store-Id: $SID" http://localhost:8000/api/stores/me)" != "200" ]; then
  SID=$(curl -s -X POST http://localhost:8000/api/stores -H 'Content-Type: application/json' \
    -d '{"name":"소소공방","category":"문구·굿즈","intro":"일상 기록용 문구"}' \
    | .venv/bin/python -c 'import json,sys; print(json.load(sys.stdin).get("store_id",""))' 2>/dev/null)
  [ -n "$SID" ] && echo "$SID" > "$SID_FILE"
fi

# ---------- 프론트 ----------
cd "$ROOT/frontend" || exit 1
[ -f .env.local ] || { echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local; echo "· frontend/.env.local을 만들었어요"; }
[ -d node_modules ] || { echo "· 프론트 패키지 설치 중..."; npm install || fail "npm install에 실패했어요."; }

URL="http://localhost:3000/home"
[ -n "$SID" ] && URL="$URL?store=$SID"
echo
echo "✅ 백엔드  http://localhost:8000/docs"
echo "✅ 프론트  $URL"
echo "   (끄려면 이 창에서 Ctrl+C)"
echo
(sleep 5; open "$URL") &
npm run dev
