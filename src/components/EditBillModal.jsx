import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { getCustomerByPan, getSettings, getStocks, updateBill } from '../services/db';
import NepaliDatePicker from './NepaliDatePicker';
import { Plus, Trash2, Save, X, Download } from 'lucide-react';
import styles from '../pages/VATBill.module.css';

const EditBillModal = ({ bill, onClose, onSave, onDownload }) => {
  const { user } = useAuthStore();
  const { addToast } = useAppStore();
  
  const [type, setType] = useState(bill.type || 'Sale');
  const [billNo, setBillNo] = useState(bill.billNumber || '');
  const [date, setDate] = useState(bill.date || '');
  
  const [customer, setCustomer] = useState({
    name: bill.customerName || '',
    address: bill.address || '',
    contact: bill.contactNumber || '',
    pan: bill.panVatNo || ''
  });
  
  const [items, setItems] = useState(
    (bill.items || []).map((item, index) => ({
      ...item,
      id: Date.now() + index // Re-inject ID for React rendering
    }))
  );
  const [vatPercent, setVatPercent] = useState(bill.vatPercentage || 13);
  
  // Stock selection state
  const [stocks, setStocks] = useState([]);
  const [activeItemIndex, setActiveItemIndex] = useState(null);
  const [stockSearch, setStockSearch] = useState('');
  const [highlightedOptionIndex, setHighlightedOptionIndex] = useState(0);
  const panInputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState(null);
  
  // Load initial data
  useEffect(() => {
    if (user) {
      loadInitialData();
    }
  }, [user]);

  const loadInitialData = async () => {
    try {
      const fetchedSettings = await getSettings(user.uid);
      if (fetchedSettings) {
        setSettings(fetchedSettings);
      }
      const stockData = await getStocks(user.uid);
      setStocks(stockData);
    } catch (err) {
      console.error(err);
    }
  };

  // Auto-fetch customer details when PAN reaches 9 digits
  useEffect(() => {
    const fetchCustomer = async () => {
      if (customer.pan.length >= 9 && user) {
        const existingCustomer = await getCustomerByPan(user.uid, customer.pan);
        if (existingCustomer) {
          setCustomer(prev => ({
            ...prev,
            name: existingCustomer.customerName,
            address: existingCustomer.address,
            contact: existingCustomer.contactNumber
          }));
          if (existingCustomer.type) {
            setType(existingCustomer.type);
          }
        }
      }
    };
    fetchCustomer();
  }, [customer.pan, user]);

  const handleCustomerChange = (e) => {
    const { name, value } = e.target;
    
    // Capitalize first letter of words for name and address
    let formattedValue = value;
    if (name === 'name' || name === 'address') {
      formattedValue = value.replace(/\b\w/g, l => l.toUpperCase());
    }
    
    if (name === 'contact' && (value.length > 10 || !/^\d*$/.test(value))) return;
    if (name === 'pan' && (value.length > 9 || !/^\d*$/.test(value))) return;
    
    setCustomer(prev => ({ ...prev, [name]: formattedValue }));
  };

  const addItem = () => {
    const lastItem = items[items.length - 1];
    if (lastItem && (!lastItem.particular || lastItem.qty <= 0 || lastItem.rate <= 0)) {
      addToast("Please fill the current item details before adding a new one.", "error");
      return;
    }
    setError(null);
    setItems([...items, { id: Date.now(), particular: '', qty: '', unit: 'Pcs', rate: 0, amount: 0 }]);
  };

  const removeItem = (id) => {
    setItems(items.filter(item => item.id !== id));
  };

  const getAvailableStock = (particularName, currentItemId) => {
    const stockInfo = stocks.find(s => s.particularName === particularName);
    if (!stockInfo) return null;

    const usedQty = items
      .filter(item => item.id !== currentItemId && item.particular === particularName)
      .reduce((sum, item) => sum + (Number(item.qty) || 0), 0);

    return stockInfo.currentStock - usedQty;
  };

  const updateItem = (id, field, value) => {
    setItems(items.map(item => {
      if (item.id === id) {
        let newValue = value;
        
        if (field === 'qty') {
          if (newValue === '') {
            newValue = '';
          } else {
            newValue = Number(newValue);
          }
          
          if (item.particular && type === 'Sale' && newValue !== '') {
            const available = getAvailableStock(item.particular, id);
            if (available !== null && newValue > available) {
              addToast(`Currently only ${available} is available for ${item.particular}`, 'error');
              newValue = '';
            }
          }
        }
        
        const updatedItem = { ...item, [field]: newValue };
        if (field === 'qty' || field === 'rate') {
          updatedItem.amount = Number(((Number(updatedItem.qty) || 0) * updatedItem.rate).toFixed(2));
        }
        return updatedItem;
      }
      return item;
    }));
  };

  const filteredStocks = stocks.filter(stock => 
    stock.particularName.toLowerCase().includes(stockSearch.toLowerCase())
  );

  const handleStockInputFocus = (index, value) => {
    setActiveItemIndex(index);
    setStockSearch(value);
    setHighlightedOptionIndex(0);
  };

  const handleStockSearchChange = (index, value) => {
    setStockSearch(value);
    setHighlightedOptionIndex(0);
    updateItem(items[index].id, 'particular', value);
  };

  const handleStockInputBlur = () => {
    setTimeout(() => {
      setActiveItemIndex(null);
    }, 200);
  };

  const selectStock = (index, stock) => {
    const itemToUpdate = items[index];
    if (itemToUpdate) {
      let newQty = itemToUpdate.qty;
      
      if (type === 'Sale') {
        const available = getAvailableStock(stock.particularName, itemToUpdate.id);
        if (available !== null && newQty !== '' && newQty > available) {
          addToast(`Currently only ${available} is available for ${stock.particularName}`, 'error');
          newQty = '';
        }
      }

      const newItems = [...items];
      newItems[index] = {
        ...itemToUpdate,
        particular: stock.particularName,
        unit: stock.defaultUnit,
        rate: stock.price,
        qty: newQty,
        amount: Number(((Number(newQty) || 0) * stock.price).toFixed(2))
      };
      setItems(newItems);
    }
    setActiveItemIndex(null);
    setError(null);
  };

  const handleStockKeyDown = (e, index) => {
    if (activeItemIndex !== index) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedOptionIndex(prev => prev < filteredStocks.length - 1 ? prev + 1 : prev);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedOptionIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredStocks[highlightedOptionIndex]) {
        selectStock(index, filteredStocks[highlightedOptionIndex]);
      }
    } else if (e.key === 'Escape') {
      setActiveItemIndex(null);
    }
  };

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const vatAmount = (totalAmount * vatPercent) / 100;
  const grandTotal = totalAmount + vatAmount;

  const validateForm = () => {
    if (!billNo || billNo.toString().trim() === '') {
      addToast("Please enter a valid Bill No.", "error");
      document.querySelector('input[name="billNo"]')?.focus();
      return false;
    }
    if (!customer.pan || customer.pan.length !== 9) {
      addToast("Please enter a valid 9-digit PAN/VAT No.", "error");
      document.querySelector('input[name="pan"]')?.focus();
      return false;
    }
    if (!customer.name) {
      addToast("Please enter the customer name.", "error");
      document.querySelector('input[name="name"]')?.focus();
      return false;
    }
    if (!customer.address) {
      addToast("Please enter the customer address.", "error");
      document.querySelector('input[name="address"]')?.focus();
      return false;
    }
    
    if (items.length === 0) {
      addToast("Please add at least one item.", "error");
      return false;
    }
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.particular) {
        addToast(`Please enter particular name for item ${i + 1}.`, "error");
        document.getElementById(`particular-${i}`)?.focus();
        return false;
      }
      if (item.qty === '' || item.qty <= 0) {
        addToast(`Please enter a valid quantity for item ${i + 1}.`, "error");
        document.getElementById(`qty-${i}`)?.focus();
        return false;
      }
      if (item.rate === '' || item.rate < 0) {
        addToast(`Please enter a valid rate for item ${i + 1}.`, "error");
        document.getElementById(`rate-${i}`)?.focus();
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const billData = {
        ...bill,
        type,
        date,
        customerName: customer.name,
        address: customer.address,
        contactNumber: customer.contact,
        panVatNo: customer.pan,
        items: items.map(({ id, ...rest }) => rest), // remove internal id
        total: totalAmount,
        vatPercentage: vatPercent,
        vatAmount: vatAmount,
        totalAmountWithTax: grandTotal,
        lastUpdated: new Date().toISOString()
      };
      
      const updatedBill = await updateBill(user.uid, bill.id, billData);
      
      alert('Bill updated successfully!');
      onSave(updatedBill);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className={`animate-fade-in ${styles.container}`} style={{ backgroundColor: 'var(--bg-secondary)', width: '100%', maxWidth: '1000px', maxHeight: '95vh', overflowY: 'auto', padding: '2rem', position: 'relative', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
        
        <button onClick={onClose} style={{ position: 'absolute', top: '0.7rem', right: '0.7rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
          <X size={24} />
        </button>

        <div className={styles.header}>
          <h1 className="heading-1">Edit Bill #{billNo}</h1>
          <div className={styles.toggleGroup}>
            <button className={`${styles.toggleBtn} ${type === 'Sale' ? styles.active : ''}`} onClick={() => setType('Sale')}>Sale</button>
            <button className={`${styles.toggleBtn} ${type === 'Purchase' ? styles.active : ''}`} onClick={() => setType('Purchase')}>Purchase</button>
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={`${styles.card} glass-panel`} style={{ marginBottom: '1.5rem' }}>
          <div className={styles.formGrid}>
            <div className="form-group">
              <label className="form-label">Bill No *</label>
              <input type="text" name="billNo" className="input-field" value={billNo} onChange={(e) => setBillNo(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Date (BS) *</label>
              <NepaliDatePicker value={date} onChange={setDate} required />
            </div>
            <div className="form-group">
              <label className="form-label">PAN/VAT No. *</label>
              <input 
                ref={panInputRef}
                type="text" className="input-field" name="pan"
                value={customer.pan} onChange={handleCustomerChange}
                placeholder="9 digits"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Customer Name *</label>
              <input type="text" className="input-field" name="name" value={customer.name} onChange={handleCustomerChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Address *</label>
              <input type="text" className="input-field" name="address" value={customer.address} onChange={handleCustomerChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Contact Number</label>
              <input type="text" className="input-field" name="contact" value={customer.contact} onChange={handleCustomerChange} placeholder="10 digits max" />
            </div>
          </div>
        </div>

        <div className={`${styles.card} glass-panel`} style={{ marginBottom: '1.5rem' }}>
          <div className={styles.tableResponsive}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>S.N. *</th>
                  <th>Particular *</th>
                  <th>QTY *</th>
                  <th>UNIT *</th>
                  <th>RATE *</th>
                  <th>AMOUNT</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id}>
                    <td>{index + 1}</td>
                    <td>
                      <div className={styles.autocompleteWrapper}>
                        <input 
                          id={`particular-${index}`}
                          type="text" className="input-field" value={item.particular}
                          onChange={(e) => handleStockSearchChange(index, e.target.value)}
                          onFocus={() => handleStockInputFocus(index, item.particular)}
                          onBlur={handleStockInputBlur}
                          onKeyDown={(e) => handleStockKeyDown(e, index)}
                          placeholder="Type to search..."
                        />
                        {activeItemIndex === index && filteredStocks.length > 0 && (
                          <ul className={styles.autocompleteDropdown}>
                            {filteredStocks.map((stock, idx) => (
                              <li 
                                key={stock.id}
                                className={`${styles.autocompleteItem} ${highlightedOptionIndex === idx ? styles.autocompleteItemActive : ''}`}
                                onMouseDown={(e) => { e.preventDefault(); selectStock(index, stock); }}
                                onMouseEnter={() => setHighlightedOptionIndex(idx)}
                              >
                                <div className={styles.autocompleteItemName}>{stock.particularName}</div>
                                <div className={styles.autocompleteItemDetails}>
                                  <span>Rs. {stock.price}</span>
                                  <span>{stock.currentStock} {stock.defaultUnit} left</span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </td>
                    <td><input id={`qty-${index}`} type="number" className="input-field" value={item.qty} onChange={(e) => updateItem(item.id, 'qty', e.target.value)} onKeyDown={(e) => { if (e.key === 'Tab' && item.qty && item.particular && index === items.length - 1) { e.preventDefault(); addItem(); setTimeout(() => document.getElementById(`particular-${index + 1}`)?.focus(), 50); } }} /></td>
                    <td><input type="text" className="input-field" value={item.unit} disabled tabIndex="-1" /></td>
                    <td><input id={`rate-${index}`} type="number" className="input-field" value={item.rate} onChange={(e) => updateItem(item.id, 'rate', e.target.value)} step="0.01" min="0" tabIndex="-1" /></td>
                    <td><input type="text" className="input-field" value={Number(item.amount || 0).toFixed(2)} disabled tabIndex="-1" /></td>
                    <td><button className={styles.iconBtn} onClick={() => removeItem(item.id)}><Trash2 size={18} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className={styles.addBtnContainer}>
            <button className="btn-secondary" onClick={addItem}><Plus size={18} /> Add Item</button>
          </div>

          <div className={styles.totalsContainer}>
            <div className={styles.totalRow}><span>Total:</span><span>Rs. {totalAmount.toFixed(2)}</span></div>
            <div className={styles.totalRow}><span>TAX/VAT ({vatPercent}%):</span><span>Rs. {vatAmount.toFixed(2)}</span></div>
            <div className={`${styles.totalRow} ${styles.grandTotal}`}><span>Total Amount with Tax:</span><span>Rs. {grandTotal.toFixed(2)}</span></div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          {onDownload && (
            <button className="btn-secondary" onClick={() => onDownload(bill)}>
              <Download size={18} /> Download
            </button>
          )}
          <button className="btn-primary" onClick={handleSave} disabled={loading || items.length === 0}>
            <Save size={18} /> {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default EditBillModal;
