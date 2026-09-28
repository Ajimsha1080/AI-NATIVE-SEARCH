#!/usr/bin/env bash
set -e

echo "=========================================================="
echo "  SHOPMATE AI - AMAZON EC2 AUTOMATED HOSTING SETUP SCRIPT"
echo "=========================================================="

# 1. Update OS Packages
echo "--> Updating Ubuntu system packages..."
sudo apt-get update -y && sudo apt-get upgrade -y

# 2. Install Essentials & Build Tools
echo "--> Installing curl, git, ufw, nginx, certbot..."
sudo apt-get install -y curl git ufw nginx certbot python3-certbot-nginx build-essential

# 3. Install Node.js 20 LTS (NodeSource)
echo "--> Installing Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 4. Install Global NPM Tools (PM2)
echo "--> Installing PM2 globally..."
sudo npm install -g pm2

# 5. Configure Firewall (UFW)
echo "--> Configuring UFW Firewall (SSH, HTTP, HTTPS)..."
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# 6. Install Project Dependencies & Build
echo "--> Installing application dependencies..."
npm install --production=false

echo "--> Building production Next.js application..."
npm run build

# 7. Start App with PM2 Cluster Mode
echo "--> Starting application via PM2..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u $USER --hp $HOME | sudo bash || true

# 8. Setup Nginx Configuration
echo "--> Configuring Nginx reverse proxy..."
sudo cp deploy/nginx.conf /etc/nginx/sites-available/aaas-ecommerce
sudo ln -sf /etc/nginx/sites-available/aaas-ecommerce /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

echo "=========================================================="
echo "  SETUP COMPLETE!"
echo "  Application running on http://127.0.0.1:3000 via PM2"
echo "  Nginx listening on Port 80"
echo "  To attach free SSL certificate:"
echo "    sudo certbot --nginx -d yourdomain.com"
echo "=========================================================="
