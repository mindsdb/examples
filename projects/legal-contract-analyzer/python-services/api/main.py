"""
FastAPI Main Application
REST API for Legal Contract Analysis Platform
"""

# Load environment variables FIRST before any other imports
from api.integrations_routes import router as integrations_router, set_manager as set_integrations_manager
from api.agent_routes import router as agent_router, set_manager as set_agent_manager
from api.upload_routes import router as upload_router, set_manager as set_upload_manager
from api.kb_routes import router as kb_router, set_manager as set_kb_manager
from api.agent_actions.email_action import router as email_action_router, set_manager as set_email_action_manager
from mindsdb_manager import MindsDBManager
import sys
import logging
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI
from dotenv import load_dotenv
import os
import logging

# Configure logging early
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Load .env file - try current directory first, then parent directory
env_paths = [
    os.path.join(os.path.dirname(__file__), '..',
                 '.env'),  # In Docker container
    os.path.join(os.path.dirname(__file__), '..',
                 '..', '.env')  # Local development
]

for env_path in env_paths:
    if os.path.exists(env_path):
        load_dotenv(env_path)
        logger = logging.getLogger(__name__)
        logger.info(f"Loaded environment from: {env_path}")
        break

# Add parent directory to Python path for imports
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Legal Contract Analysis API",
    description="AI-powered contract analysis using MindsDB Knowledge Bases",
    version="1.0.0"
)

# Include integration routes
app.include_router(integrations_router)
# Include AI agent routes
app.include_router(agent_router)
# Include file upload routes
app.include_router(upload_router)
# Include KB management routes
app.include_router(kb_router)
# Include email action routes
app.include_router(email_action_router)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000",
                   os.getenv("NEXT_PUBLIC_APP_URL", "")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure upload directory exists
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Initialize managers
mindsdb_manager = MindsDBManager()


# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize MindsDB connection and create resources"""
    try:
        logger.info("Starting Legal Contract Analysis API...")

        # Initialize MindsDB
        await mindsdb_manager.initialize()

        # Set manager for all route modules
        set_integrations_manager(mindsdb_manager)
        set_agent_manager(mindsdb_manager)
        set_upload_manager(mindsdb_manager)
        set_kb_manager(mindsdb_manager)
        set_email_action_manager(mindsdb_manager)

        logger.info("✅ API startup completed successfully")
        logger.info(
            f"📊 Knowledge Base: {'Active' if mindsdb_manager.knowledge_base else 'Not initialized'}")
        logger.info(
            f"🤖 AI Agent: {'Active' if mindsdb_manager.agent else 'Not initialized'}")
    except Exception as e:
        logger.error(f"❌ Startup failed: {str(e)}")


@app.get("/")
async def root():
    """Root endpoint with system status"""
    try:
        # Check KB manager status
        kb_status = None
        if mindsdb_manager.kb_manager:
            kb_status = mindsdb_manager.kb_manager.get_kb_status()

        return {
            "message": "Legal Contract Analysis API",
            "version": "1.0.0",
            "status": "operational",
            "docs": "/docs",
            "system_status": {
                "mindsdb_connected": bool(mindsdb_manager.server),
                "knowledge_base": "active" if mindsdb_manager.knowledge_base else "not_initialized",
                "agent": "active" if mindsdb_manager.agent else "not_initialized",
                "kb_manager": "active" if mindsdb_manager.kb_manager else "not_initialized",
                "kb_last_sync": kb_status.get('last_sync') if kb_status else None,
                "kb_sources_count": kb_status.get('current_sources_found', 0) if kb_status else 0
            }
        }
    except Exception as e:
        logger.error(f"Error getting system status: {e}")
        return {
            "message": "Legal Contract Analysis API",
            "version": "1.0.0",
            "status": "operational",
            "docs": "/docs",
            "system_status": {"error": str(e)}
        }


@app.get("/health")
async def health_check():
    """Health check endpoint for Docker containers"""
    return {"status": "healthy", "service": "legal-contract-analyzer-api"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
