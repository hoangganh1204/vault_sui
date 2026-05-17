#!/usr/bin/env node
import { Command } from 'commander';
import { pushCommand } from './commands/push.js';
import { restoreCommand } from './commands/restore.js';
import { listCommand } from './commands/list.js';
import * as logger from './utils/logger.js';
import { formatBytes, truncateAddress } from './utils/format.js';
import type { VaultSuiError } from './utils/errors.js';

const program = new Command();

program
  .name('vault-sui')
  .version('0.1.0')
  .description('Decentralized sensitive data vault using Sui + Walrus')
  .option('--wallet-key <key>', 'Sui wallet private key (overrides SUI_PRIVATE_KEY env)')
  .option('--network <network>', 'Network to use: testnet or mainnet', 'testnet');

program
  .command('push <path>')
  .description('Encrypt and upload a file to Walrus')
  .option('--allow <addresses...>', 'Authorized recipient wallet addresses (in addition to owner)')
  .option('--epochs <number>', 'Number of Walrus storage epochs', '3')
  .action(async (filePath: string, opts: { allow?: string[]; epochs: string }) => {
    logger.header();
    const parentOpts = program.opts() as { walletKey?: string; network?: string };
    try {
      const result = await pushCommand(filePath, {
        walletKey: parentOpts.walletKey,
        allow: opts.allow,
        epochs: parseInt(opts.epochs, 10),
      });

      const expiresDate = result.expiresAt.split('T')[0] ?? result.expiresAt;
      logger.success('Vault created successfully', {
        'Vault ID': result.vaultId,
        File: result.fileName,
        Size: `${formatBytes(result.fileSize)} → ${formatBytes(result.compressedSize)}`,
        Owner: truncateAddress(result.ownerAddress),
        Recipients: String(result.allowedWallets.length),
        Expires: expiresDate,
      });
      logger.divider();
    } catch (err) {
      const e = err as VaultSuiError;
      logger.error('Push failed', e.code ? e : undefined);
      logger.divider();
      process.exit(1);
    }
  });

program
  .command('restore <vault-id>')
  .description('Download and decrypt a vault to your local machine')
  .option('--output <dir>', 'Output directory for the restored file', '.')
  .action(async (vaultId: string, opts: { output: string }) => {
    logger.header();
    const parentOpts = program.opts() as { walletKey?: string };
    try {
      const result = await restoreCommand(vaultId, {
        walletKey: parentOpts.walletKey,
        output: opts.output,
      });

      logger.success('Vault restored successfully', {
        File: result.fileName,
        Size: formatBytes(result.fileSize),
        Location: result.outputPath,
        Checksum: result.checksum.slice(0, 16) + '...',
      });
      logger.divider();
    } catch (err) {
      const e = err as VaultSuiError;
      logger.error('Restore failed', e.code ? e : undefined);
      logger.divider();
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all vaults in your local registry')
  .option('--json', 'Output raw JSON instead of a table')
  .action(async (opts: { json?: boolean }) => {
    logger.header();
    const parentOpts = program.opts() as { walletKey?: string };
    try {
      await listCommand({ walletKey: parentOpts.walletKey, json: opts.json });
      logger.divider();
    } catch (err) {
      const e = err as VaultSuiError;
      logger.error('List failed', e.code ? e : undefined);
      logger.divider();
      process.exit(1);
    }
  });

program
  .command('verify <vault-id>')
  .description('Verify the integrity and availability of a vault on Walrus')
  .action((_vaultId: string) => {
    // TODO: implement in Phase 6
  });

program.parse(process.argv);
