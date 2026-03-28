import cron from 'node-cron';
import { config } from '../config';
import { rwStatusCron } from './rw-status-cron';
import { maintenanceCron } from './maintenance-cron';
import { vaultStorageCron } from './vault-storage-cron';
import { goldPriceCron } from './gold-price-cron';

export function initializeCronJobs() {
  // RolliWorking Status Cache (Daily 5 AM)
  cron.schedule(config.cronSchedules.rwStatus, async () => {
    console.log('🔄 Running RW Status Cron...');
    await rwStatusCron();
  });

  // Maintenance (Daily 2 AM)
  cron.schedule(config.cronSchedules.maintenance, async () => {
    console.log('🧹 Running Maintenance Cron...');
    await maintenanceCron();
  });

  // Vault Storage Fee (Daily 3 AM)
  cron.schedule(config.cronSchedules.vaultStorage, async () => {
    console.log('💰 Running Vault Storage Cron...');
    await vaultStorageCron();
  });

  // Gold Price Update (Every 6 hours)
  cron.schedule(config.cronSchedules.goldPrice, async () => {
    console.log('🪙 Running Gold Price Cron...');
    await goldPriceCron();
  });
}
