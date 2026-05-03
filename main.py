from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict
import os
import secrets
import smtplib
from email.mime.text import MIMEText

from fastapi import FastAPI, Depends, HTTPException, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from sqlalchemy.pool import NullPool

from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    DateTime,
    Boolean,
    ForeignKey,
    UniqueConstraint,
    CheckConstraint,
)
from sqlalchemy.orm import (
    sessionmaker,
    declarative_base,
    relationship,
    Session,
    joinedload,
)
from sqlalchemy.pool import NullPool

from passlib.hash import pbkdf2_sha256
from dotenv import load_dotenv

# -----------------------------------
# Config
# -----------------------------------
load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
)
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL")

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASS = os.getenv("SMTP_PASS")
SMTP_FROM = os.getenv("SMTP_FROM")

cors_origins_env = os.getenv("CORS_ORIGINS", "*")
origins = (
    ["*"]
    if cors_origins_env == "*"
    else [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
)

# IMPORTANT:
# - NullPool evita problemas em ambientes tipo Render + Supabase pooler/session mode
# - pool_pre_ping evita conexões "mortas"


engine = create_engine(
    DATABASE_URL,
    poolclass=NullPool,      # ✅ aqui
    pool_pre_ping=True,
)



SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

app = FastAPI(title="Bolão Copa 2026")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------
# Models
# -----------------------------------

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    auth_token = Column(String, unique=True, nullable=True)
    reset_token = Column(String, unique=True, nullable=True)
    reset_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    profile = Column(String, nullable=False, default="user")

    bets = relationship("Bet", back_populates="user")


class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    fifa_code = Column(String, nullable=False)
    group = Column(String, nullable=False)


class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, index=True)
    home_team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    away_team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    stage = Column(String, nullable=False)
    kickoff_at_utc = Column(DateTime(timezone=True), nullable=False)
    home_score = Column(Integer, nullable=True)
    away_score = Column(Integer, nullable=True)

    home_team = relationship("Team", foreign_keys=[home_team_id])
    away_team = relationship("Team", foreign_keys=[away_team_id])
    bets = relationship("Bet", back_populates="match")


class Bet(Base):
    __tablename__ = "bets"
    __table_args__ = (
        UniqueConstraint("user_id", "match_id", name="uix_user_match"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    home_score_prediction = Column(Integer, nullable=False)
    away_score_prediction = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="bets")
    match = relationship("Match", back_populates="bets")

class ChampionPick(Base):
    __tablename__ = "champion_picks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="RESTRICT"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User")
    team = relationship("Team")


class BetHistory(Base):
    __tablename__ = "bet_history"
    __table_args__ = (
        CheckConstraint("action_type IN ('insert', 'update')", name="ck_bet_history_action_type"),
    )

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user_name = Column(String, nullable=False)

    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)

    home_score_prediction = Column(Integer, nullable=True)
    away_score_prediction = Column(Integer, nullable=True)

    prev_home_score_prediction = Column(Integer, nullable=True)
    prev_away_score_prediction = Column(Integer, nullable=True)

    action_type = Column(String, nullable=False)  # 'insert' ou 'update'

    changed_at_utc = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User")
    match = relationship("Match")

