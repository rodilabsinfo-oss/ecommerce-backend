/**
 * All money is stored as whole paisa (Int) to avoid floating point errors.
 * Rs 1,250.50 is stored as 125050.
 */
export const toPaisa = (rupees: number) => Math.round(rupees * 100);
export const toRupees = (paisa: number) => paisa / 100;
