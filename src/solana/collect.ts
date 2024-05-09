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
import { logger } from "../../util/logger";

// rpc
const rpc = "";
//存放json钱包目录
const dir = "/Users/user1/keys/";

//收钱地址(所有代币都将归集到此地址)
const addr = "CUNo3omJLJhXNGqiJy69ggK5kVWmFaFdJhBKXdgMmkm";

//代币合约地址
const token_address = "CnKqniq2e9xxE5v2k293YvBYv1v6DHAnJTpUSj9AXAUU";

const send = async () => {
  const conn = new Connection(rpc, { commitment: "confirmed" });
  const keyFileNames = fs.readdirSync(dir, {});

  const toAccount = new PublicKey(addr);
  const tokenAddress = new PublicKey(token_address);
  const toTokenAccounts = await conn.getTokenAccountsByOwner(toAccount, {
    mint: tokenAddress,
  });

  let num = 0;

  for (const keyFileName of keyFileNames) {
    num ++;
    logger.info(`-------------------------Num ${num}-------------------------`);
    logger.info("当前钱包文件：",keyFileName);
    if (keyFileName.indexOf(".json") < 0) {
      continue;
    }
    const content = fs.readFileSync(dir + keyFileName, "utf8");
    const privateKey = Uint8Array.from(JSON.parse(content));

    let keypair = Keypair.fromSecretKey(privateKey);
    let balance = await conn.getBalance(keypair.publicKey, "confirmed");
    logger.info(keypair.publicKey.toString(), "sol:", balance);

    const tokenAccounts = await conn.getTokenAccountsByOwner(
      keypair.publicKey,
      {
        mint: tokenAddress,
      }
    );

    logger.info("Token account address info: ", tokenAccounts.value);

    for (const item of tokenAccounts.value) {
      logger.info("Token account address: ", item.pubkey);
      let tokenAmount = await conn.getTokenAccountBalance(item.pubkey);
      logger.info(`amount: ${parseInt(tokenAmount.value.amount)}`);
      logger.info(`decimals: ${tokenAmount.value.decimals}`);

      logger.info(keypair.publicKey.toString(), "代币余额:", balance);
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
        await sendAndConfirmTransaction(conn, transaction, [keypair]);

        {
          let txhash = await closeAccount(
            conn, // connection
            keypair, // payer
            item.pubkey, // token account which you want to close
            keypair.publicKey, // destination
            keypair // owner of token account
          );
          logger.info(`txhash: ${txhash}`);
        }
      }
    }
    if (balance > 0) {
      const recentBlockhash = await conn.getLatestBlockhash();
      let transaction = new Transaction({
        feePayer: keypair.publicKey,
        blockhash: recentBlockhash.blockhash,
        lastValidBlockHeight: 296,
      });
      const fees = (await transaction.getEstimatedFee(conn)) || 0;
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: toAccount,
          lamports: balance - fees,
        })
      );
      await sendAndConfirmTransaction(conn, transaction, [keypair]);
    }
    logger.info(`-------------------------End ${num}-------------------------`);
  }
};
send();