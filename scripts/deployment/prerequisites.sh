set -eu
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y --no-install-recommends ca-certificates curl xz-utils python3-venv python3-dev build-essential libpq-dev postgresql-14 postgresql-client-14 nginx tesseract-ocr tesseract-ocr-chi-sim tesseract-ocr-eng
install -d -m 0755 /opt/table-purifier /opt/table-purifier/toolchain
if ! id tablepurifier >/dev/null 2>&1; then useradd --system --user-group --home-dir /opt/table-purifier --shell /usr/sbin/nologin tablepurifier; fi
install -d -m 0700 /root/cfg/table-purifier
if [ ! -x /opt/table-purifier/toolchain/node-v24.22.2-linux-x64/bin/node ]; then
 install -d -m 0755 /opt/table-purifier/toolchain/downloads
 cd /opt/table-purifier/toolchain/downloads
 curl --fail --location --retry 3 --connect-timeout 20 --max-time 240 -o SHASUMS256.txt https://nodejs.org/dist/v24.22.2/SHASUMS256.txt
 curl --fail --location --retry 3 --connect-timeout 20 --max-time 240 -o node-v24.22.2-linux-x64.tar.xz https://nodejs.org/dist/v24.22.2/node-v24.22.2-linux-x64.tar.xz
 awk '$2=="node-v24.22.2-linux-x64.tar.xz"' SHASUMS256.txt > node.sha256
 test -s node.sha256
 sha256sum -c node.sha256
 tar -xJf node-v24.22.2-linux-x64.tar.xz -C /opt/table-purifier/toolchain
fi
/opt/table-purifier/toolchain/node-v24.22.2-linux-x64/bin/node --version
tesseract --version | head -n 1
echo PREREQUISITES_READY
