# ใช้ official mountebank image
FROM bbyars/mountebank:latest

# ตั้ง working directory ใน container
WORKDIR /mb

# copy imposters.js และ start script จากเครื่องคุณเข้า container
COPY imposters.js /mb/imposters.js
COPY start.sh /mb/start.sh

# เปิดพอร์ตที่เราจะใช้
EXPOSE 2525 3001 3002 3003

# รัน mountebank พร้อม config ของเรา
# Override the entrypoint and use shell to run our script
ENTRYPOINT ["/bin/sh"]
CMD ["/mb/start.sh"]
