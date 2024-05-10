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
import { sleep } from "../../util/util";

// rpc
const rpc = "https://api.mainnet-beta.solana.com";
//存放json钱包目录
const dir = "/Users/user1/keys/";

//收钱地址(所有代币都将归集到此地址)
const addr = "CUNo3omJLJhXNGqiJy69ggK5kVWmFaFdJhBKXdgMmkm";

//代币合约地址
const token_address = "CnKqniq2e9xxE5v2k293YvBYv1v6DHAnJTpUSj9AXAUU";

// 读取主账号私钥文件
const masterPrivateKeyFile = "/Users/user1/keys/1.json";

const send = async () => {
  const conn = new Connection(rpc, { commitment: "confirmed" });

  // 加载主账号
  const masterPrivateKeyContent = fs.readFileSync(masterPrivateKeyFile, "utf8");
  const masterPrivateKey = Uint8Array.from(JSON.parse(masterPrivateKeyContent));
  const masterKeypair = Keypair.fromSecretKey(masterPrivateKey); // 创建主账号密钥对
  logger.info(`主账号:${masterKeypair.publicKey.toBase58()}`); // 打印账号

  const keyFileNames = fs.readdirSync(dir, {});

  const toAccount = new PublicKey(addr);
  const tokenAddress = new PublicKey(token_address);
  const toTokenAccounts = await conn.getTokenAccountsByOwner(toAccount, {
    mint: tokenAddress,
  });

  let num = 0;

  for (const keyFileName of keyFileNames) {
    num++;
    logger.info(`-------------------------Num ${num}-------------------------`);
    logger.info("当前钱包文件：", keyFileName);
    if (keyFileName.indexOf(".json") < 0) {
      continue;
    }
    const content = fs.readFileSync(dir + keyFileName, "utf8");
    const privateKey = Uint8Array.from(JSON.parse(content));

    let keypair = Keypair.fromSecretKey(privateKey);
    let balance = await conn.getBalance(keypair.publicKey, "confirmed");
    // 打印账户信息
    logger.info("子钱包账号: ", keypair.publicKey.toString());
    logger.info("子钱包账号 sol 余额: ", balance);

    const tokenAccounts = await conn.getTokenAccountsByOwner(
      keypair.publicKey,
      {
        mint: tokenAddress,
      }
    );

    for (const item of tokenAccounts.value) {
      logger.info("Token account address: ", item.pubkey);
      let tokenAmount = await conn.getTokenAccountBalance(item.pubkey);
      logger.info(`代币余额: ${parseInt(tokenAmount.value.amount)}`);
      logger.info(`精度: ${tokenAmount.value.decimals}`);

      if (parseInt(tokenAmount.value.amount) > 0) {
        let transaction = new Transaction();

        transaction.feePayer = masterKeypair.publicKey; // 指定费用支付者为主账号公钥
        const recentBlockhash = await conn.getLatestBlockhash();
        transaction.recentBlockhash = recentBlockhash.blockhash;

        transaction.add(
          createTransferInstruction(
            item.pubkey,
            toTokenAccounts.value[0].pubkey,
            keypair.publicKey,
            parseInt(tokenAmount.value.amount) //数量
          )
        );
        logger.info(`正在转账代币`);
        let attempt = 0;
        let success = false;

        while (!success && attempt < 20) {
          try {
            await sendAndConfirmTransaction(conn, transaction, [
              keypair,
              masterKeypair,
            ]);
            success = true;
          } catch (error) {
            attempt++;
            await sleep(1000); // 1秒延迟
            logger.info(`第 ${attempt} 次提交失败: ${error}`);
          }
        }
        if (success) {
          logger.info(`交易提交成功`);
          logger.info(`正常进入关闭token`);

          {
            let txhash = "";
            let attempt = 0;
            let success = false;

            while (!success && attempt < 10) {
              try {
                txhash = await closeAccount(
                  conn,
                  masterKeypair,
                  item.pubkey,
                  keypair.publicKey,
                  keypair
                );
                success = true;
              } catch (error) {
                attempt++;
                console.log(`第 ${attempt} 次关闭token失败: ${error}`);
              }
            }

            if (success) {
              console.log(`关闭tokens: ${txhash}`);
            } else {
              console.log(`关闭token失败达到最大次数，放弃此次交易`);
            }
          }
        } else {
          logger.info(`提交失败达到最大次数，放弃此次交易`);
        }
      }
    }

    let attempts = 0; // 初始化尝试次数
    const maxAttempts = 10; // 设置最大尝试次数

    while (attempts < maxAttempts) {
      // 循环直到达到最大尝试次数
      try {
        // 获取转账账号余额
        const keypairBalance = await conn.getBalance(keypair.publicKey);
        logger.info(`转账账号sol余额为: ${keypairBalance}`); // 打印转账账号余额

        if (keypairBalance > 0) {
          // 如果余额大于 0
          const recentBlockhash = await conn.getLatestBlockhash(); // 获取最新区块哈希
          let transaction = new Transaction({
            // 创建交易实例
            feePayer: masterKeypair.publicKey, // 设置费用支付者为主账号公钥
            blockhash: recentBlockhash.blockhash, // 设置交易的区块哈希
            lastValidBlockHeight: 296, // 设置上一个有效区块高度
          });
          const fees = (await transaction.getEstimatedFee(conn)) || 0; // 获取估算的手续费
          transaction.add(
            // 添加转账指令到交易中
            SystemProgram.transfer({
              fromPubkey: keypair.publicKey, // 源账户公钥
              toPubkey: toAccount, // 目标账户公钥
              lamports: keypairBalance - fees, // 转账的 lamports 数量
            })
          );
          logger.info(`提交转账sol`); // 打印提交转账信息
          await sendAndConfirmTransaction(conn, transaction, [
            // 发送交易并确认
            keypair,
            masterKeypair,
          ]);

          // 交易提交成功后打印信息
          logger.info(`成功转账sol: ${keypairBalance - fees}`); // 添加成功转账信息打印
          break; // 如果交易成功，跳出循环
        } else {
          logger.error(`转账账号余额不足`); // 打印余额不足信息
          break; // 如果余额不足，跳出循环
        }
      } catch (error) {
        logger.error(`交易失败: ${error}`); // 打印交易失败信息
        attempts++; // 增加尝试次数
        await sleep(1000); // 1秒延迟
      }
    }

    if (attempts >= maxAttempts) {
      // 如果尝试次数达到上限
      logger.error(`尝试次数达到上限`); // 打印尝试次数达到上限信息
    }
    logger.info(`-------------------------End ${num}-------------------------`);
    await sleep(1000); // 1秒延迟
  }
};
send();
