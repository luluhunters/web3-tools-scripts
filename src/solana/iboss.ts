import {
  PublicKey,
  Connection,
  Keypair,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import fs from "fs";
import { closeAccount, createTransferInstruction } from "@solana/spl-token";
import bs58 from "bs58";
import { logger } from "../../util/logger";

function splitByDelimiter(str: string, delimiter: string): string[] {
  return str.split(delimiter);
}

// rpc
const rpc = "https://api.mainnet-beta.solana.com";

//存放json钱包目录
const dir = "./acc.txt";

//收钱地址(所有代币都将归集到此地址)
const addr = "CUNo3omJLJhXNGqiJy69ggK5kVWmFaFdJhBKXdgMmkm";

//代币合约地址
const token_address = "CnKqniq2e9xxE5v2k293YvBYv1v6DHAnJTpUSj9AXAUU";

const send = async () => {
  const conn = new Connection(rpc, { commitment: "confirmed" });

  const toAccount = new PublicKey(addr);
  const tokenAddress = new PublicKey(token_address);
  const toTokenAccounts = await conn.getTokenAccountsByOwner(toAccount, {
    mint: tokenAddress,
  });

  const file = fs.readFileSync(dir, "utf8");
  const lines = file.split("\n");
  let num = 0;
  for (const element of lines) {
    num++;
    logger.info(`-------------------------Num ${num}-------------------------`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const splitResult = splitByDelimiter(element, "----");
    logger.info(`pubKey:${splitResult[0]}`);
    logger.info(`privateKey:${splitResult[1]}`);
    const privateKey = bs58.decode(splitResult[1]);
    const keypair = Keypair.fromSecretKey(privateKey);
    const balance = await conn.getBalance(keypair.publicKey, "confirmed");
    logger.info(`balance:${balance}`);

    const tokenAddress = new PublicKey(token_address);
    const tokenAccounts = await conn.getTokenAccountsByOwner(
      keypair.publicKey,
      {
        mint: tokenAddress,
      }
    );
    for (const item of tokenAccounts.value) {
      logger.info("Token account address: ", item.pubkey);

      // 获取代币余额精度参数
      let tokenAmount = await conn.getTokenAccountBalance(item.pubkey);
      logger.info(
        `amount: ${parseInt(tokenAmount.value.amount)} | decimals: ${
          tokenAmount.value.decimals
        }`
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // 判断代币余额并开始归集
      if (parseInt(tokenAmount.value.amount) > 0) {
        let transaction = new Transaction();
        transaction.add(
          createTransferInstruction(
            item.pubkey, //付款人 token account
            toTokenAccounts.value[0].pubkey, //收款人 token account
            keypair.publicKey, //付款人钱包公钥
            parseInt(tokenAmount.value.amount) //数量
          )
        );
        // 发送交易
        await sendAndConfirmTransaction(conn, transaction, [keypair]);
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // 关闭token account
      {
        let txHash = await closeAccount(
          conn, // connection
          keypair, // payer
          item.pubkey, // token account which you want to close
          keypair.publicKey, // destination
          keypair // owner of token account
        );
        logger.info(`closeAccountTxHash: ${txHash}`);
      }
    }
    // 归集 sol
    if (balance > 0) {
      const recentBlockhash = await conn.getLatestBlockhash();
      let transaction = new Transaction({
        feePayer: keypair.publicKey,
        blockhash: recentBlockhash.blockhash,
        lastValidBlockHeight: 296,
      });
      // 计算交易费
      const fees = (await transaction.getEstimatedFee(conn)) || 0;

      // 添加交易
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: toAccount,
          lamports: balance - fees,
        })
      );
      // 发送交易
      await sendAndConfirmTransaction(conn, transaction, [keypair]);
    }
    logger.info(`-------------------------End ${num}-------------------------`);
  }
};
send();
