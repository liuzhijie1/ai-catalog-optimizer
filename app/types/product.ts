export type ProductListItem = {
  id: string;
  title: string;
  handle: string;
  status: "ACTIVE" | "ARCHIVED" | "DRAFT";
  description: string;
  productType: string;
  tags: string[];
  updatedAt: string;
  imageUrl: string | null;
  imageAlt: string | null;
};
