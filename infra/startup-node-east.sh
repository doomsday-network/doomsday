#!/bin/bash
set -e

echo "=== Initializing Doomsday Node East ==="
export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y python3 python3-pip python3-venv git curl

if ! id -u doomsday >/dev/null 2>&1; then
    useradd -m -s /bin/bash doomsday
fi

cd /home/doomsday
if [ ! -d "doomsday" ]; then
    git clone https://github.com/doomsday-network/doomsday.git
fi
cd doomsday
git pull origin main

python3 -m venv venv
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt

chown -R doomsday:doomsday /home/doomsday

cat << 'EOF' > /etc/systemd/system/doomsday-node.service
[Unit]
Description=Doomsday Sovereign Full Validating Node (East Coast)
After=network.target

[Service]
Type=simple
User=doomsday
WorkingDirectory=/home/doomsday/doomsday
ExecStart=/home/doomsday/doomsday/venv/bin/python3 -m node.server --host 0.0.0.0 --web-port 8334 --peer doomsday.network:8334
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable doomsday-node.service
systemctl restart doomsday-node.service

echo "=== Doomsday Node East successfully started and enabled! ==="
