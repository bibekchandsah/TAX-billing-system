import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { getStocks, addStock, updateStock, getSettings, deleteRecord, getBills, getStocksWithCalculatedQty } from '../services/db';
import { getFiscalYearDateRange, getMonthIndex, getTodayBSDateString } from '../utils/fiscalYear';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import NepaliDatePicker from '../components/NepaliDatePicker';
import ActionPinModal from '../components/ActionPinModal';
import EditBillModal from '../components/EditBillModal';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Search, Plus, Edit, Trash2, Package as PackageIcon, Tag, Archive, X, Printer, ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './Stock.module.css';

const Stock = () => {
  const { user, activeUid } = useAuthStore();
  const { addToast, activeFiscalYear, activeMonth } = useAppStore();
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [settings, setSettings] = useState(null);
  
  // Selected Stock & Entries Data
  const [selectedStock, setSelectedStock] = useState(null);
  const [stockEntries, setStockEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Add / Edit Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditingStock, setIsEditingStock] = useState(false);
  const [stockToEdit, setStockToEdit] = useState(null);

  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinActionType, setPinActionType] = useState(null); // 'delete_stock', 'edit_stock', 'delete_bill', 'edit_bill'
  
  const [stockToDelete, setStockToDelete] = useState(null);
  const [deleteStockConfirmOpen, setDeleteStockConfirmOpen] = useState(false);
  
  const [billToEdit, setBillToEdit] = useState(null);
  const [editBillModalOpen, setEditBillModalOpen] = useState(false);
  const [billToDelete, setBillToDelete] = useState(null);
  const [deleteBillConfirmOpen, setDeleteBillConfirmOpen] = useState(false);

  const [formData, setFormData] = useState({
    particularName: '',
    particularId: '',
    defaultUnit: 'Pcs',
    salesRate: '',
    purchaseRate: '',
    initialStockQuantity: '',
    date: '',
    billNumber: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (activeUid) loadStocks();
  }, [activeUid]);

  useEffect(() => {
    if (selectedStock) {
      loadStockEntries(selectedStock.particularName);
    }
  }, [selectedStock]);

  // We removed the useEffect that auto-populated fromDate and toDate from activeFiscalYear.
  // The filtering logic below now applies the FY date range transparently in the background if fromDate/toDate are empty.

  const loadStocks = async () => {
    setLoading(true);
    try {
      const computedStocks = await getStocksWithCalculatedQty(activeUid);
      setStocks(computedStocks);
      const userSettings = await getSettings(activeUid);
      setSettings(userSettings);
      
      // Auto-set first unit if available
      if (userSettings?.units?.length > 0) {
        setFormData(prev => ({...prev, defaultUnit: userSettings.units[0]}));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePinSuccess = () => {
    setPinModalOpen(false);
    if (pinActionType === 'delete_stock') {
      setDeleteStockConfirmOpen(true);
    } else if (pinActionType === 'edit_stock') {
      openEditModal(stockToEdit);
    } else if (pinActionType === 'delete_bill') {
      setDeleteBillConfirmOpen(true);
    } else if (pinActionType === 'edit_bill') {
      setEditBillModalOpen(true);
    }
  };

  const getNextParticularId = () => {
    if (!stocks || stocks.length === 0) return '00001';
    let maxId = 0;
    stocks.forEach(stock => {
      const num = parseInt(stock.particularId, 10);
      if (!isNaN(num) && num > maxId) {
        maxId = num;
      }
    });
    return (maxId + 1).toString().padStart(5, '0');
  };

  const openEditModal = (stock) => {
    setIsEditingStock(true);
    setFormData({
      particularName: stock.particularName || '',
      particularId: stock.particularId || '',
      defaultUnit: stock.defaultUnit || 'Pcs',
      salesRate: stock.salesRate !== undefined && stock.salesRate !== '' ? stock.salesRate : (stock.price || ''),
      purchaseRate: stock.purchaseRate !== undefined && stock.purchaseRate !== '' ? stock.purchaseRate : (stock.price || ''),
      initialStockQuantity: stock.currentStock || '',
      date: stock.date || '',
      billNumber: stock.billNumber || ''
    });
    setShowAddModal(true);
  };

  const handleEditRequest = (stock) => {
    setStockToEdit(stock);
    if (settings?.actionPin) {
      setPinActionType('edit_stock');
      setPinModalOpen(true);
    } else {
      openEditModal(stock);
    }
  };

  const handleDeleteRequest = (stock) => {
    setStockToDelete(stock);
    if (settings?.actionPin) {
      setPinActionType('delete_stock');
      setPinModalOpen(true);
    } else {
      setDeleteStockConfirmOpen(true);
    }
  };

  const executeDelete = async (stockId = stockToDelete?.id) => {
    try {
      await deleteRecord(activeUid, 'stock', stockId);
      setStocks(stocks.filter(s => s.id !== stockId));
      if (selectedStock?.id === stockId) setSelectedStock(null);
      setDeleteStockConfirmOpen(false);
      setStockToDelete(null);
    } catch (error) {
      console.error("Failed to delete", error);
      alert("Failed to delete stock particular.");
    }
  };

  const handleDeleteBillRequest = (bill) => {
    setBillToDelete(bill);
    if (settings?.actionPin) {
      setPinActionType('delete_bill');
      setPinModalOpen(true);
    } else {
      setDeleteBillConfirmOpen(true);
    }
  };

  const handleEditBillRequest = (bill) => {
    setBillToEdit(bill);
    if (settings?.actionPin) {
      setPinActionType('edit_bill');
      setPinModalOpen(true);
    } else {
      setEditBillModalOpen(true);
    }
  };

  const executeDeleteBill = async (billId = billToDelete?.billId) => {
    try {
      await deleteRecord(activeUid, 'records', billId);
      setStockEntries(stockEntries.filter(b => b.billId !== billId));
      setDeleteBillConfirmOpen(false);
      setBillToDelete(null);
      // We should ideally reload stocks to update currentStock, but for now we'll just reload the entries
      if (selectedStock) {
         loadStockEntries(selectedStock.particularName);
      }
    } catch (error) {
      console.error("Failed to delete bill", error);
      alert("Failed to delete bill.");
    }
  };

  const loadStockEntries = async (particularName) => {
    setLoadingEntries(true);
    try {
      // Fetch all bills from the db service which uses the correct VAT_PAN namespace
      const allBills = await getBills(activeUid);
      
      let entries = [];
      allBills.forEach(bill => {
        const matchedItems = bill.items.filter(item => item.particular === particularName);
        matchedItems.forEach(item => {
          entries.push({
            id: `${bill.id}-${item.id}`,
            billId: bill.id,
            date: bill.date,
            type: bill.type,
            billNumber: bill.billNumber,
            customerName: bill.customerName,
            qty: item.qty,
            amount: item.amount,
            timestamp: bill.timestamp,
            bill: bill // reference to whole bill
          });
        });
      });
      
      // Sort ascending by date for chronological ledger and running balance
      entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      setStockEntries(entries);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEntries(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value;
    if (name === 'particularName') {
      formattedValue = value.replace(/\b\w/g, l => l.toUpperCase());
    }
    if (name === 'particularId' && value.length > 5) return;
    
    setFormData(prev => {
      const newData = { ...prev, [name]: formattedValue };
      if (name === 'initialStockQuantity' && Number(formattedValue) > 0 && !prev.date) {
        if (window.NepaliDatePicker) {
          const today = window.NepaliDatePicker.utils.getToday();
          newData.date = `${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`;
        } else {
          newData.date = '2081-04-01';
        }
      }
      return newData;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    if (Number(formData.initialStockQuantity) > 0 && !formData.date) {
      addToast("Date is required when Initial Stock Quantity is entered.", "error");
      setIsSubmitting(false);
      return;
    }

    const pid = formData.particularId.padStart(5, '0');
    if (isEditingStock) {
      const exists = stocks.find(s => s.particularId === pid && s.id !== stockToEdit.id);
      if (exists) {
        addToast(`Particular ID already exists for "${exists.particularName}".`, "error");
        setIsSubmitting(false);
        return;
      }
    } else {
      const exists = stocks.find(s => s.particularId === pid);
      if (exists) {
        addToast(`Particular ID already exists for "${exists.particularName}".`, "error");
        setIsSubmitting(false);
        return;
      }
    }
    try {
      const initialQty = Number(formData.initialStockQuantity) || 0;
      const salesRate = Number(formData.salesRate) || 0;
      const purchaseRate = Number(formData.purchaseRate) || 0;
      
      const stockData = {
        ...formData,
        particularId: formData.particularId.padStart(5, '0'),
        salesRate,
        purchaseRate,
        price: salesRate
      };
      
      if (isEditingStock) {
        await updateStock(activeUid, stockToEdit.id, stockData);
      } else {
        stockData.currentStock = initialQty;
        stockData.stockIn = initialQty;
        stockData.stockOut = 0;
        stockData.amountIn = initialQty * purchaseRate;
        stockData.amountOut = 0;
        stockData.createdAt = new Date().toISOString();
        await addStock(activeUid, stockData);
      }
      
      setFormData({
        particularName: '', particularId: '', defaultUnit: 'Pcs', salesRate: '', purchaseRate: '', 
        initialStockQuantity: '', date: '', billNumber: ''
      });
      setShowAddModal(false);
      setIsEditingStock(false);
      setStockToEdit(null);
      loadStocks();
    } catch (err) {
      console.error("Error adding stock:", err);
      alert("Failed to add particular");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredStocks = stocks.filter(s => 
    s.particularName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.particularId.includes(searchTerm)
  );

  let effFromDate = fromDate;
  let effToDate = toDate;
  
  if (!fromDate && !toDate && activeFiscalYear) {
    if (activeMonth === 'current') {
      const todayStr = getTodayBSDateString();
      const [yr, mo] = todayStr.split('-');
      const pad = (n) => String(n).padStart(2, '0');
      effFromDate = `${yr}-${pad(Number(mo))}-01`;
      effToDate   = `${yr}-${pad(Number(mo))}-32`;
    } else if (activeMonth) {
      const [yr, mo] = activeMonth.split('-');
      effFromDate = `${yr}-${mo}-01`;
      effToDate   = `${yr}-${mo}-32`;
    } else {
      const startMonth = settings?.fiscalYearStartMonth || 'Shrawan';
      const startMonthIdx = getMonthIndex(startMonth);
      const range = getFiscalYearDateRange(activeFiscalYear, startMonthIdx);
      effFromDate = range.from;
      effToDate = range.to;
    }
  }

  const filteredEntries = stockEntries.filter(entry => {
    if (effFromDate && entry.date < effFromDate) return false;
    if (effToDate && entry.date > effToDate) return false;
    return true;
  });

  // Calculate opening stock quantity before effFromDate
  const initialQty = Number(selectedStock?.initialStockQuantity) || 0;
  const purchaseRate = Number(selectedStock?.purchaseRate ?? selectedStock?.price ?? 0);
  const initialDate = selectedStock?.date || '';
  const initialAmt = initialQty * purchaseRate;

  let openingStockQty = 0;
  let openingStockAmt = 0;

  // Add initial stock if it was created before or during the active period
  const isInitialValid = !effFromDate || !initialDate || (effToDate ? initialDate <= effToDate : true);
  if (initialQty > 0 && isInitialValid) {
    openingStockQty += initialQty;
    // Add the initial stock amount so it shows in the Opening Amount card
    openingStockAmt += initialAmt; 
  }

  // Add purchases (+) and subtract sales (-) that occurred BEFORE effFromDate to get exact carried-forward opening balance
  if (effFromDate) {
    stockEntries.forEach(entry => {
      if (entry.date < effFromDate) {
        if (entry.type === 'Purchase') {
          openingStockQty += entry.qty;
          // Accumulate prior In for next month's opening amount
          openingStockAmt += entry.amount;
        } else if (entry.type === 'Sale') {
          openingStockQty -= entry.qty;
          // Accumulate prior Out for next month's opening amount
          openingStockAmt -= entry.amount;
        }
      }
    });
  }

  // Calculate Period Transactions & Stats
  const purchasesIn = filteredEntries.filter(e => e.type === 'Purchase');
  const totalStockIn = purchasesIn.reduce((sum, e) => sum + e.qty, 0);
  const totalAmountIn = purchasesIn.reduce((sum, e) => sum + e.amount, 0);

  const salesOut = filteredEntries.filter(e => e.type === 'Sale');
  const totalStockOut = salesOut.reduce((sum, e) => sum + e.qty, 0);
  const totalAmountOut = salesOut.reduce((sum, e) => sum + e.amount, 0);

  // Running balance starting from opening stock of the period
  let runningStock = openingStockQty;
  const entriesWithBalance = filteredEntries.map(entry => {
    if (entry.type === 'Purchase') {
      runningStock += entry.qty;
    } else if (entry.type === 'Sale') {
      runningStock -= entry.qty;
    }
    return { ...entry, runningBalance: runningStock };
  });

  const closingStockQty = runningStock;
  const actualCurrentStock = closingStockQty;
  
  // User explicitly requested Closing Amount to be strictly (Period In - Period Out) + Prior Carried Forward (Opening Amount)
  // But without Initial Stock included in Opening Amount!
  const closingStockAmount = openingStockAmt + totalAmountIn - totalAmountOut;
  const taxableAmount = closingStockAmount;

  const generateStockLedgerPDF = () => {
    if (!selectedStock) return;

    const doc = new jsPDF();
    const margin = 14;
    let yPos = margin + 10;

    // Header
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(settings?.businessName || "Business Name", 105, yPos, { align: "center" });
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    const addressParts = [];
    if (settings?.businessAddress) addressParts.push(settings.businessAddress);
    if (settings?.contactNumber) addressParts.push(`Phone: ${settings.contactNumber}`);
    if (settings?.panNo) addressParts.push(`PAN/VAT: ${settings.panNo}`);
    
    const addressLine = addressParts.length > 0 ? addressParts.join(' | ') : '';
    if (addressLine) {
      doc.text(addressLine, 105, yPos, { align: "center" });
      yPos += 12;
    } else {
      yPos += 4;
    }

    // Title
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("STOCK LEDGER STATEMENT", 105, yPos, { align: "center" });
    yPos += 12;

    // Stock Details
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Particular: ${selectedStock.particularName} (Unit:${selectedStock.defaultUnit || 'N/A'})`, margin, yPos);
    
    // Right side Date Range
    const dateText = (fromDate || toDate) ? 
      `Date Range: ${fromDate || '...'} to ${toDate || '...'}` : 
      `Date Range: All`;
    doc.text(dateText, 200 - margin, yPos, { align: "right" });
    
    yPos += 8;

    // Table Data
    const tableColumn = ["Date (BS)", "Type", "Bill Number", "Particular (Customer)", "Stock In", "Amount In", "Stock Out", "Amount Out", "Current Stock"];
    const tableRows = [];

    // 1. TOP: Opening Stock Row in PDF
    tableRows.push([
      effFromDate || initialDate || "-",
      "Opening Stock",
      selectedStock.billNumber || "-",
      "Opening Stock Balance",
      openingStockQty,
      `Rs. ${Math.max(0, openingStockAmt).toFixed(2)}`,
      "-",
      "-",
      openingStockQty
    ]);

    // 2. MIDDLE: Period Entries
    entriesWithBalance.forEach(entry => {
      tableRows.push([
        entry.date,
        entry.type,
        entry.billNumber,
        entry.customerName,
        entry.type === 'Purchase' ? entry.qty : "-",
        entry.type === 'Purchase' ? `Rs. ${entry.amount.toFixed(2)}` : "-",
        entry.type === 'Sale' ? entry.qty : "-",
        entry.type === 'Sale' ? `Rs. ${entry.amount.toFixed(2)}` : "-",
        entry.runningBalance
      ]);
    });

    // 3. BOTTOM: Closing Stock Row in PDF
    const closingDate = effToDate || (entriesWithBalance.length > 0 ? entriesWithBalance[entriesWithBalance.length - 1].date : effFromDate || "-");
    tableRows.push([
      closingDate,
      "Closing Stock",
      "-",
      "Closing Stock Balance",
      "-",
      "-",
      "-",
      `Rs. ${taxableAmount.toFixed(2)}`,
      `${closingStockQty} ${selectedStock.defaultUnit || 'Pcs'}`
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      tableLineWidth: 0.1,
      tableLineColor: 0,
      styles: { 
        fontSize: 8, 
        cellPadding: 2,
        textColor: 0,
        fillColor: 255,
        lineWidth: { top: 0, right: 0.1, bottom: 0, left: 0.1 },
        lineColor: 0
      },
      headStyles: { 
        halign: 'center',
        fontStyle: 'bold',
        fontSize: 9,
        lineWidth: { top: 0.1, right: 0.1, bottom: 0.5, left: 0.1 }
      },
      bodyStyles: {
        fontStyle: 'bold'
      }
    });

    // Open PDF in a new tab for preview and printing
    window.open(doc.output('bloburl'), '_blank');
  };

  return (
    <div className={`animate-fade-in ${styles.container}`}>
      <div className={`${styles.contentGrid} ${!isLeftPanelOpen ? styles.contentGridCollapsed : ''}`}>
        
        {/* Left Side: Items List */}
        <div className={`${styles.leftPanel} ${!isLeftPanelOpen ? styles.leftPanelCollapsed : ''}`}>
          <div className={styles.leftPanelHeader}>
            <div className={styles.searchBox}>
              <Search size={18} className={styles.searchIcon} />
              <input 
                type="text" 
                className="input-field" 
                placeholder="Search particular..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="btn-primary" onClick={() => {
              setFormData({
                particularName: '', particularId: getNextParticularId(), defaultUnit: settings?.units?.[0] || 'Pcs', salesRate: '', purchaseRate: '', 
                initialStockQuantity: '', date: '', billNumber: ''
              });
              setIsEditingStock(false);
              setStockToEdit(null);
              setShowAddModal(true);
            }}>
              <Plus size={18} /> New Particular
            </button>
          </div>

          <div className={styles.itemList}>
            {loading ? (
              <div className={styles.loadingState}>Loading...</div>
            ) : filteredStocks.length === 0 ? (
              <div className={styles.emptyState}>No items found.</div>
            ) : (
              filteredStocks.map(stock => (
                <div 
                  key={stock.id} 
                  className={`${styles.itemCard} glass-panel ${selectedStock?.id === stock.id ? styles.activeCard : ''}`}
                  onClick={() => setSelectedStock(stock)}
                >
                  <div className={styles.cardHeader}>
                    <div>
                      <h3 className={styles.itemName}>{stock.particularName}</h3>
                      <span className={styles.unitBadge}><PackageIcon size={12} /> {stock.defaultUnit}</span>
                    </div>
                    <span className={styles.itemId}>#{stock.particularId}</span>
                  </div>
                  
                  <div className={styles.ratesContainer}>
                    <div className={styles.rateBadge}>
                      <span className={styles.rateLabel}>Sale Rate</span>
                      <span className={styles.rateValue}>Rs. {Number(stock.salesRate ?? stock.price ?? 0).toFixed(2)}</span>
                    </div>
                    <div className={styles.rateBadge}>
                      <span className={styles.rateLabel}>Purch Rate</span>
                      <span className={styles.rateValue}>Rs. {Number(stock.purchaseRate ?? stock.price ?? 0).toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <div className={styles.cardFooter}>
                    <span>Current Stock:</span>
                    <span className={styles.stockCount}>{stock.actualCurrentStock} {stock.defaultUnit}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Stock Ledger Details */}
        <div className={`${styles.rightPanel} glass-panel`}>
          {selectedStock ? (
            <div className={styles.ledgerView}>
              <div className={styles.ledgerHeader}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                    <button 
                      onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)} 
                      className={styles.iconBtn} 
                      style={{ padding: '0.25rem' }}
                      title={isLeftPanelOpen ? "Collapse List" : "Expand List"}
                    >
                      {isLeftPanelOpen ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
                    </button>
                    <h2 className="heading-2" style={{margin: 0}}>{selectedStock.particularName}</h2>
                  </div>
                  <div className={styles.ledgerMeta}>
                    <span><Archive size={14}/> ID: #{selectedStock.particularId}</span>
                    <span><PackageIcon size={14}/> Unit: {selectedStock.defaultUnit}</span>
                    <span className={styles.salesTag}><Tag size={14}/> Sale: Rs. {Number(selectedStock.salesRate ?? selectedStock.price ?? 0).toFixed(2)}</span>
                    <span className={styles.purchTag}><Tag size={14}/> Purchase: Rs. {Number(selectedStock.purchaseRate ?? selectedStock.price ?? 0).toFixed(2)}</span>
                  </div>
                </div>
                <div className={styles.actions}>
                  <button className={styles.iconBtn} onClick={() => handleEditRequest(selectedStock)}><Edit size={18} /></button>
                  <button className={`${styles.iconBtn} ${styles.danger}`} onClick={() => handleDeleteRequest(selectedStock)}><Trash2 size={18} /></button>
                </div>
              </div>

              <div className={styles.filterBar}>
                <div className={styles.dateFilters}>
                  <NepaliDatePicker 
                    value={fromDate} 
                    onChange={setFromDate} 
                    className="input-field" 
                    placeholder="From Date (BS)"
                  />
                  <NepaliDatePicker 
                    value={toDate} 
                    onChange={setToDate} 
                    className="input-field" 
                    placeholder="To Date (BS)"
                  />
                  {(fromDate || toDate) && (
                    <button className="btn-secondary" onClick={() => {setFromDate(''); setToDate('');}}>
                      Clear
                    </button>
                  )}
                </div>
                <button className="btn-secondary" onClick={generateStockLedgerPDF}>
                  <Printer size={18} /> Print
                </button>
              </div>

              <div className={styles.statsCards}>
                {/* 1. Opening Stock Card */}
                <div className={`${styles.statCard} ${styles.statCardOpening}`}>
                  <div className={styles.statLabel}>Opening Stock</div>
                  <div className={styles.statMetrics}>
                    <div className={styles.metricItem}>
                      <span className={styles.metricSubLabel}>Opening Qty</span>
                      <span className={`${styles.metricValue} ${styles.colorPurple}`}>{openingStockQty} <span className={styles.metricUnit}>{selectedStock?.defaultUnit}</span></span>
                    </div>
                    <div className={styles.metricItem}>
                      <span className={styles.metricSubLabel}>Opening Amount</span>
                      <span className={`${styles.metricAmount} ${styles.colorPurple}`}>Rs. {Math.max(0, openingStockAmt).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Stock In Card */}
                <div className={`${styles.statCard} ${styles.statCardIn}`}>
                  <div className={styles.statLabel}>Stock In</div>
                  <div className={styles.statMetrics}>
                    <div className={styles.metricItem}>
                      <span className={styles.metricSubLabel}>Quantity</span>
                      <span className={`${styles.metricValue} ${styles.colorSuccess}`}>{totalStockIn} <span className={styles.metricUnit}>{selectedStock?.defaultUnit}</span></span>
                    </div>
                    <div className={styles.metricItem}>
                      <span className={styles.metricSubLabel}>Total Amount In</span>
                      <span className={`${styles.metricAmount} ${styles.colorSuccess}`}>Rs. {totalAmountIn.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Stock Out Card */}
                <div className={`${styles.statCard} ${styles.statCardOut}`}>
                  <div className={styles.statLabel}>Stock Out</div>
                  <div className={styles.statMetrics}>
                    <div className={styles.metricItem}>
                      <span className={styles.metricSubLabel}>Quantity</span>
                      <span className={`${styles.metricValue} ${styles.colorError}`}>{totalStockOut} <span className={styles.metricUnit}>{selectedStock?.defaultUnit}</span></span>
                    </div>
                    <div className={styles.metricItem}>
                      <span className={styles.metricSubLabel}>Total Amount Out</span>
                      <span className={`${styles.metricAmount} ${styles.colorError}`}>Rs. {totalAmountOut.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* 4. Closing Stock Card */}
                <div className={`${styles.statCard} ${styles.statCardClosing}`}>
                  <div className={styles.statLabel}>Closing Stock</div>
                  <div className={styles.statMetrics}>
                    <div className={styles.metricItem}>
                      <span className={styles.metricSubLabel}>Closing Qty</span>
                      <span className={`${styles.metricValue} ${styles.colorPrimary}`}>{closingStockQty} <span className={styles.metricUnit}>{selectedStock?.defaultUnit}</span></span>
                    </div>
                    <div className={styles.metricItem}>
                      <span className={styles.metricSubLabel}>Closing Amount</span>
                      <span className={`${styles.metricAmount} ${styles.colorPrimary}`}>Rs. {taxableAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.tableResponsive}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Date (BS)</th>
                      <th>Type</th>
                      <th>Bill Number</th>
                      <th>Particular (Customer)</th>
                      <th>Stock In</th>
                      <th>Amount In</th>
                      <th>Stock Out</th>
                      <th>Amount Out</th>
                      <th>Current Stock</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingEntries ? (
                      <tr><td colSpan="10" style={{textAlign: 'center', padding: '2rem'}}>Loading...</td></tr>
                    ) : (
                      <>
                        {/* Top Row: Opening Stock */}
                        <tr key="opening-stock" style={{ backgroundColor: 'rgba(59, 130, 246, 0.06)', fontWeight: 600 }}>
                          <td>{effFromDate || initialDate || '-'}</td>
                          <td><span className={`${styles.tag} ${styles.tagPurchase}`}>Opening</span></td>
                          <td>{selectedStock?.billNumber || '-'}</td>
                          <td>Opening Stock Balance</td>
                          <td style={{color: 'var(--success)', fontWeight: 600}}>{openingStockQty}</td>
                          <td>Rs. {Math.max(0, openingStockAmt).toFixed(2)}</td>
                          <td>-</td>
                          <td>-</td>
                          <td style={{color: 'var(--accent-primary)', fontWeight: 600}}>{openingStockQty}</td>
                          <td>-</td>
                        </tr>

                        {/* Middle Rows: Transactions in Period */}
                        {entriesWithBalance.map(entry => (
                          <tr key={entry.id}>
                            <td>{entry.date}</td>
                            <td>
                              <span className={`${styles.tag} ${entry.type === 'Sale' ? styles.tagSale : styles.tagPurchase}`}>
                                {entry.type}
                              </span>
                            </td>
                            <td>{entry.billNumber}</td>
                            <td>{entry.customerName}</td>
                            
                            {/* Stock In logic */}
                            {entry.type === 'Purchase' ? (
                              <>
                                <td style={{color: 'var(--success)', fontWeight: 600}}>{entry.qty}</td>
                                <td>Rs. {entry.amount.toFixed(2)}</td>
                              </>
                            ) : (
                              <>
                                <td>-</td>
                                <td>-</td>
                              </>
                            )}

                            {/* Stock Out logic */}
                            {entry.type === 'Sale' ? (
                              <>
                                <td style={{color: 'var(--error)', fontWeight: 600}}>{entry.qty}</td>
                                <td>Rs. {entry.amount.toFixed(2)}</td>
                              </>
                            ) : (
                              <>
                                <td>-</td>
                                <td>-</td>
                              </>
                            )}
                            
                            <td style={{color: 'var(--accent-primary)', fontWeight: 600}}>{entry.runningBalance}</td>

                            <td>
                              <div className={styles.actions}>
                                <button className={styles.iconBtn} onClick={() => handleEditBillRequest(entry)}><Edit size={14} /></button>
                                <button className={`${styles.iconBtn} ${styles.danger}`} onClick={() => handleDeleteBillRequest(entry)}><Trash2 size={14} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}

                        {/* Bottom Row: Closing Stock */}
                        <tr key="closing-stock" style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>
                          <td>{effToDate || (entriesWithBalance.length > 0 ? entriesWithBalance[entriesWithBalance.length - 1].date : effFromDate || '-')}</td>
                          <td><span className={styles.tag} style={{ backgroundColor: 'var(--accent-primary)', color: '#ffffff' }}>Closing</span></td>
                          <td>-</td>
                          <td>Closing Stock Balance</td>
                          <td>-</td>
                          <td>-</td>
                          <td>-</td>
                          <td style={{color: 'var(--accent-primary)', fontWeight: 600}}>Rs. {taxableAmount.toFixed(2)}</td>
                          <td style={{color: 'var(--accent-primary)', fontWeight: 700, fontSize: '0.95rem'}}>{closingStockQty} {selectedStock?.defaultUnit}</td>
                          <td>-</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          ) : (
            <div className={styles.emptyState} style={{ position: 'relative' }}>
              <button 
                onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)} 
                className={styles.iconBtn} 
                style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', padding: '0.25rem' }}
                title={isLeftPanelOpen ? "Collapse List" : "Expand List"}
              >
                {isLeftPanelOpen ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
              </button>
              Select a particular from the left to view its stock ledger records.
            </div>
          )}
        </div>
      </div>

      {/* Add Particular Modal */}
      {showAddModal && (
        createPortal(
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} glass-panel animate-fade-in`}>
            <div className={styles.modalHeader}>
              <h2 className="heading-2" style={{marginBottom: 0}}>Add New Particular</h2>
              <button className={styles.closeBtn} onClick={() => setShowAddModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <form onSubmit={handleSubmit} id="add-stock-form" className={styles.form}>
                
                <div className="form-group">
                  <label className="form-label">Particular Name *</label>
                  <input type="text" className="input-field" name="particularName" value={formData.particularName} onChange={handleInputChange} required autoFocus />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Particular ID *</label>
                  <input type="text" className="input-field" name="particularId" value={formData.particularId} onChange={handleInputChange} onBlur={(e) => {
                    const val = e.target.value;
                    if (val) setFormData(p => ({...p, particularId: val.padStart(5, '0')}));
                  }} required placeholder="Max 5 digits (e.g. 0001)" />
                </div>

                <div className="form-group">
                  <label className="form-label">Default Unit *</label>
                  <select className="input-field" name="defaultUnit" value={formData.defaultUnit} onChange={handleInputChange} required>
                    {(settings?.units || ['Pcs', 'Kg', 'Ltr', 'Mtr']).map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Sales Rate *</label>
                    <input type="number" step="0.01" min="0" className="input-field" name="salesRate" value={formData.salesRate} onChange={handleInputChange} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Purchase Rate *</label>
                    <input type="number" step="0.01" min="0" className="input-field" name="purchaseRate" value={formData.purchaseRate} onChange={handleInputChange} required />
                  </div>
                </div>

                <div className={styles.divider}></div>
                
                <div className="form-group">
                  <label className="form-label">Initial Stock Quantity</label>
                  <input type="number" min="0" className="input-field" name="initialStockQuantity" value={formData.initialStockQuantity} onChange={handleInputChange} />
                </div>

                {Number(formData.initialStockQuantity) > 0 && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Opening Date (BS) *</label>
                      <NepaliDatePicker value={formData.date} onChange={(val) => setFormData(p => ({...p, date: val}))} className="input-field" required placeholder="YYYY-MM-DD" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Bill Number</label>
                      <input type="text" className="input-field" name="billNumber" value={formData.billNumber} onChange={handleInputChange} />
                    </div>
                  </>
                )}

              </form>
            </div>
            
            <div className={styles.modalFooter}>
              <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button type="submit" form="add-stock-form" className="btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : (isEditingStock ? 'Update Particular' : 'Add Particular')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
      )}

      {/* Action PIN Modal */}
      <ActionPinModal 
        isOpen={pinModalOpen} 
        onClose={() => {setPinModalOpen(false); setStockToDelete(null); setStockToEdit(null); setBillToDelete(null); setBillToEdit(null);}} 
        onSuccess={handlePinSuccess} 
        requiredPin={settings?.actionPin} 
        actionName={
          pinActionType === 'delete_stock' ? `delete particular ${stockToDelete?.particularName}` : 
          pinActionType === 'edit_stock' ? `edit particular ${stockToEdit?.particularName}` : 
          pinActionType === 'delete_bill' ? `delete Bill #${billToDelete?.billNumber}` : 
          pinActionType === 'edit_bill' ? `edit Bill #${billToEdit?.billNumber}` : 
          'perform action'
        }
      />

      {/* Custom Delete Stock Confirmation Modal */}
      {deleteStockConfirmOpen && (
        createPortal(
        <div className={styles.modalOverlay} onClick={() => { setDeleteStockConfirmOpen(false); setStockToDelete(null); }}>
          <div className={`${styles.modal} glass-panel animate-fade-in`} onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', height: 'auto', padding: '2rem', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '50%', color: '#ef4444' }}>
                <Trash2 size={32} />
              </div>
            </div>
            <h3 className="heading-3" style={{ marginBottom: '1rem' }}>Confirm Deletion</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Are you sure you want to delete particular "{stockToDelete?.particularName}"? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                className="btn-secondary" 
                onClick={() => {
                  setDeleteStockConfirmOpen(false);
                  setStockToDelete(null);
                }}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button 
                className="btn-primary" 
                onClick={() => executeDelete()}
                style={{ flex: 1, backgroundColor: '#ef4444' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
      )}

      {/* Custom Delete Bill Confirmation Modal */}
      {deleteBillConfirmOpen && (
        createPortal(
        <div className={styles.modalOverlay} onClick={() => { setDeleteBillConfirmOpen(false); setBillToDelete(null); }}>
          <div className={`${styles.modal} glass-panel animate-fade-in`} onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', height: 'auto', padding: '2rem', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '50%', color: '#ef4444' }}>
                <Trash2 size={32} />
              </div>
            </div>
            <h3 className="heading-3" style={{ marginBottom: '1rem' }}>Confirm Deletion</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Are you sure you want to delete Bill #{billToDelete?.billNumber}? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                className="btn-secondary" 
                onClick={() => {
                  setDeleteBillConfirmOpen(false);
                  setBillToDelete(null);
                }}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button 
                className="btn-primary" 
                onClick={() => executeDeleteBill()}
                style={{ flex: 1, backgroundColor: '#ef4444' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
      )}

      {/* Edit Bill Modal */}
      {editBillModalOpen && billToEdit && (
        createPortal(
        <EditBillModal 
          bill={billToEdit.bill}
          onClose={() => {
            setEditBillModalOpen(false);
            setBillToEdit(null);
          }}
          onSave={(updatedBill) => {
            setEditBillModalOpen(false);
            setBillToEdit(null);
            if (selectedStock) {
              loadStockEntries(selectedStock.particularName);
            }
          }}
        />,
        document.body
      )
      )}
    </div>
  );
};

export default Stock;
