from fastapi import FastAPI, Request, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.sql import text
from database import Users, sessionLocal
from fastapi.responses import Response
import os, json, jwt, logging, time
from datetime import datetime, timedelta
from dotenv import load_dotenv
load_dotenv()
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
ph = PasswordHasher()
def get_db():
    db=sessionLocal()
    try:
        yield db
    finally:
        db.close()

app = FastAPI()
@app.get("/")
def chek():
    return {"status": "Running"}

@app.get("/dbcheck")
def dbchek(db:Session=Depends(get_db)):
    db_status = "up"
    try:
        db.execute(text('SELECT 1'))
    except Exception as e:
        db_status = "down"
    return {"db_status": db_status}

@app.post("/create")
def createUser(payload: CreateSchema, db:Session=Depends(get_db)):
    name, username, user_id, password, role = payload.name,payload.username,  payload.user_id, payload.password, payload.role
    db_note = Users(name=name, user_id=user_id, role=role, password=ph.hash(password), username=username)
    db.add(db_note)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="database error")
    db.refresh(db_note)
    return {"message": "proceed to login"}

@app.post("/login")
def logi(payload: LoginSchema, response: Response, db:Session=Depends(get_db)):
    username, password, role = payload.username, payload.password, payload.role
    user = db.query(Users).filter(Users.username == username, Users.role==role, Users.user_id==payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="no user found")
    passw = user.password
    try:
        ph.verify(passw, password)
        pay = {"iss": "nagar-auth", "username": username, "user_id": payload.user_id, "role": role, "exp": datetime.utcnow()+timedelta(days=7)}
        token = jwt.encode(pay, os.getenv("JWT_SECRET"), algorithm="HS256")
        response.set_cookie(key="session_token", value=token, httponly=True, secure=True, samesite="lax", max_age=604800)
        return {"message": "Logged in"}
    except VerifyMismatchError:
        raise HTTPException(status_code=401, detail="passwords do not match")

@app.get("/logout")
def logo(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if not token:
        raise HTTPException(status_code=401, detail="you are not logged in")
    response.delete_cookie("session_token")
    return {"message": "Logged out"}

@app.get("/profile")
def get_profile(request: Request,response: Response,  db:Session=Depends(get_db)):
    token = request.cookies.get("session_token")
    if not token:
        raise HTTPException(status_code=401, detail="not signed in")
    payl = jwt.decode(token, os.getenv("JWT_SECRET"), algorithms=["HS256"])
    exp = payl.get("exp")
    if time.time() > exp:
        response.delete_cookie("session_token")
        raise HTTPException(status_code=401, detail="session token expired, log in again")
    username, user_id, role = payl.get("username"), payl.get("user_id"), payl.get("role")
    user = db.query(Users).filter(Users.username==username, Users.user_id==user_id, Users.role==role).first()
    if not user:
        raise HTTPException(status_code=404, detail="user not found")
    return {"name": user.name, "username": user.username, "role": user.role, "created_at": user.created_at}


