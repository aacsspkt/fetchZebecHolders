import assert from 'assert';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

import { AccountLayout } from '@solana/spl-token';
import {
  Connection,
  PublicKey,
} from '@solana/web3.js';

dotenv.config();

function getConnection() {
	const RPC_URL = process.env.RPC_URL;
	assert(RPC_URL && RPC_URL != "", "missing env var RPC_URL");

	return new Connection(RPC_URL);
}

function chunkArray<T>(arr: Array<T>, chunkSize: number): T[][] {
	const result: T[][] = [];
	for (let i = 0; i < arr.length; i += chunkSize) {
		result.push(arr.slice(i, i + chunkSize));
	}
	return result;
}

(async () => {
	const connection = getConnection();

	const response = await connection.getProgramAccounts(new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), {
		filters: [
			{ dataSize: 165 },
			{
				memcmp: {
					offset: 0,
					bytes: "zebeczgi5fSEtbpfQKVZKCJ3WgYXxjkMUkNNx7fLKAF",
				},
			},
		],
	});

	const tokenAccounts = response.map((r) => r.pubkey);
	console.log("token account count: %d", tokenAccounts.length);

	const chunkList = chunkArray(tokenAccounts, 100);
	console.log("chunk count: %d", chunkList.length);

	const data: {
		owner: string;
		tokenAccount: string;
		amount: string;
	}[][] = [];

	let index = 0;
	while (index < chunkList.length) {
		console.log(`fetching data. index: ${index}`);
		const chunk = chunkList[index];
		const tokenInfos = await connection.getMultipleAccountsInfo(chunk, "confirmed");

		const tokenDataList = tokenInfos.map((tokenInfo, j) => {
			assert(tokenInfo, "Token account doesnot exists");
			const tokenData = AccountLayout.decode(tokenInfo.data);

			return {
				owner: tokenData.owner.toString(),
				tokenAccount: chunk[j].toString(),
				amount: tokenData.amount.toString(),
			};
		});
		data.push(tokenDataList);

		index++;
	}

	const holders = data.flat();
	const holderWithAmount = holders.filter((h) => h.amount != "0");
	console.log("holders with amout count: %d", holderWithAmount.length);

	fs.writeFileSync(path.resolve(__dirname, "zebecholders.json"), JSON.stringify(holderWithAmount), "utf-8");
})();
