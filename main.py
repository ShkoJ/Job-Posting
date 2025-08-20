import requests
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta

# ========================
# Mock Data (simulating your Excel sheet/Microsoft List)
# ========================
mock_jobs_data = [
    {
        'id': i,
        'title': f'Job Title {i}',
        'arabic_job_title': f'عنوان الوظيفة {i}',
        'description': f'Description for Job {i}.',
        'location': 'Erbil',
        'company': f'Company {i}',
        'status': 'active' if i <= 15 else 'archived',
        'posted': 'No',
        'scheduled_time': None
    } for i in range(1, 26)
]

# In-memory store for scheduled posts
scheduled_posts = []

# ========================
# FastAPI app + Routes
# ========================
app = FastAPI()

# CORS middleware to allow requests from the front-end
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic model for job data
class Job(BaseModel):
    id: int
    title: str
    arabic_job_title: str
    description: str
    location: str
    company: str
    status: str
    posted: str
    scheduled_time: Optional[str]

# Helper function to find a job by ID
def get_job_by_id(job_id: int):
    for job in mock_jobs_data:
        if job['id'] == job_id:
            return job
    return None

def get_next_available_slot():
    """Finds the next available one-hour slot, checking for gaps in the schedule."""
    now = datetime.now()
    next_hour_slot = now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    
    # Sort the scheduled jobs to ensure we check in chronological order
    scheduled_posts.sort(key=lambda x: x['scheduled_time'])
    
    # Iterate through scheduled jobs to find the first available gap
    for job in scheduled_posts:
        job_time = datetime.fromisoformat(job['scheduled_time'])
        if job_time >= next_hour_slot:
            # If there's a gap of one hour or more, we found our slot
            if job_time - next_hour_slot >= timedelta(hours=1):
                return next_hour_slot
            # Otherwise, move to the next hour and continue checking
            next_hour_slot = job_time + timedelta(hours=1)

    # If no gap is found, schedule the job after the last one in the queue
    return next_hour_slot


# REST API route to list jobs with pagination, filtering, and sorting
@app.get("/jobs", response_model=List[Job])
def list_jobs(
    status: str = "active",
    skip: int = 0,
    limit: int = 10,
    order: str = "asc", 
    search: Optional[str] = None
):
    """List jobs with pagination, filtering, and sorting."""
    filtered = [job for job in mock_jobs_data if job['status'] == status]
    
    # Apply search filter if a query is provided
    if search:
        filtered = [job for job in filtered if search.lower() in job['company'].lower()]

    # Sort the filtered list by ID to create a queue (first-in, first-out)
    filtered.sort(key=lambda x: x['id'], reverse=(order == "desc"))
        
    return filtered[skip : skip + limit]

# REST API route to get total job count
@app.get("/jobs/count")
def get_job_count(
    status: str = "active",
    search: Optional[str] = None
):
    """Get the total count of jobs for a given status."""
    filtered = [job for job in mock_jobs_data if job['status'] == status]
    if search:
        filtered = [job for job in filtered if search.lower() in job['company'].lower()]
    
    count = len(filtered)
    return {"total": count}

# REST API route to post a job to Telegram
@app.post("/jobs/{job_id}/post_and_schedule")
def post_and_schedule_job(job_id: int):
    """Formats, schedules, and posts a job to a Telegram channel."""
    job = get_job_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Mark the job as posted and update the status
    job['posted'] = 'Yes'
    job['status'] = 'archived'

    # Get the next available time slot and add the job to the queue
    scheduled_time = get_next_available_slot()
    job['scheduled_time'] = scheduled_time.isoformat()
    scheduled_posts.append(job)

    # Sort the queue by scheduled time
    scheduled_posts.sort(key=lambda x: x['scheduled_time'])

    # The actual API key and Chat ID should come from environment variables
    # NEVER hardcode them in production code.
    TELEGRAM_BOT_TOKEN = "8443927282:AAGJJMxgSBF93C_kSPSpvNJxtqD9sbcNewA"
    TELEGRAM_CHAT_ID = "@LastTestTestTest"
    
    # Generate hashtags
    location_tag = job['location'].replace(' ', '')
    hashtags = f"\n\n\u200f#\u200f{location_tag} #\u200fHiring #\u200fVacancy #\u200fJobsIn{location_tag}"

    # Construct the multi-lingual template string with RTL marks
    message_text = (
        f"\u200fهەلی کار بۆ ئێوە لە شاری {job['location']}!\n\n"
        f"{job['company']} پێویستی بە کارمەند هەیە بۆ {job['title']} بۆ ئەوەی ببێت بە بەشێک لە تیمەکە.\n"
        f"📍{job['location']}\n"
        f"بۆ پێشکەشکردن و زانیاری زیاتر تکایە سەردانی ماڵپەری JOBS KRD بکەن\n\n"
        "____\n\n"
        f"{job['company']} is looking for a {job['title']} to join the team\n"
        f"📍{job['location']}\n"
        "Interested candidates can register and apply through JOBS KRD website\n\n"
        "____\n\n"
        f"\u200f{job['company']} تبحث عن موظفة لمنصب {job['arabic_job_title']} للانضمام إلى الفريق.\n"
        f"📍{job['location']}\n"
        "يمكن للمرشحات المهتمات التسجيل والتقديم من خلال موقع JOBS KR" +
        hashtags
    )

    telegram_api_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    
    try:
        # In a real-world scenario, you would not post immediately,
        # but would use a task scheduler to post at the scheduled time.
        # For this mock, we will just return the scheduled time.
        return {"message": f"Job scheduled for Telegram at {scheduled_time.strftime('%Y-%m-%d %H:%M')}", "scheduled_time": scheduled_time.isoformat()}
    
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to post to Telegram: {e}")

# New endpoint to update the 'posted' status
@app.post("/jobs/{job_id}/mark_as_posted")
def mark_job_as_posted(job_id: int):
    """Updates the 'posted' and 'status' of a job."""
    job = get_job_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job['posted'] = 'Yes'
    job['status'] = 'archived'
    return {"message": f"Job {job_id} marked as 'Posted' and 'Archived'."}

# NEW ENDPOINT: Get a list of all scheduled jobs
@app.get("/scheduled-jobs")
def get_scheduled_jobs():
    return scheduled_posts

# NEW ENDPOINT: Delete a job from the scheduled queue
@app.delete("/scheduled-jobs/{job_id}")
def delete_scheduled_job(job_id: int):
    global scheduled_posts
    job_to_remove = None
    for job in scheduled_posts:
        if job['id'] == job_id:
            job_to_remove = job
            break
    
    if not job_to_remove:
        raise HTTPException(status_code=404, detail="Job not found in scheduled queue.")
    
    # Remove job from scheduled queue
    scheduled_posts.remove(job_to_remove)
    
    # Return job to main active list
    job_to_remove['status'] = 'active'
    job_to_remove['posted'] = 'No'
    job_to_remove['scheduled_time'] = None

    return {"message": f"Job {job_id} removed from queue and returned to active list."}

# NEW ENDPOINT: Simulate sending a daily email report
@app.post("/trigger-daily-report")
def trigger_daily_report():
    if not scheduled_posts:
        return {"message": "No jobs have been posted today to report on."}
    
    report_message = "Daily Job Posting Report:\n\n"
    for job in scheduled_posts:
        report_message += f"- Job: '{job['title']}' for '{job['company']}' was posted at {job['scheduled_time']}\n"
    
    return {"message": "Daily report email simulated successfully.", "report": report_message}