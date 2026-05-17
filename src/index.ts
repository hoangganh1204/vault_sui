#!/usr/bin/env node
import { Command } from 'commander';

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
  .option(
    '--allow <addresses...>',
    'Authorized recipient wallet addresses (in addition to owner)'
  )
  .option('--epochs <number>', 'Number of Walrus storage epochs', '3')
  .action((_path: string, _opts: { allow?: string[]; epochs: string }) => {
    // TODO: implement in Phase 3
  });

program
  .command('restore <vault-id>')
  .description('Download and decrypt a vault to your local machine')
  .option('--output <dir>', 'Output directory for the restored file', '.')
  .action((_vaultId: string, _opts: { output: string }) => {
    // TODO: implement in Phase 4
  });

program
  .command('list')
  .description('List all vaults in your local registry')
  .option('--json', 'Output raw JSON instead of a table')
  .action((_opts: { json?: boolean }) => {
    // TODO: implement in Phase 5
  });

program
  .command('verify <vault-id>')
  .description('Verify the integrity and availability of a vault on Walrus')
  .action((_vaultId: string) => {
    // TODO: implement in Phase 6
  });

program.parse(process.argv);
