# WEB3 TOOLS SCRIPTS

web3 工具脚本，如有 bug 和优化，欢迎提交 PR。

## Installation

自行配置 node 环境。

执行`npm install -g ts-node`安装 ts-node。

执行`npm install`安装依赖。

## Usage

下列为每个脚本的说明，请自行查看。
如果脚本运行报错，重新执行运行命令即可。

### SOLANA

solana network scripts

---
### ./src/solana/collect.ts

此脚本为归集 `spl-token` 脚本，将 solana 账户中的 `spl-token` 批量归集到主账户。

并关闭 `token account`，退还开通 `token account`时所花费的 sol。

所有 gas 都由主账户支付，不需要分发 gas 到需要归集的钱包。

出现错误一般都是 rpc 的问题，可以重试几遍。

需要 rpc 可以联系我 coolkhz@outlook.com

需配置参数：

1. `rpc`: sol 链的 rpc，默认主网 rpc，需要可自行替换。
2. `dir`: 需要归集的账户路径，此路径为文件夹，需要的私钥文件为 key.json,数据格式为`Uint8Array`。
3. `addr`: 主账户公钥地址，所有代币都将归集到此地址。
4. `token_address`: 需要归集的 `spl-token` 代币合约地址。
5. `masterPrivateKeyFile`: 主账户私钥文件，数据格式为`Uint8Array`。

运行命令：`ts-node ./src/solana/collect.ts`运行脚本。

---
### ./src/solana/iboss.ts

因 iboss 项目导出的文件格式不统一，故此脚本单独出来。

此脚本为归集 `iboss` 脚本，将 solana 账户中的 `iboss` 批量归集到主账户。

并关闭 `token account`，退还开通 `token account`时所花费的 sol。


需配置参数：

1. `rpc`: sol 链的 rpc，默认主网 rpc，需要可自行替换。
2. `dir`: 需要归集的账户文件，此路径为文件。
3. `addr`: 主账户公钥地址，所有代币都将归集到此地址。
4. `token_address`: 需要归集的 `spl-token` 代币合约地址。

运行命令：`ts-node ./src/solana/iboss.ts`运行脚本。


### TON

ton network scripts