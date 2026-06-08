"use client";

import { motion } from "framer-motion";
import type { Product } from "@/types";

interface ProductCardProps {
  product: Product;
  onAdd: (product: Product) => void;
  index?: number;
}

export function ProductCard({ product, onAdd, index = 0 }: ProductCardProps) {
  const hasImage = product.image && product.image.startsWith("http");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.08, duration: 0.3, ease: "easeOut" }}
      className="product-card"
    >
      <div className="product-img-wrap">
        {hasImage ? (
          <img
            src={product.image}
            alt={product.name}
            className="product-img"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
            }}
          />
        ) : null}
        <div className={`product-img-fallback ${hasImage ? "hidden" : ""}`}>
          🛍️
        </div>
      </div>

      <div className="product-body">
        <p className="product-name">{product.name}</p>
        {product.desc && (
          <p className="product-desc">{product.desc}</p>
        )}
        <p className="product-price">
          Rs. {product.price.toLocaleString()}
        </p>
      </div>

      <button
        onClick={() => onAdd(product)}
        className="add-btn"
        aria-label={`Add ${product.name} to cart`}
      >
        + Add to cart
      </button>

      <style>{`
        .product-card {
          flex-shrink: 0;
          width: 130px;
          background: #161616;
          border-radius: 14px;
          overflow: hidden;
          border: 0.5px solid #2a2a2a;
          display: flex;
          flex-direction: column;
          transition: border-color 0.2s, transform 0.15s;
          cursor: pointer;
        }
        .product-card:hover {
          border-color: #ff6b3560;
          transform: translateY(-2px);
        }
        .product-img-wrap {
          width: 100%;
          height: 85px;
          position: relative;
          overflow: hidden;
          background: #1e1e1e;
        }
        .product-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .product-img-fallback {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          background: #1a1a1a;
        }
        .product-img-fallback.hidden {
          display: none;
        }
        .product-body {
          padding: 8px 10px 6px;
          flex: 1;
        }
        .product-name {
          color: #d4d4d4;
          font-size: 11.5px;
          font-weight: 500;
          line-height: 1.35;
          margin-bottom: 3px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          font-family: 'DM Sans', sans-serif;
        }
        .product-desc {
          color: #666;
          font-size: 10px;
          line-height: 1.3;
          margin-bottom: 4px;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
          font-family: 'DM Sans', sans-serif;
        }
        .product-price {
          color: #ff9500;
          font-size: 12px;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
        }
        .add-btn {
          width: 100%;
          background: transparent;
          border: none;
          border-top: 0.5px solid #2a2a2a;
          color: #ff6b35;
          font-size: 11px;
          font-family: 'DM Sans', sans-serif;
          font-weight: 500;
          padding: 7px 0;
          cursor: pointer;
          letter-spacing: 0.03em;
          transition: background 0.15s, color 0.15s;
        }
        .add-btn:hover {
          background: #ff6b3515;
        }
        .add-btn:active {
          background: #ff6b3525;
        }
      `}</style>
    </motion.div>
  );
}

export function ProductCarousel({
  products,
  onAdd,
}: {
  products: Product[];
  onAdd: (p: Product) => void;
}) {
  return (
    <div className="carousel-wrap">
      <div className="carousel-inner">
        {products.map((p, i) => (
          <ProductCard key={p.id} product={p} onAdd={onAdd} index={i} />
        ))}
      </div>
      <style>{`
        .carousel-wrap {
          width: 100%;
          overflow: hidden;
          margin: 6px 0 2px;
        }
        .carousel-inner {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 4px 2px 8px;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .carousel-inner::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
