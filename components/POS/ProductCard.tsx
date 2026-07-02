import styles from './ProductCard.module.css';

interface Product {
  IdProducto: number;
  Producto: string;
  Precio1: number;
  Precio2: number;
  Precio3: number;
  Multiple: number;
  IdCategoria: number;
  ArchivoImagen?: string | null;
}

interface Props {
  product: Product;
  onSelect: (product: Product) => void;
  disabled?: boolean;
}

export default function ProductCard({ product, onSelect, disabled }: Props) {
  const hasMultiplePrices = (product.Precio2 && product.Precio2 > 0) || (product.Precio3 && product.Precio3 > 0);

  return (
    <button
      className={`${styles.card} glass animate-fade ${disabled ? styles.disabled : ''}`}
      onClick={() => !disabled && onSelect(product)}
      disabled={disabled}
    >
      <div className={styles.imageArea}>
        {product.ArchivoImagen ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.ArchivoImagen}
            alt={product.Producto}
            className={styles.productImg}
          />
        ) : (
          <span className={styles.initial}>{product.Producto.charAt(0)}</span>
        )}
      </div>

      <div className={styles.info}>
        <h3 className={styles.name}>{product.Producto}</h3>
        <p className={styles.price}>
          {hasMultiplePrices ? 'Desde ' : ''}${product.Precio1.toFixed(2)}
        </p>
      </div>

      {product.Multiple === 1 && <span className={styles.badge}>Extras</span>}
    </button>
  );
}
