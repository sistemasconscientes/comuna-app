import mongoose, { Schema } from 'mongoose';

export interface IStock {
  notionId: string;
  bottleOpenedAt: Date;
  totalPills: number;
  pillsPerDay: number;
  restockFlagged: boolean;
  updatedAt: Date;
}

const stockSchema = new Schema<IStock>(
  {
    notionId: { type: String, required: true, unique: true },
    bottleOpenedAt: { type: Date, required: true },
    totalPills: { type: Number, required: true, min: 0 },
    pillsPerDay: { type: Number, required: true, min: 0 },
    restockFlagged: { type: Boolean, required: true },
    updatedAt: { type: Date, required: true },
  },
  { collection: 'stocks' }
);

export const Stock = mongoose.model<IStock>('Stock', stockSchema);
