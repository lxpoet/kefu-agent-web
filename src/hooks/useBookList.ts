import { useState, useCallback } from 'react';
import { BookRecommendItem } from '../types';

const STORAGE_KEY = 'book_list';

function loadBookList(): BookRecommendItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveBookList(items: BookRecommendItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function useBookList() {
  const [items, setItems] = useState<BookRecommendItem[]>(loadBookList);

  const addBook = useCallback((book: BookRecommendItem) => {
    setItems(prev => {
      if (prev.some(b => b.book_id === book.book_id)) return prev;
      const next = [...prev, book];
      saveBookList(next);
      return next;
    });
  }, []);

  const removeBook = useCallback((bookId: string) => {
    setItems(prev => {
      const next = prev.filter(b => b.book_id !== bookId);
      saveBookList(next);
      return next;
    });
  }, []);

  const hasBook = useCallback((bookId: string) => {
    return items.some(b => b.book_id === bookId);
  }, [items]);

  const clearList = useCallback(() => {
    setItems([]);
    saveBookList([]);
  }, []);

  return { items, addBook, removeBook, hasBook, clearList };
}
