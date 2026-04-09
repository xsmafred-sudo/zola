# Security Deployment Guide

This guide provides comprehensive instructions for deploying the Zola authentication system with all security features enabled.

## Prerequisites

### Required Services

1. **PostgreSQL Database** (Supabase-hosted or self-hosted)
   - Version: 14+ with support for JSONB, INET types
   - Requirements: Row Level Security (RLS) support

2. **Redis Server**
   - Version: 6+ (or compatible alternative)
   - Use: Session management, rate limiting, account lockout caching
   - Persistence: Recommended for production deployments

3. **Application Environment**
   - Node.js: 18+
   - Next.js: 16+ (with App Router)
   - Operating System: Linux, macOS, or Windows with appropriate runtime

### Required Environment Variables

```bash
# Database (Supabase)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE=your-service-role-key

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-redis-password (optional)

# Security
ENCRYPTION_KEY=base64-encoded-32-byte-key
CSRF_SECRET=your-csrf-secret

# OAuth Providers
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# AI Providers (Optional)
OPENAI_API_KEY=your-openai-key
MISTRAL_API_KEY=your-mistral-key
# ... other provider keys
```

## Deployment Steps

### 1. Database Setup

#### Apply Security Migrations

```bash
# Navigate to project directory
cd /path/to/zola

# Apply migrations in order
# 1. Admin user setup (existing migration)
supabase migration apply --files=20260406000001_set_admin_user.sql

# 2. Create audit log table
supabase migration apply --files=20260406000002_create_auth_audit_log.sql

# 3. Add security tracking to users
supabase migration apply --files=20260406000003_add_security_tracking_to_users.sql

# 4. Create password history and security settings
supabase migration apply --files=20260406000004_create_password_history_and_security_settings.sql
```

#### Verify Database Setup

```bash
# Connect to your database
psql $DATABASE_URL

# Check tables exist
\dt

# Verify auth_audit_log table
\d+ auth_audit_log

# Verify users table has security columns
\d+ users

# Verify RLS policies are enabled
SELECT
  schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('auth_audit_log', 'password_history', 'user_security_settings', 'user_devices');
```

### 2. Redis Setup

#### Installation

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

**macOS (Homebrew):**
```bash
brew install redis
brew services start redis
```

**Docker:**
```bash
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

#### Configuration

Edit `/etc/redis/redis.conf`:
```conf
# Security settings
requirepass your-strong-password
bind 127.0.0.1
port 6379

# Persistence settings
save 900 1
save 300 10
save 60 10000

# Memory management
maxmemory 256mb
maxmemory-policy allkeys-lru

# Logging
loglevel notice
logfile /var/log/redis/redis.log
```

#### Test Redis Connection
```bash
# Test basic connectivity
redis-cli -a your-password PING

# Test from application
redis-cli -a your-password -h 127.0.0.1 -p 6379 INFO server
```

### 3. Application Configuration

#### Environment File Setup

```bash
# Create production environment file
cp .env.example .env.production

# Edit with production values
nano .env.production
```

**Critical Security Settings:**
```bash
# Encryption key (32 bytes, base64 encoded)
# Generate with: node -e "console.log(crypto.randomBytes(32).toString('base64'))"
ENCRYPTION_KEY=your-generated-encryption-key

# CSRF secret (minimum 32 characters)
CSRF_SECRET=your-random-csrf-secret

# Redis connection
REDIS_URL=redis://:your-password@localhost:6379
```

#### Build Application

```bash
# Install dependencies
npm ci

# Build for production
npm run build

# Test production build locally
npm start
```

### 4. Security Configuration

#### Rate Limiting Configuration

Verify `lib/config.ts` contains appropriate rate limits:
```typescript
rateLimiting: {
  login: { points: 5, duration: 900, blockDuration: 1800 },      // 5 attempts per 15 minutes
  signup: { points: 3, duration: 3600, blockDuration: 3600 },   // 3 attempts per hour
  passwordReset: { points: 3, duration: 3600, blockDuration: 3600 },
  oauth: { points: 10, duration: 3600, blockDuration: 1800 }
}
```

#### Account Lockout Configuration

Verify lockout thresholds in `lib/config.ts`:
```typescript
lockout: {
  thresholds: [
    { attempts: 3, duration: 300 },    // 3 attempts: 5 min lockout
    { attempts: 5, duration: 900 },    // 5 attempts: 15 min lockout
    { attempts: 7, duration: 3600 },   // 7 attempts: 1 hour lockout
    { attempts: 10, duration: 86400 }   // 10 attempts: 24 hour lockout
  ]
}
```

#### Password Policy Configuration

Verify password requirements:
```typescript
password: {
  minLength: 8,                    // Minimum 8 characters
  requireUppercase: true,           // Require at least one uppercase
  requireLowercase: true,           // Require at least one lowercase
  requireNumbers: true,              // Require at least one number
  requireSpecialChars: true,         // Require at least one special character
  rejectCommonPasswords: true         // Reject common/weak passwords
}
```

#### Session Configuration

Verify session security settings:
```typescript
session: {
  timeout: 1800,                  // 30 minutes default timeout
  warningThreshold: 300,            // 5 minutes before timeout warning
  rememberMeTimeout: 604800        // 7 days for "remember me"
}
```

### 5. Production Deployment

#### Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard
# - ENCRYPTION_KEY
# - CSRF_SECRET
# - REDIS_URL (use Upstash or similar)
# - All database and OAuth variables
```

