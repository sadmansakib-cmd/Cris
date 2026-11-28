import urllib.request
import json
import sys

TOKEN = "cris_auth_key_sec2026"
BASE = "http://127.0.0.1:8000"

def post(endpoint, data):
    req = urllib.request.Request(
        f"{BASE}{endpoint}",
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json", "X-Cris-Token": TOKEN}
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))

print("=== 1. Assign Task ===")
r1 = post("/api/chat", {"message": "Cris, assign a new task: Full-body Workout, level 3, 2026-11-28"})
print("Response:", r1)

print("\n=== 2. Open Sidebar ===")
r2 = post("/api/chat", {"message": "Cris, open sidebar and go to quest app"})
print("Response:", r2)

print("\n=== 3. Task Done ===")
r3 = post("/api/chat", {"message": "Cris, task Full-body Workout complete hoye gese"})
print("Response:", r3)

print("\n=== 4. Download Picture ===")
r4 = post("/api/chat", {"message": "Cris, go to google and download a picture of Iron Man Arc Reactor"})
print("Response:", r4)

print("\n=== 5. File Delete (Gate Check) ===")
r5 = post("/api/chat", {"message": "Cris, go to file manager and delete file test.txt"})
print("Response:", r5)

print("\n=== 6. Approve File Deletion ===")
r6 = post("/api/chat", {"message": "yes"})
print("Response:", r6)
