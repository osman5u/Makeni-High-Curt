$token = (Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -ContentType "application/json" -Body '{"username":"admin","password":"admin123"}').access




Invoke-RestMethod -Uri "http://localhost:3000/api/setup/create-first-admin" -Method POST -ContentType "application/json" -Body '{"username":"admin","email":"admin@example.com","password":"Makeni@123","full_name":"osman sesay"}'