#### Docker Deployment

```dockerfile
# Use official Node.js image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Build application
RUN npm run build

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start application
CMD ["npm", "start"]
```

```bash
# Build and run Docker container
docker build -t zola-security:latest .
docker run -d -p 3000:3000 --name zola \
  -e ENCRYPTION_KEY=your-key \
  -e CSRF_SECRET=your-secret \
  -e REDIS_URL=redis://redis:6379 \
  -e DATABASE_URL=your-database-url \
  zola-security:latest
```

#### Docker Compose Deployment

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - CSRF_SECRET=${CSRF_SECRET}
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

```bash
# Deploy with Docker Compose
docker-compose up -d
```

## Security Hardening

### 1. HTTPS Enforcement

**Nginx Configuration:**
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Redirect HTTP to HTTPS
    if ($scheme != "https") {
        return 301 https://$host$request_uri;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}
```

### 2. Firewall Configuration

**UFW (Ubuntu):**
```bash
# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow application port (if needed)
sudo ufw allow 3000/tcp

# Enable firewall
sudo ufw enable
sudo ufw status
```

**Security Groups (AWS/VPC):**
```json
{
  "InboundRules": [
    {
      "Protocol": "TCP",
      "FromPort": 80,
      "ToPort": 80,
      "Source": "0.0.0.0/0"
    },
    {
      "Protocol": "TCP",
      "FromPort": 443,
      "ToPort": 443,
      "Source": "0.0.0.0/0"
    }
  ]
}
```

### 3. Redis Security

**Authentication and Network:**
```conf
# Require authentication
requirepass your-strong-password

# Bind to localhost only
bind 127.0.0.1

# Disable dangerous commands
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command KEYS ""

# Use TLS for external connections (if needed)
tls-port 6380
tls-cert-file /path/to/redis.crt
tls-key-file /path/to/redis.key
tls-ca-cert-file /path/to/ca.crt
```

### 4. Database Security

**PostgreSQL Security Settings:**
```sql
-- Enable SSL connections
ALTER SYSTEM SET ssl = on;

-- Require strong passwords
ALTER SYSTEM SET password_encryption = 'scram-sha-256';

-- Limit connection attempts
ALTER SYSTEM SET authentication_timeout = 60;

-- Enable connection logging
ALTER SYSTEM SET log_connections = on;
```

## Monitoring and Logging

### 1. Application Logs

**Configure Logging:**
```bash
# Set log level
export LOG_LEVEL=info

# Enable security logs
export SECURITY_LOGS_ENABLED=true

# Log file location
export LOG_FILE=/var/log/zola/security.log
```

### 2. Database Monitoring

**Audit Log Queries:**
```sql
-- Recent failed login attempts
SELECT
  event_type,
  email,
  ip_address,
  timestamp,
  metadata
FROM auth_audit_log
WHERE event_type = 'login_failure'
  AND timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;

-- Account lockouts in last 24 hours
SELECT
  email,
  COUNT(*) as lockout_count,
  MAX(timestamp) as last_lockout
FROM auth_audit_log
WHERE event_type = 'account_lockout'
  AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY email
ORDER BY lockout_count DESC;

-- Successful logins by user
SELECT
  user_id,
  COUNT(*) as login_count,
  MIN(timestamp) as first_login,
  MAX(timestamp) as last_login
FROM auth_audit_log
WHERE event_type = 'login_success'
  AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY user_id
ORDER BY login_count DESC;
```

### 3. Redis Monitoring

**Monitor Rate Limiting:**
```bash
# Check rate limit keys
redis-cli -a your-password --scan --pattern 'ratelimit:*'

# Monitor lockout keys
redis-cli -a your-password --scan --pattern 'lockout:*'

# Check key expiration
redis-cli -a your-password TTL "ratelimit:login:user@example.com"
```

### 4. Security Alerts

**Setup Monitoring Dashboard:**
- Configure alerts for:
  - More than 5 failed login attempts per hour per IP
  - More than 10 failed login attempts per hour per user
  - Sudden increase in password reset requests
  - OAuth failures from new geographic locations
  - Database connection errors

**Alert Integration:**
- Send alerts to Slack, Discord, or email
- Include relevant context (IP, user agent, timestamp)
- Rate limit alerts to prevent notification spam

## Backup and Recovery

### 1. Database Backups

**Automated Backups:**
```bash
# Daily database backups
0 2 * * * pg_dump $DATABASE_URL | gzip > /backups/zola-$(date +\%Y\%m\%d).sql.gz

# Keep 30 days of backups
find /backups/ -name "zola-*.sql.gz" -mtime +30 -delete
```

### 2. Redis Backups

**Persistence Configuration:**
```bash
# Enable AOF persistence
redis-cli CONFIG SET appendonly yes
redis-cli CONFIG SET appendfsync everysec

# Create backup
cp /var/lib/redis/appendonly.aof /backups/redis-$(date +\%Y\%m\%d).aof
```

### 3. Disaster Recovery

**Restore Procedure:**
1. Stop application services
2. Restore database from backup
3. Restart Redis with persisted data
4. Verify RLS policies are intact
5. Run security audit to detect any compromises
6. Monitor for suspicious activity post-restoration

## Post-Deployment Checklist

### Security Verification

- [ ] All environment variables are set and secure
- [ ] Database migrations applied successfully
- [ ] Redis connection is working
- [ ] HTTPS is enforced
- [ ] Security headers are configured
- [ ] Rate limiting is active
- [ ] Account lockout is working
- [ ] Password policy is enforced
- [ ] CSRF protection is enabled
- [ ] OAuth security is configured
- [ ] Audit logging is recording events
- [ ] Session timeout is enforced

### Testing Verification

- [ ] Test successful login with valid credentials
- [ ] Test failed login triggers rate limiting
- [ ] Test failed login triggers account lockout
- [ ] Test password reset flow
- [ ] Test OAuth login (Google/GitHub)
- [ ] Test CSRF token validation
- [ ] Test session timeout and expiration
- [ ] Test audit log entries are created
- [ ] Test security monitoring dashboard
- [ ] Test backup and restore procedures

### Documentation Verification

- [ ] Security documentation is complete
- [ ] Deployment guides are documented
- [ ] Incident response procedures are documented
- [ ] Monitoring setup instructions are complete
- [ ] Team has been trained on security features

## Maintenance

### Regular Tasks

**Daily:**
- Review security logs for anomalies
- Monitor failed login attempts
- Check system performance

**Weekly:**
- Review audit logs for patterns
- Update security policies if needed
- Test backup and restore procedures

**Monthly:**
- Review and update security configurations
- Analyze security trends and metrics
- Update dependencies for security patches
- Conduct security training for team

**Quarterly:**
- Conduct full security audit
- Update incident response procedures
- Review and test disaster recovery
- Update security documentation

## Troubleshooting

### Common Issues

**Redis Connection Issues:**
```bash
# Check Redis is running
redis-cli PING

# Check Redis logs
tail -f /var/log/redis/redis.log

# Test connection from application
redis-cli -a your-password -h localhost -p 6379 INFO
```

**Database Performance Issues:**
```sql
-- Check slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check table sizes
SELECT
  schemaname, tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Security Configuration Issues:**
```bash
# Verify environment variables
env | grep -E 'ENCRYPTION_KEY|CSRF_SECRET|REDIS_URL'

# Test encryption key
node -e "const crypto = require('crypto'); console.log(crypto.createDecipheriv('aes-256-cbc', Buffer.from('$ENCRYPTION_KEY', 'base64'), Buffer.alloc(16)).update('test').toString('hex'));"

# Check rate limiting is working
redis-cli --scan --pattern 'ratelimit:*'
```

## Support and Resources

### Security Incident Response

If a security incident is detected:
1. Immediately lock down affected accounts
2. Review audit logs for full timeline
3. Identify scope of potential compromise
4. Notify relevant stakeholders
5. Implement temporary mitigations
6. Conduct forensic analysis
7. Update security procedures
8. Document lessons learned

### Additional Resources

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/security)
- [Next.js Security](https://nextjs.org/docs/app/building-your-application/security)
- [Redis Security](https://redis.io/topics/security)

## Conclusion

Following this deployment guide will ensure that the Zola authentication system is deployed with comprehensive security features including rate limiting, account lockout, password policies, OAuth security, CSRF protection, audit logging, and session management. Regular monitoring and maintenance will ensure continued security effectiveness.