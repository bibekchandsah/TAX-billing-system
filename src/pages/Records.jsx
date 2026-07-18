import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { getBills, deleteRecord, getSettings } from '../services/db';
import { getFiscalYearDateRange, getMonthIndex, getTodayBSDateString } from '../utils/fiscalYear';
import { Search, Filter, Eye, Edit, Download, Trash2, X } from 'lucide-react';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import NepaliDatePicker from '../components/NepaliDatePicker';
import ActionPinModal from '../components/ActionPinModal';
import EditBillModal from '../components/EditBillModal';
import styles from './Records.module.css';

const Records = () => {
  const { user, profile } = useAuthStore();
  const { activeFiscalYear, activeMonth, addToast } = useAppStore();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  const [settings, setSettings] = useState(null);
  const [viewBill, setViewBill] = useState(null);
  
  // PIN Modal State
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinActionType, setPinActionType] = useState(null); // 'delete' or 'edit'
  
  const [deleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState(false);
  const [billToDelete, setBillToDelete] = useState(null);
  
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [billToEdit, setBillToEdit] = useState(null);

  useEffect(() => {
    if (user) {
      loadBills();
    }
  }, [user]);

  // We removed the useEffect that auto-populated fromDate and toDate from activeFiscalYear.
  // The filtering logic below now applies the FY date range transparently in the background if fromDate/toDate are empty.

  const loadBills = async () => {
    setLoading(true);
    try {
      const data = await getBills(user.uid);
      setBills(data);
      const userSettings = await getSettings(user.uid);
      setSettings(userSettings);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRequest = (bill) => {
    setBillToDelete(bill);
    if (settings?.actionPin) {
      setPinActionType('delete');
      setPinModalOpen(true);
    } else {
      setDeleteConfirmModalOpen(true);
    }
  };

  const handleEditRequest = (bill) => {
    setBillToEdit(bill);
    if (settings?.actionPin) {
      setPinActionType('edit');
      setPinModalOpen(true);
    } else {
      setEditModalOpen(true);
    }
  };

  const handlePinSuccess = () => {
    setPinModalOpen(false);
    if (pinActionType === 'delete') {
      setDeleteConfirmModalOpen(true);
    } else if (pinActionType === 'edit') {
      setEditModalOpen(true);
    }
  };

  const executeDelete = async (billId = billToDelete?.id) => {
    try {
      await deleteRecord(user.uid, 'records', billId);
      setBills(bills.filter(b => b.id !== billId));
      setDeleteConfirmModalOpen(false);
      setBillToDelete(null);
    } catch (error) {
      console.error("Failed to delete", error);
      alert("Failed to delete record.");
    }
  };

  const generatePDF = (bill) => {
    const doc = new jsPDF();
    
    // Header
    const title = settings?.billTitle || `TAX/VAT INVOICE (${bill.type})`;
    const bName = settings?.businessName || profile?.businessName || 'Business Name';
    const address = settings?.businessAddress || '';
    const contact = settings?.businessContact || '';
    const pan = settings?.panVatNo || '';
    
    // 1. Bill Title (Larger & Bold)
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 105, 18, null, null, 'center');
    
    // 2. Business Name (Large, but normal weight)
    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text(bName, 105, 26, null, null, 'center');
    
    // 3. Address | Phone | PAN (Smaller, normal weight)
    doc.setFontSize(10);
    const subHeaderTextParts = [];
    if (address) subHeaderTextParts.push(address);
    if (contact) subHeaderTextParts.push(`Phone: ${contact}`);
    if (pan) subHeaderTextParts.push(`PAN/VAT No.: ${pan}`);
    const subHeaderText = subHeaderTextParts.join(' | ');
    doc.text(subHeaderText, 105, 32, null, null, 'center');
    
    // Customer Details (Left)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Customer Name: ', 14, 45);
    doc.setFont('helvetica', 'normal');
    doc.text(bill.customerName, 14 + doc.getTextWidth('Customer Name: ') + 2, 45);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Address: ', 14, 52);
    doc.setFont('helvetica', 'normal');
    doc.text(bill.address, 14 + doc.getTextWidth('Address: ') + 2, 52);
    
    doc.setFont('helvetica', 'bold');
    doc.text('PAN/VAT No.: ', 14, 59);
    doc.setFont('helvetica', 'normal');
    doc.text(bill.panVatNo, 14 + doc.getTextWidth('PAN/VAT No.: ') + 2, 59);
    
    // Bill Details (Right)
    doc.setFont('helvetica', 'bold');
    doc.text('Bill No: ', 150, 45);
    doc.setFont('helvetica', 'normal');
    doc.text(bill.billNumber, 150 + doc.getTextWidth('Bill No: ') + 2, 45);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Date (BS): ', 150, 52);
    doc.setFont('helvetica', 'normal');
    doc.text(bill.date, 150 + doc.getTextWidth('Date (BS): ') + 2, 52);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Contact: ', 150, 59);
    doc.setFont('helvetica', 'normal');
    doc.text(bill.contactNumber || 'N/A', 150 + doc.getTextWidth('Contact: ') + 2, 59);
    
    // Items Table
    const tableColumn = ["S.N.", "Particular", "QTY", "Unit", "Rate", "Amount"];
    const tableRows = [];
    
    bill.items.forEach((item, index) => {
      const itemData = [
        index + 1,
        item.particular,
        item.qty,
        item.unit,
        item.rate.toFixed(2),
        item.amount.toFixed(2)
      ];
      tableRows.push(itemData);
    });
    
    autoTable(doc, {
      startY: 70,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      headStyles: { 
        fillColor: [255, 255, 255], 
        textColor: [0, 0, 0], 
        fontStyle: 'bold', 
        lineWidth: 0.1, 
        lineColor: [0, 0, 0],
        halign: 'center'
      },
      bodyStyles: { 
        fillColor: [255, 255, 255], 
        textColor: [0, 0, 0], 
        lineWidth: { top: 0, right: 0.1, bottom: 0, left: 0.1 }, 
        lineColor: [0, 0, 0] 
      },
      columnStyles: {
        0: { halign: 'center' }, // S.N.
        1: { halign: 'left' },   // Particular
        2: { halign: 'center' }, // QTY
        3: { halign: 'center' }, // Unit
        4: { halign: 'center' }, // Rate
        5: { halign: 'center' }  // Amount
      },
      styles: { textColor: [0, 0, 0] },
      didDrawCell: function (data) {
        // Redraw the bottom border of the header row (top border of the first body row)
        if (data.row.section === 'body' && data.row.index === 0) {
          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(0.1);
          doc.line(data.cell.x, data.cell.y, data.cell.x + data.cell.width, data.cell.y);
        }
      }
    });
    
    // Draw bottom border for the table since body rows have bottom width 0
    const finalY = doc.lastAutoTable.finalY || 70;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.1);
    doc.line(14, finalY, 196, finalY);
    
    // Totals
    doc.setFontSize(10);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Total: Rs. ', 140, finalY + 10);
    doc.setFont('helvetica', 'normal');
    doc.text(bill.total.toFixed(2), 140 + doc.getTextWidth('Total: Rs. ') + 2, finalY + 10);
    
    doc.setFont('helvetica', 'bold');
    doc.text(`TAX/VAT (${bill.vatPercentage}%): Rs. `, 140, finalY + 17);
    doc.setFont('helvetica', 'normal');
    doc.text(bill.vatAmount.toFixed(2), 140 + doc.getTextWidth(`TAX/VAT (${bill.vatPercentage}%): Rs. `) + 2, finalY + 17);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Grand Total: Rs. ', 140, finalY + 25);
    doc.setFont('helvetica', 'normal');
    doc.text(bill.totalAmountWithTax.toFixed(2), 140 + doc.getTextWidth('Grand Total: Rs. ') + 2, finalY + 25);
    
    doc.save(`Bill_${bill.billNumber}.pdf`);
  };

  const filteredBills = bills.filter(bill => {
    const matchesSearch = 
      bill.billNumber.includes(searchTerm) ||
      bill.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bill.contactNumber.includes(searchTerm) ||
      bill.panVatNo.includes(searchTerm) ||
      bill.type.toLowerCase().includes(searchTerm.toLowerCase());
      
    let effFromDate = fromDate;
    let effToDate = toDate;
    
    if (!fromDate && !toDate && activeFiscalYear) {
      if (activeMonth === 'current') {
        // Resolve today's BS month dynamically
        const todayStr = getTodayBSDateString();
        const [yr, mo] = todayStr.split('-');
        const pad = (n) => String(n).padStart(2, '0');
        effFromDate = `${yr}-${pad(Number(mo))}-01`;
        effToDate   = `${yr}-${pad(Number(mo))}-32`;
      } else if (activeMonth) {
        const [yr, mo] = activeMonth.split('-');
        const pad = (n) => String(n).padStart(2, '0');
        effFromDate = `${yr}-${mo}-01`;
        effToDate   = `${yr}-${mo}-32`;
      } else {
        // All months of FY
        const startMonth = settings?.fiscalYearStartMonth || 'Shrawan';
        const startMonthIdx = getMonthIndex(startMonth);
        const range = getFiscalYearDateRange(activeFiscalYear, startMonthIdx);
        effFromDate = range.from;
        effToDate = range.to;
      }
    }

    const matchesFromDate = effFromDate ? bill.date >= effFromDate : true;
    const matchesToDate = effToDate ? bill.date <= effToDate : true;

    return matchesSearch && matchesFromDate && matchesToDate;
  });

  return (
    <div className={` ${styles.container}`}>
      <div className={`${styles.card} glass-panel`}>
        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <Search size={18} className={styles.searchIcon} />
            <input 
              type="text" 
              className="input-field" 
              placeholder="Search by Bill No, Name, Phone, PAN, Type..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                className={styles.clearSearchBtn}
                onClick={() => setSearchTerm('')}
                title="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className={styles.filters}>
            <div className={styles.dateWrapper}>
              <NepaliDatePicker value={fromDate} onChange={setFromDate} placeholder="From Date" />
            </div>
            <div className={styles.dateWrapper}>
              <NepaliDatePicker value={toDate} onChange={setToDate} placeholder="To Date" />
            </div>
            {(searchTerm || fromDate || toDate) && (
              <button className="btn-secondary" onClick={() => {setSearchTerm(''); setFromDate(''); setToDate('');}}>
                Clear Filters
              </button>
            )}
          </div>
        </div>

        <div className={styles.tableResponsive}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Bill No</th>
                <th>Date</th>
                <th>Customer Name</th>
                <th>Type</th>
                <th>Total</th>
                <th>Total with Tax</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{textAlign: 'center', padding: '2rem'}}>Loading...</td></tr>
              ) : filteredBills.length === 0 ? (
                <tr><td colSpan="7" style={{textAlign: 'center', padding: '2rem'}}>No records found.</td></tr>
              ) : (
                filteredBills.map(bill => (
                  <tr key={bill.id}>
                    <td>{bill.billNumber}</td>
                    <td>{bill.date}</td>
                    <td>
                      <div style={{fontWeight: 500}}>{bill.customerName}</div>
                      <div style={{fontSize: '0.8rem', color: 'var(--text-tertiary)'}}>{bill.panVatNo}</div>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${bill.type === 'Sale' ? styles.badgeSuccess : styles.badgeInfo}`}>
                        {bill.type}
                      </span>
                    </td>
                    <td>Rs. {bill.total?.toFixed(2)}</td>
                    <td style={{fontWeight: 600}}>Rs. {bill.totalAmountWithTax?.toFixed(2)}</td>
                    <td>
                      <div className={styles.actions}>
                        <button className={styles.iconBtn} title="View" onClick={() => setViewBill(bill)}><Eye size={16} /></button>
                        <button className={styles.iconBtn} title="Edit" onClick={() => handleEditRequest(bill)}><Edit size={16} /></button>
                        <button className={styles.iconBtn} title="Download PDF" onClick={() => generatePDF(bill)}><Download size={16} /></button>
                        <button className={`${styles.iconBtn} ${styles.danger}`} title="Delete" onClick={() => handleDeleteRequest(bill)}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Bill Modal */}
      {viewBill && (
        <div className={styles.modalOverlay} onClick={() => setViewBill(null)}>
          <div className={`${styles.modal} glass-panel animate-fade-in`} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className="heading-2" style={{marginBottom: 0}}>Bill #{viewBill.billNumber}</h2>
              <button className={styles.closeBtn} onClick={() => setViewBill(null)}>
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.invoiceHeader}>
                <div className={styles.billTo}>
                  <h3 className={styles.sectionTitle}>Billed To</h3>
                  <div className={styles.customerName}>{viewBill.customerName}</div>
                  {viewBill.address && <div className={styles.customerDetail}>{viewBill.address}</div>}
                  {viewBill.panVatNo && <div className={styles.customerDetail}>PAN/VAT: {viewBill.panVatNo}</div>}
                </div>
                <div className={styles.invoiceDetails}>
                  <div className={styles.detailRow}>
                    <span>Date:</span>
                    <strong>{viewBill.date}</strong>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Type:</span>
                    <span className={`${styles.badge} ${viewBill.type === 'Sale' ? styles.badgeSuccess : styles.badgeInfo}`}>
                      {viewBill.type}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.tableResponsive}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ width: '50px' }}>S.N.</th>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Rate</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewBill.items.map((item, index) => (
                      <tr key={index}>
                        <td>{index + 1}</td>
                        <td>{item.particular}</td>
                        <td>{item.qty} {item.unit}</td>
                        <td>Rs. {item.rate}</td>
                        <td style={{fontWeight: 500}}>Rs. {item.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={styles.invoiceSummary}>
                <div className={styles.summaryRow}>
                  <span>Subtotal:</span>
                  <span>Rs. {viewBill.total.toFixed(2)}</span>
                </div>
                {viewBill.taxAmount > 0 && (
                  <div className={styles.summaryRow}>
                    <span>VAT ({viewBill.vatPercentage}%):</span>
                    <span>Rs. {viewBill.taxAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className={`${styles.summaryRow} ${styles.grandTotal}`}>
                  <span>Grand Total:</span>
                  <span>Rs. {viewBill.totalAmountWithTax.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className="btn-secondary" onClick={() => setViewBill(null)}>Close</button>
              <button className="btn-primary" onClick={() => generatePDF(viewBill)}><Download size={18}/> Download PDF</button>
            </div>
          </div>
        </div>
      )}

      {/* Action PIN Modal */}
      <ActionPinModal 
        isOpen={pinModalOpen} 
        onClose={() => {setPinModalOpen(false); setBillToDelete(null); setBillToEdit(null);}} 
        onSuccess={handlePinSuccess} 
        requiredPin={settings?.actionPin} 
        actionName={`${pinActionType} Bill #${pinActionType === 'delete' ? billToDelete?.billNumber : billToEdit?.billNumber}`}
      />

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirmModalOpen && (
        <div className={styles.modalOverlay} onClick={() => { setDeleteConfirmModalOpen(false); setBillToDelete(null); }}>
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
                  setDeleteConfirmModalOpen(false);
                  setBillToDelete(null);
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
        </div>
      )}

      {/* Edit Bill Modal */}
      {editModalOpen && billToEdit && (
        <EditBillModal 
          bill={billToEdit}
          onClose={() => {
            setEditModalOpen(false);
            setBillToEdit(null);
          }}
          onSave={(updatedBill) => {
            setBills(bills.map(b => b.id === updatedBill.id ? updatedBill : b));
            setEditModalOpen(false);
            setBillToEdit(null);
          }}
          onDownload={generatePDF}
        />
      )}
    </div>
  );
};

export default Records;
