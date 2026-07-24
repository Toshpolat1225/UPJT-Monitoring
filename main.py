from fastapi import FastAPI

app = FastAPI(
    title="UPJT Monitoring API",
    description="API for monitoring system at UPJT.",
    version="0.1.0"
)

@app.get("/", tags=["Root"])
async def read_root():
    return {"message": "Welcome to UPJT Monitoring API"}