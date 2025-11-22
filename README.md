# Mountebank Docker Setup

A simple Docker-based Mountebank mock server with three interconnected services (A, B, C) demonstrating API orchestration patterns.

## ⚠️ Important Note

**DO NOT RUN `start.sh` DIRECTLY!**  
The `start.sh` script is automatically executed **inside the Docker container**.  
Always use the Docker commands provided below.

---

## Quick Start

### Check if Container is Running

```bash
docker ps --filter name=mountebank-test
```

If the container is running, follow steps 1-2. If not, proceed to step 3.

---

## Step-by-Step Process

### Step 1: Stop and Remove Existing Containers

```bash
docker rm -f mountebank-test
```

### Step 2: (Optional) Remove Old Image for Clean Rebuild

```bash
docker rmi mountebank-abctest
```

### Step 3: Build Fresh Image

```bash
docker build -t mountebank-abctest .
```

### Step 4: Run Container

```bash
docker run --rm -d -p 2525:2525 -p 3001:3001 -p 3002:3002 -p 3003:3003 --name mountebank-test mountebank-abctest
```

### Step 5: Wait and Test

```bash
Start-Sleep -Seconds 5
curl http://localhost:3001/api/a
```

### Step 6: Visit Mountebank Admin UI

Open your browser to: [http://localhost:2525](http://localhost:2525)

---

## Quick One-Liner (All Steps)

```bash
docker rm -f mountebank-test; docker build -t mountebank-abctest .; docker run --rm -d -p 2525:2525 -p 3001:3001 -p 3002:3002 -p 3003:3003 --name mountebank-test mountebank-abctest; Start-Sleep -Seconds 5; curl http://localhost:3001/api/a
```

---

## Test Endpoints

### Individual Services

| Service | Endpoint | Description |
|---------|----------|-------------|
| Service B (Success) | `curl http://localhost:3002/api/b` | Returns `{"service":"B","status":"B_PASSED"}` |
| Service B (Failure) | `curl -H "X-Fail-B: true" http://localhost:3002/api/b` | Returns `{"service":"B","status":"B_FAILED"}` with 500 error |
| Service C | `curl http://localhost:3003/api/c` | Returns `{"service":"C","status":"C_CALLED"}` |

### Orchestrated Service

| Service | Endpoint | Description |
|---------|----------|-------------|
| Service A (Success) | `curl http://localhost:3001/api/a` | Orchestrator - calls B (pass) → C → returns combined results |
| Service A (Failure) | `curl -H "X-Fail-B: true" http://localhost:3001/api/a` | Orchestrator - calls B (fail) → skips C → returns error |

### Test Success Flow (B passes, C is called)

```bash
curl http://localhost:3001/api/a
```

### Expected Response from Service A (Success)

```json
{
  "from": "A",
  "message": "A called B then C successfully",
  "bResult": {
    "service": "B",
    "status": "B_PASSED"
  },
  "cResult": {
    "service": "C",
    "status": "C_CALLED"
  }
}
```

### Test Failure Flow (Force B to fail, C is NOT called)

```bash
curl -H "X-Fail-B: true" http://localhost:3001/api/a
```

### Expected Response from Service A (Failure)

```json
{
  "from": "A",
  "error": "B_FAILED",
  "message": "Service B did not pass, cannot proceed to C",
  "bResult": {
    "service": "B",
    "status": "B_FAILED",
    "message": "Service B failed due to X-Fail-B header"
  }
}
```

**Note:** When Service B fails, Service C is never called, demonstrating conditional orchestration.

---

## Useful Commands

### View Container Logs

```bash
# View all logs
docker logs mountebank-test

# Follow logs in real-time
docker logs -f mountebank-test
```

### Stop Container

```bash
docker stop mountebank-test
```

### Check if Container is Running

```bash
docker ps
```

### Get Formatted JSON Response

```powershell
(curl http://localhost:3001/api/a).Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

---

## Port Mapping

| Port | Service | Description |
|------|---------|-------------|
| 2525 | Mountebank Admin UI | Web interface for managing imposters |
| 3001 | Service A | Main orchestrator service |
| 3002 | Service B | Mock service B |
| 3003 | Service C | Mock service C |

---

## Architecture

### Success Flow (Default)

```
Client Request
     ↓
Service A (3001)
     ↓
     ├──→ Service B (3002) → Returns "B_PASSED" ✓
     │         ↓
     └──→ Service C (3003) → Returns "C_CALLED" ✓
           ↓
     Combined Response (200 OK)
```

### Failure Flow (With X-Fail-B Header)

```
Client Request + X-Fail-B Header
     ↓
Service A (3001)
     ↓
     └──→ Service B (3002) → Returns "B_FAILED" ✗
           ↓
     Error Response (500)
     Service C is NOT called
```

### Flow Description

**Success Scenario:**
1. Client calls **Service A** at `/api/a`
2. Service A calls **Service B** at `/api/b`
3. If Service B returns `"B_PASSED"`, Service A then calls **Service C** at `/api/c`
4. Service A combines results from B and C and returns to client

**Failure Scenario:**
1. Client calls **Service A** at `/api/a` with `X-Fail-B: true` header
2. Service A forwards the header and calls **Service B** at `/api/b`
3. Service B detects the header and returns `"B_FAILED"` with 500 status
4. Service A **skips calling Service C** and returns error with B's response

---

## Project Structure

```
Test01/
├── Dockerfile          # Docker container configuration
├── imposters.js        # Mountebank imposters configuration with inject functions
├── start.sh           # Container startup script (runs inside Docker)
├── README.md          # This file
```

---

## How It Works

1. **Dockerfile** builds the container with Mountebank and your configuration
2. **start.sh** automatically runs inside the container to:
   - Start Mountebank server
   - Load imposters from `imposters.js`
   - Keep the container running
3. **imposters.js** defines three mock services with custom logic using JavaScript inject functions

---

## Troubleshooting

### Container Exits Immediately

```bash
# Check logs for errors
docker logs mountebank-test

# Run in foreground to see output
docker run --rm -p 2525:2525 -p 3001:3001 -p 3002:3002 -p 3003:3003 mountebank-abctest
```

### Port Already in Use

```bash
# Check what's using the port
netstat -ano | findstr :2525

# Stop any conflicting containers
docker ps
docker stop <container_id>
```

### Imposters Not Loading

Check logs for status messages:

```bash
docker logs mountebank-test | Select-String "loaded"
```

You should see:
- `Loaded: service-B-mock`
- `Loaded: service-C-mock`
- `Loaded: service-A-mock`
- `All imposters loaded!`

---

## Development

To modify the mock services:

1. Edit `imposters.js`
2. Rebuild the container: `docker build -t mountebank-abctest .`
3. Restart: `docker rm -f mountebank-test && docker run ...`

---

## Resources

- [Mountebank Official Documentation](http://www.mbtest.org/)
- [Mountebank GitHub](https://github.com/bbyars/mountebank)
- [Docker Documentation](https://docs.docker.com/)

---

## License

This is a workshop/testing project. Modify as needed for your use case.
