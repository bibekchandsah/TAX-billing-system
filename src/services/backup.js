import * as XLSX from 'xlsx';
import { getBills, getCustomers, getStocks, getSettings } from './db';

/**
 * Generates an Excel backup containing all user data
 * @param {string} userId - Firebase User UID
 */
export const generateExcelBackup = async (userId) => {
  try {
    // 1. Fetch all data in parallel
    const [bills, customers, stocks, settings] = await Promise.all([
      getBills(userId),
      getCustomers(userId),
      getStocks(userId),
      getSettings(userId)
    ]);

    // 2. Format Bills Sheet
    // Flatten items for detailed bill view, or just overview. We'll do an overview sheet and an items sheet.
    const billsOverview = bills.map(bill => ({
      'Date (BS)': bill.date,
      'Bill No': bill.billNumber,
      'Type': bill.type,
      'Customer Name': bill.customerName,
      'Contact': bill.contactNumber,
      'PAN/VAT No': bill.panVatNo,
      'Address': bill.address,
      'Sub Total': bill.total,
      'VAT Amount': bill.taxAmount || 0,
      'Total With Tax': bill.totalAmountWithTax
    }));

    const billItems = [];
    bills.forEach(bill => {
      bill.items.forEach(item => {
        billItems.push({
          'Bill No': bill.billNumber,
          'Date (BS)': bill.date,
          'Particular': item.particular,
          'Unit': item.unit,
          'Quantity': item.qty,
          'Rate': item.rate,
          'Amount': item.amount
        });
      });
    });

    // 3. Format Customers Sheet
    const customerData = customers.map(c => ({
      'Customer Name': c.customerName,
      'Type': c.type,
      'PAN/VAT No': c.panVatNo,
      'Contact': c.contactNumber,
      'Address': c.address,
      'Opening Balance': c.openingBalance,
      'Created At': new Date(c.createdAt).toLocaleDateString()
    }));

    // 4. Format Stock Sheet
    const stockData = stocks.map(s => ({
      'Particular ID': s.particularId,
      'Particular Name': s.particularName,
      'Default Unit': s.defaultUnit,
      'Price Rate': s.price,
      'Current Stock': s.currentStock,
      'Stock In': s.stockIn,
      'Amount In': s.amountIn,
      'Stock Out': s.stockOut,
      'Amount Out': s.amountOut,
      'Initial QTY': s.initialStockQuantity
    }));

    // 5. Format Settings Sheet
    const settingsData = [{
      'Business Name': settings?.businessName || '',
      'Bill Title': settings?.billTitle || '',
      'Contact': settings?.businessContact || '',
      'Address': settings?.businessAddress || '',
      'PAN/VAT No': settings?.panVatNo || '',
      'Default VAT %': settings?.vatPercentage || 0,
      'Action PIN Protected': settings?.actionPin ? 'Yes' : 'No'
    }];

    // Create Worksheets
    const wsBills = XLSX.utils.json_to_sheet(billsOverview);
    const wsItems = XLSX.utils.json_to_sheet(billItems);
    const wsCustomers = XLSX.utils.json_to_sheet(customerData);
    const wsStock = XLSX.utils.json_to_sheet(stockData);
    const wsSettings = XLSX.utils.json_to_sheet(settingsData);

    // Create Workbook and append sheets
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsBills, "Bills Overview");
    XLSX.utils.book_append_sheet(wb, wsItems, "Bill Items Details");
    XLSX.utils.book_append_sheet(wb, wsCustomers, "Ledger Customers");
    XLSX.utils.book_append_sheet(wb, wsStock, "Stock Inventory");
    XLSX.utils.book_append_sheet(wb, wsSettings, "System Settings");

    // Generate date string for filename
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = `${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`;
    const fileName = `VAT_Billing_Backup_${dateStr}_${timeStr}.xlsx`;

    // Trigger download or save to folder
    const { get, set } = await import('idb-keyval');
    let savedToFolder = false;
    
    try {
      const dirHandle = await get('backupDirectoryHandle');
      if (dirHandle) {
        // Request permissions if needed
        const permission = await dirHandle.queryPermission({ mode: 'readwrite' });
        if (permission === 'granted' || (await dirHandle.requestPermission({ mode: 'readwrite' })) === 'granted') {
          const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
          const writable = await fileHandle.createWritable();
          const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
          await writable.write(buffer);
          await writable.close();
          savedToFolder = true;
        }
      }
    } catch (e) {
      console.warn("Could not save to selected folder, falling back to download", e);
    }

    if (!savedToFolder) {
      XLSX.writeFile(wb, fileName);
    }
    
    // Record last backup time
    await set('lastBackupTime', Date.now());
    
    return true;
  } catch (error) {
    console.error("Backup Generation Failed: ", error);
    throw error;
  }
};
