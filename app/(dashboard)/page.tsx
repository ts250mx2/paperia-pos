'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Search, Trash2, Plus, Minus, X, CreditCard, Banknote, ArrowRightLeft, AlertCircle, AlertTriangle } from 'lucide-react';
import ProductCard from '@/components/POS/ProductCard';
import styles     from './pos.module.css';
import cartStyles from '@/components/POS/Cart.module.css';

interface Product {
  IdProducto: number;
  Producto: string;
  Precio1: number;
  Precio2: number;
  Precio3: number;
  Multiple: number;
  IdCategoria: number;
  Categoria?: string;
  ArchivoImagen?: string | null;
}

interface Category {
  IdCategoria: number;
  Categoria: string;
}

interface CartItem {
  cartId: string;
  productId: number;
  name: string;
  price: number;
  quantity: number;
  typePrice: number;
  image?: string | null;
  sizeLabel?: string;
  discount: number;   // descuento en $ para toda la línea
}

interface PaymentState {
  efectivo: string;
  tarjeta: string;
  transferencia: string;
}

export default function POSPage() {
  const [products, setProducts]               = useState<Product[]>([]);
  const [categories, setCategories]           = useState<Category[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchTerm, setSearchTerm]           = useState('');
  const [carts, setCarts]                       = useState<CartItem[][]>([[], [], []]);
  const [activeCartIdx, setActiveCartIdx]     = useState(0);
  const cart = carts[activeCartIdx];
  const [loading, setLoading]                 = useState(true);

  const [priceModal, setPriceModal]     = useState<{ product: Product } | null>(null);
  const [paymentModal, setPaymentModal] = useState(false);
  const [payment, setPayment]           = useState<PaymentState>({ efectivo: '', tarjeta: '', transferencia: '' });
  const [processing, setProcessing]     = useState(false);
  const [cashError, setCashError]       = useState('');
  const [openSession, setOpenSession]   = useState<{ IdApertura: number } | null>(null);
  const [cliente, setCliente]           = useState('');
  const [globalDiscount, setGlobalDiscount] = useState('');
  const [ticketConfig, setTicketConfig] = useState<any>(null);
  const [cotizacionModal, setCotizacionModal] = useState(false);
  const [cotCliente, setCotCliente]     = useState('');
  const [cotNotas, setCotNotas]         = useState('');
  const [savingCot, setSavingCot]       = useState(false);
  const [cotError, setCotError]         = useState('');
  const router = useRouter();

  useEffect(() => { fetchData(); checkSession(); }, []);

  // Re-check session when window regains focus
  useEffect(() => {
    const onFocus = () => checkSession();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  useEffect(() => {
    let result = products;
    if (selectedCategory) result = result.filter(p => p.IdCategoria === selectedCategory);
    if (searchTerm)       result = result.filter(p => p.Producto.toLowerCase().includes(searchTerm.toLowerCase()));
    setFilteredProducts(result);
  }, [selectedCategory, searchTerm, products]);

  const fetchData = async () => {
    try {
      const [res, configRes]  = await Promise.all([
        fetch('/api/products'),
        fetch('/api/config/ticket')
      ]);
      const data = await res.json();
      const configData = await configRes.json();
      setProducts(data.products);
      setCategories(data.categories);
      setTicketConfig(configData);
      setLoading(false);
    } catch (err) { console.error('POS fetchData error:', err); }
  };

  const checkSession = async () => {
    try {
      const res  = await fetch('/api/cash/status');
      const data = await res.json();
      const session = data.isOpen ? data.session : null;
      setOpenSession(session);
      return session;
    } catch { return null; }
  };

  /* ── Cart / discount math ── */
  const lineGross = (item: CartItem) => item.price * item.quantity;
  const lineNet = (item: CartItem) => Math.max(0, lineGross(item) - (item.discount || 0));

  const subtotal           = cart.reduce((acc, item) => acc + lineGross(item), 0);
  const descuentoProductos = cart.reduce((acc, item) => acc + Math.min(item.discount || 0, lineGross(item)), 0);
  const descuentoGlobal    = Math.min(parseFloat(globalDiscount) || 0, Math.max(0, subtotal - descuentoProductos));
  const descuentoTotal     = descuentoProductos + descuentoGlobal;
  const total              = Math.max(0, subtotal - descuentoTotal);

  const pEfectivo      = parseFloat(payment.efectivo)      || 0;
  const pTarjeta       = parseFloat(payment.tarjeta)       || 0;
  const pTransferencia = parseFloat(payment.transferencia) || 0;
  const totalPagado    = pEfectivo + pTarjeta + pTransferencia;
  const cambio         = Math.max(0, pEfectivo - (total - pTarjeta - pTransferencia));
  const faltante       = Math.max(0, total - totalPagado);
  const canPay         = totalPagado >= total - 0.001 && cart.length > 0;

  /* ── Validation for card/transfer (cannot exceed total) ── */
  const validatePayment = (field: keyof PaymentState, value: string) => {
    const num = parseFloat(value) || 0;
    if ((field === 'tarjeta' || field === 'transferencia')) {
      const other = field === 'tarjeta' ? pTransferencia : pTarjeta;
      if (num + other > total) return; // silently cap
    }
    setPayment(prev => ({ ...prev, [field]: value }));
  };

  /* ── Open payment modal ── */
  const openPaymentModal = async () => {
    const session = await checkSession();
    if (!session) { alert('No hay caja abierta. Ve a Caja y abre el turno primero.'); return; }
    setPayment({ efectivo: total.toFixed(2), tarjeta: '', transferencia: '' });
    setCliente('');
    setCashError('');
    setPaymentModal(true);
  };

  /* ── Cart helpers ── */
  const handleProductSelect = (product: Product) => {
    const hasMultiple = (product.Precio2 > 0) || (product.Precio3 > 0);
    if (hasMultiple) setPriceModal({ product });
    else             addToCart(product, product.Precio1, 1);
  };

  const addToCart = (product: Product, price: number, typePrice: number) => {
    const cartId   = `${product.IdProducto}-${typePrice}`;
    const existing = cart.find(i => i.cartId === cartId);
    if (existing) {
      updateQuantity(cartId, existing.quantity + 1);
    } else {
      const newItem: CartItem = {
        cartId, productId: product.IdProducto,
        name: product.Producto, price, quantity: 1,
        typePrice, image: product.ArchivoImagen || null,
        discount: 0,
        sizeLabel: (product.Precio2 > 0 || product.Precio3 > 0) ? `Precio ${typePrice}` : '',
      };
      setCarts(prev => {
        const next = [...prev];
        next[activeCartIdx] = [...next[activeCartIdx], newItem];
        return next;
      });
    }
    setPriceModal(null);
  };

  const updateQuantity = async (cartId: string, qty: number) => {
    if (qty <= 0) {
      const item = cart.find(i => i.cartId === cartId);
      if (item) {
        fetch('/api/alerts/log', {
          method: 'POST',
          body: JSON.stringify({ 
            message: `PRODUCTO ELIMINADO: ${item.name} del carrito`,
            idApertura: openSession?.IdApertura || 0,
            isRed: 1
          })
        });
      }
    }
    setCarts(prev => {
      const next = [...prev];
      const currentCart = next[activeCartIdx];
      if (qty <= 0) {
        next[activeCartIdx] = currentCart.filter(i => i.cartId !== cartId);
      } else {
        next[activeCartIdx] = currentCart.map(i => i.cartId === cartId ? { ...i, quantity: qty } : i);
      }
      return next;
    });
  };

  // Fija la cantidad directamente (input editable en el pedido). Mínimo 1;
  // para quitar el producto se usa el botón menos o el bote de basura.
  const setQuantityDirect = (cartId: string, value: string) => {
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 1) return;
    setCarts(prev => {
      const next = [...prev];
      next[activeCartIdx] = next[activeCartIdx].map(i => i.cartId === cartId ? { ...i, quantity: n } : i);
      return next;
    });
  };

  const updateDiscount = (cartId: string, value: string) => {
    const raw = parseFloat(value) || 0;
    setCarts(prev => {
      const next = [...prev];
      next[activeCartIdx] = next[activeCartIdx].map(i => {
        if (i.cartId !== cartId) return i;
        const gross = i.price * i.quantity;
        return { ...i, discount: Math.max(0, Math.min(raw, gross)) };
      });
      return next;
    });
  };

  /* ── Process sale ── */
  const processSale = async () => {
    if (!openSession) { alert('No hay caja abierta.'); return; }
    if (!canPay)      { setCashError('El monto pagado no cubre el total.'); return; }
    if (pTarjeta > total)       { setCashError('Tarjeta no puede ser mayor al total.'); return; }
    if (pTransferencia > total) { setCashError('Transferencia no puede ser mayor al total.'); return; }
    if (pTarjeta + pTransferencia > total) { setCashError('Tarjeta + Transferencia no puede exceder el total.'); return; }
    if (ticketConfig?.RequireCustomerName && !cliente.trim()) { setCashError('El nombre del cliente es obligatorio.'); return; }

    setProcessing(true);
    setCashError('');

    // Pre-open the ticket window to avoid popup blockers after the async fetch
    const ticketWin = window.open('about:blank', 'TicketPrint', 'width=420,height=650');

    try {
      const res  = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart, total,
          idApertura: openSession.IdApertura,
          efectivo:      pEfectivo,
          tarjeta:       pTarjeta,
          transferencia: pTransferencia,
          cliente,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPaymentModal(false);
        setCarts(prev => {
          const next = [...prev];
          next[activeCartIdx] = [];
          return next;
        });

        if (ticketWin) {
          ticketWin.location.href = `/print/ticket/${data.idVenta}`;
        }
      } else {
        if (ticketWin) ticketWin.close();
        setCashError(data.message || 'Error al procesar la venta');
      }
    } catch {
      if (ticketWin) ticketWin.close();
      setCashError('Error de conexión');
    }
    finally   { setProcessing(false); }
  };

  /* ── Guardar cotización (no requiere caja abierta) ── */
  const openCotizacionModal = () => {
    if (cart.length === 0) return;
    setCotCliente('');
    setCotNotas('');
    setCotError('');
    setCotizacionModal(true);
  };

  const saveCotizacion = async () => {
    if (cart.length === 0) return;
    setSavingCot(true);
    setCotError('');

    // Pre-abrir la ventana para evitar el bloqueo de popups tras el fetch
    const pdfWin = window.open('about:blank', 'CotizacionPDF', 'width=820,height=920');

    try {
      const res = await fetch('/api/cotizaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cart, cliente: cotCliente, notas: cotNotas, descuentoGlobal }),
      });
      const data = await res.json();
      if (res.ok) {
        setCotizacionModal(false);
        setGlobalDiscount('');
        setCarts(prev => {
          const next = [...prev];
          next[activeCartIdx] = [];
          return next;
        });
        if (pdfWin) pdfWin.location.href = `/print/cotizacion/${data.id}`;
      } else {
        if (pdfWin) pdfWin.close();
        setCotError(data.message || 'Error al guardar la cotización');
      }
    } catch {
      if (pdfWin) pdfWin.close();
      setCotError('Error de conexión');
    } finally {
      setSavingCot(false);
    }
  };

  if (loading) return <div className="flex-center" style={{ height: '100%' }}>Cargando...</div>;

  const ItemThumb = ({ item }: { item: CartItem }) =>
    item.image ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={item.image} alt={item.name} className={cartStyles.itemThumb} />
    ) : (
      <div className={cartStyles.itemThumbEmpty}>{item.name.charAt(0)}</div>
    );

  return (
    <div className={styles.posContainer}>
      {/* ── Products panel ── */}
      <div className={styles.mainContent}>
        <header className={styles.header}>
          <div className={styles.searchBar}>
            <Search size={18} className={styles.searchIcon} />
            <input type="text" placeholder="Buscar producto..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <div className={styles.categories}>
            <button className={`${styles.catBtn} ${selectedCategory === null ? styles.activeCat : ''}`}
              onClick={() => setSelectedCategory(null)}>Todos</button>
            {categories.map(cat => (
              <button key={cat.IdCategoria}
                className={`${styles.catBtn} ${selectedCategory === cat.IdCategoria ? styles.activeCat : ''}`}
                onClick={() => setSelectedCategory(cat.IdCategoria)}>{cat.Categoria}</button>
            ))}
          </div>
        </header>

        {!openSession && (
          <div className={`${styles.sessionWarning} animate-fade`} onClick={() => router.push('/cash')}>
            <AlertTriangle size={20} />
            <div>
              <strong>No hay apertura de caja activa</strong>
              <p>Haz clic aquí para ir a Control de Caja e iniciar una nueva apertura.</p>
            </div>
          </div>
        )}

        <div className="grid-responsive" style={{ marginTop: '1.5rem', paddingBottom: '1rem' }}>
          {filteredProducts.map(p => (
            <ProductCard 
              key={p.IdProducto} 
              product={p} 
              onSelect={handleProductSelect} 
              disabled={!openSession}
            />
          ))}
        </div>
      </div>

      {/* ── Cart ── */}
      <div className={`${cartStyles.cart} glass`}>
        {/* Account Selector */}
        <div className={cartStyles.accountSelector}>
          {[0, 1, 2].map(idx => (
            <button 
              key={idx} 
              className={`${cartStyles.accountBtn} ${activeCartIdx === idx ? cartStyles.activeAccount : ''}`}
              onClick={() => setActiveCartIdx(idx)}
            >
              Cuenta {idx + 1}
              {carts[idx].length > 0 && <span className={cartStyles.badge}>{carts[idx].length}</span>}
            </button>
          ))}
        </div>

        <div className={cartStyles.header}>
          <div>
            <h2>Pedido Actual</h2>
            {openSession && (
              <div className={styles.sessionMiniBadge}>
                <div className={styles.pulseDot}></div>
                <span>No. Apertura: {openSession.IdApertura}</span>
              </div>
            )}
          </div>
          <button onClick={() => { setGlobalDiscount(''); setCarts(prev => {
            const next = [...prev];
            next[activeCartIdx] = [];
            return next;
          }); }}><Trash2 size={19} color="var(--text-muted)" /></button>
        </div>

        <div className={cartStyles.items}>
          {cart.length === 0 ? (
            <div className={cartStyles.empty}><p>Carrito vacío</p></div>
          ) : cart.map(item => (
            <div key={item.cartId} className={cartStyles.item}>
              <ItemThumb item={item} />
              <div className={cartStyles.itemDetails}>
                <p className={cartStyles.itemName}>{item.name}</p>
                <p className={cartStyles.itemMeta}>
                  ${item.price.toFixed(2)}{item.sizeLabel ? ` · ${item.sizeLabel}` : ''}
                </p>
              </div>
              <div className={cartStyles.itemControls}>
                <p className={cartStyles.itemPrice}>
                  {item.discount > 0 && (
                    <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.78em', marginRight: 6 }}>
                      ${lineGross(item).toFixed(2)}
                    </span>
                  )}
                  ${lineNet(item).toFixed(2)}
                </p>
                <div className={cartStyles.quantity}>
                  <button className={cartStyles.qtyBtn} onClick={() => updateQuantity(item.cartId, item.quantity - 1)}><Minus size={15} /></button>
                  <input
                    type="number" min="1" step="1"
                    value={item.quantity}
                    onChange={e => setQuantityDirect(item.cartId, e.target.value)}
                    style={{ width: 46, padding: '2px 4px', fontSize: '0.9rem', textAlign: 'center', fontWeight: 700 }}
                    aria-label="Cantidad"
                  />
                  <button className={cartStyles.qtyBtn} onClick={() => updateQuantity(item.cartId, item.quantity + 1)}><Plus size={15} /></button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Desc $</span>
                  <input
                    type="number" min="0" step="0.01"
                    value={item.discount ? String(item.discount) : ''}
                    placeholder="0"
                    onChange={e => updateDiscount(item.cartId, e.target.value)}
                    style={{ width: 66, padding: '4px 6px', fontSize: '0.8rem', textAlign: 'right' }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className={cartStyles.footer}>
          <div className={cartStyles.summaryRow}>
            <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
          </div>
          {descuentoProductos > 0 && (
            <div className={cartStyles.summaryRow}>
              <span>Descuento productos</span><span>–${descuentoProductos.toFixed(2)}</span>
            </div>
          )}
          <div className={cartStyles.summaryRow} style={{ alignItems: 'center' }}>
            <span>Descuento total (extra)</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              $
              <input
                type="number" min="0" step="0.01"
                value={globalDiscount}
                placeholder="0.00"
                onChange={e => setGlobalDiscount(e.target.value)}
                disabled={cart.length === 0}
                style={{ width: 90, padding: '5px 8px', fontSize: '0.85rem', textAlign: 'right' }}
              />
            </span>
          </div>
          <div className={`${cartStyles.summaryRow} ${cartStyles.totalRow}`}>
            <span>Total</span><span>${total.toFixed(2)}</span>
          </div>
          <button
            className={cartStyles.checkoutBtn}
            disabled
            title="Temporalmente deshabilitado"
            style={{ opacity: 0.45, cursor: 'not-allowed' }}
          >
            Pagar Ahora
          </button>
          <button
            className={cartStyles.checkoutBtn}
            disabled={cart.length === 0}
            onClick={openCotizacionModal}
            style={{ marginTop: '0.6rem', background: 'linear-gradient(135deg, var(--cyan) 0%, var(--cyan-deep) 100%)' }}
          >
            Guardar Cotización
          </button>
        </div>
      </div>

      {/* ── Price modal ── */}
      {priceModal && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} glass animate-scale`}>
            {priceModal.product.ArchivoImagen && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={priceModal.product.ArchivoImagen} alt={priceModal.product.Producto} className={styles.modalProductImg} />
            )}
            <h3>Seleccionar Precio</h3>
            <p className={styles.modalSubtitle}>{priceModal.product.Producto}</p>
            <div className={styles.priceOptions}>
              {/* Precio 1 */}
              <button onClick={() => addToCart(priceModal.product, priceModal.product.Precio1, 1)}>
                <span>Precio 1</span><strong>${priceModal.product.Precio1.toFixed(2)}</strong>
              </button>

              {/* Precio 2 */}
              {priceModal.product.Precio2 > 0 && (
                <button onClick={() => addToCart(priceModal.product, priceModal.product.Precio2, 2)}>
                  <span>Precio 2</span>
                  <strong>${priceModal.product.Precio2.toFixed(2)}</strong>
                </button>
              )}

              {/* Precio 3 */}
              {priceModal.product.Precio3 > 0 && (
                <button onClick={() => addToCart(priceModal.product, priceModal.product.Precio3, 3)}>
                  <span>Precio 3</span><strong>${priceModal.product.Precio3.toFixed(2)}</strong>
                </button>
              )}
            </div>
            <button className={styles.closeBtn} onClick={() => setPriceModal(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* ── Payment modal ── */}
      {paymentModal && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.payModal} glass animate-scale`}>
            <div className={styles.payModalHead}>
              <h3>Cobrar Venta</h3>
              <button onClick={() => setPaymentModal(false)} disabled={processing}><X size={20} /></button>
            </div>

            <div className={styles.payTotal}>
              <span>Total a cobrar</span>
              <strong>${total.toFixed(2)}</strong>
            </div>

            <div className={styles.payModalContent}>
              <div className={styles.payFields}>
                {/* Cash */}
                <div className={styles.payField}>
                  <label><Banknote size={16} /> Efectivo</label>
                  <input
                    type="number" step="0.01" min="0"
                    placeholder="0.00"
                    value={payment.efectivo}
                    onChange={e => setPayment(p => ({ ...p, efectivo: e.target.value }))}
                  />
                  {pEfectivo > 0 && (
                    <span className={styles.cambio}>
                      Cambio: ${Math.max(0, pEfectivo - Math.max(0, total - pTarjeta - pTransferencia)).toFixed(2)}
                    </span>
                  )}
                </div>

                {/* Card */}
                <div className={styles.payField}>
                  <label><CreditCard size={16} /> Tarjeta</label>
                  <input
                    type="number" step="0.01" min="0"
                    placeholder="0.00"
                    value={payment.tarjeta}
                    onChange={e => validatePayment('tarjeta', e.target.value)}
                  />
                  <span className={styles.payHint}>Máx: ${Math.max(0, total - pTransferencia).toFixed(2)}</span>
                </div>

                {/* Transfer */}
                <div className={styles.payField}>
                  <label><ArrowRightLeft size={16} /> Transferencia</label>
                  <input
                    type="number" step="0.01" min="0"
                    placeholder="0.00"
                    value={payment.transferencia}
                    onChange={e => validatePayment('transferencia', e.target.value)}
                  />
                  <span className={styles.payHint}>Máx: ${Math.max(0, total - pTarjeta).toFixed(2)}</span>
                </div>
              </div>

              <div className={styles.payOptions}>
                {/* Customer Name */}
                <div className={styles.payField}>
                  <label>Nombre del Cliente (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Nombre..."
                    value={cliente}
                    onChange={e => setCliente(e.target.value)}
                    autoComplete="off"
                  />
                </div>

                {/* Summary (Inside right col) */}
                <div className={styles.paySummary} style={{ marginTop: '1.5rem' }}>
                  <div className={styles.payRow}>
                    <span>Total pagado</span>
                    <span className={totalPagado >= total ? styles.payOk : styles.payShort}>
                      ${totalPagado.toFixed(2)}
                    </span>
                  </div>
                  {faltante > 0.01 && (
                    <div className={`${styles.payRow} ${styles.payAlert}`}>
                      <span>Faltante</span>
                      <span>–${faltante.toFixed(2)}</span>
                    </div>
                  )}
                  {cambio > 0.01 && (
                    <div className={`${styles.payRow} ${styles.payChange}`}>
                      <span>Cambio</span>
                      <span>${cambio.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {cashError && (
              <div className={styles.payError}>
                <AlertCircle size={15} /> {cashError}
              </div>
            )}

            <button
              className={styles.payConfirmBtn}
              disabled={!canPay || processing}
              onClick={processSale}
            >
              {processing ? 'Procesando...' : `Confirmar Pago — $${total.toFixed(2)}`}
            </button>
          </div>
        </div>
      )}

      {/* ── Cotización modal ── */}
      {cotizacionModal && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.payModal} glass animate-scale`} style={{ maxWidth: '520px' }}>
            <div className={styles.payModalHead}>
              <h3>Guardar Cotización</h3>
              <button onClick={() => setCotizacionModal(false)} disabled={savingCot}><X size={20} /></button>
            </div>

            <div className={styles.payTotal}>
              <span>Total cotizado</span>
              <strong>${total.toFixed(2)}</strong>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className={styles.payField}>
                <label>Nombre del Cliente (Opcional)</label>
                <input
                  type="text"
                  placeholder="Nombre del cliente..."
                  value={cotCliente}
                  onChange={e => setCotCliente(e.target.value)}
                  autoComplete="off"
                  autoFocus
                />
              </div>
              <div className={styles.payField}>
                <label>Notas / Observaciones (Opcional)</label>
                <textarea
                  placeholder="Vigencia, condiciones de entrega, etc."
                  value={cotNotas}
                  onChange={e => setCotNotas(e.target.value)}
                  rows={3}
                  style={{ resize: 'vertical', minHeight: '80px' }}
                />
              </div>
            </div>

            {cotError && (
              <div className={styles.payError}>
                <AlertCircle size={15} /> {cotError}
              </div>
            )}

            <button
              className={styles.payConfirmBtn}
              disabled={savingCot || cart.length === 0}
              onClick={saveCotizacion}
            >
              {savingCot ? 'Guardando...' : 'Guardar y Generar PDF'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
