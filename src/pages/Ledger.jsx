import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { getCustomers, addCustomer, updateCustomer, getSettings, deleteRecord, getBills } from '../services/db';
import { getFiscalYearDateRange, getMonthIndex } from '../utils/fiscalYear';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import NepaliDatePicker from '../components/NepaliDatePicker';
import ActionPinModal from '../components/ActionPinModal';
import EditBillModal from '../components/EditBillModal';
import { Search, Plus, Edit, Trash2, MapPin, Phone, CreditCard, Tag, X, Printer, Save, ChevronLeft, ChevronRight } from 'lucide-react';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import styles from './Ledger.module.css';

const Ledger = () => {
  const { user } = useAuthStore();
  const { addToast, activeFiscalYear } = useAppStore();
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [settings, setSettings] = useState(null);
  
  // Selected Customer & Ledger Data
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinActionType, setPinActionType] = useState(null); // 'delete' or 'edit'
  
  const [deleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState(null);
  
  const [billToEdit, setBillToEdit] = useState(null);
  const [editBillModalOpen, setEditBillModalOpen] = useState(false);
  const [billToDelete, setBillToDelete] = useState(null);
  const [deleteBillConfirmOpen, setDeleteBillConfirmOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    customerName: '',
    type: 'Sale',
    address: '',
    contactNumber: '',
    panVatNo: '',
    openingBalance: '',
    date: '',
    particular: 'Opening Balance',
    billNumber: ''
  });

  useEffect(() => {
    if (user) loadCustomers();
  }, [user]);

  useEffect(() => {
    if (selectedCustomer) {
      loadLedgerEntries(selectedCustomer.panVatNo);
    }
  }, [selectedCustomer]);

  // When fiscal year changes, reset date filters to FY range
  useEffect(() => {
    if (activeFiscalYear) {
      const startMonth = settings?.fiscalYearStartMonth || 'Shrawan';
      const startMonthIdx = getMonthIndex(startMonth);
      const range = getFiscalYearDateRange(activeFiscalYear, startMonthIdx);
      setFromDate(range.from);
      setToDate(range.to);
    }
  }, [activeFiscalYear, settings]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const data = await getCustomers(user.uid);
      const bills = await getBills(user.uid);
      
      const enrichedData = data.map(customer => {
        const customerBills = bills.filter(b => b.panVatNo === customer.panVatNo);
        const totalBilled = customerBills.reduce((sum, b) => sum + (b.totalAmountWithTax || 0), 0);
        return {
          ...customer,
          calculatedTotalWithTax: totalBilled + (customer.openingBalance || 0)
        };
      });
      
      setCustomers(enrichedData);
      const userSettings = await getSettings(user.uid);
      setSettings(userSettings);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRequest = (customer) => {
    setCustomerToDelete(customer);
    if (settings?.actionPin) {
      setPinActionType('delete');
      setPinModalOpen(true);
    } else {
      setDeleteConfirmModalOpen(true);
    }
  };

  const handleEditRequest = (customer) => {
    setCustomerToEdit(customer);
    if (settings?.actionPin) {
      setPinActionType('edit');
      setPinModalOpen(true);
    } else {
      openEditModal(customer);
    }
  };

  const handlePinSuccess = () => {
    setPinModalOpen(false);
    if (pinActionType === 'delete') {
      setDeleteConfirmModalOpen(true);
    } else if (pinActionType === 'edit') {
      openEditModal(customerToEdit);
    } else if (pinActionType === 'delete_bill') {
      setDeleteBillConfirmOpen(true);
    } else if (pinActionType === 'edit_bill') {
      setEditBillModalOpen(true);
    }
  };

  const openEditModal = (customer) => {
    setFormData({
      customerName: customer.customerName || '',
      type: customer.type || 'Sale',
      address: customer.address || '',
      contactNumber: customer.contactNumber || '',
      panVatNo: customer.panVatNo || '',
      openingBalance: customer.openingBalance || '',
      date: customer.date || '', 
      particular: customer.particular || 'Opening Balance',
      billNumber: customer.billNumber || ''
    });
    setIsEditingCustomer(true);
    setShowAddModal(true);
  };

  const executeDelete = async (customerId = customerToDelete?.id) => {
    try {
      await deleteRecord(user.uid, 'ledger', customerId);
      setCustomers(customers.filter(c => c.id !== customerId));
      if (selectedCustomer?.id === customerId) setSelectedCustomer(null);
      setDeleteConfirmModalOpen(false);
      setCustomerToDelete(null);
    } catch (error) {
      console.error("Failed to delete customer", error);
      alert("Failed to delete customer.");
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

  const executeDeleteBill = async (billId = billToDelete?.id) => {
    try {
      await deleteRecord(user.uid, 'records', billId);
      setLedgerEntries(ledgerEntries.filter(b => b.id !== billId));
      setDeleteBillConfirmOpen(false);
      setBillToDelete(null);
      // We should ideally reload customers to update the total amount, but for now it's okay
      loadCustomers();
    } catch (error) {
      console.error("Failed to delete bill", error);
      alert("Failed to delete bill.");
    }
  };

  const loadLedgerEntries = async (panVatNo) => {
    setLoadingEntries(true);
    try {
      // Fetch all bills from the db service which uses the correct VAT_PAN namespace
      const allBills = await getBills(user.uid);
      const entries = allBills.filter(bill => bill.panVatNo === panVatNo);
      
      // Sort descending by timestamp
      entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setLedgerEntries(entries);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEntries(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value;
    if (name === 'contactNumber' && (value.length > 10 || !/^\d*$/.test(value))) return;
    if (name === 'panVatNo' && (value.length > 9 || !/^\d*$/.test(value))) return;
    if (name === 'customerName' || name === 'address') {
      formattedValue = value.replace(/\b\w/g, l => l.toUpperCase());
    }
    
    setFormData(prev => {
      const newData = { ...prev, [name]: formattedValue };
      if (name === 'openingBalance' && formattedValue && !prev.date) {
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
    
    if (!formData.panVatNo || formData.panVatNo.length !== 9) {
      addToast("PAN/VAT No. must be exactly 9 digits.", "error");
      return;
    }

    if (formData.openingBalance && !formData.date) {
      addToast("Date is required when Opening Balance is entered.", "error");
      return;
    }

    // Check for duplicate PAN/VAT No.
    if (isEditingCustomer) {
      const exists = customers.find(c => c.panVatNo === formData.panVatNo && c.id !== customerToEdit.id);
      if (exists) {
        addToast(`PAN/VAT No. already exists for customer "${exists.customerName}".`, 'error');
        return;
      }
    } else {
      const exists = customers.find(c => c.panVatNo === formData.panVatNo);
      if (exists) {
        addToast(`PAN/VAT No. already exists for customer "${exists.customerName}".`, 'error');
        return;
      }
    }

    try {
      const customerData = {
        ...formData,
        openingBalance: Number(formData.openingBalance) || 0,
      };
      
      if (isEditingCustomer) {
        await updateCustomer(user.uid, customerToEdit.id, customerData);
      } else {
        customerData.createdAt = new Date().toISOString();
        await addCustomer(user.uid, customerData);
      }
      
      setFormData({
        customerName: '', type: 'Sale', address: '', contactNumber: '', 
        panVatNo: '', openingBalance: '', date: '', particular: 'Opening Balance', billNumber: ''
      });
      setShowAddModal(false);
      setIsEditingCustomer(false);
      setCustomerToEdit(null);
      loadCustomers();
    } catch (err) {
      console.error("Error saving customer:", err);
      alert("Failed to save customer");
    }
  };

  const filteredCustomers = customers.filter(c => 
    (c.customerName && c.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.address && c.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.panVatNo && c.panVatNo.includes(searchTerm)) ||
    (c.contactNumber && c.contactNumber.includes(searchTerm))
  );

  const filteredEntries = ledgerEntries.filter(entry => {
    if (fromDate && entry.date < fromDate) return false;
    if (toDate && entry.date > toDate) return false;
    return true;
  });

  const totalAmount = filteredEntries.reduce((sum, entry) => sum + (entry.total || 0), 0);
  const totalAmountWithTax = filteredEntries.reduce((sum, entry) => sum + (entry.totalAmountWithTax || 0), 0) + (selectedCustomer?.openingBalance || 0);

  const generateLedgerPDF = () => {
    if (!selectedCustomer) return;

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
    doc.text("CUSTOMER LEDGER STATEMENT", 105, yPos, { align: "center" });
    yPos += 12;

    // Customer Details
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Customer Name: ${selectedCustomer.customerName}`, margin, yPos);
    
    // Right side Date Range
    const dateText = (fromDate || toDate) ? 
      `Date Range: ${fromDate || '...'} to ${toDate || '...'}` : 
      `Date Range: All`;
    doc.text(dateText, 200 - margin, yPos, { align: "right" });
    
    yPos += 8;

    // Table Data
    const tableColumn = ["Date (BS)", "Particular", "Bill Number", "Total", "Total with Tax"];
    const tableRows = [];

    // Opening Balance Row
    if (selectedCustomer.openingBalance) {
      tableRows.push([
        selectedCustomer.date || "",
        "Opening Balance",
        "",
        "",
        `Rs. ${selectedCustomer.openingBalance.toFixed(2)}`
      ]);
    }

    filteredEntries.forEach(entry => {
      tableRows.push([
        entry.date,
        `Bill #${entry.billNumber}`,
        entry.billNumber,
        `Rs. ${entry.total?.toFixed(2)}`,
        `Rs. ${entry.totalAmountWithTax?.toFixed(2)}`
      ]);
    });

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
        fontStyle: 'bold',
        halign: 'center'
      },
      footStyles: {
        fontStyle: 'bold',
        halign: 'center',
        lineWidth: { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 }
      },
      foot: [
        [
          '', '', '', 
          `Total: Rs. ${totalAmount.toFixed(2)}`, 
          `Grand Total: Rs. ${totalAmountWithTax.toFixed(2)}`
        ]
      ]
    });

    window.open(doc.output('bloburl'), '_blank');
  };

  return (
    <div className={`animate-fade-in ${styles.container}`}>
      <div className={`${styles.contentGrid} ${!isLeftPanelOpen ? styles.contentGridCollapsed : ''}`}>
        
        {/* Left Side: Customers List */}
        <div className={`${styles.leftPanel} ${!isLeftPanelOpen ? styles.leftPanelCollapsed : ''}`}>
          <div className={styles.leftPanelHeader}>
            <div className={styles.searchBox}>
              <Search size={18} className={styles.searchIcon} />
              <input 
                type="text" 
                className="input-field" 
                placeholder="Search customers..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="btn-primary" onClick={() => {
              setFormData({
                customerName: '', type: 'Sale', address: '', contactNumber: '', 
                panVatNo: '', openingBalance: '', date: '', particular: 'Opening Balance', billNumber: ''
              });
              setIsEditingCustomer(false);
              setCustomerToEdit(null);
              setShowAddModal(true);
            }}>
              <Plus size={18} /> New
            </button>
          </div>

          <div className={styles.customerList}>
            {loading ? (
              <div className={styles.loadingState}>Loading...</div>
            ) : filteredCustomers.length === 0 ? (
              <div className={styles.emptyState}>No customers found.</div>
            ) : (
              filteredCustomers.map(customer => (
                <div 
                  key={customer.id} 
                  className={`${styles.customerCard} glass-panel ${selectedCustomer?.id === customer.id ? styles.activeCard : ''}`}
                  onClick={() => setSelectedCustomer(customer)}
                >
                  <div className={styles.cardHeader}>
                    <h3 className={styles.customerName}>{customer.customerName}</h3>
                  </div>
                  
                  <div className={styles.cardBody}>
                    <div className={styles.infoRow}>
                      <MapPin size={14} /> <span>{customer.address}</span>
                    </div>
                    {customer.contactNumber && (
                      <div className={styles.infoRow}>
                        <Phone size={14} /> <span>{customer.contactNumber}</span>
                      </div>
                    )}
                    {customer.panVatNo && (
                      <div className={styles.infoRow}>
                        <CreditCard size={14} /> <span>{customer.panVatNo}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className={styles.cardFooter}>
                    <span className={styles.tag}>{customer.type}</span>
                    <span className={styles.balance}>Total With Tax: Rs. {(customer.calculatedTotalWithTax || 0).toFixed(2)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Customer Ledger Details */}
        <div className={`${styles.rightPanel} glass-panel`}>
          {selectedCustomer ? (
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
                    <h2 className="heading-2" style={{margin: 0}}>{selectedCustomer.customerName}</h2>
                  </div>
                  <div className={styles.ledgerMeta}>
                    <span><MapPin size={14}/> {selectedCustomer.address}</span>
                    <span><Phone size={14}/> {selectedCustomer.contactNumber || 'N/A'}</span>
                    <span><CreditCard size={14}/> {selectedCustomer.panVatNo}</span>
                    <span className={styles.tag}>{selectedCustomer.type}</span>
                  </div>
                </div>
                <div className={styles.actions}>
                  <button className={styles.iconBtn} onClick={() => handleEditRequest(selectedCustomer)}><Edit size={18} /></button>
                  <button className={`${styles.iconBtn} ${styles.danger}`} onClick={() => handleDeleteRequest(selectedCustomer)}><Trash2 size={18} /></button>
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
                <button className="btn-secondary" onClick={generateLedgerPDF}>
                  <Printer size={18} /> Print
                </button>
              </div>

              <div className={styles.statsCards}>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Total Amount</div>
                  <div className={styles.statValue}>Rs. {totalAmount.toFixed(2)}</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Total With Tax</div>
                  <div className={styles.statValue}>Rs. {totalAmountWithTax.toFixed(2)}</div>
                </div>
              </div>

              <div className={styles.tableResponsive}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Date (BS)</th>
                      <th>Particular</th>
                      <th>Bill Number</th>
                      <th>Total</th>
                      <th>Total with Tax</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingEntries ? (
                      <tr><td colSpan="6" style={{textAlign: 'center', padding: '2rem'}}>Loading...</td></tr>
                    ) : (filteredEntries.length === 0 && !selectedCustomer?.openingBalance) ? (
                      <tr><td colSpan="6" style={{textAlign: 'center', padding: '2rem'}}>No records found.</td></tr>
                    ) : (
                      <>
                        {selectedCustomer?.openingBalance ? (
                          <tr>
                            <td>{selectedCustomer.date || "-"}</td>
                            <td>{selectedCustomer.particular || "Opening Balance"}</td>
                            <td>{selectedCustomer.billNumber || "-"}</td>
                            <td>-</td>
                            <td style={{fontWeight: 600}}>Rs. {Number(selectedCustomer.openingBalance).toFixed(2)}</td>
                            <td></td>
                          </tr>
                        ) : null}
                        {filteredEntries.map(entry => (
                          <tr key={entry.id}>
                            <td>{entry.date}</td>
                            <td>Bill #{entry.billNumber}</td>
                            <td>{entry.billNumber}</td>
                            <td>Rs. {entry.total?.toFixed(2)}</td>
                            <td style={{fontWeight: 600}}>Rs. {entry.totalAmountWithTax?.toFixed(2)}</td>
                            <td>
                              <div className={styles.actions}>
                                <button className={styles.iconBtn} onClick={() => handleEditBillRequest(entry)}><Edit size={14} /></button>
                                <button className={`${styles.iconBtn} ${styles.danger}`} onClick={() => handleDeleteBillRequest(entry)}><Trash2 size={14} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
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
              Select a customer from the left to view their ledger records.
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Customer Modal */}
      {showAddModal && createPortal((
        <div className={styles.modalOverlay} onClick={() => {
          setShowAddModal(false);
          setIsEditingCustomer(false);
          setCustomerToEdit(null);
        }}>
          <div className={`${styles.modal} glass-panel animate-fade-in`} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className="heading-2" style={{marginBottom: 0}}>{isEditingCustomer ? 'Edit Customer' : 'Add New Customer'}</h2>
              <button className={styles.closeBtn} onClick={() => {
                setShowAddModal(false);
                setIsEditingCustomer(false);
                setCustomerToEdit(null);
              }}>
                <X size={20} />
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <form onSubmit={handleSubmit} id="add-customer-form" className={styles.form}>
                
                <div className="form-group">
                  <label className="form-label">Customer Name *</label>
                  <input type="text" className="input-field" name="customerName" value={formData.customerName} onChange={handleInputChange} required autoFocus />
                </div>
                
                <div className="form-group">
                    <label className="form-label">Type *</label>
                    <div className={styles.toggleGroup}>
                      <button 
                        type="button"
                        className={`${styles.toggleBtn} ${formData.type === 'Sale' ? styles.active : ''}`}
                        onClick={() => setFormData({...formData, type: 'Sale'})}
                      >
                        Sale (Debtor)
                      </button>
                      <button 
                        type="button"
                        className={`${styles.toggleBtn} ${formData.type === 'Purchase' ? styles.active : ''}`}
                        onClick={() => setFormData({...formData, type: 'Purchase'})}
                      >
                        Purchase (Creditor)
                      </button>
                    </div>
                  </div>

                <div className="form-group">
                  <label className="form-label">Address *</label>
                  <input type="text" className="input-field" name="address" value={formData.address} onChange={handleInputChange} required />
                </div>

                <div className="form-group">
                  <label className="form-label">Contact Number</label>
                  <input type="text" className="input-field" name="contactNumber" value={formData.contactNumber} onChange={handleInputChange} maxLength="10" />
                </div>

                <div className="form-group">
                  <label className="form-label">PAN/VAT No. *</label>
                  <input type="text" className="input-field" name="panVatNo" value={formData.panVatNo} onChange={handleInputChange} required />
                </div>

                <div className={styles.divider}></div>
                
                <div className="form-group">
                  <label className="form-label">Opening Balance (Optional)</label>
                  <input type="number" step="0.01" min="1" onKeyDown={(e) => { if (e.key === '-') e.preventDefault(); }} className="input-field" name="openingBalance" value={formData.openingBalance} onChange={handleInputChange} />
                </div>

                {formData.openingBalance && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Date (BS) *</label>
                      <NepaliDatePicker value={formData.date} onChange={(val) => setFormData(p => ({...p, date: val}))} required placeholder="YYYY-MM-DD" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Particular *</label>
                      <input type="text" className="input-field" name="particular" value={formData.particular} onChange={handleInputChange} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Bill Number *</label>
                      <input type="text" className="input-field" name="billNumber" value={formData.billNumber} onChange={handleInputChange} required />
                    </div>
                  </>
                )}
              </form>
            </div>
            <div className={styles.modalFooter}>
              <button className="btn-secondary" onClick={() => {
                setShowAddModal(false);
                setIsEditingCustomer(false);
                setCustomerToEdit(null);
              }}>
                Cancel
              </button>
              <button type="submit" form="add-customer-form" className="btn-primary">
                <Save size={18} /> {isEditingCustomer ? 'Save Changes' : 'Save Customer'}
              </button>
            </div>
          </div>
        </div>
      ), document.body)}

      {/* Action PIN Modal */}
      <ActionPinModal 
        isOpen={pinModalOpen} 
        onClose={() => {setPinModalOpen(false); setCustomerToDelete(null); setCustomerToEdit(null); setBillToDelete(null); setBillToEdit(null);}} 
        onSuccess={handlePinSuccess} 
        requiredPin={settings?.actionPin} 
        actionName={
          pinActionType === 'delete_bill' ? `delete Bill #${billToDelete?.billNumber}` : 
          pinActionType === 'edit_bill' ? `edit Bill #${billToEdit?.billNumber}` : 
          `${pinActionType} Customer`
        }
      />

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirmModalOpen && createPortal((
        <div className={styles.modalOverlay} onClick={() => { setDeleteConfirmModalOpen(false); setCustomerToDelete(null); }}>
          <div className={`${styles.modal} glass-panel animate-fade-in`} onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', height: 'auto', padding: '2rem', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '50%', color: '#ef4444' }}>
                <Trash2 size={32} />
              </div>
            </div>
            <h3 className="heading-3" style={{ marginBottom: '1rem' }}>Confirm Deletion</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Are you sure you want to delete {customerToDelete?.customerName}? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                className="btn-secondary" 
                onClick={() => {
                  setDeleteConfirmModalOpen(false);
                  setCustomerToDelete(null);
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
      ), document.body)}

      {/* Custom Delete Bill Confirmation Modal */}
      {deleteBillConfirmOpen && createPortal((
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
        </div>
      ), document.body)}

      {/* Edit Bill Modal */}
      {editBillModalOpen && billToEdit && (
        <EditBillModal 
          bill={billToEdit}
          onClose={() => {
            setEditBillModalOpen(false);
            setBillToEdit(null);
          }}
          onSave={(updatedBill) => {
            setLedgerEntries(ledgerEntries.map(b => b.id === updatedBill.id ? updatedBill : b));
            setEditBillModalOpen(false);
            setBillToEdit(null);
            loadCustomers(); // Reload customer stats
          }}
        />
      )}
    </div>
  );
};

export default Ledger;