class ChampionConfig(Base):
    __tablename__ = "champion_config"

    id = Column(Integer, primary_key=True)
    champion_team_id = Column(Integer, ForeignKey("teams.id", ondelete="RESTRICT"), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    champion_team = relationship("Team")

# -----------------------------------
# Utils / Auth helpers
# -----------------------------------


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def hash_password(password: str) -> str:
    return pbkdf2_sha256.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pbkdf2_sha256.verify(plain_password, password_hash)


def generate_auth_token() -> str:
    return secrets.token_urlsafe(32)


def send_reset_email(to_email: str, reset_link: str):
    subject = "Bolão Copa 2026 - Reset de senha"
    body = f"""
Olá,

Você solicitou a redefinição de senha do seu usuário no Bolão da Copa 2026.

Clique no link abaixo para definir uma nova senha (válido por 1 hora):

{reset_link}

Se você não solicitou isso, pode ignorar este email.

Abraços,
Bolão Copa 2026
"""

    if not (SMTP_HOST and SMTP_USER and SMTP_PASS and SMTP_FROM):
        print("==== RESET DE SENHA (DEV) ====")
        print(f"Para: {to_email}")
        print(f"Link: {reset_link}")
        print("==============================")
        return

    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM
    msg["To"] = to_email

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        server.send_message(msg)


def get_current_user(
    db: Session = Depends(get_db),
    x_user_id: Optional[int] = Header(None, alias="X-User-Id"),
    x_auth_token: Optional[str] = Header(None, alias="X-Auth-Token"),
):
    if x_user_id is None or x_auth_token is None:
        raise HTTPException(status_code=401, detail="Não autenticado")

    user = db.query(User).filter(User.id == x_user_id, User.auth_token == x_auth_token).first()
    if not user:
        raise HTTPException(status_code=401, detail="Sessão inválida")
    return user

def get_champion_pick_lock_at(db: Session) -> datetime:
    first_match = (
        db.query(Match)
        .order_by(Match.kickoff_at_utc.asc())
        .first()
    )

    if not first_match:
        raise HTTPException(status_code=500, detail="Nenhuma partida cadastrada.")

    return first_match.kickoff_at_utc - timedelta(minutes=30)


def is_champion_pick_locked(db: Session) -> bool:
    now_utc = datetime.now(timezone.utc)
    lock_at = get_champion_pick_lock_at(db)
    return now_utc >= lock_at


def get_official_champion_team_id(db: Session) -> Optional[int]:
    config = db.query(ChampionConfig).filter(ChampionConfig.id == 1).first()
    if not config:
        return None
    return config.champion_team_id

# -----------------------------------
# Schemas (Pydantic)
# -----------------------------------

# Compat Pydantic v1/v2
class _OrmConfig:
    try:
        from_attributes = True  # pydantic v2
    except Exception:
        orm_mode = True  # pydantic v1


class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    accessCode: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserAuthOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    auth_token: str
    profile: str

    class Config(_OrmConfig):
        pass


class BetInfo(BaseModel):
    home_score_prediction: int
    away_score_prediction: int

    class Config(_OrmConfig):
        pass


class MatchOut(BaseModel):
    id: int
    stage: str
    kickoff_at_utc: datetime
    home_team_name: str
    home_team_code: str
    away_team_name: str
    away_team_code: str
    home_score: Optional[int]
    away_score: Optional[int]
    is_locked: bool
    round: str
    my_bet: Optional[BetInfo] = None

    class Config(_OrmConfig):
        pass


class BetCreate(BaseModel):
    match_id: int
    home_score_prediction: int
    away_score_prediction: int


class BetBulkCreate(BaseModel):
    bets: List[BetCreate]


class BetOut(BaseModel):
    id: int
    match_id: int
    user_id: int
    home_score_prediction: int
    away_score_prediction: int

    class Config(_OrmConfig):
        pass


class RankingItem(BaseModel):
    user_id: int
    user_name: str
    total_points: int


class ResetPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordPayload(BaseModel):
    token: str
    new_password: str


class PublicBetOut(BaseModel):
    match_id: int
    user_id: int
    user_name: str
    home_score_prediction: int
    away_score_prediction: int

    class Config(_OrmConfig):
        pass


class MatchResultUpdate(BaseModel):
    match_id: int
    home_score: int
    away_score: int


class MatchResultBulkUpdate(BaseModel):
    results: List[MatchResultUpdate]


class BetHistoryOut(BaseModel):
    id: int
    user_id: int
    user_name: str

    match_id: int
    match_stage: Optional[str] = None
    kickoff_at_utc: Optional[datetime] = None
    home_team_name: Optional[str] = None
    away_team_name: Optional[str] = None

    home_score_prediction: Optional[int] = None
    away_score_prediction: Optional[int] = None
    prev_home_score_prediction: Optional[int] = None
    prev_away_score_prediction: Optional[int] = None

    action_type: str
    changed_at_utc: datetime

    class Config(_OrmConfig):
        pass

class AccessCode(Base):
    __tablename__ = "access_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, nullable=False, index=True)
    is_master = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    used_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    used_by_user = relationship("User")

class ChampionPickCreate(BaseModel):
    team_id: int


class ChampionPickOut(BaseModel):
    user_id: int
    team_id: Optional[int]
    team_name: Optional[str]
    locked: bool
    lock_at_utc: datetime

    class Config(_OrmConfig):
        pass

# -----------------------------------
# Regras de pontuação
# -----------------------------------

POINT_EXACT = 18
POINT_RESULT_AND_ONE_SCORE = 12
POINT_RESULT_ONLY = 9
POINT_WRONG_RESULT_ONE_SCORE = 3
POINT_PREDICTED_DRAW_ACTUAL_WIN = 3
CHAMPION_BONUS_POINTS = 40


def calculate_points_for_bet(match: Match, bet: Bet) -> int:
    if match.home_score is None or match.away_score is None:
        return 0

    real_h = match.home_score
    real_a = match.away_score
    pred_h = bet.home_score_prediction
    pred_a = bet.away_score_prediction

    if real_h == pred_h and real_a == pred_a:
        return POINT_EXACT

    real_result = (real_h > real_a) - (real_h < real_a)
    pred_result = (pred_h > pred_a) - (pred_h < pred_a)

    if pred_result == 0 and real_result != 0:
        return POINT_PREDICTED_DRAW_ACTUAL_WIN

    correct_scores_count = int(real_h == pred_h) + int(real_a == pred_a)

    if real_result == pred_result:
        if correct_scores_count == 1:
            return POINT_RESULT_AND_ONE_SCORE
        elif correct_scores_count == 0:
            return POINT_RESULT_ONLY

    if correct_scores_count >= 1:
        return POINT_WRONG_RESULT_ONE_SCORE

    return 0


def is_match_locked(match: Match) -> bool:
    now_utc = datetime.now(timezone.utc)
    lock_time = match.kickoff_at_utc - timedelta(minutes=5)
    return now_utc >= lock_time

def calculate_champion_bonus_for_user(
    user_id: int,
    champion_pick_by_user: Dict[int, int],
    official_champion_team_id: Optional[int],
) -> int:
    if official_champion_team_id is None:
        return 0

    picked_team_id = champion_pick_by_user.get(user_id)
    if picked_team_id is None:
        return 0

    if picked_team_id == official_champion_team_id:
        return CHAMPION_BONUS_POINTS

    return 0
# -----------------------------------
# Endpoints de Auth
# -----------------------------------


@app.post("/auth/register", response_model=UserAuthOut)
def register_user(payload: UserRegister, db: Session = Depends(get_db)):
    name = payload.name.strip()
    email = payload.email.strip().lower()
    password = payload.password
    access_code_value = payload.accessCode.strip().lower()

    if not name:
        raise HTTPException(status_code=400, detail="Nome é obrigatório.")

    if not access_code_value:
        raise HTTPException(status_code=400, detail="Código de acesso é obrigatório.")

    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Senha muito curta (mínimo 8 caracteres).")

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email já registrado")

    access_code = (
        db.query(AccessCode)
        .filter(AccessCode.code == access_code_value)
        .with_for_update()
        .first()
    )

    if not access_code:
        raise HTTPException(status_code=400, detail="Código de acesso inválido.")

    if not access_code.is_active:
        raise HTTPException(status_code=400, detail="Código de acesso desativado.")

    if not access_code.is_master and access_code.used_at is not None:
        raise HTTPException(status_code=400, detail="Código de acesso já utilizado.")

    try:
        user = User(
            name=name,
            email=email,
            password_hash=hash_password(password),
            auth_token=generate_auth_token(),
        )
        db.add(user)
        db.flush()

        if not access_code.is_master:
            access_code.used_by_user_id = user.id
            access_code.used_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(user)

    except Exception:
        db.rollback()
        raise

    return UserAuthOut(
        id=user.id,
        name=user.name,
        email=user.email,
        auth_token=user.auth_token,
        profile=user.profile,
    )

@app.post("/auth/login", response_model=UserAuthOut)
def login_user(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.strip().lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email ou senha inválidos")

    if not user.auth_token:
        user.auth_token = generate_auth_token()
        db.commit()
        db.refresh(user)

    return UserAuthOut(
        id=user.id,
        name=user.name,
        email=user.email,
        auth_token=user.auth_token,
        profile=user.profile,
    )


@app.post("/auth/request-password-reset")
def request_password_reset(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if user:
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        user.reset_token = token
        user.reset_token_expires_at = expires_at
        db.commit()

        reset_link = f"{FRONTEND_BASE_URL}/reset-password?token={token}"
        send_reset_email(user.email, reset_link)

    return {"message": "Se este email estiver cadastrado, você receberá um link para redefinir a senha."}


@app.post("/auth/reset-password")
def reset_password(payload: ResetPasswordPayload, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.reset_token == payload.token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Token inválido")

    if (not user.reset_token_expires_at) or (user.reset_token_expires_at < datetime.now(timezone.utc)):
        raise HTTPException(status_code=400, detail="Token expirado")

    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="Senha muito curta (mínimo 8 caracteres).")

    user.password_hash = hash_password(payload.new_password)
    user.reset_token = None
    user.reset_token_expires_at = None
    user.auth_token = generate_auth_token()
    db.commit()

    return {"message": "Senha redefinida com sucesso. Faça login novamente."}


# -----------------------------------
# Endpoints Matches / Bets / Ranking
# -----------------------------------


@app.get("/matches", response_model=List[MatchOut])
def list_matches(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Carrega times junto pra não dar N+1
    matches = (
        db.query(Match)
        .options(joinedload(Match.home_team), joinedload(Match.away_team))
        .order_by(Match.kickoff_at_utc)
        .all()
    )

    # Carrega TODAS as bets do usuário em 1 query e faz map match_id -> bet
    user_bets = db.query(Bet).filter(Bet.user_id == current_user.id).all()
    bet_by_match: Dict[int, Bet] = {b.match_id: b for b in user_bets}

    # Agrupamento por stage "Group ..."
    groups = {}
    for m in matches:
        stage_lower = (m.stage or "").lower()
        if stage_lower.startswith("group") or stage_lower.startswith("grupo"):
            groups.setdefault(m.stage, []).append(m)

    match_round_map = {}
    for _group_stage, group_matches in groups.items():
        group_matches.sort(key=lambda x: x.kickoff_at_utc)
        for idx, mm in enumerate(group_matches):
            if idx < 2:
                r = "1a rodada"
            elif idx < 4:
                r = "2a rodada"
            else:
                r = "3a rodada"
            match_round_map[mm.id] = r

    def infer_round_for_knockout(m: Match) -> str:
        s = (m.stage or "").lower()
        if m.id in match_round_map:
            return match_round_map[m.id]

        if "16 avos" in s or "32" in s:
            return "16 avos"
        if "oitavas" in s or "round of 16" in s:
            return "oitavas"
        if "quartas" in s or "quarter" in s:
            return "quartas"
        if "semi" in s:
            return "semi"
        if "3o" in s or "3º" in s or "third" in s:
            return "finais"
        if "final" in s:
            return "finais"
        return "1a rodada"

    result: List[MatchOut] = []

    for m in matches:
        bet = bet_by_match.get(m.id)
        round_label = match_round_map.get(m.id) or infer_round_for_knockout(m)

        result.append(
            MatchOut(
                id=m.id,
                stage=m.stage,
                kickoff_at_utc=m.kickoff_at_utc,
                home_team_name=m.home_team.name,
                home_team_code=m.home_team.fifa_code,
                away_team_name=m.away_team.name,
                away_team_code=m.away_team.fifa_code,
                home_score=m.home_score,
                away_score=m.away_score,
                is_locked=is_match_locked(m),
                round=round_label,
                my_bet=BetInfo(
                    home_score_prediction=bet.home_score_prediction,
                    away_score_prediction=bet.away_score_prediction,
                )
                if bet
                else None,
            )
        )

    return result

@app.get("/teams")
def list_teams(db: Session = Depends(get_db)):
    teams = (
        db.query(Team)
        .filter(Team.id != 49)
        .order_by(Team.name.asc())
        .all()
    )
    return [
        {
            "id": t.id,
            "name": t.name,
            "fifa_code": t.fifa_code,
            "group": t.group,
        }
        for t in teams
    ]

@app.get("/champion-pick", response_model=ChampionPickOut)
def get_my_champion_pick(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lock_at = get_champion_pick_lock_at(db)
    locked = is_champion_pick_locked(db)

    pick = (
        db.query(ChampionPick)
        .join(Team, Team.id == ChampionPick.team_id)
        .filter(ChampionPick.user_id == current_user.id)
        .first()
    )

    if not pick:
        return ChampionPickOut(
            user_id=current_user.id,
            team_id=None,
            team_name=None,
            locked=locked,
            lock_at_utc=lock_at,
        )

    return ChampionPickOut(
        user_id=current_user.id,
        team_id=pick.team_id,
        team_name=pick.team.name,
        locked=locked,
        lock_at_utc=lock_at,
    )

@app.post("/champion-pick", response_model=ChampionPickOut)
def upsert_champion_pick(
    payload: ChampionPickCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if is_champion_pick_locked(db):
        raise HTTPException(
            status_code=403,
            detail="O prazo para palpitar o campeão já foi encerrado.",
        )

    team = db.query(Team).filter(Team.id == payload.team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Seleção não encontrada.")

    if team.id == 49:
        raise HTTPException(
            status_code=400,
            detail="A seleção 'A definir' não pode ser escolhida como campeã.",
        )

    pick = db.query(ChampionPick).filter(ChampionPick.user_id == current_user.id).first()
    now = datetime.now(timezone.utc)

    if pick is None:
        pick = ChampionPick(
            user_id=current_user.id,
            team_id=payload.team_id,
            created_at=now,
            updated_at=now,
        )
        db.add(pick)
    else:
        pick.team_id = payload.team_id
        pick.updated_at = now

    db.commit()
    db.refresh(pick)

    return ChampionPickOut(
        user_id=current_user.id,
        team_id=pick.team_id,
        team_name=team.name,
        locked=False,
        lock_at_utc=get_champion_pick_lock_at(db),
    )

@app.post("/bets", response_model=BetOut)
def upsert_bet(
    bet_in: BetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    match = (
        db.query(Match)
        .options(joinedload(Match.home_team), joinedload(Match.away_team))
        .filter(Match.id == bet_in.match_id)
        .first()
    )
    if not match:
        raise HTTPException(status_code=404, detail="Partida não encontrada")

    if is_match_locked(match):
        raise HTTPException(
            status_code=400,
            detail="Palpites só podem ser alterados até 5 minutos antes do início da partida (horário UTC).",
        )

    bet = db.query(Bet).filter(Bet.user_id == current_user.id, Bet.match_id == bet_in.match_id).first()
    now = datetime.now(timezone.utc)

    if bet is None:
        bet = Bet(
            user_id=current_user.id,
            match_id=bet_in.match_id,
            home_score_prediction=bet_in.home_score_prediction,
            away_score_prediction=bet_in.away_score_prediction,
            created_at=now,
            updated_at=now,
        )
        db.add(bet)

        history = BetHistory(
            user_id=current_user.id,
            user_name=current_user.name,
            match_id=bet_in.match_id,
            home_score_prediction=bet_in.home_score_prediction,
            away_score_prediction=bet_in.away_score_prediction,
            prev_home_score_prediction=None,
            prev_away_score_prediction=None,
            action_type="insert",
            changed_at_utc=now,
        )
        db.add(history)
    else:
        prev_home = bet.home_score_prediction
        prev_away = bet.away_score_prediction

        bet.home_score_prediction = bet_in.home_score_prediction
        bet.away_score_prediction = bet_in.away_score_prediction
        bet.updated_at = now

        if (prev_home != bet.home_score_prediction) or (prev_away != bet.away_score_prediction):
            history = BetHistory(
                user_id=current_user.id,
                user_name=current_user.name,
                match_id=bet_in.match_id,
                home_score_prediction=bet.home_score_prediction,
                away_score_prediction=bet.away_score_prediction,
                prev_home_score_prediction=prev_home,
                prev_away_score_prediction=prev_away,
                action_type="update",
                changed_at_utc=now,
            )
            db.add(history)

    db.commit()
    db.refresh(bet)
    return bet


@app.post("/bets/bulk")
def upsert_bets_bulk(
    payload: BetBulkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    saved = 0
    errors: List[str] = []

    # Puxa os matches envolvidos numa tacada só (evita query por item)
    match_ids = [b.match_id for b in payload.bets]
    matches = (
        db.query(Match)
        .options(joinedload(Match.home_team), joinedload(Match.away_team))
        .filter(Match.id.in_(match_ids))
        .all()
    )
    match_by_id: Dict[int, Match] = {m.id: m for m in matches}

    # Puxa bets existentes do usuário em uma tacada só
    existing_bets = (
        db.query(Bet)
        .filter(Bet.user_id == current_user.id, Bet.match_id.in_(match_ids))
        .all()
    )
    bet_by_match: Dict[int, Bet] = {b.match_id: b for b in existing_bets}

    for bet_in in payload.bets:
        match = match_by_id.get(bet_in.match_id)
        if not match:
            errors.append(f"Partida {bet_in.match_id} não encontrada.")
            continue

        if is_match_locked(match):
            errors.append(f"Partida {match.id} entre {match.home_team.name} x {match.away_team.name} já está bloqueada.")
            continue

        bet = bet_by_match.get(bet_in.match_id)

        if bet is None:
            bet = Bet(
                user_id=current_user.id,
                match_id=bet_in.match_id,
                home_score_prediction=bet_in.home_score_prediction,
                away_score_prediction=bet_in.away_score_prediction,
                created_at=now,
                updated_at=now,
            )
            db.add(bet)

            history = BetHistory(
                user_id=current_user.id,
                user_name=current_user.name,
                match_id=bet_in.match_id,
                home_score_prediction=bet_in.home_score_prediction,
                away_score_prediction=bet_in.away_score_prediction,
                prev_home_score_prediction=None,
                prev_away_score_prediction=None,
                action_type="insert",
                changed_at_utc=now,
            )
            db.add(history)

            bet_by_match[bet_in.match_id] = bet
        else:
            prev_home = bet.home_score_prediction
            prev_away = bet.away_score_prediction

            bet.home_score_prediction = bet_in.home_score_prediction
            bet.away_score_prediction = bet_in.away_score_prediction
            bet.updated_at = now

            if (prev_home != bet.home_score_prediction) or (prev_away != bet.away_score_prediction):
                history = BetHistory(
                    user_id=current_user.id,
                    user_name=current_user.name,
                    match_id=bet_in.match_id,
                    home_score_prediction=bet.home_score_prediction,
                    away_score_prediction=bet.away_score_prediction,
                    prev_home_score_prediction=prev_home,
                    prev_away_score_prediction=prev_away,
                    action_type="update",
                    changed_at_utc=now,
                )
                db.add(history)

        saved += 1

    db.commit()

    status = "ok" if not errors else "partial"
    return {"status": status, "saved": saved, "errors": errors}


@app.get("/ranking", response_model=List[RankingItem])
def get_ranking(db: Session = Depends(get_db)):
    users = db.query(User).all()
    matches = db.query(Match).all()
    bets = db.query(Bet).all()
    champion_picks = db.query(ChampionPick).all()

    matches_dict = {m.id: m for m in matches}
    points_by_user = {u.id: 0 for u in users}
    champion_pick_by_user = {cp.user_id: cp.team_id for cp in champion_picks}
    official_champion_team_id = get_official_champion_team_id(db)

    for bet in bets:
        match = matches_dict.get(bet.match_id)
        if match:
            points_by_user[bet.user_id] += calculate_points_for_bet(match, bet)

    for user in users:
        points_by_user[user.id] += calculate_champion_bonus_for_user(
            user.id,
            champion_pick_by_user,
            official_champion_team_id,
        )

    ranking = [
        RankingItem(
            user_id=u.id,
            user_name=u.name,
            total_points=points_by_user.get(u.id, 0),
        )
        for u in users
    ]
    ranking.sort(key=lambda r: (-r.total_points, r.user_name.lower()))
    return ranking

@app.get("/bets/public", response_model=List[PublicBetOut])
def list_public_bets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Carrega user junto pra bet.user.name não virar N+1
    # Carrega match e teams para is_locked e validações futuras
    bets = (
        db.query(Bet)
        .options(
            joinedload(Bet.user),
            joinedload(Bet.match).joinedload(Match.home_team),
            joinedload(Bet.match).joinedload(Match.away_team),
        )
        .all()
    )

    result: List[PublicBetOut] = []

    for bet in bets:
        match = bet.match
        if not match:
            continue

        # Só mostra público quando bloqueou
        if not is_match_locked(match):
            continue

        result.append(
            PublicBetOut(
                match_id=bet.match_id,
                user_id=bet.user_id,
                user_name=bet.user.name,
                home_score_prediction=bet.home_score_prediction,
                away_score_prediction=bet.away_score_prediction,
            )
        )

    return result


@app.post("/matches/results/bulk")
def update_match_results_bulk(
    payload: MatchResultBulkUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # só admin pode postar resultado
    if current_user.profile != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem postar resultados oficiais.")

    updated = 0
    errors: List[str] = []

    match_ids = [r.match_id for r in payload.results]
    matches = db.query(Match).filter(Match.id.in_(match_ids)).all()
    match_by_id = {m.id: m for m in matches}

    for item in payload.results:
        match = match_by_id.get(item.match_id)
        if not match:
            errors.append(f"Partida {item.match_id} não encontrada.")
            continue

        if item.home_score < 0 or item.away_score < 0:
            errors.append(f"Placar inválido para partida {item.match_id}.")
            continue

        match.home_score = item.home_score
        match.away_score = item.away_score
        updated += 1

    db.commit()

    return {"status": "ok" if not errors else "partial", "updated": updated, "errors": errors}


# -----------------------------------
# Endpoint admin – histórico de apostas
# -----------------------------------

@app.get("/admin/bet-history", response_model=List[BetHistoryOut])
def list_bet_history(
    user_id: int = Query(..., ge=1),
    match_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.profile != "admin":
        raise HTTPException(status_code=403, detail="Apenas admins podem ver o histórico")

    q = (
        db.query(BetHistory)
        .options(
            joinedload(BetHistory.match).joinedload(Match.home_team),
            joinedload(BetHistory.match).joinedload(Match.away_team),
        )
        .filter(BetHistory.user_id == user_id)
        .order_by(BetHistory.changed_at_utc.desc())
    )

    if match_id is not None:
        q = q.filter(BetHistory.match_id == match_id)

    rows = q.all()

    result: List[BetHistoryOut] = []
    for h in rows:
        m = h.match
        result.append(
            BetHistoryOut(
                id=h.id,
                user_id=h.user_id,
                user_name=h.user_name,
                match_id=h.match_id,
                match_stage=m.stage if m else None,
                kickoff_at_utc=m.kickoff_at_utc if m else None,
                home_team_name=m.home_team.name if m and m.home_team else None,
                away_team_name=m.away_team.name if m and m.away_team else None,
                home_score_prediction=h.home_score_prediction,
                away_score_prediction=h.away_score_prediction,
                prev_home_score_prediction=h.prev_home_score_prediction,
                prev_away_score_prediction=h.prev_away_score_prediction,
                action_type=h.action_type,
                changed_at_utc=h.changed_at_utc,
            )
        )
    return result

@app.get("/admin/users")
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.profile != "admin":
        raise HTTPException(status_code=403, detail="Apenas admins")

    users = (
        db.query(User.id, User.name)
        .order_by(User.name.asc())
        .all()
    )

    return [{"id": u.id, "name": u.name} for u in users]


@app.get("/admin/matches")
def list_matches_admin(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.profile != "admin":
        raise HTTPException(status_code=403, detail="Apenas admins")

    matches = (
        db.query(Match)
        .options(
            joinedload(Match.home_team),
            joinedload(Match.away_team),
        )
        .order_by(Match.kickoff_at_utc)
        .all()
    )

    return [
        {
            "id": m.id,
            "label": f"{m.home_team.name} x {m.away_team.name}",
            "stage": m.stage,
            "kickoff_at_utc": m.kickoff_at_utc,
        }
        for m in matches
    ]
