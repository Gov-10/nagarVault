from fastapi import FastAPI, Request, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.sql import text
from database import Users, sessionLocal, RefreshToken
from fastapi.responses import Response, JSONResponse
import os, uuid, jwt, logging
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
load_dotenv()
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

ph = PasswordHasher()

class CreateSchema(BaseModel):
    name: str
    username: str
    user_id: str
    password: str
    role: str

class LoginSchema(BaseModel):
    username: str
    user_id: str
    password: str

def get_db():
    db = sessionLocal()
    try:
        yield db
    finally:
        db.close()

app = FastAPI()

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

def get_current_user(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("session_token")
    if not token:
        raise HTTPException(status_code=401, detail="not authenticated")
    try:
        payl = jwt.decode(
            token,
            os.getenv("JWT_SECRET"),
            algorithms=["HS256"],
            issuer="nagar-auth",
            audience="nagar-services",
            options={"require": ["iss", "aud", "jti"]},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="session token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="invalid session token")
    username = payl.get("username")
    user = db.query(Users).filter(Users.username == username).first()
    if not user:
        raise HTTPException(status_code=401, detail="user not found")
    return user

def require_admin(current_user: Users = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="admin access required")
    return current_user

@app.get("/")
def chek():
    return {"status": "Running"}

@app.get("/dbcheck")
def dbchek(db: Session = Depends(get_db)):
    db_status = "up"
    try:
        db.execute(text('SELECT 1'))
    except Exception:
        db_status = "down"
    return {"db_status": db_status}

@app.post("/create")
def createUser(
    payload: CreateSchema,
    db: Session = Depends(get_db),
    _admin: Users = Depends(require_admin),
):
    name, username, user_id, password, role = (
        payload.name, payload.username, payload.user_id, payload.password, payload.role
    )
    db_note = Users(name=name, user_id=user_id, role=role, password=ph.hash(password), username=username)
    db.add(db_note)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="database error")
    db.refresh(db_note)
    return {"message": "proceed to login"}

@app.post("/login")
@limiter.limit("5/minute")
def logi(request: Request, payload: LoginSchema, response: Response, db: Session = Depends(get_db)):
    username, password = payload.username, payload.password
    user = db.query(Users).filter(
        Users.username == username,
        Users.user_id == payload.user_id,
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="no user found")
    passw = user.password
    try:
        ph.verify(passw, password)
    except VerifyMismatchError:
        raise HTTPException(status_code=401, detail="passwords do not match")

    jti_value = uuid.uuid4().hex
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=3600)

    pay = {
        "iss": "nagar-auth",
        "aud": "nagar-services",
        "jti": jti_value,
        "username": username,
        "user_id": payload.user_id,
        "role": user.role,  # always read from DB — never from request body
        "exp": expires_at,
    }
    token = jwt.encode(pay, os.getenv("JWT_SECRET"), algorithm="HS256")

    # Record the token server-side for revocation support
    db.add(RefreshToken(
        jti=jti_value,
        user_id=payload.user_id,
        issued_at=now,
        expires_at=expires_at,
    ))
    db.commit()

    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=3600,
    )
    return {"message": "Logged in"}

@app.get("/logout")
def logo(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get("session_token")
    if not token:
        raise HTTPException(status_code=401, detail="you are not logged in")
    # Invalidate the token server-side even if it is expired
    try:
        payl = jwt.decode(
            token,
            os.getenv("JWT_SECRET"),
            algorithms=["HS256"],
            options={"verify_exp": False, "verify_aud": False},
        )
        jti = payl.get("jti")
        if jti:
            record = db.query(RefreshToken).filter(RefreshToken.jti == jti).first()
            if record:
                record.revoked = True
                db.commit()
    except jwt.InvalidTokenError:
        pass
    response.delete_cookie("session_token")
    return {"message": "Logged out"}

@app.get("/profile")
def get_profile(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get("session_token")
    if not token:
        raise HTTPException(status_code=401, detail="not signed in")
    try:
        payl = jwt.decode(
            token,
            os.getenv("JWT_SECRET"),
            algorithms=["HS256"],
            issuer="nagar-auth",
            audience="nagar-services",
            options={"require": ["iss", "aud", "jti"]},
        )
    except jwt.ExpiredSignatureError:
        response.delete_cookie("session_token")
        raise HTTPException(status_code=401, detail="session token expired, log in again")
    except jwt.InvalidTokenError:
        response.delete_cookie("session_token")
        raise HTTPException(status_code=401, detail="invalid session token")

    jti = payl.get("jti")
    if jti:
        record = db.query(RefreshToken).filter(RefreshToken.jti == jti).first()
        if record and record.revoked:
            response.delete_cookie("session_token")
            raise HTTPException(status_code=401, detail="session has been revoked")

    username, user_id, role = payl.get("username"), payl.get("user_id"), payl.get("role")
    user = db.query(Users).filter(
        Users.username == username,
        Users.user_id == user_id,
        Users.role == role,
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="user not found")
    return {"name": user.name, "username": user.username, "role": user.role, "created_at": user.created_at}
