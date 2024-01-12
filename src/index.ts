import assert from 'assert';
import BigNumber from 'bignumber.js';
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
	const unitsPerZebec = "1000000000";

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
	const tokenAccountCount = tokenAccounts.length;
	console.log("token account count: %d", tokenAccountCount);

	const chunkList = chunkArray(tokenAccounts, 100);
	const chunkCount = chunkList.length;
	console.log("chunk count: %d", chunkCount);

	const data: {
		owner: string;
		amount: string;
	}[][] = [];

	let index = 0;
	while (index < chunkList.length) {
		console.log(`fetching data - index: ${index+1} out of ${chunkCount}`);
		const chunk = chunkList[index];
		const tokenInfos = await connection.getMultipleAccountsInfo(chunk, "confirmed");

		const tokenDataList = tokenInfos.map((tokenInfo, j) => {
			assert(tokenInfo, "Token account doesnot exists");
			const tokenData = AccountLayout.decode(tokenInfo.data);

			const amount = BigNumber(tokenData.amount.toString()).div(unitsPerZebec).toFixed();
			return {
				owner: tokenData.owner.toString(),
				amount: amount,
			};
		});
		data.push(tokenDataList);

		index++;
	}

	const holders = data.flat();
	const holderWithAmount = holders.filter((h) => !BigNumber(h.amount).isZero());
	console.log("holders with amout count: %d", holderWithAmount.length);

	fs.writeFileSync(path.resolve(__dirname, "zebecholders.json"), JSON.stringify(holderWithAmount), "utf-8");
})();
