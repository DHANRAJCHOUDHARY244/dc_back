export type CrmMetadataField = {
  id: string;
  key: string;
  label: string;
  value: string;
  type: "text" | "url" | "email" | "phone" | "textarea";
  sort_order: number;
  visible: boolean;
};
