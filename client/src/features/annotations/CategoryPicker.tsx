import type { CSSProperties } from 'react';
import type { Category } from './types';

type CategoryPickerProps = {
  categories: Category[];
  selectedCategoryId: number | null;
  onSelect: (categoryId: number) => void;
};

export function CategoryPicker({ categories, selectedCategoryId, onSelect }: CategoryPickerProps) {
  if (categories.length === 0) {
    return <p className="category-picker__empty">Cargando categorías…</p>;
  }

  return (
    <div className="category-picker">
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          className="category-picker__item"
          data-selected={category.id === selectedCategoryId}
          style={{ '--category-color': category.color } as CSSProperties}
          onClick={() => onSelect(category.id)}
        >
          <span className="category-picker__swatch" />
          {category.name}
        </button>
      ))}
    </div>
  );
}
