"""
sync_scores.py
Busca placares ao vivo da ESPN e atualiza o banco do bolão automaticamente.

Uso:
  python sync_scores.py           # roda uma vez
  python sync_scores.py --loop    # fica em loop (polling a cada 60s)
"""

import os
import sys
import time
import urllib.request
import json
import psycopg2
from datetime import datetime, timezone

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# ── Config ─────────────────────────────────────────────────────────────────
DB_CONN = dict(
    host=os.environ.get('DB_HOST', 'db.rffsunqijlcrjiibocai.supabase.co'),
    port=int(os.environ.get('DB_PORT', 5432)),
    dbname=os.environ.get('DB_NAME', 'postgres'),
    user=os.environ.get('DB_USER', 'postgres'),
    password=os.environ.get('DB_PASSWORD', 'Sm6zqL7OQ7ABYg87'),
    sslmode=os.environ.get('DB_SSLMODE', 'require'),
)

ESPN_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard'
POLL_INTERVAL = 60  # segundos entre cada chamada no modo --loop

# Status ESPN que indicam jogo ativo ou encerrado (score válido)
SCORE_STATUSES = {
    'STATUS_IN_PROGRESS',
    'STATUS_FIRST_HALF',
    'STATUS_SECOND_HALF',
    'STATUS_HALFTIME',
    'STATUS_FULL_TIME',
    'STATUS_EXTRA_TIME',
    'STATUS_EXTRA_TIME_FIRST_HALF',
    'STATUS_EXTRA_TIME_SECOND_HALF',
    'STATUS_PENALTIES',
    'STATUS_END_PERIOD',
    'STATUS_FINAL',
    'STATUS_FINAL_AET',
    'STATUS_FINAL_PEN',
}

# ── ESPN ────────────────────────────────────────────────────────────────────
def fetch_espn():
    req = urllib.request.Request(ESPN_URL, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())

def parse_events(data):
    """Retorna lista de dicts com home_abbr, away_abbr, home_score, away_score, status."""
    results = []
    for event in data.get('events', []):
        if not event.get('competitions'):
            continue
        comp = event['competitions'][0]
        status_name = comp['status']['type']['name']
        if status_name not in SCORE_STATUSES:
            continue
        teams = comp['competitors']
        home = next((t for t in teams if t['homeAway'] == 'home'), None)
        away = next((t for t in teams if t['homeAway'] == 'away'), None)
        if not home or not away:
            continue
        try:
            home_score = int(home['score'])
            away_score = int(away['score'])
        except (KeyError, ValueError, TypeError):
            continue
        results.append({
            'home_abbr': home['team']['abbreviation'].upper(),
            'away_abbr': away['team']['abbreviation'].upper(),
            'home_score': home_score,
            'away_score': away_score,
            'status': status_name,
            'date': event.get('date', '')[:10],
        })
    return results

# ── DB ──────────────────────────────────────────────────────────────────────
def get_pending_matches(cur):
    """Retorna todos os jogos que ainda não têm resultado (ou estão em andamento)."""
    cur.execute("""
        SELECT m.id, ht.fifa_code, at.fifa_code,
               m.home_score, m.away_score,
               m.kickoff_at_utc
        FROM matches m
        JOIN teams ht ON ht.id = m.home_team_id
        JOIN teams at ON at.id = m.away_team_id
        WHERE m.kickoff_at_utc <= NOW() + INTERVAL '30 minutes'
        ORDER BY m.kickoff_at_utc
    """)
    return cur.fetchall()

def update_match_score(cur, match_id, home_score, away_score):
    cur.execute("""
        UPDATE matches
        SET home_score = %s, away_score = %s
        WHERE id = %s
    """, (home_score, away_score, match_id))

# ── Sync ────────────────────────────────────────────────────────────────────
def sync_once():
    now = datetime.now(timezone.utc).strftime('%H:%M:%S')

    try:
        data = fetch_espn()
    except Exception as e:
        print(f"[{now}] ERRO ao buscar ESPN: {e}")
        return

    try:
        espn_events = parse_events(data)
    except Exception as e:
        print(f"[{now}] ERRO ao parsear ESPN: {e}")
        return

    if not espn_events:
        print(f"[{now}] Nenhum jogo com placar na ESPN agora.")
        return

    try:
        conn = psycopg2.connect(**DB_CONN)
        conn.set_client_encoding('UTF8')
        cur = conn.cursor()
    except Exception as e:
        print(f"[{now}] ERRO ao conectar no banco: {e}")
        return

    try:
        db_matches = get_pending_matches(cur)

        # Índice ESPN por (home_abbr, away_abbr)
        espn_by_pair = {(e['home_abbr'], e['away_abbr']): e for e in espn_events}

        updated = 0
        for match_id, home_code, away_code, db_home, db_away, kickoff in db_matches:
            espn = espn_by_pair.get((home_code, away_code))
            if not espn:
                continue

            new_home = espn['home_score']
            new_away = espn['away_score']

            if new_home == db_home and new_away == db_away:
                continue  # sem mudança

            update_match_score(cur, match_id, new_home, new_away)
            prev = f"{db_home}x{db_away}" if db_home is not None else "sem placar"
            print(f"[{now}] OK Jogo {match_id} ({home_code} x {away_code}): {prev} -> {new_home}x{new_away}  [{espn['status']}]")
            updated += 1

        if updated:
            conn.commit()
            print(f"[{now}] {updated} placar(es) atualizado(s).")
        else:
            resumo = [f"{e['home_abbr']}{e['home_score']}x{e['away_abbr']}{e['away_score']}" for e in espn_events]
            print(f"[{now}] Nenhuma alteração. ESPN: {resumo}")

    except Exception as e:
        conn.rollback()
        print(f"[{now}] ERRO durante sync: {e}")
    finally:
        cur.close()
        conn.close()

# ── Entry point ─────────────────────────────────────────────────────────────
if __name__ == '__main__':
    loop = '--loop' in sys.argv

    if loop:
        print(f"Modo loop ativo — polling a cada {POLL_INTERVAL}s. Ctrl+C para parar.\n")
        while True:
            sync_once()
            time.sleep(POLL_INTERVAL)
    else:
        sync_once()
