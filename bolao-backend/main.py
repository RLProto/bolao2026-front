from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Tuple
import hashlib
import os
import secrets
import smtplib
from email.mime.text import MIMEText

from fastapi import FastAPI, Depends, HTTPException, Header, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from sqlalchemy import (
    create_engine,
    Column,
    Index,
    Integer,
    String,
    DateTime,
    Boolean,
    ForeignKey,
    UniqueConstraint,
    CheckConstraint,
    text,
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

DATABASE_URL = os.getenv("DATABASE_URL")
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL")

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASS = os.getenv("SMTP_PASS")
SMTP_FROM = os.getenv("SMTP_FROM")

AUTH_TOKEN_EXPIRE_DAYS = 30

cors_origins_env = os.getenv("CORS_ORIGINS", "*")
origins = (
    ["*"]
    if cors_origins_env == "*"
    else [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
)

# NullPool evita problemas em ambientes tipo Render + Supabase pooler/session mode
engine = create_engine(
    DATABASE_URL,
    poolclass=NullPool,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

app = FastAPI(title="Bolao Copa 2026")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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
    # Nova coluna -- migration: ALTER TABLE users ADD COLUMN auth_token_expires_at TIMESTAMPTZ;
    auth_token_expires_at = Column(DateTime(timezone=True), nullable=True)
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
        Index("ix_bet_history_user_match", "user_id", "match_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user_name = Column(String, nullable=False)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    home_score_prediction = Column(Integer, nullable=True)
    away_score_prediction = Column(Integer, nullable=True)
    prev_home_score_prediction = Column(Integer, nullable=True)
    prev_away_score_prediction = Column(Integer, nullable=True)
    action_type = Column(String, nullable=False)
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


class League(Base):
    __tablename__ = "leagues"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    creator = relationship("User", foreign_keys=[created_by])
    members = relationship("LeagueMember", back_populates="league", cascade="all, delete-orphan")


class LeagueMember(Base):
    __tablename__ = "league_members"

    league_id = Column(Integer, ForeignKey("leagues.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    joined_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    league = relationship("League", back_populates="members")
    user = relationship("User")


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


def generate_auth_token_with_expiry() -> Tuple[str, datetime]:
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=AUTH_TOKEN_EXPIRE_DAYS)
    return token, expires_at


def hash_reset_token(token: str) -> str:
    """Armazena hash SHA-256 no banco; o token bruto vai apenas no link do e-mail."""
    return hashlib.sha256(token.encode()).hexdigest()


def send_reset_email(to_email: str, reset_link: str):
    subject = "Bolao Copa 2026 - Reset de senha"
    body = (
        "Ola,\n\n"
        "Voce solicitou a redefinicao de senha no Bolao Copa 2026.\n\n"
        f"Link para nova senha (valido por 1 hora):\n\n{reset_link}\n\n"
        "Se nao foi voce, ignore este email.\n\nAbracos,\nBolao Copa 2026\n"
    )

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


ADMIN_PROFILES = {"admin", "superuser"}

def is_admin(user) -> bool:
    return user.profile in ADMIN_PROFILES

def is_superuser(user) -> bool:
    return user.profile == "superuser"

def get_current_user(
    db: Session = Depends(get_db),
    x_user_id: Optional[int] = Header(None, alias="X-User-Id"),
    x_auth_token: Optional[str] = Header(None, alias="X-Auth-Token"),
):
    if x_user_id is None or x_auth_token is None:
        raise HTTPException(status_code=401, detail="Nao autenticado")

    user = db.query(User).filter(
        User.id == x_user_id,
        User.auth_token == x_auth_token,
    ).first()

    if not user:
        raise HTTPException(status_code=401, detail="Sessao invalida")

    # Tokens antigos sem expiracao (NULL) continuam validos para nao quebrar sessoes existentes
    if user.auth_token_expires_at and user.auth_token_expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Sessao expirada. Faca login novamente.")

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
    return datetime.now(timezone.utc) >= get_champion_pick_lock_at(db)


def get_official_champion_team_id(db: Session) -> Optional[int]:
    config = db.query(ChampionConfig).filter(ChampionConfig.id == 1).first()
    if not config:
        return None
    return config.champion_team_id


# -----------------------------------
# Schemas (Pydantic)
# -----------------------------------

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
    home_score_prediction: int = Field(..., ge=0)
    away_score_prediction: int = Field(..., ge=0)


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
    champion_correct: int = 0
    exact_scores: int = 0
    correct_results: int = 0
    winner_goals: int = 0
    loser_goals: int = 0


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
    home_score: int = Field(..., ge=0)
    away_score: int = Field(..., ge=0)


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


class PublicChampionPickOut(BaseModel):
    user_id: int
    user_name: str
    team_id: int
    team_name: str
    team_code: Optional[str]

    class Config(_OrmConfig):
        pass


class ChampionConfigSet(BaseModel):
    team_id: Optional[int] = None


class ChampionConfigOut(BaseModel):
    team_id: Optional[int]
    team_name: Optional[str]

    class Config(_OrmConfig):
        pass


class LeagueCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class LeagueMemberAdd(BaseModel):
    user_id: int


class LeagueMemberOut(BaseModel):
    user_id: int
    user_name: str

    class Config(_OrmConfig):
        pass


class LeagueOut(BaseModel):
    id: int
    name: str
    created_by: int
    members: List[LeagueMemberOut]

    class Config(_OrmConfig):
        pass


# -----------------------------------
# Regras de pontuacao
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


MATCH_LOCK_MINUTES = 30
HIDDEN_FROM_RANKING_PROFILE = "superuser"  # superusers não aparecem no ranking nem nos palpites públicos

def is_match_locked(match: Match) -> bool:
    lock_time = match.kickoff_at_utc - timedelta(minutes=MATCH_LOCK_MINUTES)
    return datetime.now(timezone.utc) >= lock_time


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
    return CHAMPION_BONUS_POINTS if picked_team_id == official_champion_team_id else 0


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
        raise HTTPException(status_code=400, detail="Nome e obrigatorio.")

    _connectors = {"e", "de", "da", "do", "dos", "das", "di", "du"}
    _words = name.split()
    if len(_words) < 2:
        raise HTTPException(status_code=400, detail="Digite nome e sobrenome, ou dois nomes para duplas (ex: Joao e Maria).")
    _real = [w for w in _words if w.lower() not in _connectors]
    if len(_real) < 2:
        raise HTTPException(status_code=400, detail="Digite pelo menos dois nomes distintos.")
    import re as _re
    for _w in _real:
        if _re.match(r'^[A-Z]{2,3}$', _w):
            raise HTTPException(status_code=400, detail="Evite siglas — use apelido + sobrenome (ex: Guga Proto).")
        if len(_w) < 2:
            raise HTTPException(status_code=400, detail="Cada parte do nome deve ter pelo menos 2 letras.")

    if not access_code_value:
        raise HTTPException(status_code=400, detail="Codigo de acesso e obrigatorio.")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Senha muito curta (minimo 8 caracteres).")
    if not any(c.isdigit() for c in password) or not any(c.isalpha() for c in password):
        raise HTTPException(status_code=400, detail="Senha deve conter ao menos uma letra e um numero.")

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email ja registrado")

    access_code = (
        db.query(AccessCode)
        .filter(AccessCode.code == access_code_value)
        .with_for_update()
        .first()
    )

    if not access_code:
        raise HTTPException(status_code=400, detail="Codigo de acesso invalido.")
    if not access_code.is_active:
        raise HTTPException(status_code=400, detail="Codigo de acesso desativado.")
    if not access_code.is_master and access_code.used_at is not None:
        raise HTTPException(status_code=400, detail="Codigo de acesso ja utilizado.")

    try:
        token, expires_at = generate_auth_token_with_expiry()
        user = User(
            name=name,
            email=email,
            password_hash=hash_password(password),
            auth_token=token,
            auth_token_expires_at=expires_at,
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
@limiter.limit("10/minute")
def login_user(request: Request, payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.strip().lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email ou senha invalidos")

    # Reutiliza o token existente se ainda for válido — permite sessões simultâneas
    # em múltiplos dispositivos (desktop + mobile) sem invalidar uns aos outros.
    # Só gera token novo se não houver token ou ele estiver expirado.
    now = datetime.now(timezone.utc)
    token_valido = (
        user.auth_token
        and user.auth_token_expires_at
        and user.auth_token_expires_at > now
    )
    if not token_valido:
        token, expires_at = generate_auth_token_with_expiry()
        user.auth_token = token
        user.auth_token_expires_at = expires_at
        db.commit()
        db.refresh(user)

    return UserAuthOut(
        id=user.id,
        name=user.name,
        email=user.email,
        auth_token=user.auth_token,
        profile=user.profile,
    )


@app.post("/auth/logout")
def logout(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.auth_token = None
    current_user.auth_token_expires_at = None
    db.commit()
    return {"message": "Logout realizado com sucesso."}


@app.post("/auth/request-password-reset")
@limiter.limit("5/minute")
def request_password_reset(request: Request, payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if user:
        raw_token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        # Armazena apenas o hash SHA-256; token bruto vai no link do e-mail
        user.reset_token = hash_reset_token(raw_token)
        user.reset_token_expires_at = expires_at
        db.commit()

        reset_link = f"{FRONTEND_BASE_URL}?token={raw_token}"
        send_reset_email(user.email, reset_link)

    return {"message": "Se este email estiver cadastrado, voce recebera um link para redefinir a senha."}


@app.post("/auth/reset-password")
def reset_password(payload: ResetPasswordPayload, db: Session = Depends(get_db)):
    hashed = hash_reset_token(payload.token)
    user = db.query(User).filter(User.reset_token == hashed).first()
    if not user:
        raise HTTPException(status_code=400, detail="Token invalido")

    if (not user.reset_token_expires_at) or (user.reset_token_expires_at < datetime.now(timezone.utc)):
        raise HTTPException(status_code=400, detail="Token expirado")

    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="Senha muito curta (minimo 8 caracteres).")

    token, expires_at = generate_auth_token_with_expiry()
    user.password_hash = hash_password(payload.new_password)
    user.reset_token = None
    user.reset_token_expires_at = None
    user.auth_token = token
    user.auth_token_expires_at = expires_at
    db.commit()

    return {"message": "Senha redefinida com sucesso. Faca login novamente."}


# -----------------------------------
# Endpoints Matches / Bets / Ranking
# -----------------------------------

@app.get('/matches', response_model=List[MatchOut])
def list_matches(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    matches = (
        db.query(Match)
        .options(joinedload(Match.home_team), joinedload(Match.away_team))
        .order_by(Match.kickoff_at_utc)
        .all()
    )

    user_bets = db.query(Bet).filter(Bet.user_id == current_user.id).all()
    bet_by_match: Dict[int, Bet] = {b.match_id: b for b in user_bets}

    groups: Dict[str, List[Match]] = {}
    for m in matches:
        stage_lower = (m.stage or '').lower()
        if stage_lower.startswith('group') or stage_lower.startswith('grupo'):
            groups.setdefault(m.stage, []).append(m)

    match_round_map: Dict[int, str] = {}
    for _stage, group_matches in groups.items():
        group_matches.sort(key=lambda x: x.kickoff_at_utc)
        for idx, mm in enumerate(group_matches):
            if idx < 2:
                r = '1a rodada'
            elif idx < 4:
                r = '2a rodada'
            else:
                r = '3a rodada'
            match_round_map[mm.id] = r

    def infer_round_for_knockout(m: Match) -> str:
        s = (m.stage or '').lower()
        if '16 avos' in s or '32' in s:
            return '16 avos'
        if 'oitavas' in s or 'round of 16' in s:
            return 'oitavas'
        if 'quartas' in s or 'quarter' in s:
            return 'quartas'
        if 'semi' in s:
            return 'semi'
        if '3o' in s or '3º' in s or 'third' in s:
            return 'finais'
        if 'final' in s:
            return 'finais'
        return '1a rodada'

    result: List[MatchOut] = []
    for m in matches:
        bet = bet_by_match.get(m.id)
        round_label = match_round_map.get(m.id) or infer_round_for_knockout(m)
        result.append(
            MatchOut(
                id=m.id, stage=m.stage, kickoff_at_utc=m.kickoff_at_utc,
                home_team_name=m.home_team.name, home_team_code=m.home_team.fifa_code,
                away_team_name=m.away_team.name, away_team_code=m.away_team.fifa_code,
                home_score=m.home_score, away_score=m.away_score,
                is_locked=is_match_locked(m), round=round_label,
                my_bet=BetInfo(
                    home_score_prediction=bet.home_score_prediction,
                    away_score_prediction=bet.away_score_prediction,
                ) if bet else None,
            )
        )
    return result


@app.get('/teams')
def list_teams(db: Session = Depends(get_db)):
    teams = db.query(Team).filter(Team.id != 49).order_by(Team.name.asc()).all()
    return [{'id': t.id, 'name': t.name, 'fifa_code': t.fifa_code, 'group': t.group} for t in teams]


@app.get('/champion-pick', response_model=ChampionPickOut)
def get_my_champion_pick(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lock_at = get_champion_pick_lock_at(db)
    locked = is_champion_pick_locked(db)
    pick = db.query(ChampionPick).join(Team, Team.id == ChampionPick.team_id).filter(ChampionPick.user_id == current_user.id).first()
    if not pick:
        return ChampionPickOut(user_id=current_user.id, team_id=None, team_name=None, locked=locked, lock_at_utc=lock_at)
    return ChampionPickOut(user_id=current_user.id, team_id=pick.team_id, team_name=pick.team.name, locked=locked, lock_at_utc=lock_at)


@app.post('/champion-pick', response_model=ChampionPickOut)
def upsert_champion_pick(
    payload: ChampionPickCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if is_champion_pick_locked(db):
        raise HTTPException(status_code=403, detail='O prazo para palpitar o campeao ja foi encerrado.')
    team = db.query(Team).filter(Team.id == payload.team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail='Selecao nao encontrada.')
    if team.id == 49:
        raise HTTPException(status_code=400, detail='A selecao A definir nao pode ser escolhida.')
    pick = db.query(ChampionPick).filter(ChampionPick.user_id == current_user.id).first()
    now = datetime.now(timezone.utc)
    if pick is None:
        pick = ChampionPick(user_id=current_user.id, team_id=payload.team_id, created_at=now, updated_at=now)
        db.add(pick)
    else:
        pick.team_id = payload.team_id
        pick.updated_at = now
    db.commit()
    db.refresh(pick)
    return ChampionPickOut(user_id=current_user.id, team_id=pick.team_id, team_name=team.name, locked=False, lock_at_utc=get_champion_pick_lock_at(db))


@app.get("/champion-picks/public", response_model=List[PublicChampionPickOut])
def get_public_champion_picks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not is_champion_pick_locked(db):
        return []
    picks = (
        db.query(ChampionPick)
        .join(User, User.id == ChampionPick.user_id)
        .join(Team, Team.id == ChampionPick.team_id)
        .filter(User.profile != HIDDEN_FROM_RANKING_PROFILE)
        .order_by(User.name.asc())
        .all()
    )
    return [
        PublicChampionPickOut(
            user_id=p.user_id,
            user_name=p.user.name,
            team_id=p.team_id,
            team_name=p.team.name,
            team_code=p.team.fifa_code,
        )
        for p in picks
    ]


@app.post("/bets", response_model=BetOut)
def upsert_bet(bet_in: BetCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    match = db.query(Match).options(joinedload(Match.home_team), joinedload(Match.away_team)).filter(Match.id == bet_in.match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Partida nao encontrada")
    if is_match_locked(match):
        raise HTTPException(status_code=400, detail="Palpites so podem ser alterados ate 30 minutos antes do inicio da partida.")
    bet = db.query(Bet).filter(Bet.user_id == current_user.id, Bet.match_id == bet_in.match_id).first()
    now = datetime.now(timezone.utc)
    if bet is None:
        bet = Bet(user_id=current_user.id, match_id=bet_in.match_id,
            home_score_prediction=bet_in.home_score_prediction, away_score_prediction=bet_in.away_score_prediction,
            created_at=now, updated_at=now)
        db.add(bet)
        db.add(BetHistory(user_id=current_user.id, user_name=current_user.name, match_id=bet_in.match_id,
            home_score_prediction=bet_in.home_score_prediction, away_score_prediction=bet_in.away_score_prediction,
            prev_home_score_prediction=None, prev_away_score_prediction=None, action_type="insert", changed_at_utc=now))
    else:
        prev_home = bet.home_score_prediction
        prev_away = bet.away_score_prediction
        bet.home_score_prediction = bet_in.home_score_prediction
        bet.away_score_prediction = bet_in.away_score_prediction
        bet.updated_at = now
        if prev_home != bet_in.home_score_prediction or prev_away != bet_in.away_score_prediction:
            db.add(BetHistory(user_id=current_user.id, user_name=current_user.name, match_id=bet_in.match_id,
                home_score_prediction=bet_in.home_score_prediction, away_score_prediction=bet_in.away_score_prediction,
                prev_home_score_prediction=prev_home, prev_away_score_prediction=prev_away, action_type="update", changed_at_utc=now))
    db.commit()
    db.refresh(bet)
    return bet


@app.post("/bets/bulk")
def upsert_bets_bulk(payload: BetBulkCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    saved = 0
    errors: List[str] = []
    match_ids = [b.match_id for b in payload.bets]
    matches = db.query(Match).options(joinedload(Match.home_team), joinedload(Match.away_team)).filter(Match.id.in_(match_ids)).all()
    match_by_id: Dict[int, Match] = {m.id: m for m in matches}
    existing_bets = db.query(Bet).filter(Bet.user_id == current_user.id, Bet.match_id.in_(match_ids)).all()
    bet_by_match: Dict[int, Bet] = {b.match_id: b for b in existing_bets}
    for bet_in in payload.bets:
        match = match_by_id.get(bet_in.match_id)
        if not match:
            errors.append(f"Partida {bet_in.match_id} nao encontrada.")
            continue
        if is_match_locked(match):
            errors.append(f"Partida {match.home_team.name} x {match.away_team.name} ja esta bloqueada.")
            continue
        bet = bet_by_match.get(bet_in.match_id)
        if bet is None:
            bet = Bet(user_id=current_user.id, match_id=bet_in.match_id,
                home_score_prediction=bet_in.home_score_prediction, away_score_prediction=bet_in.away_score_prediction,
                created_at=now, updated_at=now)
            db.add(bet)
            db.add(BetHistory(user_id=current_user.id, user_name=current_user.name, match_id=bet_in.match_id,
                home_score_prediction=bet_in.home_score_prediction, away_score_prediction=bet_in.away_score_prediction,
                prev_home_score_prediction=None, prev_away_score_prediction=None, action_type="insert", changed_at_utc=now))
            bet_by_match[bet_in.match_id] = bet
        else:
            prev_home = bet.home_score_prediction
            prev_away = bet.away_score_prediction
            bet.home_score_prediction = bet_in.home_score_prediction
            bet.away_score_prediction = bet_in.away_score_prediction
            bet.updated_at = now
            if prev_home != bet_in.home_score_prediction or prev_away != bet_in.away_score_prediction:
                db.add(BetHistory(user_id=current_user.id, user_name=current_user.name, match_id=bet_in.match_id,
                    home_score_prediction=bet_in.home_score_prediction, away_score_prediction=bet_in.away_score_prediction,
                    prev_home_score_prediction=prev_home, prev_away_score_prediction=prev_away, action_type="update", changed_at_utc=now))
        saved += 1
    db.commit()
    return {"status": "ok" if not errors else "partial", "saved": saved, "errors": errors}


@app.get("/ranking", response_model=List[RankingItem])
def get_ranking(
    limit: int = Query(250, ge=1, le=500),
    offset: int = Query(0, ge=0),
    scope: str = Query("geral", pattern="^(geral|mata_mata)$"),
    db: Session = Depends(get_db),
):
    # Official champion (-1 never matches any real team id)
    official_team_id = get_official_champion_team_id(db) or -1

    # Ranking "mata_mata": considera só jogos fora da fase de grupos e não
    # soma o bônus de campeão.
    stage_filter_sql = "AND m.stage NOT ILIKE '%grupo%'" if scope == "mata_mata" else ""
    if scope == "mata_mata":
        total_points_sql = "COALESCE(mp.pts, 0) AS total_points"
        champion_correct_sql = "0 AS champion_correct"
    else:
        total_points_sql = (
            "COALESCE(mp.pts, 0) + CASE WHEN cp.team_id = :official_team_id THEN 40 ELSE 0 END AS total_points"
        )
        champion_correct_sql = "CASE WHEN cp.team_id = :official_team_id THEN 1 ELSE 0 END AS champion_correct"

    # Single SQL query: CTE aggregates match points + tiebreakers per user
    sql = text(f"""
        WITH match_pts AS (
            SELECT b.user_id,
                   SUM(CASE
                       WHEN b.home_score_prediction = m.home_score
                        AND b.away_score_prediction = m.away_score
                        THEN 18
                       WHEN b.home_score_prediction = b.away_score_prediction
                        AND m.home_score != m.away_score
                        THEN 3
                       WHEN (
                               (b.home_score_prediction > b.away_score_prediction AND m.home_score > m.away_score)
                            OR (b.home_score_prediction < b.away_score_prediction AND m.home_score < m.away_score)
                            OR (b.home_score_prediction = b.away_score_prediction AND m.home_score = m.away_score)
                           )
                        AND (b.home_score_prediction = m.home_score OR b.away_score_prediction = m.away_score)
                        THEN 12
                       WHEN (
                               (b.home_score_prediction > b.away_score_prediction AND m.home_score > m.away_score)
                            OR (b.home_score_prediction < b.away_score_prediction AND m.home_score < m.away_score)
                            OR (b.home_score_prediction = b.away_score_prediction AND m.home_score = m.away_score)
                           )
                        THEN 9
                       WHEN b.home_score_prediction = m.home_score
                         OR b.away_score_prediction = m.away_score
                        THEN 3
                       ELSE 0
                   END) AS pts,
                   -- Critério 2: placares exatos
                   SUM(CASE
                       WHEN b.home_score_prediction = m.home_score
                        AND b.away_score_prediction = m.away_score
                       THEN 1 ELSE 0
                   END) AS exact_scores,
                   -- Critério 3: acerto do resultado (vencedor ou empate)
                   SUM(CASE
                       WHEN (b.home_score_prediction > b.away_score_prediction AND m.home_score > m.away_score)
                         OR (b.home_score_prediction < b.away_score_prediction AND m.home_score < m.away_score)
                         OR (b.home_score_prediction = b.away_score_prediction AND m.home_score = m.away_score)
                       THEN 1 ELSE 0
                   END) AS correct_results,
                   -- Critério 4: gols do vencedor acertados em jogos de 12 pts
                   -- (resultado certo + acertou gols do vencedor + NÃO foi placar exato)
                   SUM(CASE
                       WHEN m.home_score > m.away_score
                        AND b.home_score_prediction > b.away_score_prediction
                        AND b.home_score_prediction = m.home_score
                        AND b.away_score_prediction != m.away_score
                       THEN 1
                       WHEN m.away_score > m.home_score
                        AND b.away_score_prediction > b.home_score_prediction
                        AND b.away_score_prediction = m.away_score
                        AND b.home_score_prediction != m.home_score
                       THEN 1
                       ELSE 0
                   END) AS winner_goals,
                   -- Critério 5: gols do perdedor acertados em jogos de 12 pts
                   -- (resultado certo + acertou gols do perdedor + NÃO foi placar exato)
                   SUM(CASE
                       WHEN m.home_score > m.away_score
                        AND b.home_score_prediction > b.away_score_prediction
                        AND b.away_score_prediction = m.away_score
                        AND b.home_score_prediction != m.home_score
                       THEN 1
                       WHEN m.away_score > m.home_score
                        AND b.away_score_prediction > b.home_score_prediction
                        AND b.home_score_prediction = m.home_score
                        AND b.away_score_prediction != m.away_score
                       THEN 1
                       ELSE 0
                   END) AS loser_goals
            FROM bets b
            JOIN matches m ON m.id = b.match_id
                AND m.home_score IS NOT NULL
                AND m.away_score IS NOT NULL
                {stage_filter_sql}
            GROUP BY b.user_id
        )
        SELECT
            u.id        AS user_id,
            u.name      AS user_name,
            {total_points_sql},
            {champion_correct_sql},
            COALESCE(mp.exact_scores, 0)    AS exact_scores,
            COALESCE(mp.correct_results, 0) AS correct_results,
            COALESCE(mp.winner_goals, 0)    AS winner_goals,
            COALESCE(mp.loser_goals, 0)     AS loser_goals
        FROM users u
        LEFT JOIN match_pts mp ON mp.user_id = u.id
        LEFT JOIN champion_picks cp ON cp.user_id = u.id
        WHERE u.profile != :hidden_profile
        ORDER BY
            total_points DESC,
            champion_correct DESC,
            COALESCE(mp.exact_scores, 0) DESC,
            COALESCE(mp.correct_results, 0) DESC,
            COALESCE(mp.winner_goals, 0) DESC,
            COALESCE(mp.loser_goals, 0) DESC,
            lower(u.name) ASC
        LIMIT :lim OFFSET :off
    """)

    rows = db.execute(sql, {"official_team_id": official_team_id, "lim": limit, "off": offset, "hidden_profile": HIDDEN_FROM_RANKING_PROFILE}).fetchall()
    return [
        RankingItem(
            user_id=row.user_id,
            user_name=row.user_name,
            total_points=row.total_points,
            champion_correct=row.champion_correct,
            exact_scores=row.exact_scores,
            correct_results=row.correct_results,
            winner_goals=row.winner_goals,
            loser_goals=row.loser_goals,
        )
        for row in rows
    ]


@app.get("/bets/public", response_model=List[PublicBetOut])
def list_public_bets(
    match_id: Optional[int] = Query(None),
    user_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lock_cutoff = datetime.now(timezone.utc) + timedelta(minutes=MATCH_LOCK_MINUTES)
    q = (
        db.query(Bet)
        .join(Match, Match.id == Bet.match_id)
        .filter(Match.kickoff_at_utc <= lock_cutoff)
        .join(User, User.id == Bet.user_id)
        .filter(User.profile != HIDDEN_FROM_RANKING_PROFILE)
        .options(joinedload(Bet.user))
    )
    if match_id is not None:
        q = q.filter(Bet.match_id == match_id)
    if user_id is not None:
        q = q.filter(Bet.user_id == user_id)
    return [
        PublicBetOut(match_id=bet.match_id, user_id=bet.user_id, user_name=bet.user.name,
            home_score_prediction=bet.home_score_prediction, away_score_prediction=bet.away_score_prediction)
        for bet in q.all()
    ]


@app.get("/stats/match/{match_id}")
def get_match_stats(
    match_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    match = (
        db.query(Match)
        .options(joinedload(Match.home_team), joinedload(Match.away_team))
        .filter(Match.id == match_id)
        .first()
    )
    if not match:
        raise HTTPException(status_code=404, detail="Partida não encontrada")
    if not is_match_locked(match):
        raise HTTPException(status_code=403, detail="Prazo desta partida ainda não encerrou")

    bets = (
        db.query(Bet)
        .join(User, User.id == Bet.user_id)
        .filter(Bet.match_id == match_id, User.profile != HIDDEN_FROM_RANKING_PROFILE)
        .all()
    )

    total = len(bets)
    score_counts: dict = {}
    for bet in bets:
        key = (bet.home_score_prediction, bet.away_score_prediction)
        score_counts[key] = score_counts.get(key, 0) + 1

    scores_sorted = sorted(score_counts.items(), key=lambda x: -x[1])
    home_win = sum(v for (h, a), v in score_counts.items() if h > a)
    draw     = sum(v for (h, a), v in score_counts.items() if h == a)
    away_win = sum(v for (h, a), v in score_counts.items() if h < a)
    avg_home = sum(h * v for (h, a), v in score_counts.items()) / total if total else 0
    avg_away = sum(a * v for (h, a), v in score_counts.items()) / total if total else 0

    return {
        "match_id": match_id,
        "home_team_name": match.home_team.name,
        "away_team_name": match.away_team.name,
        "home_team_code": match.home_team.fifa_code,
        "away_team_code": match.away_team.fifa_code,
        "official_home_score": match.home_score,
        "official_away_score": match.away_score,
        "kickoff_at_utc": match.kickoff_at_utc.isoformat(),
        "total_bets": total,
        "scores": [
            {"home": h, "away": a, "count": c, "pct": round(c / total * 100, 1) if total else 0}
            for (h, a), c in scores_sorted
        ],
        "home_win_count": home_win,
        "draw_count": draw,
        "away_win_count": away_win,
        "home_win_pct": round(home_win / total * 100, 1) if total else 0,
        "draw_pct": round(draw / total * 100, 1) if total else 0,
        "away_win_pct": round(away_win / total * 100, 1) if total else 0,
        "avg_home_goals": round(avg_home, 2),
        "avg_away_goals": round(avg_away, 2),
    }


@app.post("/matches/results/bulk")
def update_match_results_bulk(payload: MatchResultBulkUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Apenas administradores podem postar resultados oficiais.")
    updated = 0
    errors: List[str] = []
    match_ids = [r.match_id for r in payload.results]
    matches = db.query(Match).filter(Match.id.in_(match_ids)).all()
    match_by_id = {m.id: m for m in matches}
    for item in payload.results:
        match = match_by_id.get(item.match_id)
        if not match:
            errors.append(f"Partida {item.match_id} nao encontrada.")
            continue
        match.home_score = item.home_score
        match.away_score = item.away_score
        updated += 1
    db.commit()
    return {"status": "ok" if not errors else "partial", "updated": updated, "errors": errors}


# -----------------------------------
# Leagues
# -----------------------------------

def send_league_invite_email(to_email: str, to_name: str, league_name: str, creator_name: str):
    subject = f"Bolão Copa 2026 - Você entrou na liga {league_name}"
    body = (
        f"Olá {to_name},\n\n"
        f"{creator_name} te adicionou à liga \"{league_name}\" no Bolão Copa 2026.\n\n"
        f"Acesse o bolão e vá em Ranking para ver a classificação do seu grupo.\n\n"
        f"Abraços,\nBolão Copa 2026\n"
    )
    if not (SMTP_HOST and SMTP_USER and SMTP_PASS and SMTP_FROM):
        print(f"==== CONVITE LIGA (DEV) ==== Para: {to_email} | Liga: {league_name}")
        return
    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM
    msg["To"] = to_email
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
    except Exception as e:
        print(f"Erro ao enviar email de liga: {e}")


def _league_out(league: League) -> dict:
    return {
        "id": league.id,
        "name": league.name,
        "created_by": league.created_by,
        "members": [{"user_id": m.user_id, "user_name": m.user.name} for m in league.members],
    }


@app.get("/users")
def list_users_public(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    users = (
        db.query(User.id, User.name)
        .filter(User.profile != HIDDEN_FROM_RANKING_PROFILE)
        .order_by(User.name.asc())
        .all()
    )
    return [{"id": u.id, "name": u.name} for u in users]


@app.post("/leagues")
def create_league(
    payload: LeagueCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    name = payload.name.strip()
    league = League(name=name, created_by=current_user.id)
    db.add(league)
    db.flush()
    db.add(LeagueMember(league_id=league.id, user_id=current_user.id))
    db.commit()
    db.refresh(league)
    return _league_out(league)


@app.get("/leagues/mine")
def get_my_leagues(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    leagues = (
        db.query(League)
        .join(LeagueMember, (LeagueMember.league_id == League.id) & (LeagueMember.user_id == current_user.id))
        .options(joinedload(League.members).joinedload(LeagueMember.user))
        .order_by(League.created_at.asc())
        .all()
    )
    return [_league_out(l) for l in leagues]


@app.post("/leagues/{league_id}/members")
def add_league_member(
    league_id: int,
    payload: LeagueMemberAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    league = (
        db.query(League)
        .options(joinedload(League.members).joinedload(LeagueMember.user))
        .filter(League.id == league_id)
        .first()
    )
    if not league:
        raise HTTPException(status_code=404, detail="Liga não encontrada.")
    if league.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Apenas o criador pode adicionar membros.")

    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    already = any(m.user_id == payload.user_id for m in league.members)
    if already:
        raise HTTPException(status_code=400, detail="Usuário já é membro desta liga.")

    db.add(LeagueMember(league_id=league_id, user_id=payload.user_id))
    db.commit()

    send_league_invite_email(user.email, user.name, league.name, current_user.name)

    db.refresh(league)
    return _league_out(league)


@app.delete("/leagues/{league_id}/members/me")
def leave_league(
    league_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="Liga não encontrada.")

    member = db.query(LeagueMember).filter(
        LeagueMember.league_id == league_id,
        LeagueMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Você não é membro desta liga.")

    db.delete(member)

    if league.created_by == current_user.id:
        next_member = db.query(LeagueMember).filter(
            LeagueMember.league_id == league_id,
            LeagueMember.user_id != current_user.id,
        ).first()
        if next_member:
            league.created_by = next_member.user_id
        else:
            db.delete(league)

    db.commit()
    return {"message": "Você saiu da liga."}


@app.delete("/leagues/{league_id}")
def delete_league(
    league_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="Liga não encontrada.")
    if league.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Apenas o criador pode excluir a liga.")
    db.delete(league)
    db.commit()
    return {"message": "Liga excluída."}


# -----------------------------------
# Admin
# -----------------------------------

@app.get("/admin/bet-history", response_model=List[BetHistoryOut])
def list_bet_history(
    user_id: int = Query(..., ge=1),
    match_id: Optional[int] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not is_superuser(current_user):
        raise HTTPException(status_code=403, detail="Apenas superusers podem ver o historico")
    q = (
        db.query(BetHistory)
        .options(joinedload(BetHistory.match).joinedload(Match.home_team), joinedload(BetHistory.match).joinedload(Match.away_team))
        .filter(BetHistory.user_id == user_id)
        .order_by(BetHistory.changed_at_utc.desc())
    )
    if match_id is not None:
        q = q.filter(BetHistory.match_id == match_id)
    rows = q.offset(offset).limit(limit).all()
    result: List[BetHistoryOut] = []
    for h in rows:
        m = h.match
        result.append(BetHistoryOut(
            id=h.id, user_id=h.user_id, user_name=h.user_name, match_id=h.match_id,
            match_stage=m.stage if m else None,
            kickoff_at_utc=m.kickoff_at_utc if m else None,
            home_team_name=m.home_team.name if m and m.home_team else None,
            away_team_name=m.away_team.name if m and m.away_team else None,
            home_score_prediction=h.home_score_prediction, away_score_prediction=h.away_score_prediction,
            prev_home_score_prediction=h.prev_home_score_prediction, prev_away_score_prediction=h.prev_away_score_prediction,
            action_type=h.action_type, changed_at_utc=h.changed_at_utc,
        ))
    return result


@app.get("/admin/users")
def list_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Apenas admins")
    users = db.query(User.id, User.name).order_by(User.name.asc()).all()
    return [{"id": u.id, "name": u.name} for u in users]


class BetOverridePayload(BaseModel):
    secondary_password: str
    user_id: int
    match_id: int
    home_score_prediction: int = Field(..., ge=0)
    away_score_prediction: int = Field(..., ge=0)


@app.post("/admin/bet-override")
@limiter.limit("5/minute")
def admin_bet_override(
    request: Request,
    payload: BetOverridePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not is_superuser(current_user):
        raise HTTPException(status_code=403, detail="Acesso negado.")

    override_pw = os.getenv("ADMIN_OVERRIDE_PW", "")
    if not override_pw or not secrets.compare_digest(
        payload.secondary_password.encode(), override_pw.encode()
    ):
        raise HTTPException(status_code=401, detail="Senha incorreta.")

    target_user = db.query(User).filter(User.id == payload.user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    match = db.query(Match).filter(Match.id == payload.match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Partida não encontrada.")

    now = datetime.now(timezone.utc)
    bet = db.query(Bet).filter(
        Bet.user_id == payload.user_id,
        Bet.match_id == payload.match_id,
    ).first()

    if bet is None:
        bet = Bet(
            user_id=payload.user_id,
            match_id=payload.match_id,
            home_score_prediction=payload.home_score_prediction,
            away_score_prediction=payload.away_score_prediction,
            created_at=now,
            updated_at=now,
        )
        db.add(bet)
        db.add(BetHistory(
            user_id=payload.user_id,
            user_name=target_user.name,
            match_id=payload.match_id,
            home_score_prediction=payload.home_score_prediction,
            away_score_prediction=payload.away_score_prediction,
            prev_home_score_prediction=None,
            prev_away_score_prediction=None,
            action_type="insert",
            changed_at_utc=now,
        ))
    else:
        prev_home = bet.home_score_prediction
        prev_away = bet.away_score_prediction
        bet.home_score_prediction = payload.home_score_prediction
        bet.away_score_prediction = payload.away_score_prediction
        bet.updated_at = now
        db.add(BetHistory(
            user_id=payload.user_id,
            user_name=target_user.name,
            match_id=payload.match_id,
            home_score_prediction=payload.home_score_prediction,
            away_score_prediction=payload.away_score_prediction,
            prev_home_score_prediction=prev_home,
            prev_away_score_prediction=prev_away,
            action_type="update",
            changed_at_utc=now,
        ))

    db.commit()
    db.refresh(bet)
    return {"status": "ok", "bet_id": bet.id, "user_name": target_user.name}


@app.get("/admin/matches")
def list_matches_admin(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Apenas admins")
    matches = db.query(Match).options(joinedload(Match.home_team), joinedload(Match.away_team)).order_by(Match.kickoff_at_utc).all()
    return [{"id": m.id, "label": f"{m.home_team.name} x {m.away_team.name}", "stage": m.stage, "kickoff_at_utc": m.kickoff_at_utc} for m in matches]


@app.get("/admin/champion-config", response_model=ChampionConfigOut)
def get_champion_config(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Apenas admins")
    config = db.query(ChampionConfig).options(joinedload(ChampionConfig.champion_team)).filter(ChampionConfig.id == 1).first()
    if not config or not config.champion_team_id:
        return ChampionConfigOut(team_id=None, team_name=None)
    return ChampionConfigOut(team_id=config.champion_team_id, team_name=config.champion_team.name if config.champion_team else None)


@app.post("/admin/champion-config", response_model=ChampionConfigOut)
def set_champion_config(payload: ChampionConfigSet, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Apenas admins")
    team_name = None
    if payload.team_id is not None:
        team = db.query(Team).filter(Team.id == payload.team_id).first()
        if not team:
            raise HTTPException(status_code=404, detail="Selecao nao encontrada.")
        if team.id == 49:
            raise HTTPException(status_code=400, detail="A selecao A definir nao pode ser campea.")
        team_name = team.name
    config = db.query(ChampionConfig).filter(ChampionConfig.id == 1).first()
    now = datetime.now(timezone.utc)
    if config is None:
        db.add(ChampionConfig(id=1, champion_team_id=payload.team_id, updated_at=now))
    else:
        config.champion_team_id = payload.team_id
        config.updated_at = now
    db.commit()
    return ChampionConfigOut(team_id=payload.team_id, team_name=team_name)
