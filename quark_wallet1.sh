WALLET_PATH=./wallets/wallet1 yarn cli mint-dft quark --satsbyte 102
msg=$(tail -n 8 atomicaljs.txt)
msg=`echo ${msg//\"/\'}`

curl 'https://oapi.dingtalk.com/robot/send?access_token=1e98b1f7fca7a8d62472aa60d5cf8cfc900d24ac7bd5fd066f9709f14cca8a33' -H 'Content-Type: application/json' -d"{\"msgtype\":\"text\",\"text\":{\"content\":\"info 夸克钱包1 $msg\"},\"at\":{\"isAtAll\":true}}"