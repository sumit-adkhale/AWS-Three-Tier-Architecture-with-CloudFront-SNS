#!/bin/bash
# APP TIER Launch Template user data (Amazon Linux 2023, private app subnets, no internet needed).
exec > /var/log/user-data.log 2>&1
set -ex
export AWS_DEFAULT_REGION=ap-south-1
BUCKET=YOUR_CODE_BUCKET

dnf install -y nodejs npm
mkdir -p /opt/app-tier
aws s3 cp s3://$BUCKET/app-tier.tar.gz /tmp/app-tier.tar.gz
tar -xzf /tmp/app-tier.tar.gz -C /opt/app-tier

cat > /opt/app-tier/.env <<ENV
PORT=4000
AWS_REGION=ap-south-1
DB_HOST=YOUR_RDS_ENDPOINT
DB_USER=admin
DB_PASSWORD=YOUR_DB_PASSWORD
DB_NAME=shop
JWT_SECRET=YOUR_LONG_RANDOM_STRING
CART_TABLE=shop-carts
EVENTS_TABLE=shop-events
ENV
chown -R ec2-user:ec2-user /opt/app-tier

cat > /etc/systemd/system/app-tier.service <<UNIT
[Unit]
Description=Shop app tier (Node.js)
After=network.target
[Service]
User=ec2-user
WorkingDirectory=/opt/app-tier
ExecStart=/usr/bin/node index.js
Restart=always
[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now app-tier
