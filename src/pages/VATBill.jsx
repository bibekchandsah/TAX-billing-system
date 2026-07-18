import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { getLatestBillNumber, getCustomerByPan, getSettings, addBill, getStocks } from '../services/db';
import NepaliDatePicker from '../components/NepaliDatePicker';
import { Search, Plus, Trash2, Save, RefreshCw, X } from 'lucide-react';
import styles from './VATBill.module.css';

const VATBill = () => {
  const { user } = useAuthStore();
  const { addToast } = useAppStore();
  
  const [type, setType] = useState('Sale');
  const [billNo, setBillNo] = useState('0001');
  const [date, setDate] = useState('');
  
  const [customer, setCustomer] = useState({
    name: '',
    address: '',
    contact: '',
    pan: ''
  });
  
  const [items, setItems] = useState([{ id: Date.now(), particular: '', qty: '', unit: 'Pcs', rate: 0, amount: 0 }]);
  const [vatPercent, setVatPercent] = useState(13);
  
  // Stock selection state
  const [stocks, setStocks] = useState([]);
  const [activeItemIndex, setActiveItemIndex] = useState(null);
  const [stockSearch, setStockSearch] = useState('');
  const [highlightedOptionIndex, setHighlightedOptionIndex] = useState(0);
  const panInputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState(null);
  
  // Load initial data
  useEffect(() => {
    if (user) {
      loadInitialData();
    }
  }, [user, type]);

  const loadInitialData = async () => {
    try {
      if (type === 'Sale') {
        const nextBillNo = await getLatestBillNumber(user.uid, 'Sale');
        setBillNo(nextBillNo.toString().padStart(4, '0'));
      } else {
        setBillNo('');
      }
      
      const fetchedSettings = await getSettings(user.uid);
      if (fetchedSettings) {
        setSettings(fetchedSettings);
        if (fetchedSettings.vatPercentage) {
          setVatPercent(fetchedSettings.vatPercentage);
        }
      }
      
      // Auto set today's date if empty
      if (!date) {
        if (window.NepaliDatePicker) {
          const today = window.NepaliDatePicker.utils.getToday();
          setDate(`${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`);
        } else {
          setDate('2081-04-01');
        }
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
    // Validation: prevent adding new row if previous is empty
    const lastIndex = items.length - 1;
    const lastItem = items[lastIndex];
    
    if (lastItem) {
      if (!lastItem.particular) {
        addToast("Please fill the particular name before adding a new item.", "error");
        document.getElementById(`particular-${lastIndex}`)?.focus();
        return;
      }
      if (lastItem.qty === '' || lastItem.qty <= 0) {
        addToast("Please enter a valid quantity before adding a new item.", "error");
        document.getElementById(`qty-${lastIndex}`)?.focus();
        return;
      }
      if (lastItem.rate === '' || lastItem.rate <= 0) {
        addToast("Please enter a valid rate before adding a new item.", "error");
        document.getElementById(`rate-${lastIndex}`)?.focus();
        return;
      }
    }
    
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
              newValue = ''; // Clear it completely
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
    // Also update the particular name directly so they can type custom items if needed
    updateItem(items[index].id, 'particular', value);
  };

  const handleStockInputBlur = () => {
    // Delay closing so that clicking an option registers first
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
          newQty = ''; // Clear it completely
        }
      }

      const newItems = [...items];
      newItems[index] = {
        ...itemToUpdate,
        particular: stock.particularName,
        unit: stock.defaultUnit,
        rate: stock.price,
        qty: newQty,
        amount: Number((newQty * stock.price).toFixed(2))
      };
      setItems(newItems);
    }
    setActiveItemIndex(null);
    
    // Auto-focus quantity field after selection
    setTimeout(() => {
      const qtyInput = document.getElementById(`qty-${index}`);
      if (qtyInput) qtyInput.focus();
    }, 0);
  };

  const handleStockKeyDown = (e, index) => {
    if (activeItemIndex !== index) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedOptionIndex(prev => 
        prev < filteredStocks.length - 1 ? prev + 1 : prev
      );
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
    if (!billNo || billNo.trim() === '') {
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
    try {
      const existingCustomer = await getCustomerByPan(user.uid, customer.pan);
      if (existingCustomer && existingCustomer.customerName.toLowerCase() !== customer.name.toLowerCase()) {
        addToast(`PAN/VAT No. already exists for customer "${existingCustomer.customerName}".`, 'error');
        setLoading(false);
        return;
      }

      const billData = {
        type,
        billNumber: billNo,
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
        timestamp: new Date().toISOString()
      };
      
      await addBill(user.uid, billData);
      
      // Reset form
      handleReset();
      loadInitialData();
      addToast('Bill saved successfully!', 'success');
      
      // Focus PAN input for next bill
      setTimeout(() => {
        if (panInputRef.current) {
          panInputRef.current.focus();
        }
      }, 100);
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setCustomer({ name: '', address: '', contact: '', pan: '' });
    setItems([{ id: Date.now(), particular: '', qty: '', unit: 'Pcs', rate: 0, amount: 0 }]);
  };

  return (
    <div className={`animate-fade-in ${styles.container}`}>
      <div className={styles.header}>
        <div className={styles.toggleGroup}>
          <button 
            className={`${styles.toggleBtn} ${type === 'Sale' ? styles.active : ''}`}
            onClick={() => setType('Sale')}
          >
            Sale
          </button>
          <button 
            className={`${styles.toggleBtn} ${type === 'Purchase' ? styles.active : ''}`}
            onClick={() => setType('Purchase')}
          >
            Purchase
          </button>
        </div>
      </div>

      <div className={`${styles.card} glass-panel`}>
        <div className={styles.formGrid}>
          <div className="form-group">
            <label className="form-label">Bill No *</label>
            <input 
              type="text" 
              name="billNo"
              className="input-field" 
              value={billNo} 
              onChange={(e) => setBillNo(e.target.value)} 
            />
          </div>
          <div className="form-group">
            <label className="form-label">Date (BS) *</label>
            <NepaliDatePicker 
              value={date} 
              onChange={setDate} 
              required 
            />
          </div>
          <div className="form-group">
            <label className="form-label">PAN/VAT No. *</label>
            <input 
              ref={panInputRef}
              type="text" 
              className="input-field" 
              name="pan"
              value={customer.pan}
              onChange={handleCustomerChange}
              onBlur={() => {
                if (customer.pan && customer.pan.length < 9) {
                  addToast("PAN/VAT No. must be exactly 9 digits.", "error");
                }
              }}
              placeholder="9 digits"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Customer Name *</label>
            <input 
              type="text" 
              className="input-field" 
              name="name"
              value={customer.name}
              onChange={handleCustomerChange}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Address *</label>
            <input 
              type="text" 
              className="input-field" 
              name="address"
              value={customer.address}
              onChange={handleCustomerChange}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Contact Number</label>
            <input 
              type="text" 
              className="input-field" 
              name="contact"
              value={customer.contact}
              onChange={handleCustomerChange}
              placeholder="10 digits max"
            />
          </div>
        </div>
      </div>

      <div className={`${styles.card} glass-panel`}>
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
                        type="text" 
                        className="input-field" 
                        value={item.particular}
                        onChange={(e) => handleStockSearchChange(index, e.target.value)}
                        onFocus={() => handleStockInputFocus(index, item.particular)}
                        onBlur={handleStockInputBlur}
                        onKeyDown={(e) => handleStockKeyDown(e, index)}
                        placeholder="Type to search..."
                        autoFocus={index > 0 && index === items.length - 1}
                      />
                      
                      {activeItemIndex === index && filteredStocks.length > 0 && (
                        <ul className={styles.autocompleteDropdown}>
                          {filteredStocks.map((stock, idx) => (
                            <li 
                              key={stock.id}
                              className={`${styles.autocompleteItem} ${highlightedOptionIndex === idx ? styles.autocompleteItemActive : ''}`}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                selectStock(index, stock);
                              }}
                              onMouseEnter={() => setHighlightedOptionIndex(idx)}
                            >
                              <div className={styles.autocompleteItemName}>{stock.particularName}</div>
                              <div className={styles.autocompleteItemDetails}>
                                <span>Rs. {stock.price}</span>
                                <span>{type === 'Sale' ? getAvailableStock(stock.particularName, item.id) : stock.currentStock} {stock.defaultUnit} left</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </td>
                  <td>
                    <input 
                      id={`qty-${index}`}
                      type="number" 
                      className="input-field" 
                      value={item.qty}
                      onChange={(e) => updateItem(item.id, 'qty', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Tab' && !e.shiftKey && index === items.length - 1) {
                          if (item.particular && item.qty > 0 && item.rate > 0) {
                            e.preventDefault();
                            addItem();
                          }
                        }
                      }}
                      min="1"
                    />
                  </td>
                  <td>
                    <select 
                      className="input-field"
                      value={item.unit}
                      onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                      tabIndex="-1"
                    >
                      {(settings?.units || ['Pcs', 'Kg', 'Ltr', 'Mtr']).map(unit => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input 
                      id={`rate-${index}`}
                      type="number" 
                      className="input-field" 
                      value={item.rate}
                      onChange={(e) => updateItem(item.id, 'rate', Number(e.target.value))}
                      step="0.01"
                      min="0"
                      tabIndex="-1"
                    />
                  </td>
                  <td>
                    <input type="text" className="input-field" value={item.amount.toFixed(2)} disabled tabIndex="-1" />
                  </td>
                  <td>
                    <button className={styles.iconBtn} onClick={() => removeItem(item.id)} tabIndex="-1" title="Remove Item">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className={styles.addBtnContainer}>
          <button className="btn-secondary" onClick={addItem}>
            <Plus size={18} /> Add Item
          </button>
        </div>

        <div className={styles.totalsContainer}>
          <div className={styles.totalRow}>
            <span>Total:</span>
            <span>Rs. {totalAmount.toFixed(2)}</span>
          </div>
          <div className={styles.totalRow}>
            <span>TAX/VAT ({vatPercent}%):</span>
            <span>Rs. {vatAmount.toFixed(2)}</span>
          </div>
          <div className={`${styles.totalRow} ${styles.grandTotal}`}>
            <span>Total Amount with Tax:</span>
            <span>Rs. {grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <button className="btn-secondary" onClick={handleReset}>
          <RefreshCw size={18} /> Reset
        </button>
        <button 
          className="btn-primary" 
          onClick={handleSave}
          disabled={loading || items.length === 0 || customer.pan.length !== 9}
        >
          <Save size={18} /> {loading ? 'Saving...' : 'Save Bill'}
        </button>
      </div>
    </div>
  );
};

export default VATBill;
