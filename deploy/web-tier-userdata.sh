#!/bin/bash
# WEB TIER Launch Template user data (Amazon Linux 2023, public subnets with public IPs).
exec > /var/log/user-data.log 2>&1
set -ex
export AWS_DEFAULT_REGION=ap-south-1
BUCKET=YOUR_CODE_BUCKET
INTERNAL_ALB=YOUR_INTERNAL_ALB_DNS_NAME      # e.g. internal-shop-app-alb-123.ap-south-1.elb.amazonaws.com

dnf install -y nginx
aws s3 cp s3://$BUCKET/web-tier/nginx.conf /etc/nginx/nginx.conf
sed -i "s/INTERNAL_ALB_DNS/$INTERNAL_ALB/" /etc/nginx/nginx.conf
nginx -t
systemctl enable --now nginx
