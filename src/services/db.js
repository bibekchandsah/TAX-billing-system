import { db } from '../firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit 
} from 'firebase/firestore';

// Helper to get user subcollection reference under VAT_PAN to avoid collision
const getRef = (userId, collectionName) => collection(db, 'users', userId, 'VAT_PAN', 'data', collectionName);

// Settings
export const getSettings = async (userId) => {
  const docRef = doc(db, 'users', userId, 'VAT_PAN', 'data', 'settings', 'profile');
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
};

export const updateSettings = async (userId, data) => {
  const docRef = doc(db, 'users', userId, 'VAT_PAN', 'data', 'settings', 'profile');
  await setDoc(docRef, data, { merge: true });
};

// Customers
export const getCustomers = async (userId) => {
  const q = query(getRef(userId, 'ledger'), orderBy('customerName'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getCustomerByPan = async (userId, pan) => {
  const q = query(getRef(userId, 'ledger'), where('panVatNo', '==', pan), limit(1));
  const snapshot = await getDocs(q);
  return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
};

export const addCustomer = async (userId, customerData) => {
  const docRef = await addDoc(getRef(userId, 'ledger'), customerData);
  return { id: docRef.id, ...customerData };
};

export const updateCustomer = async (userId, customerId, data) => {
  const docRef = doc(db, 'users', userId, 'VAT_PAN', 'data', 'ledger', customerId);
  await updateDoc(docRef, data);
};

// Stock
export const getStocks = async (userId) => {
  const q = query(getRef(userId, 'stock'), orderBy('particularName'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const addStock = async (userId, stockData) => {
  const docRef = await addDoc(getRef(userId, 'stock'), stockData);
  return { id: docRef.id, ...stockData };
};

export const updateStock = async (userId, stockId, data) => {
  const docRef = doc(db, 'users', userId, 'VAT_PAN', 'data', 'stock', stockId);
  await updateDoc(docRef, data);
};

// Records (Bills)
export const getLatestBillNumber = async (userId, type) => {
  const q = query(getRef(userId, 'records'), where('type', '==', type), orderBy('billNumber', 'desc'), limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return 1;
  return Number(snapshot.docs[0].data().billNumber) + 1;
};

export const addBill = async (userId, billData) => {
  const docRef = await addDoc(getRef(userId, 'records'), billData);
  return { id: docRef.id, ...billData };
};

export const updateBill = async (userId, billId, billData) => {
  const { updateDoc } = await import('firebase/firestore');
  const docRef = doc(db, 'users', userId, 'VAT_PAN', 'data', 'records', billId);
  await updateDoc(docRef, billData);
  return { id: billId, ...billData };
};

export const getBills = async (userId) => {
  const q = query(getRef(userId, 'records'), orderBy('timestamp', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const deleteRecord = async (userId, collectionName, docId) => {
  const { deleteDoc } = await import('firebase/firestore');
  const docRef = doc(db, 'users', userId, 'VAT_PAN', 'data', collectionName, docId);
  await deleteDoc(docRef);
};
