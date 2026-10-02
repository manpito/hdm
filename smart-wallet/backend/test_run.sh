export JWT_SECRET=testsecret
node index.js > server.log 2>&1 &
PID=$!
sleep 2
cat server.log
kill $PID
